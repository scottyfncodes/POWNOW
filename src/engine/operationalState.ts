import type { OperationsReport } from '@/domain/conditions';
import { fromDateKey } from '@/domain/dates';
import type { MountainOperationalState } from '@/domain/mountainStatus';
import type { DayInputs } from './inputs';
import { isOpeningMonth, openingLine, seasonFor, shortDate } from './season';

/**
 * Turns whatever the lift-status and weather feeds actually reported into
 * one of the eight states in `domain/mountainStatus.ts`.
 *
 * The rule that matters most: a dead feed is never allowed to become an
 * inferred `OPEN` or `CLOSED`. `OFF_SEASON` is the one state grounded in a
 * fact nobody has to fetch — the calendar — so a June feed failure reads as
 * "this is summer" rather than as a mystery. Everywhere else, absence of
 * data stays `UNKNOWN`.
 */

/** Colorado's ski areas are reliably shut across this window; shoulder months stay `UNKNOWN`, not assumed either way. */
const OFF_SEASON_MONTHS = new Set([6, 7, 8, 9]);
/** Openings and closings land in these months and vary by mountain and year, so a missing lift report can't be read as "open". */
const SHOULDER_MONTHS = new Set([4, 5, 10, 11]);

const BETWEEN_DAYS = "Open for the season, but the lift board hasn't been set for the day yet.";

export interface OperationalStateResult {
  state: MountainOperationalState;
  reason: string;
}

export function classifyOperationalState(inputs: DayInputs): OperationalStateResult {
  const month = fromDateKey(inputs.date).getMonth() + 1;
  // Demo mode deliberately simulates a mid-season day for any date it's
  // asked about (see providers/demo/scenario.ts) — treating a real July
  // as the off-season there would contradict the very data it's showing.
  // The calendar only gets a vote in live mode, where absence of an ops
  // feed genuinely could mean "it's summer."
  const calendarOffSeason = !inputs.usingDemoData && OFF_SEASON_MONTHS.has(month);

  // The resort's announced dates. Demo mode simulates a mid-season day for
  // any date, so the calendar only gets a vote in live mode.
  const season = inputs.usingDemoData ? null : seasonFor(inputs.mountain, inputs.date);

  if (inputs.operations.status === 'ok') {
    const ops = inputs.operations.data;
    const liftsRunning = (ops.liftsOpen ?? ops.liftsExpectedOpen) + (ops.liftsHold ?? 0) + (ops.liftsScheduled ?? 0);

    if (ops.status === 'closed' || liftsRunning === 0) {
      // "No lifts running" on a resort that hasn't opened for the season is
      // the calendar, not a lift outage or a weather day.
      if (season?.phase === 'preseason' || (season?.phase === 'unknown' && isOpeningMonth(inputs.date))) {
        return { state: 'PRESEASON', reason: `Not open for the season yet. ${openingLine(season.opening)}` };
      }
      if (season?.phase === 'postseason') {
        return { state: 'OFF_SEASON', reason: 'Closed for the season.' };
      }
      if (calendarOffSeason) {
        return { state: 'OFF_SEASON', reason: 'Nothing open, and this is the off-season.' };
      }
      // Open for the season, and the board is between days. Lifts stop at
      // last chair and the board reads all closed until first chair, so
      // overnight it says nothing about the day ahead. Reading it as CLOSED
      // would call an open mountain shut every morning before 9.
      // Only a confirmed opening counts: a projected date passing is not the resort opening.
      if (season?.phase === 'in-season' && season.opening?.status === 'confirmed') {
        if (inputs.horizonDays > 0) {
          return { state: 'UNKNOWN', reason: BETWEEN_DAYS };
        }
        if (inputs.now !== undefined && inputs.now < ops.scheduledOpen) {
          return { state: 'UNKNOWN', reason: BETWEEN_DAYS };
        }
        if (inputs.now !== undefined && inputs.now >= ops.lastChair) {
          return { state: 'CLOSED', reason: 'Lifts are done for the day.' };
        }
      }
      return { state: 'CLOSED', reason: 'The lift report says nothing is running today.' };
    }

    // A lift turning with no runs open is not a ski day: on 2026-10-31
    // Heavenly's gondola was running (sightseeing, three weeks before its
    // opening day) with nothing open to ski. Only a board that actually
    // reports runs can show that; one that doesn't is judged on the calendar.
    const runsReported = ops.trailsTotal != null && ops.trailsTotal > 0;
    const liftsSpinning = (ops.liftsOpen ?? ops.liftsExpectedOpen) > 0;
    if (liftsSpinning && (runsReported ? ops.trailsOpen === 0 : season?.phase === 'preseason')) {
      if (season?.phase === 'preseason') {
        return {
          state: 'PRESEASON',
          reason: `Not open for skiing yet: a lift is turning, but no runs are ${runsReported ? 'open' : 'reported open'}. ${openingLine(season.opening)}`,
        };
      }
      if (runsReported) {
        return { state: 'INSUFFICIENT_COVERAGE', reason: 'Lifts are turning, but no runs are open.' };
      }
    }

    // Lifts are turning. However thin, that is an open mountain, and the
    // score (not a takeover screen) says how little of it there is.
    if (ops.terrainOpenShare < 0.45) {
      return { state: 'LIMITED_OPERATIONS', reason: limitedReason(ops, season?.phase === 'preseason' || isOpeningMonth(inputs.date)) };
    }

    if (ops.windHoldRisk > 0.55 || ops.upperMountainDelayMinutes > 75) {
      return { state: 'LIMITED_OPERATIONS', reason: 'High hold risk or a long upper-mountain delay today.' };
    }

    if (ops.windHoldRisk > 0.3 || ops.upperMountainDelayMinutes > 30) {
      return { state: 'OPEN_WITH_RESTRICTIONS', reason: 'Open, but expect holds or a late upper-mountain opening.' };
    }

    return { state: 'OPEN', reason: 'Normal operations reported.' };
  }

  // No lift report, but the resort has said when it opens and today is before it.
  if (season?.phase === 'preseason') {
    return { state: 'PRESEASON', reason: `Not open for the season yet. ${openingLine(season.opening)}` };
  }
  if (season?.phase === 'postseason') {
    return { state: 'OFF_SEASON', reason: 'Closed for the season.' };
  }

  // The lift feed is down. Never guess open or closed from that alone.
  if (calendarOffSeason) {
    return { state: 'OFF_SEASON', reason: 'No lift report, and this is typically the off-season.' };
  }

  // A measured station depth is the better witness; the model's grid-cell
  // depth is the fallback. Either way the bar is "next to nothing on the
  // ground and nothing recent". A thin pack alone is a coverage question
  // for the lift report, not a NO_SNOW verdict. The station stands on its
  // own, so a dead weather feed doesn't hide a bare mountain.
  //
  // Not in the opening months, though. Early-season terrain is machine-made,
  // and neither a SNOTEL pillow nor a weather model's grid cell sees it: on
  // 2026-10-31 A-Basin was open on an 18" made base while every station near
  // it read 0", and this rule called it (and 66 other mountains) NO SNOW.
  // In September through December a silent lift report stays UNKNOWN, and
  // the no-call line says to check before going.
  if (isOpeningMonth(inputs.date)) {
    return { state: 'UNKNOWN', reason: 'No lift report available.' };
  }
  const weather = inputs.weather.status === 'ok' ? inputs.weather.data : null;
  const measured = inputs.snowpack.status === 'ok' ? inputs.snowpack.data.snowDepthIn : null;
  const depth = measured ?? weather?.modelSnowDepthIn ?? null;
  const recentFall = weather?.snowHistory?.pastTotalIn
    ?? (inputs.snowpack.status === 'ok' ? inputs.snowpack.data.newSnow5dIn : null);
  if (depth !== null && depth < 6 && (recentFall === null || recentFall < 3)) {
    return {
      state: 'NO_SNOW',
      reason: measured !== null
        ? 'The nearest snow station reads next to no depth, and little has fallen recently.'
        : 'Modeled snow depth is negligible and little has fallen recently.',
    };
  }

  return { state: 'UNKNOWN', reason: 'No lift report available.' };
}

/**
 * Why a day can't be called, or `null` when it can. A score built on neutral
 * stand-ins reads exactly like a real one, so the plan withholds it when:
 * - there's no weather feed: nothing to judge the snow on at all, or
 * - there's no lift report in a shoulder month, when the mountain may simply
 *   not be open yet (or anymore).
 * Mid-season, a missing lift report alone stays a routine caveat; see
 * `NON_SKIABLE_STATES` in domain/mountainStatus.ts.
 */
/** "Early season: 1 of 9 lifts and 1 of 147 runs open." Only counts the feed actually reported. */
function limitedReason(ops: OperationsReport, early: boolean): string {
  const lifts = `${ops.liftsOpen ?? ops.liftsExpectedOpen} of ${ops.liftsTotal} lifts`;
  const runs = ops.trailsOpen != null && ops.trailsTotal ? ` and ${ops.trailsOpen} of ${ops.trailsTotal} runs` : '';
  const share = ops.trailsOpen != null && ops.trailsTotal ? '' : ` (about ${Math.round(ops.terrainOpenShare * 100)}% of the mountain)`;
  return `${early ? 'Early season: ' : 'Limited terrain: '}${lifts}${runs} open${share}.`;
}

export function noCallReason(inputs: DayInputs, state: MountainOperationalState): string | null {
  if (inputs.weather.status !== 'ok') {
    return "The weather feed is down, so there's no snow to judge this day on.";
  }
  const month = fromDateKey(inputs.date).getMonth() + 1;
  if (state === 'UNKNOWN' && !inputs.usingDemoData && SHOULDER_MONTHS.has(month)) {
    const season = seasonFor(inputs.mountain, inputs.date);
    if (season.phase === 'in-season' && season.opening?.status === 'confirmed') {
      // Early season, how much is open changes day to day, and a guess at it is exactly what can't be scored.
      return inputs.horizonDays > 0
        ? "Open for the season, but early-season terrain changes day to day and the lift board can't say what that day brings."
        : "Open for the season, but today's lift board isn't set yet, so how much terrain is open is unknown. Check after first chair.";
    }
    const opening = season.opening?.date ? ` Its projected opening day was ${shortDate(season.opening.date)}.` : ' No opening date has been announced.';
    return `No lift report, and this time of year that can mean it isn't open.${opening} Check before you go.`;
  }
  return null;
}
