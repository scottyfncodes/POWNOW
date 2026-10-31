import { mountainProfileFor } from '@/data/mountainProfiles';
import { type DateKey, fromDateKey, MONTH_LONG } from '@/domain/dates';
import type { Mountain } from '@/domain/mountain';
import type { SeasonDate } from '@/domain/mountainProfile';

/**
 * Where a mountain is in its season, from the one fact nobody has to fetch:
 * the resort's own announced opening and closing dates
 * (`data/mountainProfiles.ts`). A live lift board outranks this whenever it
 * shows lifts running (resorts open early on good snow, as A-Basin did in
 * October 2026); this only answers the question when the board is silent or
 * shows everything closed.
 */
export type SeasonPhase = 'preseason' | 'postseason' | 'in-season' | 'unknown';

export interface SeasonInfo {
  phase: SeasonPhase;
  opening: SeasonDate | null;
  closing: SeasonDate | null;
}

/** Months a missing or all-closed board most likely means "not open yet", when no date is announced. */
const OPENING_MONTHS = new Set([9, 10, 11, 12]);

export function seasonFor(mountain: Mountain, date: DateKey): SeasonInfo {
  const profile = mountainProfileFor(mountain.id);
  const opening = profile?.openingDate ?? null;
  const closing = profile?.closingDate ?? null;
  if (opening?.date && date < opening.date) return { phase: 'preseason', opening, closing };
  if (closing?.date && date > closing.date) return { phase: 'postseason', opening, closing };
  if (opening?.date && date >= opening.date) return { phase: 'in-season', opening, closing };
  return { phase: 'unknown', opening, closing };
}

/** True in the autumn months when a resort with no announced date is most likely still waiting to open. */
export const isOpeningMonth = (date: DateKey): boolean => OPENING_MONTHS.has(fromDateKey(date).getMonth() + 1);

/** "Nov 6", for a YYYY-MM-DD date. */
export function shortDate(date: DateKey): string {
  const d = fromDateKey(date);
  return `${(MONTH_LONG[d.getMonth()] ?? '').slice(0, 3)} ${d.getDate()}`;
}

/** "Opening day is Nov 6 (projected by the resort)." / "No opening date announced yet." */
export function openingLine(opening: SeasonDate | null): string {
  if (!opening?.date) return 'No opening date announced yet.';
  return opening.status === 'confirmed'
    ? `Opening day is ${shortDate(opening.date)}.`
    : `Opening day is ${shortDate(opening.date)} (the resort's projected date).`;
}
