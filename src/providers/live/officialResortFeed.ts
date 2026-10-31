import { resortSourceFor } from '@/data/resortSources';
import type { OperationsReport } from '@/domain/conditions';
import { isWeekend } from '@/domain/dates';
import type { Mountain } from '@/domain/mountain';
import { openTimeFor } from '@/domain/mountain';
import { type Availability, ok, unavailable } from '@/domain/provenance';
import type { ProviderContext } from '@/providers/types';
import { cachedJson } from './fetchCache';

/**
 * TIER 1 of the mountain-operations strategy (see `mountainStatus.ts`): the
 * resort's own structured lift and trail board, read through the proxy's
 * `/api/resort-status`, which normalizes it to counts.
 *
 * Two platforms qualified, both checked against the live endpoints on
 * 2026-10-31 rather than written from documentation:
 *  - MtnPowder (Alterra's conditions platform, also used by Arapahoe Basin).
 *    That morning A-Basin's board listed Black Mountain Express open and one
 *    run, High Noon, out of 9 lifts and 147 runs.
 *  - POWDR's day-of-report API (Copper, Eldora, Snowbird).
 * Vail Resorts, Loveland and the rest only publish their boards inside HTML
 * pages, which this project doesn't scrape; they stay on Liftie.
 *
 * Unlike Liftie this reports trails as well as lifts, so `terrainOpenShare`
 * is the real share of runs open, not a lift-count stand-in.
 */
export interface ResortStatusResponse {
  feed?: string;
  resortName?: string | null;
  lifts?: { open?: number; hold?: number; scheduled?: number; closed?: number; unknown?: number };
  trails?: { open?: number; total?: number };
  acres?: { open?: number; total?: number } | null;
  boardUpdatedAt?: number | null;
  sourceTimestamp?: string;
}

export interface OfficialFeedOptions {
  apiBaseUrl: string;
}

/**
 * How old a board with something open may be before it isn't today's board.
 * A board where everything is closed is allowed to be old: a resort that
 * hasn't opened yet doesn't touch it, and "closed" is still the truth.
 */
const MAX_OPEN_BOARD_AGE_HOURS = 36;

const FEED_LABEL: Record<string, string> = {
  mtnpowder: "The resort's own lift and trail board (via MtnPowder).",
  powdr: "The resort's own lift and trail board (POWDR day-of report).",
  aspen: "Aspen Snowmass's own lift status feed.",
  boyne: "The resort's own lift status feed (Boyne).",
  vail: "Read from the resort's own lift and terrain status page.",
  alta: "Read from Alta's own lift and terrain status page.",
  loveland: "Read from Loveland's own lift report page.",
  markup: "Read from the resort's own lift status page.",
};

const count = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export async function getOfficialOperations(
  mountain: Mountain,
  context: ProviderContext,
  options: OfficialFeedOptions,
): Promise<Availability<OperationsReport> | null> {
  const source = resortSourceFor(mountain.id);
  const feed = source.officialFeed;
  if (!feed) return null;

  const url = `${options.apiBaseUrl}/api/resort-status?feed=${feed.kind}&id=${encodeURIComponent(feed.id)}`;
  let payload: ResortStatusResponse;
  let fetchedAtMs: number;
  try {
    const result = await cachedJson<ResortStatusResponse>(url, { timeoutMs: 10000, ttlMs: 5 * 60 * 1000 });
    payload = result.value;
    fetchedAtMs = result.fetchedAt;
  } catch (error) {
    return unavailable('resort-feed', error instanceof Error ? error.message : 'Resort feed request failed.');
  }

  const open = count(payload.lifts?.open);
  const hold = count(payload.lifts?.hold);
  const scheduled = count(payload.lifts?.scheduled);
  const closed = count(payload.lifts?.closed);
  if (open === null || hold === null || scheduled === null || closed === null) {
    return unavailable('resort-feed', 'The resort feed returned a shape this provider does not recognize.');
  }
  const total = open + hold + scheduled + closed + (count(payload.lifts?.unknown) ?? 0);
  if (total === 0) return unavailable('resort-feed', 'The resort feed listed no lifts.');

  const boardAt = typeof payload.boardUpdatedAt === 'number' ? payload.boardUpdatedAt : null;
  const running = open + hold + scheduled;
  if (running > 0 && boardAt !== null && fetchedAtMs - boardAt > MAX_OPEN_BOARD_AGE_HOURS * 3_600_000) {
    return unavailable(
      'resort-feed',
      `The resort's board was last updated ${Math.round((fetchedAtMs - boardAt) / 3_600_000)} hours ago.`,
    );
  }

  const trailsOpen = count(payload.trails?.open);
  const trailsTotal = count(payload.trails?.total);
  const hasTrails = trailsOpen !== null && trailsTotal !== null && trailsTotal > 0;

  const weekend = isWeekend(context.date);
  const scheduledOpen = openTimeFor(mountain, weekend);
  // Same rule as Liftie: before first chair, lifts listed as scheduled are
  // the ones about to turn. A board with nothing open and nothing scheduled
  // is closed whatever the clock says.
  const preOpening = context.horizonDays === 0 && context.now < scheduledOpen && open === 0 && scheduled > 0;
  // Lifts on hold are a weather day, not a closed resort: only a board with
  // nothing open, held or scheduled reads as closed.
  const status: OperationsReport['status'] =
    running === 0 ? 'closed' : hold / total > 0.3 || (open === 0 && hold > 0) ? 'hold' : open === 0 && !preOpening ? 'delayed' : 'open';
  const expectedRunning = preOpening ? scheduled : open;
  const liftShare = Math.min(1, expectedRunning / total);
  const terrainShare = hasTrails ? Math.min(1, trailsOpen / trailsTotal) : liftShare;

  const notes: string[] = [];
  if (hold > 0) notes.push(`${hold} lift${hold === 1 ? '' : 's'} on hold.`);
  if (preOpening) notes.push(`${scheduled} lift${scheduled === 1 ? '' : 's'} scheduled to open.`);

  return ok(
    {
      expectedOpen: scheduledOpen,
      scheduledOpen,
      lastChair: mountain.operations.lastChair,
      liftsExpectedOpen: expectedRunning,
      liftsTotal: total,
      terrainOpenShare: status === 'closed' ? 0 : terrainShare,
      // No feed here reports grooming in a form this reads; documented stand-in, same as Liftie.
      groomedShare: 0.8,
      windHoldRisk: hold / total,
      upperMountainDelayMinutes: mountain.operations.upperMountainOpenOffset,
      status,
      notes,
      liftsOpen: open,
      liftsHold: hold,
      liftsScheduled: scheduled,
      liftsClosed: closed,
      ...(hasTrails ? { trailsOpen, trailsTotal } : {}),
      sourceUrl: source.officialOpsUrl,
    },
    {
      source: 'live',
      observation: context.horizonDays === 0 ? 'observed' : 'forecast',
      confidence: context.horizonDays === 0 ? 'high' : 'low',
      provider: 'resort-feed',
      horizonDays: context.horizonDays,
      fetchedAt: new Date(fetchedAtMs).toISOString(),
      validUntil: new Date(fetchedAtMs + 20 * 60 * 1000).toISOString(),
      attribution: FEED_LABEL[payload.feed ?? feed.kind] ?? "The resort's own lift and trail board.",
    },
  );
}
