import { type DateKey, holidayName, isWeekend } from '@/domain/dates';
import type { Mountain } from '@/domain/mountain';
import { at, clamp, clamp01, type MinuteOfDay } from '@/domain/time';
import { createRng, hashSeed, type Rng } from '@/lib/random';

/**
 * The demo world.
 *
 * This module invents a plausible mid-season Colorado ski day for any date and
 * keeps it stable: the same date always produces the same world. It exists so
 * SNOWNOW can be evaluated end-to-end before any vendor API is wired up.
 *
 * Nothing here is real. Providers stamp every value with `source: 'demo'` and
 * the UI never renders demo numbers without saying so.
 *
 * The one rule the demo data has to obey is *causal differentiation*: the
 * mountain that wins has to win for a reason a skier would recognise. So each
 * mountain gets a distinct identity **and a distinct vulnerability**, and the
 * weather generator produces the conditions that expose them — big storms,
 * dry spells, wind events, warm afternoons, and storm tracks that favour one
 * part of the state over another.
 */

/** Fixed per-mountain character. These biases are what make the demo *mean* something. */
export interface MountainProfile {
  /** Multiplier on regional snowfall. */
  snow: number;
  /** Multiplier on regional wind, before terrain exposure. */
  wind: number;
  /** Multiplier on lift/terrain reliability, >1 is more dependable. */
  operations: number;
  /** Multiplier on crowding. */
  crowds: number;
  /** How much of the open terrain gets groomed overnight, 0..1. */
  grooming: number;
  /** Typical avalanche-control delay on a big storm, minutes. */
  controlDelay: number;
}

/*
 * Identity — and the condition that punishes it:
 *
 *  Vail          most snow on the corridor · biggest crowds, exposed bowls
 *  Beaver Creek  never bad at anything     · modest snow, furthest up I-70
 *  Breckenridge  highest alpine in the US  · worst wind holds, longest control work
 *  Keystone      first chair, best corduroy· least snow of the corridor
 *  Crested Butte deepest and emptiest      · the drive
 *  Winter Park   real snow, real terrain   · Berthoud Pass in a storm
 *  Purgatory     San Juan track, no lines  · south-facing, low, and far from everywhere
 *  Copper        best-sorted terrain, closest· the good stuff up high goes on wind hold
 *  Wolf Creek    the most snow in the state  · four and a half hours from Denver
 *  Monarch       divide-top storms, no lines  · small, slow lifts, three hours out
 *  Telluride     deep and steep, Alpino Vino  · the end of a dead-end road
 */
const PROFILES: Record<string, MountainProfile> = {
  vail: { snow: 1.34, wind: 1.3, operations: 0.96, crowds: 1.06, grooming: 0.78, controlDelay: 35 },
  'beaver-creek': { snow: 0.78, wind: 0.5, operations: 1.06, crowds: 0.58, grooming: 0.88, controlDelay: 10 },
  breckenridge: { snow: 1.14, wind: 1.5, operations: 0.94, crowds: 1.0, grooming: 0.74, controlDelay: 40 },
  keystone: { snow: 0.7, wind: 0.62, operations: 1.14, crowds: 0.86, grooming: 0.95, controlDelay: 10 },
  'crested-butte': { snow: 1.5, wind: 1.12, operations: 0.86, crowds: 0.34, grooming: 0.6, controlDelay: 45 },
  'winter-park': { snow: 1.2, wind: 1.08, operations: 0.98, crowds: 0.78, grooming: 0.8, controlDelay: 30 },
  purgatory: { snow: 1.0, wind: 0.45, operations: 1.12, crowds: 0.26, grooming: 0.9, controlDelay: 8 },
  copper: { snow: 0.95, wind: 1.3, operations: 0.95, crowds: 0.92, grooming: 0.84, controlDelay: 35 },
  'wolf-creek': { snow: 1.75, wind: 1.02, operations: 1.08, crowds: 0.5, grooming: 0.66, controlDelay: 25 },
  // Monarch: a divide-top pass resort that catches San Juan storms, old fixed-grip lifts, nobody in line.
  monarch: { snow: 1.3, wind: 0.95, operations: 1.0, crowds: 0.3, grooming: 0.7, controlDelay: 20 },
  // Telluride: deep San Juan snow, a lot of steep terrain that needs control work, a long way from Denver.
  telluride: { snow: 1.25, wind: 1.1, operations: 0.95, crowds: 0.5, grooming: 0.72, controlDelay: 35 },
};

const NEUTRAL_PROFILE: MountainProfile = {
  snow: 1,
  wind: 1,
  operations: 1,
  crowds: 1,
  grooming: 0.8,
  controlDelay: 20,
};

export const profileFor = (mountainId: string): MountainProfile =>
  PROFILES[mountainId] ?? NEUTRAL_PROFILE;

export interface RegionalPattern {
  date: DateKey;
  region: string;
  /** 0 (bluebird, nothing falling) .. 1 (a proper cycle). */
  stormIntensity: number;
  /** Total inches that fell overnight, regionally, before any mountain bias. */
  overnightIn: number;
  /** Peak snowfall rate in inches/hour during the daytime tail of the storm. */
  daytimeRateInPerHour: number;
  /** When the daytime snowfall tapers out. */
  stormTaperMinute: MinuteOfDay;
  baseTempF: number;
  /** Degrees of warming from dawn to mid-afternoon. */
  diurnalRangeF: number;
  windBaseMph: number;
  /** True when this is a genuine wind event, not just a breezy day. */
  windEvent: boolean;
  /** 0..1, 1 = full sun. Storms suppress it. */
  sunBase: number;
  density: number;
  daysSinceStorm: number;
  recentSnow72hIn: number;
  /** Aggregate corridor demand, 1 = a normal busy Saturday. */
  demandFactor: number;
  holiday: string | null;
  weekend: boolean;
  summary: string;
}

const SEED_SALT = 'snownow-demo-v2';

/**
 * Day zero is deliberately shaped into a storm day somewhere in the state: the
 * product story starts at 4:47am with snow on the ground, and a demo that
 * opens on a dry Tuesday teaches nobody anything. Every other date is left to
 * the seed.
 */
function bandFor(roll: number, rng: Rng): number {
  if (roll < 0.32) return rng.range(0, 0.16);
  if (roll < 0.58) return rng.range(0.16, 0.45);
  if (roll < 0.82) return rng.range(0.45, 0.72);
  return rng.range(0.72, 1);
}

/**
 * Regions share a synoptic pattern but not a storm track. A system can favour
 * the San Juans while the I-70 corridor gets scraps, which is exactly the case
 * a single global "how snowy is it today" number can never express.
 */
export function regionalPattern(
  date: DateKey,
  horizonDays: number,
  region = 'i70-corridor',
): RegionalPattern {
  const synoptic = createRng(hashSeed(SEED_SALT, date, 'synoptic'));
  const rng = createRng(hashSeed(SEED_SALT, date, region));

  /*
   * A synoptic regime tilts the whole state, then each region still rolls its
   * own outcome. Blending the *rolls* rather than the resulting intensities
   * matters: averaging two intensities would erase both ends of the
   * distribution and leave the demo with nothing but forgettable middling
   * days. The widened spread keeps real dumps and real bluebird days common,
   * while still correlating the two regions.
   */
  const regimeRoll = synoptic.next();
  const localRoll = rng.next();
  const blended = clamp01(0.5 + (localRoll - 0.5) * 1.25 + (regimeRoll - 0.5) * 0.55);
  // Today always has fresh snow somewhere worth driving to — the demo should
  // open on the day the product was designed for. Every other date is free.
  const roll = horizonDays === 0 ? clamp(blended, 0.62, 1) : blended;
  const stormIntensity = bandFor(roll, rng);
  const storming = stormIntensity > 0.2;

  // The San Juans sit lower and further south: warmer, sunnier, drier snow is rarer.
  const south = region === 'san-juans';
  const baseTempF = rng.around(storming ? (south ? 21 : 17) : south ? 26 : 21, 7, 2, 36);
  const density = clamp(0.045 + (baseTempF - 5) * 0.0022 + rng.range(-0.006, 0.006), 0.04, 0.13);

  // Wind events are their own thing, and they are what wreck high alpine days.
  const windEvent = synoptic.chance(0.18);
  const windBaseMph = windEvent
    ? rng.around(34, 9, 22, 58)
    : rng.around(storming ? 16 : 9, 6, 2, 30);

  const overnightIn = storming ? stormIntensity * rng.range(7, 15) : rng.range(0, 1.4);
  const daytimeRate = storming ? stormIntensity * rng.range(0.4, 1.3) : 0;
  const taper = storming ? at(8, 0) + Math.round(stormIntensity * rng.range(60, 260)) : at(6, 0);

  const daysSinceStorm = storming ? 0 : Math.round(rng.range(1, 7));
  const recentSnow72h = overnightIn + (storming ? rng.range(2, 9) * stormIntensity : rng.range(0, 5));

  const holiday = holidayName(date);
  const weekend = isWeekend(date);
  const demandFactor = clamp(
    (weekend ? 1 : 0.52) * (holiday ? 1.24 : 1) * (1 + stormIntensity * 0.34) + rng.range(-0.06, 0.06),
    0.25,
    1.7,
  );

  return {
    date,
    region,
    stormIntensity,
    overnightIn,
    daytimeRateInPerHour: daytimeRate,
    stormTaperMinute: taper,
    baseTempF,
    diurnalRangeF: storming ? rng.range(6, 12) : rng.range(12, 22),
    windBaseMph,
    windEvent,
    sunBase: storming ? clamp01(0.9 - stormIntensity) : rng.range(0.65, 1),
    density,
    daysSinceStorm,
    recentSnow72hIn: recentSnow72h,
    demandFactor,
    holiday,
    weekend,
    summary: summarise(stormIntensity, daysSinceStorm, windEvent),
  };
}

function summarise(intensity: number, daysSinceStorm: number, windEvent: boolean): string {
  const wind = windEvent ? ' Strong wind through the day.' : '';
  if (intensity > 0.65) return `Active storm cycle. Snow overnight, still falling into the morning.${wind}`;
  if (intensity > 0.2) return `Light-to-moderate snow overnight, tapering through the morning.${wind}`;
  if (daysSinceStorm <= 2) return `Between systems. Leftovers off the last storm, mostly firm and fast.${wind}`;
  return `Dry pattern. Groomers are the play.${wind}`;
}

export const patternFor = (
  mountain: Mountain,
  date: DateKey,
  horizonDays: number,
): RegionalPattern => regionalPattern(date, horizonDays, mountain.snowRegion);

/**
 * Wind exposure applies to the *excess* over a calm baseline, not to the whole
 * number. A mountain with exposed alpine terrain is not windier than its
 * neighbour on a still morning — it is dramatically windier when the wind
 * actually blows, which is the behaviour that should decide a ski day.
 */
const CALM_BASELINE_MPH = 8;

export const exposedWind = (regionalMph: number, exposure: number): number =>
  CALM_BASELINE_MPH + Math.max(0, regionalMph - CALM_BASELINE_MPH) * exposure;

/** Aspect and elevation modulate how much of a regional storm each mountain sees. */
export function orographicFactor(mountain: Mountain, pattern: RegionalPattern): number {
  const elevationBoost = 1 + (mountain.weatherLocation.forecastElevationFt - 10400) / 9000;
  const aspectBoost = {
    'west-facing': 1.12,
    divide: 1.02,
    'east-facing': 0.9,
    'south-facing': 0.86,
  }[mountain.weatherLocation.aspect];
  const rng = createRng(hashSeed(SEED_SALT, pattern.date, mountain.id, 'oro'));
  return clamp(elevationBoost * aspectBoost * rng.around(1, 0.17, 0.62, 1.42), 0.5, 1.7);
}

export const mountainRng = (mountain: Mountain, date: DateKey, salt: string): Rng =>
  createRng(hashSeed(SEED_SALT, date, mountain.id, salt));
