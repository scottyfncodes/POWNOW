import type { PassAffiliation } from '@/domain/mountain';
import type { ScoreFactorKey } from '@/domain/plan';

/**
 * Scoring weights live here, not in the engine and definitely not in the UI.
 * Tuning the product's opinion should be a config change.
 *
 * A score is decision support, not scientific truth. The weights encode one
 * claim: a great ski day is mostly about the snow you actually get to ski,
 * and the drive is a real, first-class cost — not a footnote.
 */
export interface ScoringWeights {
  factors: Record<ScoreFactorKey, number>;
  labels: Record<ScoreFactorKey, string>;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  factors: {
    snow: 1.8,
    /*
     * The snow *cycle*, not the snow clock: how much actually fell in the
     * last five days and how much is projected in the next five. `snow`
     * above already answers "what's still there when you click in today" —
     * this answers the question that leaves two mountains with an identical
     * base and an identical overnight total looking identical when one just
     * had a foot fall this week and the other has been bone dry. Weighted
     * well under `snow` on purpose: a strong five-day cycle is context for
     * today's call, not a substitute for what's actually skiable right now.
     * See `engine/scoring.ts#snowCycleFactor` and the tests in
     * `scoring.test.ts` under "snow cycle".
     */
    snowCycle: 0.6,
    snowTiming: 1.2,
    weather: 0.6,
    wind: 0.7,
    terrain: 1.0,
    operations: 0.8,
    // Traffic and crowds are deliberately light here: both already depress the
    // snow clock and the travel burden, and double-counting them would let a
    // two-hour dawn patrol outscore a full powder day.
    travel: 1.2,
    traffic: 0.7,
    roads: 0.9,
    crowds: 0.6,
    usableTime: 2.0,
    /*
     * Ticket price is real decision context, not the decision. It is weighted
     * so the full spread of the market — roughly a $200 gap between the
     * cheapest independent and a peak window rate at a destination resort —
     * moves the published score by at most about 0.35 out of 10. That is
     * enough to break a genuine tie and to be visible in the explanation, and
     * deliberately nowhere near enough for a cheap ticket to outrank a
     * materially better ski day. `scoring.test.ts` holds that line.
     */
    ticket: 0.5,
  },
  labels: {
    snow: 'Snow',
    snowCycle: '5-day snow cycle',
    snowTiming: 'Snow timing',
    weather: 'Weather',
    wind: 'Wind',
    terrain: 'Terrain open',
    operations: 'Lifts & ops',
    travel: 'Travel burden',
    traffic: 'Traffic',
    roads: 'Roads',
    crowds: 'Crowds',
    usableTime: 'Useful ski time',
    ticket: 'Ticket price',
  },
};

/**
 * Rider preferences bias the same engine; they never change what NOW and
 * LATER mean. `sleepVsSend` runs 0 (protect my sleep) → 1 (first chair or bust).
 */
export interface RiderPreferences {
  originId: string;
  sleepVsSend: number;
  /** How much powder is worth relative to everything else, 0.5..1.5 multiplier. */
  powderPreference: number;
  /** 0 (hates crowds) .. 1 (doesn't care). */
  crowdTolerance: number;
  /** Hard ceiling on one-way drive, minutes. */
  maxDriveMinutes: number;
  /** Earliest the rider will get out of bed. */
  earliestDeparture: number;
  /** Latest the rider wants to be home. */
  latestHomeArrival: number;
  favoriteMountainIds: string[];
  /**
   * Season passes the rider holds. A mountain one of them honors costs
   * nothing extra that day, so its ticket factor reads as covered rather
   * than as a walk-up price nobody is going to pay.
   */
  passes: PassAffiliation[];
  /** Only consider mountains one of `passes` honors. Ignored when `passes` is empty. */
  onlyMyPasses: boolean;
}

export const DEFAULT_PREFERENCES: RiderPreferences = {
  originId: 'denver',
  sleepVsSend: 0.6,
  powderPreference: 1,
  crowdTolerance: 0.45,
  maxDriveMinutes: 300,
  earliestDeparture: 4 * 60,
  latestHomeArrival: 19 * 60,
  favoriteMountainIds: [],
  passes: [],
  onlyMyPasses: false,
};

/** Tunables the optimisers share. Kept out of the algorithms for testability. */
export const OPTIMIZER_CONFIG = {
  /** Parking, boots, ticket, walk to the lift. */
  baseToLiftMinutes: 22,
  /** Departure grid resolution, minutes. */
  departureStepMinutes: 6,
  /** Return grid resolution, minutes. */
  returnStepMinutes: 6,
  /** Snow clock resolution, minutes. */
  snowClockStepMinutes: 15,
  /** Quality at or above this counts as "prime". */
  primeQualityThreshold: 72,
  /** Minimum length of a window we'll call prime. */
  minPrimeWindowMinutes: 45,
  /** How many minutes of driving equal one minute of top-quality skiing. */
  driveMinutesPerQualityMinute: 0.5,
  /** Extra distaste for driving in heavy congestion, multiplier on congested minutes. */
  congestionPainMultiplier: 0.9,
  /** Sleep value per minute, scaled by (1 - sleepVsSend). */
  sleepValuePerMinute: 0.35,
  /** Value of hanging around the mountain after last chair (après, waiting out traffic). */
  apresValuePerMinute: 0.08,
  /** Penalty per minute home later than the rider wants. */
  lateHomePenaltyPerMinute: 1.5,
  /** Cost of standing in the parking lot before the lifts turn. */
  preOpenWaitPerMinute: 0.28,
  /**
   * Value of being early in the line when there is powder to be had. Scaled by
   * how much untracked snow is actually waiting, and capped: nobody's third
   * hour in a dark parking lot is buying them anything.
   */
  firstTracksValuePerMinute: 0.22,
  firstTracksMaxMinutes: 60,
  /** Shortest ski day worth driving for. */
  minSkiMinutes: 90,
  /** How long after last chair we're willing to wait out traffic. */
  maxWaitAfterLastChair: 120,
} as const;

export type OptimizerConfig = typeof OPTIMIZER_CONFIG;
