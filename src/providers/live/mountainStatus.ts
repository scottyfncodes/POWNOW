import type { CrowdCurve, OperationsReport } from '@/domain/conditions';
import type { Mountain } from '@/domain/mountain';
import { type Availability, unavailable } from '@/domain/provenance';
import type { MountainProvider, ProviderContext } from '@/providers/types';
import { getLiftieOperations } from './liftieOperations';
import { getOfficialOperations } from './officialResortFeed';

/**
 * Live-mode mountain status: a three-tier strategy, tried in order.
 *
 * **Tier 1 — the resort's own feed** (`officialResortFeed.ts`). A
 * structured JSON lift-and-trail board, read through the proxy, for the
 * resorts whose board was verified against the live endpoint: the MtnPowder
 * platform (Winter Park, Steamboat, Arapahoe Basin, Deer Valley, Solitude,
 * Palisades, Mammoth, June, Bear Mountain, Snow Summit) and POWDR's
 * day-of-report API (Copper, Eldora, Snowbird). It needs the proxy; without
 * one, or when the feed fails, Tier 2 answers.
 *
 * **Tier 2 — Liftie** (`liftieOperations.ts`), a real third-party aggregator
 * with a documented API and existing Colorado coverage. Tried whenever
 * `data/resortSources.ts` has a Liftie slug for the mountain.
 *
 * **Tier 3 — unavailable.** No real signal, no invented one. The engine
 * already has a correct, tested answer for this: `scoring.ts` and
 * `snowClock.ts` impute a neutral value and flag it, which lowers confidence
 * instead of silently scoring a made-up number as if it were real (see
 * `resolveOperations`/`FALLBACK_OPS` in `engine/snowClock.ts`).
 *
 * `getCrowdForecast` used to run a calendar-based heuristic (weekday/
 * weekend, holiday, mountain popularity) here, honestly labeled `low`
 * confidence and `projected`. It has been retired: real arithmetic on real
 * calendar facts is still a projection standing in for an observed signal,
 * and production is not the place for a proxy that can be mistaken for
 * measured attendance. No trustworthy live crowd/occupancy source exists
 * for these resorts, so this reports `unavailable` — `scoring.ts` already
 * imputes a neutral, low-weight contribution for exactly this case (see
 * `crowds: 0.6` in `config/weights.ts`), which is the correct behavior for
 * "we don't have this," not a reason to keep serving a proxy that looks
 * like data.
 */
export interface LiveMountainOptions {
  /** The proxy's base URL; `undefined` means no proxy, so Tier 1 is skipped. */
  apiBaseUrl?: string;
}

export class LiveMountainProvider implements MountainProvider {
  readonly id = 'live-mountain-status';

  constructor(private readonly options: LiveMountainOptions = {}) {}

  async getOperations(
    mountain: Mountain,
    context: ProviderContext,
  ): Promise<Availability<OperationsReport>> {
    const official =
      this.options.apiBaseUrl !== undefined
        ? await getOfficialOperations(mountain, context, { apiBaseUrl: this.options.apiBaseUrl })
        : null;
    if (official?.status === 'ok') return official;
    const liftie = await getLiftieOperations(mountain, context);
    if (liftie.status === 'ok' || !official) return liftie;
    // Both tiers failed: say why for each, never pick one silently.
    return { ...liftie, reason: `${official.reason} Liftie: ${liftie.reason}` };
  }

  async getCrowdForecast(
    _mountain: Mountain,
    _context: ProviderContext,
  ): Promise<Availability<CrowdCurve>> {
    return unavailable(this.id, 'No trustworthy live crowd/occupancy source exists for this resort.');
  }
}
