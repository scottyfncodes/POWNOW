import type { TravelCurve } from '@/domain/conditions';
import type { AccessRoute, Mountain, Origin } from '@/domain/mountain';
import { type Availability, unavailable } from '@/domain/provenance';
import type { RoadStatus } from '@/domain/road';
import type { SnowpackObservation } from '@/domain/snowpack';
import type {
  Place,
  PlaceKind,
  PlacesProvider,
  ProviderContext,
  RoadConditionProvider,
  SnowpackProvider,
  TrafficProvider,
} from '@/providers/types';

/**
 * The honest alternative to a demo fallback.
 *
 * `createLiveRegistry` used to fill an unconfigured slot (no traffic server,
 * road conditions not enabled) with the matching `Demo*Provider` — plausible
 * numbers, correctly labeled `source: 'demo'`, but still a value where the
 * honest answer is "we don't have one." That is no longer how a live
 * registry degrades: every slot it can't genuinely serve reports
 * `unavailable`, the same as a live request that actually failed. This file
 * has no import from `providers/demo` — nothing under `providers/live/`
 * does — so there is no path from a live-mode registry to a demo value,
 * not even a config-time one.
 *
 * `usingDemoData` on the registry stays about *pricing/places-style*
 * static-demo slots, not about this — a slot reporting `unavailable` was
 * never "using demo data" in the first place.
 */
export class UnavailableTrafficProvider implements TrafficProvider {
  readonly id = 'traffic-unconfigured';

  async getTravelCurve(
    _route: AccessRoute,
    _direction: 'outbound' | 'return',
    _context: ProviderContext,
  ): Promise<Availability<TravelCurve>> {
    return unavailable(this.id, 'No traffic server configured (VITE_API_BASE_URL is unset).');
  }
}

export class UnavailableRoadConditionProvider implements RoadConditionProvider {
  readonly id = 'roads-disabled';

  async getCorridorStatus(_corridorId: string, _context: ProviderContext): Promise<Availability<RoadStatus>> {
    return unavailable(this.id, 'Road-condition reporting is off (VITE_ENABLE_ROAD_CONDITIONS=false or no proxy configured).');
  }
}

export class UnavailableSnowpackProvider implements SnowpackProvider {
  readonly id = 'snowpack-unconfigured';

  async getSnowpack(_mountain: Mountain, _context: ProviderContext): Promise<Availability<SnowpackObservation>> {
    return unavailable(this.id, 'No data proxy configured (VITE_API_BASE_URL is unset), so SNOTEL cannot be reached.');
  }
}

export class UnavailablePlacesProvider implements PlacesProvider {
  readonly id = 'places-unimplemented';

  async getPlaces(
    _mountain: Mountain,
    _origin: Origin,
    _kinds: PlaceKind[],
    _context: ProviderContext,
  ): Promise<Availability<Place[]>> {
    return unavailable(this.id, 'No live places source exists for this pass.');
  }
}
