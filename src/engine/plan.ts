import {
  DEFAULT_PREFERENCES,
  DEFAULT_WEIGHTS,
  OPTIMIZER_CONFIG,
  type RiderPreferences,
  type ScoringWeights,
} from '@/config/weights';
import type { DateKey } from '@/domain/dates';
import { resortSourceFor } from '@/data/resortSources';
import { type Mountain, type Origin, passCovering } from '@/domain/mountain';
import { NON_SKIABLE_STATES } from '@/domain/mountainStatus';
import type {
  DataSourceStatus,
  Recommendation,
  ReturnOption,
  SkiDayPlan,
  StayOrGoAdvice,
  TimelineEvent,
} from '@/domain/plan';
import {
  confidenceForHorizon,
  type Availability,
  displayStatus,
  observationForHorizon,
  type Provenance,
} from '@/domain/provenance';
import { formatClock, formatDuration, type MinuteOfDay } from '@/domain/time';
import type { ProviderContext, ProviderRegistry } from '@/providers/types';
import { comparisonFor, headlineFor, reasonsFor, tradeoffsAgainst, verdictFor } from './explain';
import { type DayInputs, loadDayInputs, makeContext } from './inputs';
import { buildOffSeasonMessage } from './offSeasonMessages';
import { classifyOperationalState } from './operationalState';
import { optimizeDay } from './optimize';
import { resolveAccessRoutes } from './routing';
import { scoreDay } from './scoring';
import { buildSnowClock, resolveOperations, resolveWeather } from './snowClock';
import { classifySnowState } from './snowState';

export interface PlanOptions {
  preferences?: RiderPreferences;
  weights?: ScoringWeights;
}

/**
 * Turn one mountain's data into a complete, timed, explained ski day.
 * Everything above this function consumes plans; everything below produces
 * numbers.
 */
export function buildPlan(inputs: DayInputs, options: PlanOptions = {}): SkiDayPlan {
  const preferences = options.preferences ?? DEFAULT_PREFERENCES;
  const weights = options.weights ?? DEFAULT_WEIGHTS;

  const snowClock = buildSnowClock(inputs, {
    preferences: {
      powderPreference: preferences.powderPreference,
      crowdTolerance: preferences.crowdTolerance,
    },
  });

  const optimized = optimizeDay(inputs, snowClock, { preferences, weights });
  const score = scoreDay({
    inputs,
    clock: snowClock,
    departure: optimized.departure,
    ret: optimized.ret,
    preferences,
    weights,
  });

  const weather = resolveWeather(inputs);
  const hasSnow = weather.overnightSnowIn >= 1.5;
  const snowState = classifySnowState(inputs, snowClock);
  const caveats = collectCaveats(inputs, optimized.unavailableReason);

  const { state: operationalState, reason: operationalReason } = classifyOperationalState(inputs);
  const offSeasonMessage = NON_SKIABLE_STATES.has(operationalState)
    ? buildOffSeasonMessage(
        operationalState,
        operationalReason,
        inputs.mountain,
        inputs.date,
        inputs.weather.status === 'ok' ? inputs.weather.data : null,
      )
    : null;

  return {
    mountain: inputs.mountain,
    origin: inputs.origin,
    date: inputs.date,
    isToday: inputs.isToday,
    score,
    snowClock,
    snowState,
    freshSnowIn: inputs.weather.status === 'ok' ? inputs.weather.data.overnightSnowIn : null,
    baseConditions: inputs.weather.status === 'ok' ? inputs.weather.data.base : null,
    peakConditions: inputs.weather.status === 'ok' ? inputs.weather.data.peak : null,
    snowHistory: inputs.weather.status === 'ok' ? inputs.weather.data.snowHistory : null,
    modelSnowDepthIn: inputs.weather.status === 'ok' ? inputs.weather.data.modelSnowDepthIn : null,
    snowpack: inputs.snowpack.status === 'ok' ? inputs.snowpack.data : null,
    operationalState,
    operations: inputs.operations.status === 'ok' ? inputs.operations.data : null,
    offSeasonMessage,
    ticket: inputs.ticket.status === 'ok' ? inputs.ticket.data : null,
    ticketPurchaseUrl: resortSourceFor(inputs.mountain.id).officialPurchaseUrl,
    passCoverage: passCovering(inputs.mountain, preferences.passes),
    alerts: inputs.alerts.status === 'ok' ? inputs.alerts.data : [],
    parking: inputs.parking,
    dataSources: buildDataSources(inputs),
    departure: optimized.departure,
    departureOptions: optimized.departureOptions,
    return: optimized.ret,
    returnOptions: optimized.returnOptions,
    routeDistanceMiles: routeDistanceMiles(inputs),
    routeLabel: routeLabel(inputs),
    timeline: buildTimeline(inputs, snowClock, snowState, optimized.departure, optimized.ret),
    headline: headlineFor(inputs, snowClock, score),
    verdict: verdictFor(score.score, hasSnow),
    reasons: reasonsFor(inputs, snowClock, score),
    tradeoffs: [],
    provenance: planProvenance(inputs),
    caveats,
  };
}

/** Google's real reported distance when the traffic feed is live; the pre-authored/estimated route figure otherwise. Never invented. */
function routeDistanceMiles(inputs: DayInputs): number | null {
  if (inputs.outbound.status === 'ok') return inputs.outbound.data.distanceMiles;
  const primary = inputs.routes.find((route) => route.isPrimary) ?? inputs.routes[0];
  return primary?.distanceMiles ?? null;
}

function routeLabel(inputs: DayInputs): string | null {
  if (inputs.outbound.status === 'ok') return inputs.outbound.data.routeLabel;
  const primary = inputs.routes.find((route) => route.isPrimary) ?? inputs.routes[0];
  return primary?.label ?? null;
}

function planProvenance(inputs: DayInputs): Provenance {
  const first = [inputs.weather, inputs.operations, inputs.outbound].find(
    (availability) => availability.status === 'ok',
  );
  if (first && first.status === 'ok') return first.provenance;
  return {
    source: inputs.usingDemoData ? 'demo' : 'live',
    observation: observationForHorizon(inputs.horizonDays),
    confidence: confidenceForHorizon(inputs.horizonDays),
    provider: 'none',
    horizonDays: inputs.horizonDays,
  };
}

/** One row per independent feed, so a single disclosure can show all six at once. */
function buildDataSources(inputs: DayInputs): DataSourceStatus[] {
  const row = (label: string, availability: Availability<unknown>, sourceUrl?: string): DataSourceStatus => ({
    label,
    status: displayStatus(availability),
    provider: availability.status === 'ok' ? availability.provenance.provider : availability.provider,
    fetchedAt: availability.status === 'ok' ? availability.provenance.fetchedAt : undefined,
    attribution: availability.status === 'ok' ? availability.provenance.attribution : undefined,
    sourceUrl,
  });

  const opsSourceUrl = inputs.operations.status === 'ok' ? inputs.operations.data.sourceUrl : undefined;

  const parkingSourceUrl = inputs.parking.status === 'ok' ? (inputs.parking.data.infoUrl ?? undefined) : undefined;
  const snowpackUrl = inputs.snowpack.status === 'ok' ? inputs.snowpack.data.sourceUrl : undefined;

  const rows = [
    row('Weather', inputs.weather),
    row('Snowpack', inputs.snowpack, snowpackUrl),
    row('Traffic', inputs.outbound),
    row('Lift operations', inputs.operations, opsSourceUrl),
    row('Ticket price', inputs.ticket),
    row('Alerts', inputs.alerts),
    row('Parking', inputs.parking, parkingSourceUrl),
  ];

  // Roads only gets a row when there was a corridor to ask about at all —
  // an origin/mountain pair with no routes has nothing to report here.
  if (inputs.primaryRoadStatus) rows.push(row('Roads', inputs.primaryRoadStatus));

  return rows;
}

function collectCaveats(inputs: DayInputs, timingReason: string | null): string[] {
  const caveats: string[] = [];
  if (inputs.weather.status === 'unavailable') {
    caveats.push("Weather's being weird — we can't confidently call the snow.");
  }
  if (inputs.operations.status === 'unavailable') {
    caveats.push("Lift report isn't talking. Terrain and opening times are assumptions.");
  }
  if (inputs.crowds.status === 'unavailable') {
    caveats.push('No crowd signal for this mountain.');
  }
  if (inputs.ticket.status === 'unavailable') {
    caveats.push("Ticket pricing isn't loading, so the cost of the day is missing.");
  }
  if (inputs.closedCorridors.length > 0) {
    caveats.push(`${inputs.closedCorridors.join(', ')} closed. Routing around it wasn't possible from here today.`);
  }
  if (inputs.outbound.status === 'unavailable' || inputs.inbound.status === 'unavailable') {
    const timeoutPattern = /took too long|timed out/i;
    const isSlowWake =
      (inputs.outbound.status === 'unavailable' && timeoutPattern.test(inputs.outbound.reason)) ||
      (inputs.inbound.status === 'unavailable' && timeoutPattern.test(inputs.inbound.reason));
    caveats.push(
      isSlowWake
        ? "Road intel is offline. We'll show the mountain, but we're not going to fake the drive. (Our traffic service naps when it's quiet and can take ~15 seconds to wake up — try again in a moment.)"
        : "Road intel is offline. We'll show the mountain, but we're not going to fake the drive.",
    );
  } else if (timingReason) {
    caveats.push(timingReason);
  }
  return caveats;
}

function buildTimeline(
  inputs: DayInputs,
  snowClock: SkiDayPlan['snowClock'],
  snowState: SkiDayPlan['snowState'],
  departure: SkiDayPlan['departure'],
  ret: SkiDayPlan['return'],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const ops = resolveOperations(inputs);

  if (departure) {
    events.push({
      minute: departure.departure,
      icon: '🚗',
      label: `Leave ${inputs.origin.shortName}`,
      detail: formatDuration(departure.driveMinutes),
      emphasis: true,
    });
    events.push({
      minute: departure.arrival,
      icon: '🏔️',
      label: 'Arrive',
      detail: `First turn ${formatClock(departure.firstTurn)}`,
    });
  }

  if (ops.expectedOpen > ops.scheduledOpen) {
    events.push({
      minute: ops.expectedOpen,
      icon: '🚡',
      label: 'Lifts turn (running late)',
      detail: `Scheduled ${formatClock(ops.scheduledOpen)}`,
    });
  }

  if (snowClock.prime) {
    // The window is always named (it's the day's best relative stretch), but
    // it only gets called "PRIME SNOW" when snowState agrees the snow itself
    // is genuinely good — see engine/snowState.ts.
    events.push({
      minute: snowClock.prime.start,
      icon: '❄️',
      label: snowState === 'prime' ? 'PRIME SNOW' : 'BEST WINDOW',
      detail: `through ${formatClock(snowClock.prime.end)}`,
      emphasis: snowState === 'prime',
    });
    const fade = snowClock.points.find(
      (point) =>
        point.minute > snowClock.prime!.end && point.quality < snowClock.prime!.averageQuality - 12,
    );
    if (fade) {
      events.push({ minute: fade.minute, icon: '☀️', label: 'Snow quality starts fading' });
    }
  }

  if (ret) {
    if (ret.departure > snowClock.close) {
      events.push({
        minute: snowClock.close,
        icon: '🎿',
        label: 'Last chair',
        detail: `Wait out traffic — ${formatDuration(ret.departure - snowClock.close)}`,
      });
    }
    events.push({
      minute: ret.departure,
      icon: '🚗',
      label: 'BEST TIME TO HEAD HOME',
      detail: formatDuration(ret.driveMinutes),
      emphasis: true,
    });
    events.push({ minute: ret.homeArrival, icon: '🏠', label: 'Home' });
  }

  return events.sort((a, b) => a.minute - b.minute);
}

/** ---- Multi-mountain recommendation -------------------------------------- */

export interface RecommendOptions extends PlanOptions {
  mountains: Mountain[];
  origin: Origin;
  date: DateKey;
  today: DateKey;
  now: MinuteOfDay;
}

export async function recommend(
  registry: ProviderRegistry,
  options: RecommendOptions,
): Promise<Recommendation> {
  const context: ProviderContext = makeContext(options.date, options.today, options.now);
  const preferences = options.preferences ?? DEFAULT_PREFERENCES;
  const reachable = options.mountains.filter(
    (mountain) => resolveAccessRoutes(mountain, options.origin).length > 0,
  );
  // "Only my passes" narrows the field to mountains the rider can ski on a
  // pass they hold. If that leaves nothing, the filter is ignored rather
  // than answering with an error — a rider with an Epic Pass in Durango
  // still deserves an answer, just not one that pretends Purgatory is free.
  const onPass = reachable.filter((mountain) => passCovering(mountain, preferences.passes) !== null);
  const candidates = preferences.onlyMyPasses && preferences.passes.length > 0 && onPass.length > 0 ? onPass : reachable;

  const inputs = await Promise.all(
    candidates.map((mountain) => loadDayInputs(registry, mountain, options.origin, context)),
  );

  const plans = inputs
    .map((dayInputs) => buildPlan(dayInputs, options))
    .sort((a, b) => b.score.raw - a.score.raw);

  const best = plans[0];
  if (!best) {
    throw new Error('No mountains are reachable from this starting point.');
  }

  const alternatives = plans.slice(1);
  for (const plan of alternatives) {
    plan.tradeoffs = tradeoffsAgainst(plan.score, best.score);
  }

  const caveats = [...new Set(plans.flatMap((plan) => plan.caveats))];

  return {
    date: options.date,
    origin: options.origin,
    best,
    alternatives,
    all: plans,
    comparison: comparisonFor(best, alternatives[0]),
    generatedAt: new Date().toISOString(),
    usingDemoData: registry.usingDemoData,
    caveats,
  };
}

/** ---- Stay or go --------------------------------------------------------- */

/**
 * Mid-afternoon, standing at the base, phone out: should I get in the car or
 * take another lap? A navigation app can tell you how long the drive is right
 * now. Only a model of the *whole curve* can tell you to wait.
 */
export function stayOrGo(
  plan: SkiDayPlan,
  now: MinuteOfDay,
  config = OPTIMIZER_CONFIG,
): StayOrGoAdvice {
  const remaining = plan.returnOptions.filter((option) => option.departure >= now);
  const leaveNow = remaining[0] ?? null;

  if (!leaveNow) {
    return {
      now,
      verdict: 'go-now',
      headline: 'HEAD OUT.',
      detail: 'Nothing left to wait for today.',
      leaveNow: null,
      leaveLater: null,
      minutesToWait: 0,
    };
  }

  const best = remaining.reduce((top, option) => (option.score > top.score ? option : top), leaveNow);
  const wait = best.departure - leaveNow.departure;

  if (wait <= config.returnStepMinutes) {
    return {
      now,
      verdict: 'window-open',
      headline: 'THIS IS THE WINDOW.',
      detail: `Leave now and you're home ${formatClock(leaveNow.homeArrival)}. Waiting doesn't help.`,
      leaveNow,
      leaveLater: null,
      minutesToWait: 0,
    };
  }

  const homeDelay = Math.max(0, best.homeArrival - leaveNow.homeArrival);
  const extraMountain = best.departure - leaveNow.departure;
  // The honest trade is not "you get home later" — it's how much of that delay
  // is extra *driving* rather than extra time you actually wanted to be here.
  const extraDriving = Math.max(0, homeDelay - extraMountain);
  const jammedNow = leaveNow.trafficLight === 'red';

  const cost =
    extraDriving <= 2
      ? 'and you get home no later than if you left right now'
      : `for ${formatDuration(extraDriving)} of extra driving`;

  return {
    now,
    verdict: 'stay',
    headline: jammedNow ? "DON'T LEAVE YET." : wait <= 60 ? 'ONE MORE LAP.' : 'STAY A WHILE.',
    detail: jammedNow
      ? `Traffic is stacking hard. Stay another ${formatDuration(wait)} — grab après, let the road clear. That's ${formatDuration(extraMountain)} more up here ${cost}.`
      : `Hang on ${formatDuration(wait)}. That's ${formatDuration(extraMountain)} more on the hill ${cost}.`,
    leaveNow,
    leaveLater: best,
    minutesToWait: wait,
  };
}

/**
 * A handful of departure times spanning the whole afternoon, always including
 * the recommended one.
 *
 * It deliberately shows both sides. An earlier version only listed *later*
 * departures, which collapsed to a useless table on the days when the
 * recommendation is already last chair — every row saying "no extra skiing,
 * no extra driving". The question is not only "should I stay?" but "what does
 * this decision look like either way", and that needs the shape, not a tail.
 */
export function stayOrGoLadder(plan: SkiDayPlan, count = 5): ReturnOption[] {
  const recommended = plan.return;
  if (!recommended || plan.returnOptions.length === 0) return recommended ? [recommended] : [];

  const options = plan.returnOptions;
  if (options.length <= count) return options;

  const stride = (options.length - 1) / (count - 1);
  const picked = new Map<number, ReturnOption>();
  for (let i = 0; i < count; i += 1) {
    const option = options[Math.round(i * stride)];
    if (option) picked.set(option.departure, option);
  }
  picked.set(recommended.departure, recommended);

  return [...picked.values()].sort((a, b) => a.departure - b.departure);
}
