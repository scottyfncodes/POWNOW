import type { TravelCurve } from '@/domain/conditions';
import type { AccessRoute } from '@/domain/mountain';
import {
  type Availability,
  confidenceForHorizon,
  observationForHorizon,
  ok,
  unavailable,
} from '@/domain/provenance';
import type { ProviderContext, TrafficProvider } from '@/providers/types';
import { timeZoneForPoint } from '@/lib/geo';
import { ProviderHttpError } from '@/lib/http';
import { cachedJson } from './fetchCache';

/**
 * Traffic for the ranking: one Google drive out (6:00) and one back (3:00) per
 * mountain, never a full curve.
 *
 * Ranking every mountain on full departure curves cost about 560 Google calls
 * per city per day on a budget of 190. So the ranking runs on two samples per
 * mountain, and every curve this returns says so: `sampling: 'estimate'`, one
 * sample, which the engine evaluates at exactly that departure. The full curve
 * comes from `LiveTrafficProvider` when someone opens a mountain.
 *
 * One `recommend()` asks for every mountain's curves within the same tick; this
 * gathers them into one POST /api/ranking-drives per (origin, date), which the
 * server buys whole from the ranking pool or not at all. So a ranking is never
 * half-timed: every mountain has its estimate, or none does and the reason says
 * why.
 */
export interface RankingTrafficOptions {
  /** e.g. "https://pownow-server.example.com". Empty string = same origin. */
  apiBaseUrl: string;
}

interface Drive {
  departure: number;
  durationMinutes: number;
  sampledAt: string;
}

interface RankingResponse {
  drives?: ({ outbound?: Drive | null; return?: Drive | null; distanceMiles?: number | null } | null)[];
}

interface Batch {
  destinations: { lat: number; lon: number; timeZone: string }[];
  index: Map<string, number>;
  result: Promise<{ drives: RankingResponse['drives']; fetchedAt: number }>;
}

const pointKey = (point: { lat: number; lon: number }) => `${point.lat.toFixed(4)},${point.lon.toFixed(4)}`;

export class RankingTrafficProvider implements TrafficProvider {
  readonly id = 'google-routes';
  private readonly batches = new Map<string, Batch>();

  constructor(private readonly options: RankingTrafficOptions) {}

  async getTravelCurve(
    route: AccessRoute,
    direction: 'outbound' | 'return',
    context: ProviderContext,
  ): Promise<Availability<TravelCurve>> {
    const batch = this.join(route, context);
    let drives: RankingResponse['drives'];
    let fetchedAt: number;
    try {
      ({ drives, fetchedAt } = await batch.result);
    } catch (error) {
      return unavailable(this.id, describeError(error));
    }
    const entry = drives?.[batch.index.get(pointKey(route.destinationPoint)) ?? -1];
    const drive = entry?.[direction];
    if (!drive || typeof drive.durationMinutes !== 'number' || typeof drive.departure !== 'number') {
      return unavailable(this.id, 'No drive time came back for this mountain.');
    }
    return ok(
      {
        routeId: route.id,
        routeLabel: route.label,
        corridorShorthand: '',
        distanceMiles: typeof entry?.distanceMiles === 'number' ? entry.distanceMiles : route.distanceMiles,
        direction,
        samples: [{ departure: drive.departure, durationMinutes: drive.durationMinutes, congestion: 0 }],
        roadCondition: null,
        incidents: [],
        sampling: 'estimate',
      },
      {
        source: 'live',
        observation: observationForHorizon(context.horizonDays),
        confidence: confidenceForHorizon(context.horizonDays),
        provider: this.id,
        horizonDays: context.horizonDays,
        fetchedAt: new Date(fetchedAt).toISOString(),
        validUntil: new Date(fetchedAt + 15 * 60 * 1000).toISOString(),
      },
    );
  }

  /** The batch for this origin and date, opened by the first caller in this tick and sent at the end of it. */
  private join(route: AccessRoute, context: ProviderContext): Batch {
    const key = `${pointKey(route.originPoint)}|${context.date}`;
    let batch = this.batches.get(key);
    if (!batch) {
      const destinations: Batch['destinations'] = [];
      const index = new Map<string, number>();
      const result = new Promise<void>((resolve) => setTimeout(resolve, 0)).then(async () => {
        this.batches.delete(key);
        const body = JSON.stringify({ origin: route.originPoint, date: context.date, destinations });
        const ask = () =>
          cachedJson<RankingResponse>(`${this.options.apiBaseUrl}/api/ranking-drives`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            // A cold ranking is up to about sixty Google calls on the server, which stops sending at 20 s.
            timeoutMs: 30000,
            ttlMs: 5 * 60 * 1000,
          });
        let answer;
        try {
          answer = await ask();
        } catch (error) {
          // A short Retry-After means Google was slow and the server ran out of time; what it bought is
          // cached there, so one retry costs only the rest. A long one is the daily budget: not worth waiting.
          if (!isQuickRetry(error)) throw error;
          await new Promise((resolve) => setTimeout(resolve, (error as ProviderHttpError).retryAfterSeconds! * 1000));
          answer = await ask();
        }
        return { drives: answer.value.drives, fetchedAt: answer.fetchedAt };
      });
      batch = { destinations, index, result };
      this.batches.set(key, batch);
    }
    const destinationKey = pointKey(route.destinationPoint);
    if (!batch.index.has(destinationKey)) {
      batch.index.set(destinationKey, batch.destinations.length);
      batch.destinations.push({ ...route.destinationPoint, timeZone: timeZoneForPoint(route.destinationPoint) });
    }
    return batch;
  }
}

const isQuickRetry = (error: unknown): boolean =>
  error instanceof ProviderHttpError &&
  error.status === 503 &&
  error.retryAfterSeconds !== null &&
  error.retryAfterSeconds > 0 &&
  error.retryAfterSeconds <= 10;

function describeError(error: unknown): string {
  if (isQuickRetry(error)) {
    return 'Google Routes was too slow to answer in time. Try again in a moment.';
  }
  if (error instanceof ProviderHttpError && error.status === 503) {
    return "Drive times are paused: today's Google Routes budget for rankings is spent, or could not be checked.";
  }
  if (error instanceof ProviderHttpError && error.status === 502) {
    return 'Google Routes refused the request (its quota, the key or billing).';
  }
  if (error instanceof Error) {
    if (error.name === 'ProviderTimeoutError') return 'The traffic service took too long to answer.';
    return error.message;
  }
  return 'Traffic service request failed.';
}
