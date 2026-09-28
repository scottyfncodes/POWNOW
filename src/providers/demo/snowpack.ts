import { snotelReportUrl, snotelStationFor } from '@/data/snotelStations';
import type { Mountain } from '@/domain/mountain';
import { type Availability, ok, unavailable } from '@/domain/provenance';
import type { SnowpackObservation } from '@/domain/snowpack';
import { haversineMiles } from '@/lib/geo';
import type { ProviderContext, SnowpackProvider } from '@/providers/types';
import { mountainRng, orographicFactor, patternFor, profileFor } from './scenario';

/**
 * A demo snowpack, derived from the same deterministic storm pattern the demo
 * weather uses so the two never disagree: a mountain that just got a foot in
 * the demo world shows a depth jump at its demo station too. Labeled demo
 * like everything else here, and it borrows the *real* station registry so
 * the demo card looks exactly like the live one — same station name, same
 * distance — with a DEMO chip instead of LIVE.
 */
export class DemoSnowpackProvider implements SnowpackProvider {
  readonly id = 'demo-snowpack';

  async getSnowpack(mountain: Mountain, context: ProviderContext): Promise<Availability<SnowpackObservation>> {
    const station = snotelStationFor(mountain.id);
    if (!station) return unavailable(this.id, `No SNOTEL station recorded for ${mountain.name}.`);

    const pattern = patternFor(mountain, context.date, context.horizonDays);
    const profile = profileFor(mountain.id);
    const oro = orographicFactor(mountain, pattern);
    const rng = mountainRng(mountain, context.today, 'snowpack');

    // A settled mid-season base, scaled by how snowy this mountain is, plus
    // whatever the recent cycle added on top.
    const base = 38 * profile.snow * oro * rng.range(0.85, 1.15);
    const recent = pattern.recentSnow72hIn * profile.snow * oro;
    const overnight = pattern.overnightIn * profile.snow * oro;
    const depth = Math.round(base + recent * 0.7 + overnight * 0.85);
    const swe = Math.round(depth * rng.range(0.24, 0.32) * 10) / 10;

    return ok(
      {
        stationId: station.triplet,
        stationName: station.expectedName,
        stationElevationFt: station.elevationFt,
        distanceMiles: Math.round(haversineMiles(mountain.coordinates, station.coordinates) * 10) / 10,
        snowDepthIn: depth,
        sweIn: swe,
        packDensity: depth > 0 ? Math.round((swe / depth) * 100) / 100 : null,
        depthChange24hIn: Math.round(overnight * 0.85 * 10) / 10,
        newSnow5dIn: Math.round((recent * 0.7 + overnight * 0.85) * 10) / 10,
        observedOn: context.today,
        sourceUrl: snotelReportUrl(station.triplet),
      },
      {
        source: 'demo',
        observation: 'observed',
        confidence: 'high',
        provider: this.id,
        horizonDays: context.horizonDays,
      },
    );
  }
}
