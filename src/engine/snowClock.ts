import type { CrowdCurve, HourlyWeather, MountainWeather, OperationsReport } from '@/domain/conditions';
import { isWeekend } from '@/domain/dates';
import { openTimeFor } from '@/domain/mountain';
import type { SnowClock, SnowClockPoint, SnowWindow } from '@/domain/plan';
import { at, clamp, clamp01, HOUR, minuteRange, type MinuteOfDay } from '@/domain/time';
import { type ControlPoint, sampleCurve, saturate, scoreBetween } from '@/lib/curve';
import { OPTIMIZER_CONFIG, type RiderPreferences } from '@/config/weights';
import type { DayInputs } from './inputs';

/**
 * The Snow Clock answers one question: when is the mountain actually good?
 *
 * It is a physical-ish model, not a chart of the weather. Fresh snow is a
 * consumable resource — it gets tracked out at a rate driven by how many
 * people are there and how much terrain is open — and everything else
 * (surface temperature, wind, visibility, lift access) modulates how much fun
 * the remaining snow is to ski.
 */

/** Relative weights of the six things that decide whether a run is good. */
/**
 * The best corduroy day there has ever been is still not a powder day. Without
 * this ceiling the model would let a perfectly groomed afternoon outrank a
 * tracked-out morning, and the optimiser — which counts quality-minutes —
 * would cheerfully recommend skiing until last chair and driving home in the
 * worst traffic of the day.
 */
const GROOMER_CEILING = 0.82;

const QUALITY_MIX = {
  snow: 0.52,
  wind: 0.13,
  visibility: 0.08,
  crowding: 0.15,
  access: 0.12,
} as const;

const CLOCK_START = at(6, 0);

export interface SnowClockOptions {
  stepMinutes?: number;
  preferences?: Pick<RiderPreferences, 'powderPreference' | 'crowdTolerance'>;
}

const NEUTRAL_PREFS = { powderPreference: 1, crowdTolerance: 0.45 };

/** A day we can still describe when the lift report is down. */
const FALLBACK_OPS = (inputs: DayInputs): OperationsReport => {
  const weekend = isWeekend(inputs.date);
  const scheduled = openTimeFor(inputs.mountain, weekend);
  return {
    expectedOpen: scheduled,
    scheduledOpen: scheduled,
    lastChair: inputs.mountain.operations.lastChair,
    liftsExpectedOpen: Math.round(inputs.mountain.lifts.total * 0.8),
    liftsTotal: inputs.mountain.lifts.total,
    terrainOpenShare: 0.8,
    groomedShare: 0.75,
    windHoldRisk: 0.2,
    upperMountainDelayMinutes: inputs.mountain.operations.upperMountainOpenOffset,
    status: 'open',
    notes: [],
  };
};

/**
 * A day we can still describe when the weather feed is down. Base/peak
 * conditions and the snow history are honestly absent here — a fallback
 * exists so the clock can still run, not so the UI can show numbers nobody
 * measured.
 */
const FALLBACK_WEATHER: MountainWeather = {
  overnightSnowIn: 0,
  recentSnow72hIn: 0,
  daysSinceStorm: 3,
  hourly: [],
  summary: 'No forecast available.',
  base: null,
  peak: null,
  snowHistory: null,
  modelSnowDepthIn: null,
};

export function resolveOperations(inputs: DayInputs): OperationsReport {
  return inputs.operations.status === 'ok' ? inputs.operations.data : FALLBACK_OPS(inputs);
}

export function resolveWeather(inputs: DayInputs): MountainWeather {
  return inputs.weather.status === 'ok' ? inputs.weather.data : FALLBACK_WEATHER;
}

export function resolveCrowds(inputs: DayInputs): CrowdCurve | null {
  return inputs.crowds.status === 'ok' ? inputs.crowds.data : null;
}

/** Hourly weather interpolated to arbitrary minutes. */
export function weatherAt(hourly: HourlyWeather[], minute: MinuteOfDay): HourlyWeather | null {
  if (hourly.length === 0) return null;
  const first = hourly[0] as HourlyWeather;
  const last = hourly[hourly.length - 1] as HourlyWeather;
  if (minute <= first.minute) return first;
  if (minute >= last.minute) return last;
  for (let i = 1; i < hourly.length; i += 1) {
    const a = hourly[i - 1] as HourlyWeather;
    const b = hourly[i] as HourlyWeather;
    if (minute <= b.minute) {
      const span = b.minute - a.minute || 1;
      const t = (minute - a.minute) / span;
      const mix = (x: number, y: number) => x + (y - x) * t;
      return {
        minute,
        snowfallIn: mix(a.snowfallIn, b.snowfallIn),
        temperatureF: mix(a.temperatureF, b.temperatureF),
        windMph: mix(a.windMph, b.windMph),
        windGustMph: mix(a.windGustMph, b.windGustMph),
        sunFactor: mix(a.sunFactor, b.sunFactor),
        visibility: mix(a.visibility, b.visibility),
        density: mix(a.density, b.density),
      };
    }
  }
  return last;
}

/** Inches falling between two minutes, from the hourly rate. */
function snowfallBetween(hourly: HourlyWeather[], from: MinuteOfDay, to: MinuteOfDay): number {
  if (hourly.length === 0 || to <= from) return 0;
  let total = 0;
  const step = 5;
  for (let m = from; m < to; m += step) {
    const sample = weatherAt(hourly, m + step / 2);
    if (sample) total += (sample.snowfallIn * step) / HOUR;
  }
  return total;
}

function crowdingCurve(crowds: CrowdCurve | null): ControlPoint[] {
  if (!crowds || crowds.samples.length === 0) {
    // Neutral prior: a normal midweek build with no data behind it.
    return [
      { minute: at(8), value: 0.15 },
      { minute: at(11), value: 0.45 },
      { minute: at(14), value: 0.35 },
      { minute: at(16), value: 0.15 },
    ];
  }
  return crowds.samples.map((sample) => ({ minute: sample.minute, value: sample.crowding }));
}

/** Comfort of the snow surface itself: temperature band, sun, and grooming. */
function surfaceScore(
  weather: HourlyWeather | null,
  daysSinceStorm: number,
  crowding: number,
  groomedShare: number,
): number {
  if (!weather) return 55;
  const temp = weather.temperatureF;
  // Peaks a little below 100 so grooming, sun and traffic have room to move it.
  const tempScore =
    temp < 0
      ? scoreBetween(temp, -20, 0) * 0.55 + 28
      : temp <= 30
        ? 94 - Math.abs(temp - 20) * 0.9
        : clamp(94 - (temp - 30) * 7.5, 10, 100);

  // Sun on warm snow turns it to glue in the afternoon; sun on cold snow is free joy.
  const solarPenalty = temp > 28 ? weather.sunFactor * (temp - 28) * 2.6 : 0;
  // Refrozen leftovers after a long dry spell — which is exactly what a cat
  // track fixes, so a mountain that grooms hard suffers far less from it.
  const stalenessPenalty = clamp(daysSinceStorm * 3.5, 0, 22) * (1 - 0.55 * groomedShare);
  // Groomers get scraped off as the day goes on; more corduroy takes longer.
  const scrapePenalty = crowding * 14 * (1 - 0.4 * groomedShare);

  return clamp(
    tempScore + groomedShare * 7 - solarPenalty - stalenessPenalty - scrapePenalty,
    5,
    100,
  );
}

function windScore(weather: HourlyWeather | null, windHoldRisk: number): number {
  if (!weather) return 60;
  const gustPenalty = scoreBetween(weather.windGustMph, 62, 10);
  return clamp(gustPenalty * (1 - windHoldRisk * 0.35), 0, 100);
}

function accessScore(
  minute: MinuteOfDay,
  ops: OperationsReport,
  aboveTreelineShare: number,
): number {
  const terrain = ops.terrainOpenShare * 100;
  const upperOpen = ops.expectedOpen + ops.upperMountainDelayMinutes;
  // Before control work finishes, the best terrain simply is not available.
  const upperPenalty = minute < upperOpen ? aboveTreelineShare * 55 : 0;
  const liftShare = ops.liftsExpectedOpen / Math.max(1, ops.liftsTotal);
  return clamp(terrain * 0.55 + liftShare * 45 - upperPenalty - ops.windHoldRisk * 18, 0, 100);
}

export function labelForQuality(quality: number, closed: boolean): string {
  if (closed) return 'Building';
  if (quality >= 88) return 'Firing';
  if (quality >= 80) return 'Great';
  if (quality >= 70) return 'Good';
  if (quality >= 58) return 'Okay';
  if (quality >= 45) return 'Picked over';
  return 'Falling off';
}

export function buildSnowClock(inputs: DayInputs, options: SnowClockOptions = {}): SnowClock {
  const step = options.stepMinutes ?? OPTIMIZER_CONFIG.snowClockStepMinutes;
  const prefs = options.preferences ?? NEUTRAL_PREFS;
  const ops = resolveOperations(inputs);
  const weather = resolveWeather(inputs);
  const crowds = resolveCrowds(inputs);
  const crowdCurve = crowdingCurve(crowds);

  const open = ops.expectedOpen;
  const close = ops.lastChair;
  const start = Math.min(CLOCK_START, open - 60);
  const points: SnowClockPoint[] = [];

  // Untracked snow is a stock, not a flow: it accumulates overnight, grows
  // while it snows, and is consumed by everyone else on the hill.
  let untracked = weather.overnightSnowIn;
  const densityBonus = clamp(0.085 / Math.max(0.04, averageDensity(weather.hourly)), 0.7, 1.4);

  for (const minute of minuteRange(start, close, step)) {
    if (minute > start) {
      untracked += snowfallBetween(weather.hourly, minute - step, minute);
      if (minute > open) {
        const crowding = clamp01(sampleCurve(crowdCurve, minute));
        // Denominator: more open terrain spreads the same crowd over more snow.
        const spread = Math.max(0.3, ops.terrainOpenShare);
        const trackRatePerHour = 0.62 * crowding / spread;
        untracked *= Math.exp((-trackRatePerHour * step) / HOUR);
      }
    }

    const hour = weatherAt(weather.hourly, minute);
    const crowding = clamp01(sampleCurve(crowdCurve, minute));

    // Roughly: 1" is a dusting, 4" is a good morning, 10" is why you set the
    // alarm. Deep enough to discriminate, quick enough that a few inches
    // already reads as a real day.
    const freshness = clamp(
      100 * saturate(untracked * densityBonus * prefs.powderPreference, 3.2),
      0,
      100,
    );
    const surface = surfaceScore(hour, weather.daysSinceStorm, crowding, ops.groomedShare);
    const wind = windScore(hour, ops.windHoldRisk);
    const visibility = hour ? clamp(hour.visibility * 100, 0, 100) : 60;
    // Crowd pain, softened by how much the rider actually minds a lift line.
    const crowdingScore = clamp(
      100 * (1 - Math.pow(crowding, 1.15) * (1 - 0.55 * prefs.crowdTolerance)),
      0,
      100,
    );
    const access = accessScore(minute, ops, inputs.mountain.terrain.aboveTreelineShare);

    // When there is powder, powder is the day. When there isn't, it's the
    // groomers — which are capped below what fresh snow can deliver.
    const powderShare = saturate(untracked, 2);
    const snowComponent =
      freshness * powderShare + surface * GROOMER_CEILING * (1 - powderShare);

    const closed = minute < open || minute > close;
    const quality = clamp(
      snowComponent * QUALITY_MIX.snow +
        wind * QUALITY_MIX.wind +
        visibility * QUALITY_MIX.visibility +
        crowdingScore * QUALITY_MIX.crowding +
        access * QUALITY_MIX.access,
      0,
      100,
    );

    points.push({
      minute,
      quality: Math.round(quality * 10) / 10,
      factors: {
        freshness: Math.round(freshness),
        surface: Math.round(surface),
        wind: Math.round(wind),
        visibility: Math.round(visibility),
        crowding: Math.round(crowdingScore),
        access: Math.round(access),
      },
      untrackedIn: Math.round(untracked * 100) / 100,
      label: labelForQuality(quality, closed),
      closed,
    });
  }

  return {
    points,
    prime: findPrimeWindow(points),
    open,
    close,
    stepMinutes: step,
  };
}

const averageDensity = (hourly: HourlyWeather[]): number =>
  hourly.length === 0 ? 0.085 : hourly.reduce((sum, h) => sum + h.density, 0) / hourly.length;

/**
 * Prime is the *best* stretch of the day, not merely an acceptable one. The
 * bar is therefore relative to the day's own peak as well as absolute: on a
 * day that never drops below 80, "prime" still means the top of it, and on a
 * mediocre day we still name the least-bad window rather than saying nothing.
 */
export function findPrimeWindow(
  points: SnowClockPoint[],
  threshold = OPTIMIZER_CONFIG.primeQualityThreshold,
  minLength = OPTIMIZER_CONFIG.minPrimeWindowMinutes,
): SnowWindow | null {
  const open = points.filter((point) => !point.closed);
  if (open.length < 2) return null;

  const peak = Math.max(...open.map((point) => point.quality));
  const attempt = (bar: number) => longestRunAbove(open, bar, minLength);
  return (
    attempt(Math.max(threshold, peak - 7)) ??
    attempt(Math.max(threshold, peak - 12)) ??
    attempt(peak - 18) ??
    attempt(peak - 0.01)
  );
}

/** Untracked inches remaining at a given minute, read off the clock. */
export function untrackedAt(clock: SnowClock, minute: MinuteOfDay): number {
  let value = 0;
  for (const point of clock.points) {
    if (point.minute > minute) break;
    value = point.untrackedIn;
  }
  return value;
}

function longestRunAbove(
  points: SnowClockPoint[],
  bar: number,
  minLength: number,
): SnowWindow | null {
  let best: SnowClockPoint[] | null = null;
  let current: SnowClockPoint[] = [];
  for (const point of points) {
    if (point.quality >= bar) {
      current.push(point);
    } else {
      if (best === null || current.length > best.length) best = current.length > 0 ? current : best;
      current = [];
    }
  }
  if (best === null || current.length > best.length) best = current.length > 0 ? current : best;
  if (!best || best.length === 0) return null;

  const first = best[0] as SnowClockPoint;
  const last = best[best.length - 1] as SnowClockPoint;
  const step = points.length > 1 ? (points[1] as SnowClockPoint).minute - (points[0] as SnowClockPoint).minute : 15;
  const end = last.minute + step;
  if (end - first.minute < minLength) return null;

  const peakPoint = best.reduce((top, point) => (point.quality > top.quality ? point : top), first);
  return {
    start: first.minute,
    end,
    peakMinute: peakPoint.minute,
    peakQuality: peakPoint.quality,
    averageQuality:
      Math.round((best.reduce((sum, point) => sum + point.quality, 0) / best.length) * 10) / 10,
  };
}

/** Quality-weighted minutes on snow between two times: the currency of the optimiser. */
export function qualityMinutesBetween(
  clock: SnowClock,
  from: MinuteOfDay,
  to: MinuteOfDay,
): number {
  if (to <= from) return 0;
  let total = 0;
  for (const point of clock.points) {
    if (point.closed) continue;
    const segmentStart = point.minute;
    const segmentEnd = point.minute + clock.stepMinutes;
    const overlap = Math.min(segmentEnd, to) - Math.max(segmentStart, from);
    if (overlap > 0) total += (point.quality / 100) * overlap;
  }
  return total;
}

/**
 * The optimiser evaluates thousands of (leave home, leave mountain) pairs, and
 * every one of them needs the integral of quality over a window. Precomputing
 * a cumulative curve turns that inner loop into two lookups.
 */
export function createQualityIntegral(clock: SnowClock): (from: MinuteOfDay, to: MinuteOfDay) => number {
  const edges: MinuteOfDay[] = [];
  const cumulative: number[] = [];
  let running = 0;
  for (const point of clock.points) {
    edges.push(point.minute);
    cumulative.push(running);
    running += point.closed ? 0 : (point.quality / 100) * clock.stepMinutes;
  }
  const lastPoint = clock.points[clock.points.length - 1];
  if (lastPoint) {
    edges.push(lastPoint.minute + clock.stepMinutes);
    cumulative.push(running);
  }

  const readAt = (minute: MinuteOfDay): number => {
    const firstEdge = edges[0];
    const lastEdge = edges[edges.length - 1];
    if (firstEdge === undefined || lastEdge === undefined) return 0;
    if (minute <= firstEdge) return 0;
    if (minute >= lastEdge) return cumulative[cumulative.length - 1] ?? 0;
    const index = Math.floor((minute - firstEdge) / clock.stepMinutes);
    const base = cumulative[index] ?? 0;
    const point = clock.points[index];
    if (!point || point.closed) return base;
    return base + (point.quality / 100) * (minute - (edges[index] ?? minute));
  };

  return (from, to) => (to <= from ? 0 : Math.max(0, readAt(to) - readAt(from)));
}

export function qualityAt(clock: SnowClock, minute: MinuteOfDay): number {
  const point = clock.points.find(
    (candidate) => minute >= candidate.minute && minute < candidate.minute + clock.stepMinutes,
  );
  return point ? point.quality : 0;
}
