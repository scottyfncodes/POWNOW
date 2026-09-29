/**
 * Every number POW NOW shows can be traced to where it came from and how much
 * we trust it. This is a product rule, not a nicety: we never render demo data
 * as if it were live, and we never render a forecast as if it were observed.
 */
export type DataSource = 'live' | 'demo';

export type Observation = 'observed' | 'forecast' | 'projected';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface Provenance {
  source: DataSource;
  /** observed = measured now, forecast = short-range model, projected = climatology-weighted. */
  observation: Observation;
  confidence: ConfidenceLevel;
  /** Provider that produced the value, e.g. "demo-weather". */
  provider: string;
  /** How far ahead of "now" this describes, in days. 0 = today. */
  horizonDays: number;
  /**
   * When this value was actually fetched, ISO 8601. Optional because demo
   * data has no real fetch moment — a demo provenance simply omits it rather
   * than inventing a timestamp for something that never happened.
   */
  fetchedAt?: string;
  /**
   * How long the value should be trusted before it counts as stale, ISO 8601.
   * A live weather pull is good for the next hour or so; a live travel curve
   * for less. Demo provenance omits this too.
   */
  validUntil?: string;
  /**
   * Set only when `provider` could be mistaken for something it isn't —
   * chiefly a third-party aggregator that did not come from the resort
   * itself (e.g. "Third-party aggregator (Liftie), not the resort's own
   * feed"). Absent for anything unambiguous, official or demo.
   */
  attribution?: string;
}

/** Successful or unavailable data, so the UI can render honest empty states. */
export type Availability<T> =
  | { status: 'ok'; data: T; provenance: Provenance }
  | { status: 'unavailable'; reason: string; provider: string };

export const ok = <T,>(data: T, provenance: Provenance): Availability<T> => ({
  status: 'ok',
  data,
  provenance,
});

export const unavailable = <T,>(provider: string, reason: string): Availability<T> => ({
  status: 'unavailable',
  reason,
  provider,
});

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = { high: 3, medium: 2, low: 1 };

export function weakestConfidence(levels: ConfidenceLevel[]): ConfidenceLevel {
  if (levels.length === 0) return 'low';
  return levels.reduce((worst, level) =>
    CONFIDENCE_RANK[level] < CONFIDENCE_RANK[worst] ? level : worst,
  );
}

/**
 * Forecast confidence decays with lead time. Beyond about a week we are
 * leaning on climatology, and the product should say so.
 */
export function confidenceForHorizon(horizonDays: number): ConfidenceLevel {
  if (horizonDays <= 2) return 'high';
  if (horizonDays <= 6) return 'medium';
  return 'low';
}

export function observationForHorizon(horizonDays: number): Observation {
  if (horizonDays === 0) return 'observed';
  if (horizonDays <= 6) return 'forecast';
  return 'projected';
}

export const confidenceLabel = (level: ConfidenceLevel): string =>
  ({ high: 'HIGH CONFIDENCE', medium: 'MEDIUM CONFIDENCE', low: 'LOW CONFIDENCE' })[level];

/**
 * The four states the product is willing to show for a piece of data. This is
 * the whole point of carrying provenance: the UI renders exactly one of these
 * words, and it is never allowed to say LIVE about something that isn't.
 */
export type DisplayStatus = 'live' | 'stale' | 'demo' | 'unavailable';

export const DISPLAY_STATUS_LABEL: Record<DisplayStatus, string> = {
  live: 'LIVE',
  stale: 'STALE',
  demo: 'DEMO DATA',
  unavailable: 'UNAVAILABLE',
};

/**
 * Resolves an Availability into the one honest word the UI is allowed to use.
 * Demo data is always 'demo', however fresh it "feels" — it never gets to
 * borrow LIVE's credibility. Live data ages out to 'stale' once past its
 * `validUntil`; a live value with no `validUntil` set is treated as live for
 * as long as the caller holds it (the provider chose not to time-box it).
 */
export function displayStatus(
  availability: { status: 'ok'; provenance: Provenance } | { status: 'unavailable' },
  now: Date = new Date(),
): DisplayStatus {
  if (availability.status === 'unavailable') return 'unavailable';
  const { provenance } = availability;
  if (provenance.source === 'demo') return 'demo';
  if (provenance.validUntil && new Date(provenance.validUntil).getTime() < now.getTime()) {
    return 'stale';
  }
  return 'live';
}
