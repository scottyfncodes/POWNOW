import { parkingInfoFor } from '@/data/parkingInfo';
import type { Mountain } from '@/domain/mountain';
import type { ParkingOccupancyStatus, ParkingInfo } from '@/domain/parking';
import { type Availability, ok, unavailable } from '@/domain/provenance';
import type { ParkingProvider, ProviderContext } from '@/providers/types';
import { mountainRng, patternFor } from './scenario';

export interface DemoParkingOptions {
  failFor?: (mountain: Mountain) => boolean;
}

const STATUS_BY_FULLNESS = (fullness: number): ParkingOccupancyStatus => {
  if (fullness >= 0.97) return 'full';
  if (fullness >= 0.85) return 'very-limited';
  if (fullness >= 0.65) return 'limited';
  if (fullness >= 0.35) return 'moderate';
  return 'good';
};

/**
 * Demo parking. The only place in the app that ever asserts an occupancy
 * *status* — real resorts don't publish one, so this exists purely to give
 * the demo/dev experience something to show, and it is stamped `demo`
 * everywhere the UI renders it, same as every other simulated feed here.
 *
 * Fullness is a simple function of the day's simulated demand (storm +
 * weekend + holiday), the same `patternFor` the demo pricing/crowd models
 * already use, so a busy demo day is consistently busy across every panel.
 */
export class DemoParkingProvider implements ParkingProvider {
  readonly id = 'demo-parking';

  constructor(private readonly options: DemoParkingOptions = {}) {}

  async getParkingInfo(mountain: Mountain, context: ProviderContext): Promise<Availability<ParkingInfo>> {
    if (this.options.failFor?.(mountain)) {
      return unavailable(this.id, 'No parking status returned for this mountain.');
    }

    const published = parkingInfoFor(mountain.id);
    const pattern = patternFor(mountain, context.date, context.horizonDays);
    const rng = mountainRng(mountain, context.date, 'parking');
    const fullness = Math.min(
      1,
      Math.max(0, 0.3 + 0.35 * pattern.demandFactor + (pattern.weekend ? 0.15 : 0) + (pattern.holiday ? 0.2 : 0) + rng.range(-0.08, 0.08)),
    );
    const capacity = 900 + Math.round(rng.range(0, 600));
    const occupied = Math.round(capacity * fullness);

    return ok(
      {
        status: STATUS_BY_FULLNESS(fullness),
        occupied,
        capacity,
        reservationRequired: published?.reservationRequired ?? 'unknown',
        freeOptionAvailable: published?.freeOptionAvailable ?? null,
        notes: published?.notes ?? [],
        infoUrl: published?.infoUrl ?? null,
        contact: published?.contact ?? null,
      },
      {
        source: 'demo',
        observation: 'observed',
        confidence: 'medium',
        provider: this.id,
        horizonDays: context.horizonDays,
      },
    );
  }
}
