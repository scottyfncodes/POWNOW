import { parkingInfoFor } from '@/data/parkingInfo';
import type { Mountain } from '@/domain/mountain';
import type { ParkingInfo } from '@/domain/parking';
import { type Availability, ok, unavailable } from '@/domain/provenance';
import type { ParkingProvider, ProviderContext } from '@/providers/types';

/**
 * Live-mode parking.
 *
 * Investigated for all thirteen resorts: none publishes a public, structured
 * live-occupancy feed (per-lot counts, percent full) — the closest any of
 * them gets is a resort-branded mobile app (Purgatory's, for one) with no
 * documented public API behind it. What every resort *does* publish is its
 * parking structure: which lots are free, whether a reservation system is in
 * effect, shuttle hours, fees. `data/parkingInfo.ts` is that — real,
 * resort-published facts, researched via web search against each resort's
 * own site (or, where the resort delegates parking to a town/authority, that
 * authority's page — e.g. Breckenridge, run by the Town of Breckenridge).
 *
 * So this provider always returns `status: 'unknown'` — never a guessed
 * "Good"/"Limited" — while still returning `ok` (not `unavailable`) for a
 * known mountain, because the rules themselves are real, current, sourced
 * data, not a failure to report. A mountain with no researched entry at all
 * reports `unavailable`, honestly, rather than an empty shell.
 */
export class LiveParkingProvider implements ParkingProvider {
  readonly id = 'live-parking';

  async getParkingInfo(mountain: Mountain, _context: ProviderContext): Promise<Availability<ParkingInfo>> {
    const info = parkingInfoFor(mountain.id);
    if (!info) {
      return unavailable(this.id, `No researched parking information for ${mountain.name} yet.`);
    }
    return ok(info, {
      source: 'live',
      observation: 'observed',
      confidence: 'medium',
      provider: this.id,
      horizonDays: 0,
      attribution: 'Resort-published parking rules, not a live occupancy feed — see notes.',
    });
  }
}
