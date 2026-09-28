import { resortSourceFor } from '@/data/resortSources';
import type { OperationsReport } from '@/domain/conditions';
import { isWeekend } from '@/domain/dates';
import type { Mountain } from '@/domain/mountain';
import { openTimeFor } from '@/domain/mountain';
import { type Availability, ok, unavailable } from '@/domain/provenance';
import type { ProviderContext } from '@/providers/types';
import { cachedJson } from './fetchCache';

/**
 * Lift status via Liftie (https://liftie.info) — TIER 2 of the layered
 * mountain-operations strategy (see `mountainStatus.ts` for tiers 1 and 3).
 *
 * Liftie is an open-source lift-status aggregator (github.com/pirxpilot/liftie)
 * with a public JSON endpoint per resort, `GET https://liftie.info/api/resort/:id`.
 * Its documented response shape is:
 *
 *   {
 *     id: "breck", name: "Breckenridge", href: "...",
 *     status: { "Peak 8 SuperConnect": "open", "Imperial Express": "hold", ... },
 *     stats:  { open: 21, hold: 2, scheduled: 0, closed: 12, percentage: { ... } },
 *     weather: { ... }, webcams: [ ... ], timestamp: 1737000000000
 *   }
 *
 * `status` is a map of lift name → one of open | closed | hold | scheduled,
 * and `stats` is Liftie's own tally of that map. This provider reads `stats`
 * when present and re-tallies `status` itself when it isn't, then
 * cross-checks the two — a disagreement means a shape this code doesn't
 * understand, and the answer is `unavailable`, never a guessed count. It
 * also still accepts the two shapes an earlier version of this file guessed
 * at (`lifts.status` counts, `lifts.list` entries), which cost nothing and
 * keep a Liftie-compatible self-hosted mirror working.
 *
 * Liftie is a third-party aggregator, not the resort's own feed; every value
 * sourced here carries `Provenance.attribution` saying so.
 */
const BASE_URL = 'https://liftie.info/api/resort';

type LiftStatusWord = 'open' | 'hold' | 'closed' | 'scheduled';

interface LiftCounts {
  open: number;
  hold: number;
  scheduled: number;
  closed: number;
}

/** The subset of Liftie's response this provider actually reads, plus two legacy shapes. */
interface LiftieResponse {
  id?: string;
  name?: string;
  /** Liftie: lift name → status word. */
  status?: Record<string, unknown> | string;
  /** Liftie: pre-tallied counts. */
  stats?: Partial<Record<LiftStatusWord, unknown>> & { percentage?: unknown };
  /** Liftie: ms since epoch of the last scrape. */
  timestamp?: number | string;
  /** Legacy shapes an earlier version of this provider accepted. */
  lifts?: {
    status?: Partial<Record<LiftStatusWord, number>>;
    list?: { name?: string; status?: string }[];
  };
}

export interface LiftieOptions {
  baseUrl?: string;
}

/** How old a Liftie scrape may be before we stop calling it the current board. */
const MAX_BOARD_AGE_HOURS = 6;

export async function getLiftieOperations(
  mountain: Mountain,
  context: ProviderContext,
  options: LiftieOptions = {},
): Promise<Availability<OperationsReport>> {
  const slug = resortSourceFor(mountain.id).liftieSlug;
  if (!slug) {
    return unavailable('liftie', `No known Liftie coverage for ${mountain.name}.`);
  }

  const base = options.baseUrl ?? BASE_URL;
  const url = `${base}/${slug}`;

  let payload: LiftieResponse;
  let fetchedAtMs: number;
  try {
    const result = await cachedJson<LiftieResponse>(url, { timeoutMs: 8000, ttlMs: 10 * 60 * 1000 });
    payload = result.value;
    fetchedAtMs = result.fetchedAt;
  } catch (error) {
    return unavailable('liftie', error instanceof Error ? error.message : 'Liftie request failed.');
  }

  const counts = extractLiftCounts(payload);
  if (!counts) {
    return unavailable('liftie', 'Liftie returned an unrecognized response shape.');
  }

  const { open, hold, scheduled, closed } = counts;
  const total = open + hold + scheduled + closed;
  if (total === 0) {
    return unavailable('liftie', 'Liftie reported zero lifts for this resort.');
  }

  // Liftie stamps when it last scraped the resort. A board from yesterday
  // evening is not this morning's board.
  const boardTimestamp = readTimestamp(payload.timestamp);
  if (boardTimestamp !== null && fetchedAtMs - boardTimestamp > MAX_BOARD_AGE_HOURS * 60 * 60 * 1000) {
    return unavailable(
      'liftie',
      `Liftie's last update for this resort is ${Math.round((fetchedAtMs - boardTimestamp) / 3_600_000)} hours old.`,
    );
  }

  const weekend = isWeekend(context.date);
  const scheduledOpen = openTimeFor(mountain, weekend);
  const source = resortSourceFor(mountain.id);

  // Before the lifts turn, a live board reads "everything closed" — that is
  // the clock, not a closure. `scheduled` lifts are the tell: a resort that
  // is opening today lists its lifts as scheduled, not closed. Only when
  // nothing is open *and* nothing is scheduled does the board mean closed.
  const preOpening = context.horizonDays === 0 && context.now < scheduledOpen && open === 0;
  const status: OperationsReport['status'] =
    open === 0 && scheduled === 0 && !preOpening
      ? 'closed'
      : hold / total > 0.3
        ? 'hold'
        : open > 0 && closed > open
          ? 'delayed'
          : 'open';

  const expectedRunning = preOpening ? scheduled + open : open;
  const liftShare = clampShare(expectedRunning / total);

  const notes: string[] = [];
  if (hold > 0) notes.push(`${hold} lift${hold === 1 ? '' : 's'} on hold.`);
  if (preOpening && scheduled > 0) notes.push(`${scheduled} lift${scheduled === 1 ? '' : 's'} scheduled to open.`);

  return ok(
    {
      expectedOpen: scheduledOpen,
      scheduledOpen,
      lastChair: mountain.operations.lastChair,
      liftsExpectedOpen: expectedRunning,
      liftsTotal: total,
      // Liftie reports lifts, not terrain or grooming. The lift share is the
      // closest honest proxy for how much of the mountain is reachable;
      // grooming has no signal here at all and stays a documented stand-in.
      terrainOpenShare: liftShare,
      groomedShare: 0.8,
      windHoldRisk: hold / total,
      upperMountainDelayMinutes: mountain.operations.upperMountainOpenOffset,
      status,
      notes,
      liftsOpen: open,
      liftsHold: hold,
      liftsScheduled: scheduled,
      liftsClosed: closed,
      sourceUrl: source.officialOpsUrl,
    },
    {
      source: 'live',
      // A live board describes right now. For a future date it is the best
      // available guide to what will be running, but it is not an observation
      // of that day.
      observation: context.horizonDays === 0 ? 'observed' : 'forecast',
      confidence: context.horizonDays === 0 ? 'medium' : 'low',
      provider: 'liftie',
      horizonDays: context.horizonDays,
      fetchedAt: new Date(fetchedAtMs).toISOString(),
      validUntil: new Date(fetchedAtMs + 20 * 60 * 1000).toISOString(),
      attribution: "Third-party aggregator (Liftie) — not the resort's own feed.",
    },
  );
}

function clampShare(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function readTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1e12 ? value : value * 1000;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

const STATUS_WORDS: Record<string, LiftStatusWord> = {
  open: 'open',
  hold: 'hold',
  delayed: 'hold',
  closed: 'closed',
  scheduled: 'scheduled',
  planned: 'scheduled',
};

/** Tallies a lift-name → status map. Null when most entries aren't a status word we know. */
function tallyStatusMap(status: Record<string, unknown>): LiftCounts | null {
  const entries = Object.values(status);
  if (entries.length === 0) return null;
  const tally: LiftCounts = { open: 0, hold: 0, scheduled: 0, closed: 0 };
  let recognized = 0;
  for (const value of entries) {
    const word = STATUS_WORDS[String(value ?? '').toLowerCase()];
    if (word) {
      tally[word] += 1;
      recognized += 1;
    }
  }
  return recognized >= entries.length * 0.6 ? tally : null;
}

function readCounts(source: Partial<Record<LiftStatusWord, unknown>> | undefined): LiftCounts | null {
  if (!source || typeof source !== 'object') return null;
  const open = Number(source.open ?? 0);
  const hold = Number(source.hold ?? 0);
  const scheduled = Number(source.scheduled ?? 0);
  const closed = Number(source.closed ?? 0);
  if (![open, hold, scheduled, closed].every(Number.isFinite)) return null;
  return { open, hold, scheduled, closed };
}

/**
 * Accepts Liftie's real shape (a `status` map plus `stats` counts, cross-
 * checked against each other) or either legacy shape. Returns null for
 * anything else — the fail-safe boundary that keeps a schema surprise from
 * becoming a fabricated lift count.
 */
export function extractLiftCounts(payload: LiftieResponse): LiftCounts | null {
  const statusMap =
    payload.status && typeof payload.status === 'object' ? tallyStatusMap(payload.status as Record<string, unknown>) : null;
  const stats = readCounts(payload.stats);

  if (statusMap && stats) {
    // The two must describe the same board. A mismatch means one of them is
    // not what this code thinks it is.
    const sameTotal =
      statusMap.open + statusMap.hold + statusMap.scheduled + statusMap.closed ===
      stats.open + stats.hold + stats.scheduled + stats.closed;
    return sameTotal ? stats : null;
  }
  if (statusMap) return statusMap;
  if (stats && stats.open + stats.hold + stats.scheduled + stats.closed > 0) return stats;

  // Legacy shapes.
  const legacyCounts = readCounts(payload.lifts?.status);
  if (legacyCounts) return legacyCounts;

  const list = payload.lifts?.list;
  if (Array.isArray(list) && list.length > 0) {
    const asMap: Record<string, unknown> = {};
    list.forEach((lift, index) => {
      asMap[lift?.name ?? `lift-${index}`] = lift?.status;
    });
    return tallyStatusMap(asMap);
  }

  return null;
}
