import { pricingFor } from '@/data/pricing';
import type { Mountain } from '@/domain/mountain';
import type { PriceKind, TicketPrice } from '@/domain/pricing';
import {
  type Availability,
  confidenceForHorizon,
  ok,
  observationForHorizon,
  unavailable,
} from '@/domain/provenance';
import { clamp, clamp01 } from '@/domain/time';
import type { PricingProvider, ProviderContext } from '@/providers/types';
import { patternFor } from './scenario';
import { mountainRng } from './scenario';

export interface DemoPricingOptions {
  failFor?: (mountain: Mountain) => boolean;
}

/**
 * Demo lift-ticket pricing.
 *
 * Shaped like the real thing: the price you pay is a function of how far ahead
 * you buy, whether it's a weekend or a holiday, and — the part skiers notice —
 * how much snow just fell. Walking up to the window on a powder Saturday is
 * the most expensive way to buy a ski day there is.
 *
 * These are representative figures, not quotes. Every one is stamped `demo`.
 */
export class DemoPricingProvider implements PricingProvider {
  readonly id = 'demo-pricing';

  constructor(private readonly options: DemoPricingOptions = {}) {}

  async getTicketPrice(
    mountain: Mountain,
    context: ProviderContext,
  ): Promise<Availability<TicketPrice>> {
    if (this.options.failFor?.(mountain)) {
      return unavailable(this.id, 'No ticket pricing returned for this mountain.');
    }

    const profile = pricingFor(mountain.id);
    const pattern = patternFor(mountain, context.date, context.horizonDays);
    const rng = mountainRng(mountain, context.date, 'price');

    // Buying today for today is window pricing. Two weeks out is the floor.
    const leadDiscount = clamp01(context.horizonDays / 14);
    const demand = clamp01(
      0.45 * clamp01(pattern.demandFactor - 0.4) +
        0.4 * pattern.stormIntensity +
        (pattern.holiday ? 0.3 : 0) +
        (pattern.weekend ? 0.12 : 0),
    );

    // Position between the advance floor and the window rate.
    const position = clamp(
      (1 - leadDiscount) * (0.55 + 0.45 * demand) * profile.dynamicRange +
        (1 - profile.dynamicRange) * 0.5 +
        rng.range(-0.04, 0.04),
      0,
      1,
    );

    const adultDay = Math.round(
      profile.advanceFloor + (profile.windowRate - profile.advanceFloor) * position,
    );
    const kind: PriceKind =
      context.horizonDays === 0 ? 'window' : context.horizonDays >= 10 ? 'advance' : 'dynamic';

    return ok(
      {
        mountainId: mountain.id,
        date: context.date,
        currency: profile.currency,
        adultDay,
        windowRate: profile.windowRate,
        kind,
        purchasedDaysAhead: context.horizonDays,
        note: noteFor(kind, demand, pattern.holiday),
      },
      {
        source: 'demo',
        observation: observationForHorizon(context.horizonDays),
        confidence: confidenceForHorizon(context.horizonDays),
        provider: this.id,
        horizonDays: context.horizonDays,
      },
    );
  }
}

function noteFor(kind: PriceKind, demand: number, holiday: string | null): string {
  if (holiday) return `${holiday} pricing.`;
  if (kind === 'window') return demand > 0.55 ? 'Same-day window rate, peak demand.' : 'Same-day window rate.';
  if (kind === 'advance') return 'Advance rate (booked this far out).';
  return demand > 0.55 ? 'Dynamic pricing, demand is up.' : 'Dynamic pricing.';
}
