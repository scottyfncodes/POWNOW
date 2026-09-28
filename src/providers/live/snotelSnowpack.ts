import { snotelReportUrl, snotelStationFor, stationNameMatches } from '@/data/snotelStations';
import type { Mountain } from '@/domain/mountain';
import { type Availability, ok, unavailable } from '@/domain/provenance';
import type { SnowpackObservation } from '@/domain/snowpack';
import { haversineMiles } from '@/lib/geo';
import type { ProviderContext, SnowpackProvider } from '@/providers/types';
import { cachedJson } from './fetchCache';

/** What the proxy's `/api/snotel` hands back — see `server/index.mjs`. */
interface SnotelProxyResponse {
  stationId?: string;
  stationName?: string | null;
  elevationFt?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  series?: { date?: string; snowDepthIn?: number | null; sweIn?: number | null }[];
  sourceTimestamp?: string;
}

export interface SnotelSnowpackOptions {
  /** The proxy's base URL — SNOTEL's API does not serve CORS, so the browser can't ask it directly. */
  apiBaseUrl: string;
}

/**
 * Measured snowpack from the NRCS SNOTEL network, via the proxy.
 *
 * The reading is a real sensor at a real place a few miles from the ski
 * area; the record carries the station's name, elevation and distance so it
 * is never presented as the resort's own snow stake. Depth changes over the
 * last five days are summed as a *floor* on new snow — a snowpack settles
 * as it ages, so the sum of positive daily depth changes always undercounts
 * what fell. That is stated on the record, not hidden in this comment.
 *
 * Two independent fail-safes guard the honesty of what's shown:
 *  - the station id must resolve, per NRCS's own metadata, to the name this
 *    project expects for it (`data/snotelStations.ts`); a mismatch reports
 *    unavailable with the actual name in the reason, so a wrong id is found
 *    the first time it's tried rather than shown as this mountain's depth;
 *  - the most recent reading must be recent. A SNOTEL site can go quiet for
 *    days (buried antenna, dead battery); a reading older than three days
 *    is unavailable, not "current".
 */
export class SnotelSnowpackProvider implements SnowpackProvider {
  readonly id = 'snotel';

  constructor(private readonly options: SnotelSnowpackOptions) {}

  async getSnowpack(mountain: Mountain, context: ProviderContext): Promise<Availability<SnowpackObservation>> {
    const station = snotelStationFor(mountain.id);
    if (!station) return unavailable(this.id, `No SNOTEL station recorded for ${mountain.name}.`);

    const url = `${this.options.apiBaseUrl}/api/snotel?station=${encodeURIComponent(station.triplet)}&days=8`;

    let payload: SnotelProxyResponse;
    let fetchedAt: number;
    try {
      const result = await cachedJson<SnotelProxyResponse>(url, { timeoutMs: 12000, ttlMs: 30 * 60 * 1000 });
      payload = result.value;
      fetchedAt = result.fetchedAt;
    } catch (error) {
      return unavailable(this.id, error instanceof Error ? error.message : 'SNOTEL request failed.');
    }

    if (payload.stationName && !stationNameMatches(station.expectedName, payload.stationName)) {
      return unavailable(
        this.id,
        `Station ${station.triplet} resolved to "${payload.stationName}", not "${station.expectedName}" — not shown until the registry is corrected.`,
      );
    }

    const series = (payload.series ?? [])
      .filter((point): point is { date: string; snowDepthIn: number | null; sweIn: number | null } =>
        typeof point?.date === 'string',
      )
      .map((point) => ({
        date: point.date,
        snowDepthIn: typeof point.snowDepthIn === 'number' ? point.snowDepthIn : null,
        sweIn: typeof point.sweIn === 'number' ? point.sweIn : null,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    const latest = [...series].reverse().find((point) => point.snowDepthIn !== null || point.sweIn !== null);
    if (!latest) return unavailable(this.id, 'SNOTEL returned no usable depth or water-equivalent readings.');

    // A reading from days ago is history, not the current snowpack.
    if (daysBetweenKeys(latest.date, context.today) > 3) {
      return unavailable(this.id, `The nearest SNOTEL site last reported on ${latest.date} — too old to call current.`);
    }

    const depth = latest.snowDepthIn;
    const swe = latest.sweIn;
    const previous = series.filter((point) => point.date < latest.date && point.snowDepthIn !== null);
    const yesterday = previous[previous.length - 1];
    const depthChange24hIn =
      depth !== null && yesterday?.snowDepthIn != null ? round1(depth - yesterday.snowDepthIn) : null;

    const window = series.filter((point) => point.snowDepthIn !== null).slice(-6); // 5 deltas
    let newSnow5dIn: number | null = null;
    if (window.length >= 2) {
      newSnow5dIn = 0;
      for (let i = 1; i < window.length; i += 1) {
        const delta = (window[i]!.snowDepthIn as number) - (window[i - 1]!.snowDepthIn as number);
        if (delta > 0) newSnow5dIn += delta;
      }
      newSnow5dIn = round1(newSnow5dIn);
    }

    const stationPoint =
      typeof payload.latitude === 'number' && typeof payload.longitude === 'number'
        ? { lat: payload.latitude, lon: payload.longitude }
        : station.coordinates;

    return ok(
      {
        stationId: station.triplet,
        stationName: payload.stationName ?? station.expectedName,
        stationElevationFt: typeof payload.elevationFt === 'number' ? Math.round(payload.elevationFt) : station.elevationFt,
        distanceMiles: round1(haversineMiles(mountain.coordinates, stationPoint)),
        snowDepthIn: depth,
        sweIn: swe,
        packDensity: depth !== null && swe !== null && depth > 0 ? round2(swe / depth) : null,
        depthChange24hIn,
        newSnow5dIn,
        observedOn: latest.date,
        sourceUrl: snotelReportUrl(station.triplet),
      },
      {
        source: 'live',
        observation: 'observed',
        confidence: 'high',
        provider: this.id,
        horizonDays: context.horizonDays,
        fetchedAt: new Date(fetchedAt).toISOString(),
        // SNOTEL posts hourly; the daily value this reads settles once a day.
        validUntil: new Date(fetchedAt + 3 * 60 * 60 * 1000).toISOString(),
        attribution: `NRCS SNOTEL station, not the resort's own snow stake.`,
      },
    );
  }
}

function daysBetweenKeys(from: string, to: string): number {
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

const round1 = (value: number): number => Math.round(value * 10) / 10;
const round2 = (value: number): number => Math.round(value * 100) / 100;
