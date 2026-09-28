import type { AlertSeverity, WeatherAlert } from '@/domain/alerts';
import type { Mountain } from '@/domain/mountain';
import { type Availability, ok, unavailable } from '@/domain/provenance';
import type { AlertsProvider, ProviderContext } from '@/providers/types';
import { cachedJson } from './fetchCache';

const BASE_URL = 'https://api.weather.gov/alerts/active';

interface NwsAlertFeature {
  id?: string;
  properties?: {
    event?: string;
    headline?: string;
    severity?: string;
    /** When the alert takes effect. */
    effective?: string;
    /** When the hazard begins — may be later than `effective` for an advance warning. */
    onset?: string | null;
    /** When the hazard ends. Null for some products (e.g. a statement). */
    ends?: string | null;
    /** When the *product* expires and will be reissued — not when the hazard ends. */
    expires?: string;
    areaDesc?: string;
  };
}

interface NwsAlertResponse {
  features?: NwsAlertFeature[];
}

const SEVERITY_MAP: Record<string, AlertSeverity> = {
  Extreme: 'extreme',
  Severe: 'severe',
  Moderate: 'moderate',
  Minor: 'minor',
};

export interface NwsAlertsOptions {
  baseUrl?: string;
}

/**
 * Official US weather alerts from the National Weather Service.
 *
 * Public API, no key. NWS asks integrators to send an identifying
 * `User-Agent`; browsers refuse to let `fetch` set that header, so this can
 * only honor that request when it runs somewhere other than a browser. It
 * still works without one — NWS simply prefers you don't.
 *
 * Two honesty details:
 *  - An alert is shown for a planned day only if the hazard actually
 *    overlaps that day. `alerts/active` returns everything in force *now*; a
 *    Winter Storm Warning that ends tonight has nothing to say about
 *    Saturday's plan, and an advance warning whose `onset` is Saturday has
 *    nothing to say about today's.
 *  - `ends` is when the hazard ends. `expires` is when NWS will reissue the
 *    text, which is usually sooner. The end shown to the skier is the
 *    hazard's, falling back to the product's only when NWS gave no end.
 *
 * Only meaningful for US mountains. A mountain elsewhere reports
 * `unavailable` — no source was consulted, so "no alerts" would be a claim
 * with nothing behind it.
 */
export class NwsAlertsProvider implements AlertsProvider {
  readonly id = 'nws';

  constructor(private readonly options: NwsAlertsOptions = {}) {}

  async getAlerts(mountain: Mountain, context: ProviderContext): Promise<Availability<WeatherAlert[]>> {
    if (mountain.country !== 'US') {
      return unavailable(this.id, 'NWS only covers the United States; no alert source was consulted for this mountain.');
    }

    const base = this.options.baseUrl ?? BASE_URL;
    const { lat, lon } = mountain.coordinates;
    const url = `${base}?point=${lat.toFixed(4)},${lon.toFixed(4)}`;

    let payload: NwsAlertResponse;
    let fetchedAtMs: number;
    try {
      const result = await cachedJson<NwsAlertResponse>(url, {
        timeoutMs: 6000,
        ttlMs: 5 * 60 * 1000,
        headers: { Accept: 'application/geo+json' },
      });
      payload = result.value;
      fetchedAtMs = result.fetchedAt;
    } catch (error) {
      return unavailable(this.id, error instanceof Error ? error.message : 'NWS request failed.');
    }

    if (!Array.isArray(payload.features)) {
      return unavailable(this.id, 'NWS returned an unexpected alerts payload.');
    }

    const alerts: WeatherAlert[] = payload.features.flatMap((feature) => {
      const p = feature.properties;
      if (!p?.event || !p.effective) return [];
      const ends = p.ends ?? p.expires;
      if (!ends) return [];
      const starts = p.onset ?? p.effective;
      if (!overlapsPlannedDay(starts, ends, context.date)) return [];
      return [
        {
          id: feature.id ?? `${p.event}-${p.effective}`,
          event: p.event,
          headline: p.headline ?? p.event,
          severity: SEVERITY_MAP[p.severity ?? ''] ?? 'unknown',
          effective: starts,
          expires: ends,
          areaDesc: p.areaDesc ?? '',
          source: this.id,
        },
      ];
    });

    return ok(alerts, {
      source: 'live',
      observation: 'observed',
      confidence: 'high',
      provider: this.id,
      horizonDays: context.horizonDays,
      fetchedAt: new Date(fetchedAtMs).toISOString(),
      validUntil: new Date(fetchedAtMs + 15 * 60 * 1000).toISOString(),
    });
  }
}

/**
 * Does [starts, ends] touch the planned calendar day? NWS timestamps carry
 * their own zone offset, so `Date` parses them correctly; the planned day is
 * a local `YYYY-MM-DD`, compared here as the day in the alert's own zone —
 * close enough, since the alert and the mountain share one.
 */
export function overlapsPlannedDay(starts: string, ends: string, date: string): boolean {
  const start = new Date(starts);
  const end = new Date(ends);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return true; // can't tell: keep it
  const offsetMatch = /([+-]\d{2}):(\d{2})$/.exec(starts);
  const offsetMinutes = offsetMatch
    ? Number(offsetMatch[1]) * 60 + Math.sign(Number(offsetMatch[1])) * Number(offsetMatch[2])
    : 0;
  const dayStart = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) - offsetMinutes * 60_000;
  const dayEnd = dayStart + 86_400_000;
  return start.getTime() < dayEnd && end.getTime() > dayStart;
}
