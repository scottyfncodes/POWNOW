/**
 * Operational state, as a first-class fact rather than a derived guess.
 *
 * "The lift feed failed" and "the mountain is closed" are different events,
 * and conflating them is exactly the kind of dishonesty this product refuses
 * elsewhere. `UNKNOWN` exists so a dead feed can say so instead of quietly
 * becoming `OPEN` (optimistic) or `CLOSED` (alarmist) — see
 * `engine/operationalState.ts` for how a state is chosen.
 */
export type MountainOperationalState =
  | 'OFF_SEASON'
  | 'PRESEASON'
  | 'NO_SNOW'
  | 'INSUFFICIENT_COVERAGE'
  | 'CLOSED'
  | 'LIMITED_OPERATIONS'
  | 'OPEN'
  | 'OPEN_WITH_RESTRICTIONS'
  | 'UNKNOWN';

/**
 * States where a normal NOW/LATER ski recommendation is not the useful
 * answer. `UNKNOWN` is deliberately excluded: "we don't know the lift
 * status" already has a correct, tested answer (impute a neutral value,
 * lower confidence, keep recommending — see `engine/snowClock.ts`'s
 * `FALLBACK_OPS`) and replacing that with a full off-season takeover would
 * make a routine dead feed look like a much bigger problem than it is.
 */
export const NON_SKIABLE_STATES: ReadonlySet<MountainOperationalState> = new Set([
  'OFF_SEASON',
  'PRESEASON',
  'NO_SNOW',
  'INSUFFICIENT_COVERAGE',
  'CLOSED',
]);

/** A short, personality-forward line plus the real data behind it. */
export interface OffSeasonMessage {
  state: MountainOperationalState;
  /** The one-liner. Never repeated verbatim as the *only* message in the bank — see offSeasonMessages.ts. */
  line: string;
  /** Plain-language explanation grounded in real data: why, current situation, what's coming. */
  detail: string;
}
