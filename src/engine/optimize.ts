import {
  DEFAULT_WEIGHTS,
  OPTIMIZER_CONFIG,
  type OptimizerConfig,
  type RiderPreferences,
  type ScoringWeights,
} from '@/config/weights';
import type { TravelCurve } from '@/domain/conditions';
import type { DepartureOption, ReturnOption, SnowClock, TimingIssue } from '@/domain/plan';
import { clamp, formatDuration, minuteRange, overlapMinutes, type MinuteOfDay } from '@/domain/time';
import type { DayInputs } from './inputs';
import { createQualityIntegral, untrackedAt } from './snowClock';
import { scoreDay } from './scoring';
import { travelAt, trafficLightFor } from './travel';

/**
 * The optimiser. This is the part that makes POW NOW a decision engine rather
 * than a dashboard.
 *
 * Morning and afternoon are not independent problems — leaving later can be
 * worth it if it buys you a better exit, and skiing longer is only worth it if
 * the drive home does not eat the gain. So we optimise the pair jointly over a
 * grid of (leave home, leave mountain) times and pick the best whole day.
 *
 * The objective is measured in *quality-weighted ski minutes*: one minute of
 * 100-quality skiing is worth 1.0, one minute of 60-quality skiing is worth
 * 0.6, and every other term (drive time, congestion, sleep, a late arrival
 * home, time spent waiting out traffic) is converted into the same currency by
 * config, not by magic numbers scattered through the code.
 */

export interface OptimizationResult {
  departure: DepartureOption | null;
  departureOptions: DepartureOption[];
  ret: ReturnOption | null;
  returnOptions: ReturnOption[];
  /** Set when the day could not be timed: the sentence that says why. */
  unavailableReason: string | null;
  /** Which kind of "can't time it" — see `TimingIssue`. */
  timingIssue: TimingIssue | null;
}

export interface OptimizeOptions {
  preferences: RiderPreferences;
  weights?: ScoringWeights;
  config?: OptimizerConfig;
}

interface Candidate {
  departure: MinuteOfDay;
  arrival: MinuteOfDay;
  firstTurn: MinuteOfDay;
  driveOut: number;
  congestionOut: number;
  leaveMountain: MinuteOfDay;
  homeArrival: MinuteOfDay;
  driveBack: number;
  congestionBack: number;
  skiQualityMinutes: number;
  mountainMinutes: number;
  utility: number;
}

export function optimizeDay(
  inputs: DayInputs,
  clock: SnowClock,
  options: OptimizeOptions,
): OptimizationResult {
  const config = options.config ?? OPTIMIZER_CONFIG;
  const preferences = options.preferences;

  if (inputs.outbound.status !== 'ok') {
    return emptyResult(inputs.outbound.reason, 'no-route');
  }
  const outbound = inputs.outbound.data;
  const inbound = inputs.inbound.status === 'ok' ? inputs.inbound.data : null;
  if (!inbound) {
    return emptyResult(
      inputs.inbound.status === 'unavailable' ? inputs.inbound.reason : 'No return route data.',
      'no-route',
    );
  }

  const departureGrid = buildDepartureGrid(outbound, clock, preferences, config);
  const returnGrid = buildReturnGrid(inbound, clock, config);
  if (departureGrid.length === 0 || returnGrid.length === 0) {
    return emptyResult('Not enough travel data to time this day.', 'no-timing');
  }

  const gridStart = departureGrid[0] as MinuteOfDay;
  const qualityBetween = createQualityIntegral(clock);
  const candidates: Candidate[] = [];

  // Being in the line before the ropes drop is only worth something if there
  // is actually powder behind them. Otherwise it's just a cold parking lot.
  const powderPull = clamp(untrackedAt(clock, clock.open) / 4, 0, 1) * 0.95;

  for (const departure of departureGrid) {
    const out = travelAt(outbound, departure);
    if (out.durationMinutes > preferences.maxDriveMinutes) continue;

    const arrival = departure + out.durationMinutes;
    const firstTurn = Math.max(arrival + config.baseToLiftMinutes, clock.open);
    if (firstTurn >= clock.close - config.minSkiMinutes) continue;

    const outCost =
      out.durationMinutes * config.driveMinutesPerQualityMinute * (1 + out.congestion * config.congestionPainMultiplier);
    const sleepValue =
      (departure - gridStart) * config.sleepValuePerMinute * (1 - preferences.sleepVsSend);

    const earlyMinutes = Math.max(0, clock.open - (arrival + config.baseToLiftMinutes));
    const lineValue =
      Math.min(earlyMinutes, config.firstTracksMaxMinutes) * config.firstTracksValuePerMinute * powderPull;
    const waitCost = earlyMinutes * config.preOpenWaitPerMinute;

    for (const leaveMountain of returnGrid) {
      const skiEnd = Math.min(leaveMountain, clock.close);
      if (skiEnd - firstTurn < config.minSkiMinutes) continue;

      const back = travelAt(inbound, leaveMountain);
      const homeArrival = leaveMountain + back.durationMinutes;
      const skiQualityMinutes = qualityBetween(firstTurn, skiEnd);
      const waitMinutes = Math.max(0, leaveMountain - clock.close);
      const backCost =
        back.durationMinutes *
        config.driveMinutesPerQualityMinute *
        (1 + back.congestion * config.congestionPainMultiplier);
      const latePenalty =
        Math.max(0, homeArrival - preferences.latestHomeArrival) * config.lateHomePenaltyPerMinute;

      const utility =
        skiQualityMinutes +
        waitMinutes * config.apresValuePerMinute +
        sleepValue +
        lineValue -
        waitCost -
        outCost -
        backCost -
        latePenalty;

      candidates.push({
        departure,
        arrival,
        firstTurn,
        driveOut: out.durationMinutes,
        congestionOut: out.congestion,
        leaveMountain,
        homeArrival,
        driveBack: back.durationMinutes,
        congestionBack: back.congestion,
        skiQualityMinutes,
        mountainMinutes: skiEnd - firstTurn,
        utility,
      });
    }
  }

  if (candidates.length === 0) {
    return whyNoTiming(inputs, outbound, departureGrid, preferences);
  }

  const bestByUtility = candidates.reduce((top, candidate) =>
    candidate.utility > top.utility ? candidate : top,
  );

  // Best achievable day for each possible departure — the honest answer to
  // "what if I leave at 6?" is "then here's the best day you can still have".
  const bestPerDeparture = new Map<MinuteOfDay, Candidate>();
  for (const candidate of candidates) {
    const current = bestPerDeparture.get(candidate.departure);
    if (!current || candidate.utility > current.utility) bestPerDeparture.set(candidate.departure, candidate);
  }

  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const primeStart = clock.prime?.start ?? clock.open;
  const primeEnd = clock.prime?.end ?? clock.close;

  const toReturn = (candidate: Candidate, reference: Candidate): ReturnOption => ({
    departure: Math.round(candidate.leaveMountain),
    homeArrival: Math.round(candidate.homeArrival),
    driveMinutes: Math.round(candidate.driveBack),
    congestion: Math.round(candidate.congestionBack * 100) / 100,
    mountainMinutes: Math.round(candidate.mountainMinutes),
    qualityMinutes: Math.round(candidate.skiQualityMinutes),
    score: 0,
    recommended: false,
    extraMountainMinutes: Math.round(candidate.mountainMinutes - reference.mountainMinutes),
    extraDriveMinutes: Math.round(candidate.driveBack - reference.driveBack),
    extraHomeDelayMinutes: Math.round(candidate.homeArrival - reference.homeArrival),
    trafficLight: trafficLightFor(candidate.congestionBack),
  });

  const toDeparture = (candidate: Candidate): DepartureOption => ({
    departure: Math.round(candidate.departure),
    arrival: Math.round(candidate.arrival),
    firstTurn: Math.round(candidate.firstTurn),
    driveMinutes: Math.round(candidate.driveOut),
    congestion: Math.round(candidate.congestionOut * 100) / 100,
    primeCaptured: Math.round(
      overlapMinutes(candidate.firstTurn, Math.min(candidate.leaveMountain, clock.close), primeStart, primeEnd),
    ),
    qualityMinutes: Math.round(candidate.skiQualityMinutes),
    score: 0,
    recommended: false,
    extraSleep: Math.round(candidate.departure - gridStart),
  });

  const rate = (departure: DepartureOption, ret: ReturnOption): number =>
    scoreDay({ inputs, clock, departure, ret, preferences, weights }).raw;

  /*
   * Two-stage selection. The utility function ranks whole days on a continuous
   * scale; the published score is what the user actually sees. If those two
   * disagreed, the app would recommend 4:54 while showing a better number next
   * to 5:30 — so the utility search narrows the field and the score makes the
   * final call, and the two can never contradict each other on screen.
   */
  const departureOptions = [...bestPerDeparture.values()]
    .sort((a, b) => a.departure - b.departure)
    .map((candidate) => {
      const option = toDeparture(candidate);
      option.score = rate(option, toReturn(candidate, bestByUtility));
      return option;
    });

  const bestDepartureOption = departureOptions.reduce((top, option) =>
    option.score > top.score ? option : top,
  );
  bestDepartureOption.recommended = true;

  const returnCandidates = candidates
    .filter((candidate) => Math.round(candidate.departure) === bestDepartureOption.departure)
    .sort((a, b) => a.leaveMountain - b.leaveMountain);

  const bestReturnCandidate =
    returnCandidates.reduce<{ candidate: Candidate; score: number } | null>((top, candidate) => {
      const score = rate(bestDepartureOption, toReturn(candidate, candidate));
      return top === null || score > top.score ? { candidate, score } : top;
    }, null)?.candidate ?? (returnCandidates[0] as Candidate | undefined);

  if (!bestReturnCandidate) return whyNoTiming(inputs, outbound, departureGrid, preferences);

  const returnOptions = returnCandidates.map((candidate) => {
    const option = toReturn(candidate, bestReturnCandidate);
    option.score = rate(bestDepartureOption, option);
    option.recommended = candidate.leaveMountain === bestReturnCandidate.leaveMountain;
    return option;
  });

  return {
    departure: bestDepartureOption,
    departureOptions,
    ret: returnOptions.find((option) => option.recommended) ?? returnOptions[0] ?? null,
    returnOptions,
    unavailableReason: null,
    timingIssue: null,
  };
}

function emptyResult(reason: string, timingIssue: TimingIssue): OptimizationResult {
  return {
    departure: null,
    departureOptions: [],
    ret: null,
    returnOptions: [],
    unavailableReason: reason,
    timingIssue,
  };
}

/**
 * The route data came back fine and still no departure works. Say which of
 * the two real reasons it is, with the real drive time, rather than letting
 * it read as the route service being down:
 *  - every departure is a longer drive than the rider said they'd make; or
 *  - there is time to drive but not to ski: it's too late in the day (tonight,
 *    after the last departure that makes the lifts), or the day is too short.
 */
function whyNoTiming(
  inputs: DayInputs,
  outbound: TravelCurve,
  departureGrid: MinuteOfDay[],
  preferences: RiderPreferences,
): OptimizationResult {
  const drives = departureGrid.map((departure) => travelAt(outbound, departure).durationMinutes);
  const shortest = Math.min(...drives);
  const now = drives[0] ?? shortest;
  const mountain = inputs.mountain.shortName;
  if (shortest > preferences.maxDriveMinutes) {
    return emptyResult(
      `${mountain} is a ${formatDuration(shortest)} drive — longer than the ${formatDuration(preferences.maxDriveMinutes)} you said you'd make.`,
      'too-far',
    );
  }
  const isToday = inputs.horizonDays === 0;
  return emptyResult(
    isToday
      ? `Too late to ski ${mountain} today — you'd get there after the lifts are done. Right now it's a ${formatDuration(now)} drive.`
      : `No departure gets you to ${mountain} with enough time on snow before the lifts close.`,
    'too-late',
  );
}

function buildDepartureGrid(
  outbound: TravelCurve,
  clock: SnowClock,
  preferences: RiderPreferences,
  config: OptimizerConfig,
): MinuteOfDay[] {
  const samples = outbound.samples;
  if (samples.length === 0) return [];
  const earliestSample = samples[0]?.departure ?? 0;
  const latestSample = samples[samples.length - 1]?.departure ?? 0;
  const fastest = Math.min(...samples.map((sample) => sample.durationMinutes));

  // No point evaluating departures that land you before the lifts turn, nor
  // ones that leave less than a real ski day.
  const earliest = clamp(
    Math.max(preferences.earliestDeparture, earliestSample, clock.open - fastest - 150),
    earliestSample,
    latestSample,
  );
  const latest = clamp(clock.close - config.minSkiMinutes - fastest, earliest, latestSample);
  return minuteRange(earliest, latest, config.departureStepMinutes);
}

function buildReturnGrid(
  inbound: TravelCurve,
  clock: SnowClock,
  config: OptimizerConfig,
): MinuteOfDay[] {
  const samples = inbound.samples;
  if (samples.length === 0) return [];
  const earliestSample = samples[0]?.departure ?? 0;
  const latestSample = samples[samples.length - 1]?.departure ?? 0;
  const earliest = clamp(clock.open + config.minSkiMinutes, earliestSample, latestSample);
  const latest = clamp(clock.close + config.maxWaitAfterLastChair, earliest, latestSample);
  return minuteRange(earliest, latest, config.returnStepMinutes);
}
