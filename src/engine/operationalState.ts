import { fromDateKey } from '@/domain/dates';
import type { MountainOperationalState } from '@/domain/mountainStatus';
import type { DayInputs } from './inputs';

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

  if (inputs.operations.status === 'ok') {
    const ops = inputs.operations.data;

    if (ops.status === 'closed') {
      return { state: 'CLOSED', reason: 'The lift report says closed today.' };
    }

    if (ops.liftsExpectedOpen === 0 || ops.terrainOpenShare < 0.12) {
      return calendarOffSeason
        ? { state: 'OFF_SEASON', reason: 'Next to nothing open, and this is the off-season.' }
        : { state: 'INSUFFICIENT_COVERAGE', reason: 'Next to nothing open — not enough coverage to ski yet.' };
    }

    if (ops.terrainOpenShare < 0.45) {
      return { state: 'LIMITED_OPERATIONS', reason: `Only ${Math.round(ops.terrainOpenShare * 100)}% of terrain open.` };
    }

    if (ops.windHoldRisk > 0.55 || ops.upperMountainDelayMinutes > 75) {
      return { state: 'LIMITED_OPERATIONS', reason: 'High hold risk or a long upper-mountain delay today.' };
    }

    if (ops.windHoldRisk > 0.3 || ops.upperMountainDelayMinutes > 30) {
      return { state: 'OPEN_WITH_RESTRICTIONS', reason: 'Open, but expect holds or a late upper-mountain opening.' };
    }

    return { state: 'OPEN', reason: 'Normal operations reported.' };
  }

  // The lift feed is down. Never guess open or closed from that alone.
  if (calendarOffSeason) {
    return { state: 'OFF_SEASON', reason: 'No lift report, and this is typically the off-season.' };
  }

  if (inputs.weather.status === 'ok') {
    const weather = inputs.weather.data;
    // A measured station depth is the better witness; the model's grid-cell
    // depth is the fallback. Either way the bar is "next to nothing on the
    // ground and nothing recent" — a thin pack alone is a coverage question
    // for the lift report, not a NO_SNOW verdict.
    const measured = inputs.snowpack.status === 'ok' ? inputs.snowpack.data.snowDepthIn : null;
    const depth = measured ?? weather.modelSnowDepthIn;
    const history = weather.snowHistory;
    if (depth !== null && depth < 6 && (!history || history.pastTotalIn < 3)) {
      return {
        state: 'NO_SNOW',
        reason: measured !== null
          ? 'The nearest snow station reads next to no depth, and little has fallen recently.'
          : 'Modeled snow depth is negligible and little has fallen recently.',
      };
    }
  }

  return { state: 'UNKNOWN', reason: 'No lift report available.' };
}
