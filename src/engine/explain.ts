import type {
  DayScore,
  ScoreFactor,
  ScoreFactorKey,
  SkiDayPlan,
  SnowClock,
  Tradeoff,
} from '@/domain/plan';
import { fromDateKey } from '@/domain/dates';
import { at, formatClock, formatDuration, formatWindowLabel } from '@/domain/time';
import type { DayInputs } from './inputs';
import { resolveOperations, resolveWeather, weatherAt } from './snowClock';

/**
 * Copy generation. The engine knows a great deal; the user should hear one or
 * two sentences of it. Everything here is derived from computed values — no
 * canned recommendations, no hard-coded mountains.
 */

/*
 * Calibrated against what the scoring model actually produces, not against a
 * tidy-looking 0-10 ruler. A real ski day pays a permanent tax — the drive is
 * never free, the ticket is never cheap, and a big storm brings snow-packed
 * roads with it — so the weighted average of honest factors lands in the 6s
 * and 7s most of the time. Pinning "LET'S RIDE." to a number the model can
 * only reach a couple of times a season is the point: it should mean
 * something when it appears.
 */
export function verdictFor(score: number, hasSnow: boolean): string {
  if (score >= 8.5) return "LET'S RIDE.";
  if (score >= 7.9) return hasSnow ? 'SEND IT.' : 'GO.';
  if (score >= 7.2) return 'WORTH IT.';
  if (score >= 6.5) return 'PRETTY CHILL.';
  if (score >= 5.8) return "IT'S A DAY.";
  if (score >= 4.8) return "IT'LL DO.";
  return 'SLEEP IN.';
}

/**
 * Late-season is not just "another day with less snow" — the base is
 * preserved by cold overnight refreeze and skis fastest early, before the
 * sun softens it. Detected from real hourly numbers (a cold morning and a
 * warm afternoon in a spring month, on a mountain that hasn't seen fresh
 * snow in a few days), never inferred from the calendar alone.
 */
function isSpringWarmup(inputs: DayInputs): boolean {
  const month = fromDateKey(inputs.date).getMonth() + 1;
  if (month < 3 || month > 5) return false;
  const weather = resolveWeather(inputs);
  if (weather.daysSinceStorm > 4) return false;
  const morning = weatherAt(weather.hourly, at(7));
  const midday = weatherAt(weather.hourly, at(13));
  if (!morning || !midday) return false;
  return morning.temperatureF <= 26 && midday.temperatureF >= 38;
}

/** One line under the mountain name: the call, in the fewest words possible. */
export function headlineFor(inputs: DayInputs, clock: SnowClock, score: DayScore): string {
  const weather = resolveWeather(inputs);
  const dayfall = weather.hourly.reduce((sum, hour) => sum + hour.snowfallIn, 0);
  const stacking = dayfall > 1.2;

  if (weather.overnightSnowIn >= 8) return stacking ? "SNOW'S STILL STACKING." : 'IT DUMPED.';
  if (weather.overnightSnowIn >= 4) return stacking ? 'STILL SNOWING.' : 'FRESH ON TOP.';
  if (weather.overnightSnowIn >= 1.5) return 'A LITTLE SOMETHING ON TOP.';
  if (clock.prime && clock.prime.averageQuality >= 74) return 'GROOMERS ARE THE PLAY.';
  if (isSpringWarmup(inputs)) return 'SPRING MODE. GO EARLY.';
  if (score.score < 5.5) return 'NOT THE DAY.';
  return 'FIRM AND FAST.';
}

/**
 * The evidence, in the order a skier would ask for it.
 *
 * Deliberately short and deliberately not a restatement of the card above it:
 * the prime window already has its own slot, so repeating it here would spend
 * a line saying nothing. Three or four lines is the budget — past that people
 * stop reading and the recommendation stops feeling like a decision.
 */
export function reasonsFor(inputs: DayInputs, clock: SnowClock, score: DayScore): string[] {
  const weather = resolveWeather(inputs);
  const ops = resolveOperations(inputs);
  const reasons: string[] = [];

  const dayfall = weather.hourly.reduce((sum, hour) => sum + hour.snowfallIn, 0);
  if (inputs.weather.status === 'ok') {
    if (weather.overnightSnowIn >= 0.6) {
      reasons.push(
        dayfall >= 0.8
          ? `${weather.overnightSnowIn.toFixed(1)}" overnight, still stacking.`
          : `${weather.overnightSnowIn.toFixed(1)}" overnight.`,
      );
    } else if (dayfall >= 0.8) {
      reasons.push(`${dayfall.toFixed(1)}" expected to fall during the day.`);
    } else if (clock.prime && clock.prime.averageQuality >= 74) {
      reasons.push(`No new snow, but the grooming is holding up.`);
    } else {
      reasons.push(`No new snow: ${weather.daysSinceStorm} days since the last one.`);
    }
  }

  // Whichever of wind, terrain and roads is most worth knowing about today —
  // strongest opinion first, so a real problem is never the fourth line.
  const spoken = new Set<string>();
  const speak = (key: string) => {
    const factor = score.factors.find((candidate) => candidate.key === key);
    if (!factor || factor.imputed || spoken.has(key)) return;
    spoken.add(key);
    reasons.push(factor.note);
  };

  const ranked = [...score.factors]
    .filter((factor) => ['wind', 'roads', 'crowds', 'operations'].includes(factor.key))
    .sort((a, b) => a.value - b.value);
  for (const factor of ranked) {
    if (factor.value < 62) speak(factor.key);
  }

  if (inputs.operations.status === 'ok' && !spoken.has('operations')) {
    reasons.push(
      `${Math.round(ops.terrainOpenShare * 100)}% terrain open, ${ops.liftsExpectedOpen} of ${ops.liftsTotal} lifts spinning.`,
    );
  }
  speak('wind');
  speak('roads');

  return reasons.slice(0, 4);
}

const FACTOR_PHRASES: Record<ScoreFactorKey, { better: string; worse: string }> = {
  snow: { better: 'More snow.', worse: 'Less fresh snow.' },
  snowCycle: { better: 'A stronger snow cycle.', worse: 'A drier stretch lately.' },
  snowTiming: { better: 'Better snow timing.', worse: 'Timing lines up worse.' },
  weather: { better: 'Better visibility.', worse: 'Flatter light.' },
  wind: { better: 'Calmer.', worse: 'Higher wind.' },
  terrain: { better: 'More terrain open.', worse: 'Less terrain open.' },
  operations: { better: 'More lifts spinning.', worse: 'Shakier lift picture.' },
  travel: { better: 'Shorter drive.', worse: 'Longer drive.' },
  traffic: { better: 'Cleaner traffic.', worse: 'Worse traffic.' },
  roads: { better: 'Better roads.', worse: 'Dicier roads.' },
  crowds: { better: 'Quieter.', worse: 'More crowded.' },
  usableTime: { better: 'More time on snow.', worse: 'Less time on snow.' },
  ticket: { better: 'Cheaper ticket.', worse: 'Pricier ticket.' },
};

/** Three short bullets contrasting an alternative with the winner. */
export function tradeoffsAgainst(alternative: DayScore, winner: DayScore, limit = 3): Tradeoff[] {
  const winnerByKey = new Map(winner.factors.map((factor) => [factor.key, factor]));
  const deltas = alternative.factors
    .map((factor) => {
      const other = winnerByKey.get(factor.key);
      const delta = other ? factor.value - other.value : 0;
      return { factor, delta, magnitude: Math.abs(delta) * factor.weight };
    })
    .filter((entry) => Math.abs(entry.delta) >= 7)
    .sort((a, b) => b.magnitude - a.magnitude);

  const out: Tradeoff[] = [];
  for (const entry of deltas) {
    const phrases = FACTOR_PHRASES[entry.factor.key];
    const better = entry.delta > 0;
    out.push({ text: better ? phrases.better : phrases.worse, better });
    if (out.length >= limit) break;
  }
  return out.length > 0 ? out : [{ text: 'Very close call.', better: false }];
}

/** "Vail has more snow, but Breck is the better overall day." */
export function comparisonFor(best: SkiDayPlan, runnerUp: SkiDayPlan | undefined): string {
  if (!runnerUp) return `Nothing else within reach comes close today.`;

  const bestByKey = new Map(best.score.factors.map((factor) => [factor.key, factor]));
  let rivalEdge: ScoreFactor | null = null;
  let winnerEdge: ScoreFactor | null = null;
  let rivalDelta = 0;
  let winnerDelta = 0;

  for (const factor of runnerUp.score.factors) {
    const mine = bestByKey.get(factor.key);
    if (!mine) continue;
    const delta = (factor.value - mine.value) * factor.weight;
    if (delta > rivalDelta) {
      rivalDelta = delta;
      rivalEdge = factor;
    }
    if (-delta > winnerDelta) {
      winnerDelta = -delta;
      winnerEdge = mine;
    }
  }

  const winner = best.mountain.shortName;
  const rival = runnerUp.mountain.shortName;

  if (rivalEdge && winnerEdge) {
    return `${rival} has ${describeEdge(rivalEdge)}, but ${winner} wins on ${winnerEdge.label.toLowerCase()}, and that's the difference between a good day and a great one.`;
  }
  if (winnerEdge) {
    return `${winner} takes it on ${winnerEdge.label.toLowerCase()}.`;
  }
  return `${winner} edges out ${rival} across the board.`;
}

const describeEdge = (factor: ScoreFactor): string => {
  switch (factor.key) {
    case 'snow':
      return 'more snow';
    case 'snowCycle':
      return 'a stronger snow cycle';
    case 'travel':
      return 'a shorter drive';
    case 'traffic':
      return 'easier traffic';
    case 'crowds':
      return 'fewer people';
    case 'terrain':
      return 'more terrain open';
    case 'wind':
      return 'less wind';
    case 'ticket':
      return 'a cheaper ticket';
    default:
      return `better ${factor.label.toLowerCase()}`;
  }
};

/** The one-line summary of the whole plan, used for sharing and screen readers. */
export function planSummary(plan: SkiDayPlan): string {
  if (!plan.departure || !plan.return) {
    return `${plan.mountain.name}: ${plan.score.score.toFixed(1)} out of 10.`;
  }
  const prime = plan.snowClock.prime;
  const primeText = prime ? ` Best snow ${formatWindowLabel(prime.start, prime.end)}.` : '';
  return (
    `${plan.mountain.name}, ${plan.score.score.toFixed(1)} out of 10. ` +
    `Leave ${formatClock(plan.departure.departure)}, arrive ${formatClock(plan.departure.arrival)}.` +
    `${primeText} Head home ${formatClock(plan.return.departure)}, back by ${formatClock(plan.return.homeArrival)} ` +
    `after ${formatDuration(plan.return.mountainMinutes)} on the hill.`
  );
}
