/**
 * The mountain's descriptive profile — official links, contact info, and
 * season dates. Deliberately kept separate from `resortSources.ts` (which
 * feeds live-data providers) and from anything live/operational: this module
 * is static-ish reference data a human could bookmark, not something scoring
 * or the snow clock ever reads.
 *
 * See domain/plan.ts's layering note for the full picture:
 *   STATIC PROFILE   → this file's website/address/phone/trailMap/pass URLs,
 *                      plus researched Grub & Brews picks
 *   SEASONAL PROFILE → this file's openingDate/closingDate
 *   LIVE CONDITIONS  → providers/live/* (snow, weather, lifts, alerts)
 *   LIVE ROUTING     → engine/routing.ts + providers/live/googleRoutesTraffic.ts
 */

/** How firm a published season date is. Never inferred from history — only what the resort actually said. */
export type SeasonDateStatus = 'confirmed' | 'projected' | 'tbd';

export interface SeasonDate {
  /** ISO date, or `null` when the resort hasn't given one specific enough to record. */
  date: string | null;
  status: SeasonDateStatus;
}

export const TBD_DATE: SeasonDate = { date: null, status: 'tbd' };

/**
 * The mountain's official trail map — structured so the UI never has a
 * hard-coded URL to reach for. `officialUrl` is always the resort's own
 * trail-map page (or, failing that, its site) and is what "Official Trail
 * Map ↗" always opens, regardless of whether an embeddable asset exists.
 *
 * `imageUrl`/`pdfUrl` are only ever set when a specific, directly-linkable
 * official asset was found *and* could be confirmed as the current (or
 * near-current) season — see `data/mountainProfiles.ts`'s research notes.
 * A resort whose only confirmed asset was several seasons stale gets
 * `officialUrl` alone rather than an outdated map presented as current:
 * the UI's honest "trail map unavailable to preview — view official" state
 * exists precisely for this case, not just for a missing URL.
 */
export interface TrailMap {
  /** A directly-linkable official image (JPG/PNG/etc), when one was confirmed. */
  imageUrl?: string | null;
  /** A directly-linkable official PDF, when one was confirmed. */
  pdfUrl?: string | null;
  /** The resort's own trail-map page — always present, always where "Official Trail Map ↗" points. */
  officialUrl: string;
  /** Always 'official' — this app never links a third-party trail-map repository as if it were the resort's own. */
  source: 'official';
  /** e.g. "2025-26". `null`/omitted when the asset's season couldn't be confirmed — never guessed. */
  season?: string | null;
}

/** One researched pick — a name and what it's actually known for, never a review score or a live wait time. */
export interface DiningPick {
  name: string;
  note: string;
}

/**
 * Restaurants around the mountain, researched the same way as parking: real,
 * named places, never a live availability feed. Several of these resorts
 * (Wolf Creek, Monarch, Loveland, Arapahoe Basin, Eldora) have little or no
 * real base village of their own — for those, `town` names the actual town
 * skiers eat in afterward (Pagosa Springs, Salida, Silverthorne/Dillon,
 * Nederland) instead of pretending the mountain itself has a dining scene.
 * `quickBreakfast` is a single deliberate pick, not a fourth item padded
 * onto `picks` — the one place worth naming for someone who needs to eat and
 * be on the lift in ten minutes.
 */
export interface GrubInfo {
  /** Set only when the real scene is a nearby town rather than the base area. */
  town?: string;
  picks: DiningPick[];
  quickBreakfast?: DiningPick;
}

/**
 * Breweries around the mountain — same research standard as `GrubInfo`.
 * Almost none of these resorts have an on-site brewery (Keystone's Steep
 * Brewing, right in River Run Village, is the one exception); the rest are a
 * short, named drive, and each pick's own note says how far. `distilleries`
 * is a bonus list, present only where a real one was actually found nearby —
 * never padded in to look complete.
 */
export interface BrewsInfo {
  picks: DiningPick[];
  distilleries?: DiningPick[];
}

export interface MountainProfile {
  officialWebsite: string;
  /** `null` when no official snow-report page could be confirmed distinct from `officialWebsite`. */
  snowReportUrl: string | null;
  webcamUrl: string | null;
  trailMap: TrailMap;
  ticketUrl: string | null;
  /** `null` when no separate pass-info page exists (same as `ticketUrl`, or the resort has no pass product). */
  passInfoUrl: string | null;
  phone: string | null;
  address: string | null;
  openingDate: SeasonDate;
  closingDate: SeasonDate;
  /** Absent when restaurants haven't been researched for this resort yet. */
  grub?: GrubInfo;
  /** Absent when breweries haven't been researched for this resort yet. */
  brews?: BrewsInfo;
  /** Provenance/uncertainty notes — never shown as fact, only as a caveat for whoever maintains this data. */
  notes?: string;
}
