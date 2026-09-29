import type { WeatherAlert } from './alerts';
import type { ElevationConditions, OperationsReport, SnowHistory } from './conditions';
import type { DateKey } from './dates';
import type { Mountain, Origin, PassAffiliation } from './mountain';
import type { MountainOperationalState, OffSeasonMessage } from './mountainStatus';
import type { ParkingInfo } from './parking';
import type { TicketPrice } from './pricing';
import type { Availability, ConfidenceLevel, DisplayStatus, Provenance } from './provenance';
import type { SnowpackObservation } from './snowpack';
import type { MinuteOfDay, Minutes } from './time';

/**
 * One row of "what did this number actually come from". Built once per plan
 * so a single disclosure panel can list every input's honesty at a glance,
 * instead of the user having to trust one aggregate badge to speak for six
 * independent feeds that can each be live, stale, demo, or down on their own.
 */
export interface DataSourceStatus {
  label: string;
  status: DisplayStatus;
  provider: string;
  fetchedAt?: string;
  /** Set only when `provider` needs a "this is third-party, not official" caveat. */
  attribution?: string;
  /** Where a human can check this themselves, when the source publishes one. */
  sourceUrl?: string;
}

/** ---- Snow clock -------------------------------------------------------- */

export interface SnowClockPoint {
  minute: MinuteOfDay;
  /** 0..100 how good the skiing is at this moment. */
  quality: number;
  /** Individual contributions, all 0..100, for explanation and testing. */
  factors: {
    freshness: number;
    surface: number;
    wind: number;
    visibility: number;
    crowding: number;
    access: number;
  };
  /** Untracked fresh snow still available, inches. */
  untrackedIn: number;
  label: string;
  /** True before first chair / after last chair. */
  closed: boolean;
}

export interface SnowWindow {
  start: MinuteOfDay;
  end: MinuteOfDay;
  peakMinute: MinuteOfDay;
  peakQuality: number;
  averageQuality: number;
}

export interface SnowClock {
  points: SnowClockPoint[];
  /**
   * The best contiguous stretch of the day, relative to the day's own peak.
   * This is a *timing* signal — "when is it best to be here" — and is named
   * even on a mediocre day so the optimiser and the "when to leave" UI always
   * have a window to aim for. It does NOT by itself mean the snow is good in
   * an absolute sense; see `SnowState` / `snowState` on `SkiDayPlan` for the
   * honest, absolute read on conditions. Never label this "PRIME SNOW" in the
   * UI without checking that absolute state first.
   */
  prime: SnowWindow | null;
  open: MinuteOfDay;
  close: MinuteOfDay;
  stepMinutes: Minutes;
}

/**
 * The honest, absolute read on snow conditions — distinct from `SnowClock.prime`,
 * which only ever describes the day's *best relative window* and is named even
 * on a bone-dry day. `SnowState` is what may actually be shown to a user as a
 * claim about the snow itself:
 *
 * - `prime`: real evidence supports genuinely strong ski-quality conditions.
 * - `building`: snow is falling now or meaningfully forecast, but not yet on
 *   the ground in a way that clears the bar for `prime`.
 * - `limited`: some snow is present (recent or currently on the ground) but
 *   coverage/quality falls short of `prime`.
 * - `none`: no meaningful current, recent, or incoming snow.
 * - `unavailable`: the weather feed itself is down — there isn't enough
 *   trustworthy data to make any snow-quality claim at all.
 */
export type SnowState = 'prime' | 'building' | 'limited' | 'none' | 'unavailable';

/** ---- Scoring ----------------------------------------------------------- */

export type ScoreFactorKey =
  | 'snow'
  | 'snowCycle'
  | 'snowTiming'
  | 'weather'
  | 'wind'
  | 'terrain'
  | 'operations'
  | 'travel'
  | 'traffic'
  | 'roads'
  | 'crowds'
  | 'usableTime'
  | 'ticket';

export interface ScoreFactor {
  key: ScoreFactorKey;
  label: string;
  /** 0..100 */
  value: number;
  weight: number;
  /** value * weight, before normalisation. */
  contribution: number;
  note: string;
  /** True when the factor fell back to a neutral prior because data was missing. */
  imputed: boolean;
}

export interface ScorePenalty {
  label: string;
  /** Raw points (0..100 scale) removed from the weighted average. */
  points: number;
}

export interface DayScore {
  /** 0..10, one decimal, the number on the card. */
  score: number;
  /** 0..100 internal resolution. */
  raw: number;
  factors: ScoreFactor[];
  /** Deductions applied after weighting, kept visible rather than buried. */
  penalties: ScorePenalty[];
  confidence: ConfidenceLevel;
  /** Factors that most helped / hurt, strongest first. */
  strengths: ScoreFactor[];
  weaknesses: ScoreFactor[];
}

/** ---- Departure / return optimisation ----------------------------------- */

export interface DepartureOption {
  departure: MinuteOfDay;
  arrival: MinuteOfDay;
  /** When you're actually clicked in (arrival + parking/boots). */
  firstTurn: MinuteOfDay;
  driveMinutes: Minutes;
  congestion: number;
  /** Minutes of the prime window you actually catch. */
  primeCaptured: Minutes;
  /** Quality-weighted minutes on snow — what we really optimise. */
  qualityMinutes: number;
  /** 0..100 for this departure alone. */
  score: number;
  /** True when this is the recommended departure. */
  recommended: boolean;
  /** Sleep cost relative to the earliest evaluated departure, minutes. */
  extraSleep: Minutes;
}

export interface ReturnOption {
  departure: MinuteOfDay;
  homeArrival: MinuteOfDay;
  driveMinutes: Minutes;
  congestion: number;
  /** Total minutes on the mountain if you leave at this time. */
  mountainMinutes: Minutes;
  /** Quality-weighted ski minutes gained by staying until this time. */
  qualityMinutes: number;
  score: number;
  recommended: boolean;
  /** Compared to the recommended option. */
  extraMountainMinutes: Minutes;
  extraDriveMinutes: Minutes;
  extraHomeDelayMinutes: Minutes;
  trafficLight: 'green' | 'yellow' | 'red';
}

export interface Tradeoff {
  text: string;
  /** True when this is a point in the alternative's favour. */
  better: boolean;
}

export interface TimelineEvent {
  minute: MinuteOfDay;
  icon: string;
  label: string;
  detail?: string;
  emphasis?: boolean;
}

/** ---- The plan ---------------------------------------------------------- */

export interface SkiDayPlan {
  mountain: Mountain;
  origin: Origin;
  date: DateKey;
  isToday: boolean;
  score: DayScore;
  snowClock: SnowClock;
  /** The honest, absolute snow-quality claim for this plan — see `SnowState`. */
  snowState: SnowState;
  /** Snow that fell overnight and is still skiable, inches. `null` only when the weather feed itself failed. */
  freshSnowIn: number | null;
  /** Base-elevation conditions, when the weather feed succeeded. Never a guess. */
  baseConditions: ElevationConditions | null;
  /** Summit conditions. `null` whenever the provider couldn't resolve one — never copied from base. */
  peakConditions: ElevationConditions | null;
  /** Five-day-back / five-day-forward snowfall, when a real source covers it. */
  snowHistory: SnowHistory | null;
  /** The weather model's own snow depth at the forecast point — an estimate, labeled as one. */
  modelSnowDepthIn: number | null;
  /** A measured snowpack reading at the nearest station, when one exists. Never derived from the model. */
  snowpack: SnowpackObservation | null;
  /** Real-world operational state, distinct from "the feed is unavailable." */
  operationalState: MountainOperationalState;
  /** Lift/terrain report, when the feed succeeded. `null` — never a guessed lift count — when it didn't. */
  operations: OperationsReport | null;
  /** Set only in the non-skiable states (see `NON_SKIABLE_STATES`) — a personality-forward line plus the real data behind it. */
  offSeasonMessage: OffSeasonMessage | null;
  /** Null when pricing was unavailable — never a guessed number. */
  ticket: TicketPrice | null;
  /**
   * The resort's own ticket page, shown even when `ticket` is null — "we
   * can't confirm the price" should never mean "and we won't tell you where
   * to look." Static per-resort data, not fetched, so it is present whenever
   * the resort is known regardless of whether the live price call succeeded.
   */
  ticketPurchaseUrl?: string;
  /** The rider's pass that covers this mountain, when they told us they hold one. */
  passCoverage: PassAffiliation | null;
  /** Active official alerts, supplementary only — scoring never reads this. */
  alerts: WeatherAlert[];
  /** Parking rules/status for this mountain — see `domain/parking.ts`. Supplementary; scoring never reads this. */
  parking: Availability<ParkingInfo>;
  /** Per-feed honesty, for the "data sources" disclosure. */
  dataSources: DataSourceStatus[];
  departure: DepartureOption | null;
  departureOptions: DepartureOption[];
  return: ReturnOption | null;
  returnOptions: ReturnOption[];
  /** Real route distance — Google's reported figure when traffic is live, the pre-authored/estimated figure otherwise. `null` only when no route at all was resolved. */
  routeDistanceMiles: number | null;
  /** The corridor/road description for the route actually used, e.g. "I-70 west to Avon". */
  routeLabel: string | null;
  timeline: TimelineEvent[];
  /** Two or three lines of plain-language reasoning. */
  headline: string;
  verdict: string;
  reasons: string[];
  tradeoffs: Tradeoff[];
  provenance: Provenance;
  /** Human-readable notes about missing data that limited the call. */
  caveats: string[];
}

export interface Recommendation {
  date: DateKey;
  origin: Origin;
  best: SkiDayPlan;
  alternatives: SkiDayPlan[];
  all: SkiDayPlan[];
  /** Why the winner beat the runner-up, in one or two lines. */
  comparison: string;
  generatedAt: string;
  usingDemoData: boolean;
  caveats: string[];
}

export interface StayOrGoAdvice {
  /** The time the advice was computed for. */
  now: MinuteOfDay;
  verdict: 'go-now' | 'stay' | 'window-open';
  headline: string;
  detail: string;
  /** Leave right now vs. the recommended later departure. */
  leaveNow: ReturnOption | null;
  leaveLater: ReturnOption | null;
  minutesToWait: Minutes;
}
