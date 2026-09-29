import { DEFAULT_WEIGHTS, type RiderPreferences, type ScoringWeights } from '@/config/weights';
import type { RoadCondition } from '@/domain/conditions';
import type {
  DayScore,
  DepartureOption,
  ReturnOption,
  ScoreFactor,
  ScoreFactorKey,
  ScorePenalty,
  SnowClock,
} from '@/domain/plan';
import { type ConfidenceLevel, weakestConfidence } from '@/domain/provenance';
import { PASS_LABELS, passCovering } from '@/domain/mountain';
import { formatPrice, savingsVsWindow } from '@/domain/pricing';
import { clamp, formatDuration, type MinuteOfDay } from '@/domain/time';
import { sampleCurve, saturate, scoreBetween } from '@/lib/curve';
import type { DayInputs } from './inputs';
import { resolveCrowds, resolveOperations, resolveWeather, weatherAt } from './snowClock';

/**
 * The scoring layer turns a fully-specified plan into one number plus the
 * reasons behind it. It is deliberately separate from the optimiser: the
 * optimiser decides *what to do*, the scorer decides *how good that is* and
 * has to be able to explain itself.
 *
 * The score is decision support. It is not a measurement of anything.
 *
 * Parking (`domain/parking.ts`) is deliberately NOT a scoring factor here.
 * The product brief asks for parking to influence the recommendation "when
 * reliable data supports doing so" — today, no resort in this dataset
 * exposes live per-lot occupancy (see `providers/live/parking.ts`), so the
 * only thing scoring could weight is a resort's static reservation policy,
 * which does not vary day to day and would not change which mountain is
 * best *today*. Adding a factor with no live signal behind it would be
 * exactly the kind of penalty this file elsewhere refuses to invent (see
 * `NEUTRAL`/`imputed` handling below). Parking stays a first-class, visible
 * part of the plan (`SkiDayPlan.parking`) without moving the score — if a
 * resort ever exposes real live occupancy, that is the day to add a
 * `'parking'` `ScoreFactorKey` here, not before.
 */

export interface ScoreInput {
  inputs: DayInputs;
  clock: SnowClock;
  departure: DepartureOption | null;
  ret: ReturnOption | null;
  preferences: RiderPreferences;
  weights?: ScoringWeights;
}

/** Used when a provider is down: a neutral prior, always flagged as imputed. */
const NEUTRAL = 55;

/** A full, good day is about this many quality-weighted minutes on snow. */
const REFERENCE_QUALITY_MINUTES = 380;

// Snow-packed roads are a Tuesday in Colorado, not a crisis; the scale is
// calibrated to a winter driver, not a rental car in July.
const ROAD_SCORE: Record<RoadCondition, number> = {
  clear: 96,
  wet: 84,
  'snow-packed': 68,
  'chains-required': 42,
  closed: 0,
};

interface RawFactor {
  value: number;
  note: string;
  imputed?: boolean;
}

export function scoreDay(input: ScoreInput): DayScore {
  const { inputs, clock, departure, ret, preferences } = input;
  const weights = input.weights ?? DEFAULT_WEIGHTS;

  const weather = resolveWeather(inputs);
  const ops = resolveOperations(inputs);
  const crowds = resolveCrowds(inputs);

  const skiStart = departure?.firstTurn ?? clock.open;
  const skiEnd = Math.min(ret?.departure ?? clock.close, clock.close);
  const skiWindow: [MinuteOfDay, MinuteOfDay] = [skiStart, Math.max(skiStart, skiEnd)];

  const raw: Record<ScoreFactorKey, RawFactor> = {
    snow: snowFactor(inputs, clock, skiStart, weather),
    snowCycle: snowCycleFactor(inputs, weather),
    snowTiming: snowTimingFactor(clock, departure, ret),
    weather: weatherFactor(inputs, skiWindow),
    wind: windFactor(inputs, skiWindow, ops.windHoldRisk),
    terrain: terrainFactor(inputs, ops),
    operations: operationsFactor(inputs, ops),
    travel: travelFactor(clock, departure, ret, preferences),
    traffic: trafficFactor(departure, ret),
    roads: roadsFactor(inputs),
    crowds: crowdsFactor(crowds, skiWindow, preferences),
    usableTime: usableTimeFactor(departure, ret),
    ticket: ticketFactor(inputs, preferences),
  };

  const factors: ScoreFactor[] = (Object.keys(raw) as ScoreFactorKey[]).map((key) => {
    const entry = raw[key];
    const weight = weights.factors[key];
    const value = clamp(entry.value, 0, 100);
    return {
      key,
      label: weights.labels[key],
      value: Math.round(value),
      weight,
      contribution: Math.round(value * weight * 10) / 10,
      note: entry.note,
      imputed: entry.imputed ?? false,
    };
  });

  const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const weighted = totalWeight === 0 ? 0 : factors.reduce((sum, f) => sum + f.value * f.weight, 0) / totalWeight;

  /*
   * Some costs do not belong in a weighted average because they have no
   * upper bound and no counterpart: rolling in at 10:40pm does not make the
   * snow worse, it just ruins the day. They are applied afterwards, and named,
   * so the number on the card can always be taken apart.
   */
  const penalties: ScorePenalty[] = [];
  if (ret) {
    const overrun = Math.max(0, ret.homeArrival - preferences.latestHomeArrival);
    if (overrun > 0) {
      penalties.push({
        label: `Home ${formatDuration(overrun)} later than you wanted`,
        points: Math.min(25, Math.round(overrun * 0.12 * 10) / 10),
      });
    }
  }
  const rawScore = clamp(weighted - penalties.reduce((sum, p) => sum + p.points, 0), 0, 100);

  const ranked = [...factors].sort(
    (a, b) => (b.value - 62) * b.weight - (a.value - 62) * a.weight,
  );

  return {
    score: Math.round(rawScore) / 10,
    raw: Math.round(rawScore * 10) / 10,
    factors,
    penalties,
    confidence: confidenceFor(inputs, factors),
    strengths: ranked.filter((f) => f.value >= 70).slice(0, 3),
    weaknesses: ranked.reverse().filter((f) => f.value < 62).slice(0, 3),
  };
}

function confidenceFor(inputs: DayInputs, factors: ScoreFactor[]): ConfidenceLevel {
  const levels: ConfidenceLevel[] = [];
  for (const availability of [
    inputs.weather,
    inputs.operations,
    inputs.crowds,
    inputs.outbound,
    inputs.inbound,
  ]) {
    if (availability.status === 'ok') levels.push(availability.provenance.confidence);
  }
  const base = weakestConfidence(levels.length > 0 ? levels : ['low']);
  const imputedCount = factors.filter((factor) => factor.imputed).length;
  if (imputedCount >= 3) return 'low';
  if (imputedCount >= 1 && base === 'high') return 'medium';
  return base;
}

/* ------------------------------------------------------------------ factors */

function snowFactor(
  inputs: DayInputs,
  clock: SnowClock,
  skiStart: MinuteOfDay,
  weather: ReturnType<typeof resolveWeather>,
): RawFactor {
  if (inputs.weather.status !== 'ok') {
    return { value: NEUTRAL, note: 'No snow report available.', imputed: true };
  }
  const dayfall = weather.hourly.reduce((sum, hour) => sum + hour.snowfallIn, 0);
  const total = weather.overnightSnowIn + dayfall;
  const atArrival = clock.points.find((point) => point.minute >= skiStart)?.untrackedIn ?? 0;

  // What matters is not what fell, but what is still there when you click in.
  /*
   * Calibrated so the whole range gets used: a couple of inches is a 30, a
   * good morning is a 60, and a genuine storm reaches the 90s. Saturating any
   * faster and the engine cannot tell a good day from a great one; any slower
   * and no day ever scores like the day it actually was.
   */
  const fallenScore = 100 * saturate(total, 6);
  const untrackedScore = 100 * saturate(atArrival, 3.4);
  const value = total < 1 ? scoreBetween(weather.daysSinceStorm, 8, 0) * 0.55 + 22 : fallenScore * 0.45 + untrackedScore * 0.55;

  const note =
    total < 1
      ? `No new snow. ${weather.daysSinceStorm} days since the last storm.`
      : `${total.toFixed(1)}" total, about ${atArrival.toFixed(1)}" still untracked when you get there.`;
  return { value, note };
}

/**
 * The five-day snow cycle: how loaded is this mountain right now, and how
 * loaded is it about to get. `snowFactor` above already answers "what's
 * still there when you click in today" from the overnight/intraday numbers;
 * this is the complementary, slower signal — a mountain that just banked a
 * foot this week and one that's been dry for a week can otherwise present
 * an identical "today" and get scored identically, which is exactly the gap
 * SNOWNOW's audit called out. Incoming snow gets a much smaller credit than
 * the same amount already on the ground: it isn't skiable yet, and how much
 * of it actually lands is genuinely less certain.
 */
function snowCycleFactor(inputs: DayInputs, weather: ReturnType<typeof resolveWeather>): RawFactor {
  if (inputs.weather.status !== 'ok' || !weather.snowHistory) {
    return { value: NEUTRAL, note: 'No 5-day snow history available.', imputed: true };
  }
  const { pastTotalIn: past, futureTotalIn: future } = weather.snowHistory;
  const pastScore = 100 * saturate(past, 26);
  const incomingCredit = clamp(saturate(future, 20) * 18, 0, 18);
  const value = clamp(pastScore * 0.82 + incomingCredit, 0, 100);
  return { value, note: describeSnowCycle(past, future) };
}

function describeSnowCycle(past: number, future: number): string {
  const p = past.toFixed(past < 10 ? 1 : 0);
  const f = future.toFixed(future < 10 ? 1 : 0);
  if (past < 1 && future < 1) return 'Dry stretch — nothing in the last 5 days, nothing incoming.';
  if (past < 1) return `Dry the last 5 days, but ${f}" projected over the next 5.`;
  if (future < 1) return `${p}" over the last 5 days, nothing new incoming.`;
  return `${p}" over the last 5 days, ${f}" more projected over the next 5.`;
}

function snowTimingFactor(
  clock: SnowClock,
  departure: DepartureOption | null,
  ret: ReturnOption | null,
): RawFactor {
  if (!clock.prime) {
    return { value: NEUTRAL, note: 'No standout window today.', imputed: true };
  }
  if (!departure || !ret) {
    return { value: NEUTRAL, note: 'Timing not resolved.', imputed: true };
  }
  const primeLength = clock.prime.end - clock.prime.start;
  const captured = Math.max(
    0,
    Math.min(clock.prime.end, ret.departure) - Math.max(clock.prime.start, departure.firstTurn),
  );
  const share = primeLength <= 0 ? 0 : captured / primeLength;
  return {
    value: clamp(share * 100, 0, 100),
    note:
      share >= 0.95
        ? 'You catch the whole prime window.'
        : `You catch ${formatDuration(captured)} of a ${formatDuration(primeLength)} prime window.`,
  };
}

function weatherFactor(inputs: DayInputs, window: [MinuteOfDay, MinuteOfDay]): RawFactor {
  if (inputs.weather.status !== 'ok') {
    return { value: NEUTRAL, note: 'Weather feed unavailable.', imputed: true };
  }
  const hourly = inputs.weather.data.hourly;
  const samples = sampleWindow(window, (minute) => weatherAt(hourly, minute));
  if (samples.length === 0) return { value: NEUTRAL, note: 'No hourly forecast.', imputed: true };
  const visibility = average(samples.map((s) => (s ? s.visibility : 0.6)));
  const temps = samples.map((s) => (s ? s.temperatureF : 20));
  const comfort = average(temps.map((t) => (t < 5 ? 55 : t > 36 ? 55 : 92)));
  return {
    value: visibility * 100 * 0.6 + comfort * 0.4,
    note:
      visibility > 0.85
        ? 'Good visibility all day.'
        : visibility > 0.6
          ? 'Flat light in places.'
          : 'Low visibility while it snows.',
  };
}

/**
 * Peak wind tiers. Ordinary mountain wind at the summit is not a problem —
 * penalizing it would mean docking every mountain, every day, since the top
 * is windier than the base by definition. The tiers exist so *unusual* wind
 * up high — the kind that actually threatens lift access and comfort — is
 * the only kind that costs anything, and so a mountain reporting real
 * operational trouble (`windHoldRisk`) is trusted over wind speed alone.
 */
const PEAK_WIND_NORMAL_MPH = 25;
const PEAK_WIND_SEVERE_MPH = 45;

function peakWindPenalty(peak: ReturnType<typeof resolveWeather>['peak']): {
  penalty: number;
  note: string | null;
} {
  if (!peak) return { penalty: 0, note: null };
  const mph = peak.windMph;
  if (mph < PEAK_WIND_NORMAL_MPH) return { penalty: 0, note: null };
  if (mph < PEAK_WIND_SEVERE_MPH) {
    return {
      penalty: (mph - PEAK_WIND_NORMAL_MPH) * 0.6,
      note: `Peak wind running ${Math.round(mph)} mph — some upper-mountain impact likely.`,
    };
  }
  return {
    penalty: (PEAK_WIND_SEVERE_MPH - PEAK_WIND_NORMAL_MPH) * 0.6 + (mph - PEAK_WIND_SEVERE_MPH) * 0.9,
    note: `Severe peak wind, gusting to ${Math.round(mph)} mph — expect upper-mountain holds.`,
  };
}

function windFactor(
  inputs: DayInputs,
  window: [MinuteOfDay, MinuteOfDay],
  windHoldRisk: number,
): RawFactor {
  if (inputs.weather.status !== 'ok') {
    return { value: NEUTRAL, note: 'No wind forecast.', imputed: true };
  }
  const weather = inputs.weather.data;
  const gusts = sampleWindow(window, (minute) => weatherAt(weather.hourly, minute)).map((s) =>
    s ? s.windGustMph : 20,
  );
  if (gusts.length === 0) return { value: NEUTRAL, note: 'No wind forecast.', imputed: true };
  const peakGust = Math.max(...gusts);
  const { penalty, note: peakNote } = peakWindPenalty(weather.peak);
  const value = clamp(scoreBetween(peakGust, 65, 12) * (1 - windHoldRisk * 0.4) - penalty, 0, 100);
  return {
    value,
    note:
      peakNote ??
      (peakGust < 20
        ? 'Barely any wind.'
        : peakGust < 38
          ? `Gusts around ${Math.round(peakGust)} mph.`
          : `Gusting ${Math.round(peakGust)} mph — expect lift holds up high.`),
  };
}

function terrainFactor(inputs: DayInputs, ops: ReturnType<typeof resolveOperations>): RawFactor {
  const imputed = inputs.operations.status !== 'ok';
  const share = ops.terrainOpenShare;
  return {
    value: clamp(share * 105, 0, 100),
    note: imputed
      ? 'Terrain status unknown, assuming a normal day.'
      : `${Math.round(share * 100)}% of terrain expected open.`,
    imputed,
  };
}

function operationsFactor(inputs: DayInputs, ops: ReturnType<typeof resolveOperations>): RawFactor {
  const imputed = inputs.operations.status !== 'ok';
  const liftShare = ops.liftsExpectedOpen / Math.max(1, ops.liftsTotal);
  const delayPenalty = clamp((ops.expectedOpen - ops.scheduledOpen) * 0.9, 0, 30);
  const value = liftShare * 100 - delayPenalty - ops.windHoldRisk * 30;
  return {
    value,
    note: imputed
      ? 'Lift report unavailable.'
      : `${ops.liftsExpectedOpen} of ${ops.liftsTotal} lifts expected spinning.`,
    imputed,
  };
}

/**
 * Travel is a burden, not just a duration. Door-to-door cost includes the
 * alarm you had to set and the time you spent standing in a dark parking lot
 * waiting for the ropes to drop — which is precisely what the optimiser trades
 * against, so the score has to see it too or the two would disagree.
 */
const ALARM_REFERENCE = 6 * 60;

function travelFactor(
  clock: SnowClock,
  departure: DepartureOption | null,
  ret: ReturnOption | null,
  preferences: RiderPreferences,
): RawFactor {
  if (!departure || !ret) {
    return { value: NEUTRAL, note: 'Drive time unavailable.', imputed: true };
  }
  const roundTrip = departure.driveMinutes + ret.driveMinutes;
  const idleMinutes =
    Math.max(0, departure.firstTurn - departure.arrival - 25) +
    Math.max(0, ret.departure - clock.close);
  const alarmMinutes =
    Math.max(0, ALARM_REFERENCE - departure.departure) * (1 - preferences.sleepVsSend);
  const overLimit = Math.max(0, departure.driveMinutes - preferences.maxDriveMinutes);

  /*
   * Anchored to what a real ski day costs, not to an imaginary perfect one.
   * A ~3h round trip is a normal Front Range Saturday and should not read as a
   * failing grade; the scale is tuned so the spread that actually exists —
   * roughly 3 to 9 hours door to door — uses most of the range.
   */
  const burden = roundTrip + idleMinutes * 0.8 + alarmMinutes;
  const value = scoreBetween(burden, 520, 170) - overLimit * 0.8;

  const idleNote = idleMinutes > 25 ? ` ${formatDuration(idleMinutes)} of standing around.` : '';
  return {
    value,
    note: `${formatDuration(departure.driveMinutes)} up, ${formatDuration(ret.driveMinutes)} back.${idleNote}`,
  };
}

function trafficFactor(departure: DepartureOption | null, ret: ReturnOption | null): RawFactor {
  if (!departure || !ret) {
    return { value: NEUTRAL, note: 'No traffic data.', imputed: true };
  }
  // This measures how well the plan dodges traffic — and dodging it is the
  // whole job, so a well-timed day is allowed to score like one.
  const worst = Math.max(departure.congestion, ret.congestion);
  const mean = (departure.congestion + ret.congestion) / 2;
  const value = clamp(100 - mean * 66 - worst * 24, 0, 100);
  return {
    value,
    note:
      worst < 0.3
        ? 'Both drives look clean if you hit the times.'
        : worst < 0.62
          ? 'Some slow going, nothing brutal.'
          : 'Heavy traffic on at least one leg.',
  };
}

function roadsFactor(inputs: DayInputs): RawFactor {
  /*
   * Two sources can speak to the road surface. The authoritative one is the
   * corridor's road-condition feed (CDOT), which reports what the pavement
   * is actually like and whether a chain law is in force. The secondary one
   * is whatever the traffic source inferred — the demo model derives a
   * surface from its own storm; Google Routes reports none at all (`null`).
   * A route the feed says is *closed* never reaches this function: it was
   * removed from consideration upstream (`engine/inputs.ts`).
   */
  const authoritative =
    inputs.primaryRoadStatus && inputs.primaryRoadStatus.status === 'ok' ? inputs.primaryRoadStatus.data : null;
  if (authoritative) {
    const value = ROAD_SCORE[authoritative.condition];
    const closures = authoritative.closures.length;
    return {
      value: clamp(value - closures * 5, 0, 100),
      note: authoritative.tractionLawInEffect
        ? 'Traction law in effect — snow tires or chains required.'
        : authoritative.condition === 'clear'
          ? 'Roads reported clear.'
          : `Roads: ${authoritative.condition.replace('-', ' ')}.`,
    };
  }

  if (inputs.outbound.status !== 'ok' || inputs.outbound.data.roadCondition === null) {
    return { value: NEUTRAL, note: 'No road condition data.', imputed: true };
  }
  const outbound = inputs.outbound.data;
  const outboundCondition = outbound.roadCondition as RoadCondition;
  const inboundCondition =
    inputs.inbound.status === 'ok' && inputs.inbound.data.roadCondition !== null
      ? inputs.inbound.data.roadCondition
      : outboundCondition;
  const value = Math.min(ROAD_SCORE[outboundCondition], ROAD_SCORE[inboundCondition]);
  const incidents = outbound.incidents.length + (inputs.inbound.status === 'ok' ? inputs.inbound.data.incidents.length : 0);
  return {
    value: clamp(value - incidents * 5, 0, 100),
    note: outboundCondition === 'clear' ? 'Roads clear.' : `Roads: ${outboundCondition.replace('-', ' ')}.`,
  };
}

function crowdsFactor(
  crowds: ReturnType<typeof resolveCrowds>,
  window: [MinuteOfDay, MinuteOfDay],
  preferences: RiderPreferences,
): RawFactor {
  if (!crowds) {
    return { value: NEUTRAL, note: 'No crowd signal.', imputed: true };
  }
  const points = crowds.samples.map((sample) => ({ minute: sample.minute, value: sample.crowding }));
  const values = sampleWindow(window, (minute) => sampleCurve(points, minute));
  const mean = average(values);
  const tolerance = 1 - 0.5 * preferences.crowdTolerance;
  return {
    value: clamp(100 - mean * 95 * tolerance, 0, 100),
    note:
      mean < 0.25
        ? 'Quiet.'
        : mean < 0.5
          ? 'Normal lift lines.'
          : mean < 0.72
            ? 'Busy through the middle of the day.'
            : 'Properly crowded.',
  };
}

/**
 * Ticket price as decision context.
 *
 * The anchors span the actual market: a peak window rate at a destination
 * resort against a same-day independent. The *weight* (config/weights.ts) is
 * what keeps this honest — this factor exists so the user can see the cost and
 * so a cheap ticket can break a tie, not so it can win an argument against
 * fresh snow.
 */
const EXPENSIVE_TICKET = 320;
const CHEAP_TICKET = 80;

/** A pass-covered day scores like the cheapest ticket on the market — because for this rider it is. */
const PASS_COVERED_VALUE = 96;

function ticketFactor(inputs: DayInputs, preferences: RiderPreferences): RawFactor {
  const pass = passCovering(inputs.mountain, preferences.passes);
  if (pass) {
    return { value: PASS_COVERED_VALUE, note: `Covered by your ${PASS_LABELS[pass]}.` };
  }
  if (inputs.ticket.status !== 'ok') {
    return { value: NEUTRAL, note: 'No ticket pricing available.', imputed: true };
  }
  const ticket = inputs.ticket.data;
  const saved = savingsVsWindow(ticket);
  const note =
    saved > 8
      ? `${formatPrice(ticket.adultDay, ticket.currency)} — ${formatPrice(saved, ticket.currency)} under the window rate.`
      : `${formatPrice(ticket.adultDay, ticket.currency)}. ${ticket.note}`;
  return { value: scoreBetween(ticket.adultDay, EXPENSIVE_TICKET, CHEAP_TICKET), note };
}

function usableTimeFactor(departure: DepartureOption | null, ret: ReturnOption | null): RawFactor {
  if (!departure || !ret) {
    return { value: NEUTRAL, note: 'Ski time not resolved.', imputed: true };
  }
  const value = clamp((ret.qualityMinutes / REFERENCE_QUALITY_MINUTES) * 100, 0, 100);
  return {
    value,
    note: `${formatDuration(ret.mountainMinutes)} on the hill.`,
  };
}

/* ------------------------------------------------------------------- utils */

function sampleWindow<T>(window: [MinuteOfDay, MinuteOfDay], read: (minute: MinuteOfDay) => T): T[] {
  const [start, end] = window;
  const out: T[] = [];
  if (end <= start) return [read(start)];
  for (let minute = start; minute <= end; minute += 30) out.push(read(minute));
  return out;
}

const average = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
