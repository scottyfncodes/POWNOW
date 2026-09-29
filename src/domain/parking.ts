/**
 * Parking, as a first-class piece of the ski-day decision — not a footnote in
 * "other mountain information."
 *
 * No provider in this codebase has access to a live, per-lot occupancy feed
 * for any of these resorts (there is no public API for it — see
 * `data/parkingInfo.ts`). `status` is therefore honestly `'unknown'` for
 * every mountain today. What *is* real and useful is the resort's own
 * published parking structure — which lots are free, whether a reservation
 * is required, and where to check same-day status — and that is what
 * `notes` / `reservationRequired` / `infoUrl` carry. The moment a mountain
 * exposes genuine live occupancy, `status`/`occupied`/`capacity` are the
 * fields a real provider fills in; nothing else about this shape has to
 * change.
 */
export type ParkingOccupancyStatus =
  | 'good'
  | 'moderate'
  | 'limited'
  | 'very-limited'
  | 'full'
  | 'unknown';

export const PARKING_STATUS_LABEL: Record<ParkingOccupancyStatus, string> = {
  good: 'Good',
  moderate: 'Moderate',
  limited: 'Limited',
  'very-limited': 'Very limited',
  full: 'Full',
  unknown: 'Unavailable',
};

/** Whether the resort requires a reservation for (at least some) parking. Never guessed — 'unknown' when unconfirmed. */
export type ReservationRequirement = 'required' | 'not-required' | 'partial' | 'unknown';

export const RESERVATION_LABEL: Record<ReservationRequirement, string> = {
  required: 'Reservation required',
  'not-required': 'No reservation needed',
  partial: 'Reservation required for some lots',
  unknown: 'Reservation policy unconfirmed',
};

export interface ParkingInfo {
  /** Live occupancy read. 'unknown' whenever no genuine live occupancy source exists — never guessed from time of day or popularity. */
  status: ParkingOccupancyStatus;
  /** Real counts, only ever set by a genuine live source — never estimated from `status`. */
  occupied: number | null;
  capacity: number | null;
  reservationRequired: ReservationRequirement;
  /** Whether a free (non-reserved, non-paid) parking option exists at all. `null` when unconfirmed. */
  freeOptionAvailable: boolean | null;
  /** Short, factual, resort-published notes — lot names, shuttle hours, fees. Never a fabricated rule. */
  notes: string[];
  /** Where a human can check current parking rules/status themselves. */
  infoUrl: string | null;
  /** A phone/contact for parking or transportation, when published separately from the resort's main line. */
  contact?: string | null;
}
