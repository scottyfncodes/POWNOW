import type { DateKey } from './dates';

/**
 * Lift ticket pricing.
 *
 * A day ticket is a real part of "the best day I can realistically have", so
 * POW NOW carries it as first-class domain data — with the same provenance
 * discipline as snow and traffic. It is deliberately *not* a headline number:
 * see `config/weights.ts` for how lightly it is allowed to move a score.
 */
export type Currency = 'USD';

/** How the quoted number was arrived at. Dynamic pricing is the norm now. */
export type PriceKind = 'window' | 'advance' | 'dynamic';

export interface TicketPrice {
  mountainId: string;
  date: DateKey;
  currency: Currency;
  /** Adult single-day lift ticket. */
  adultDay: number;
  /** What the walk-up window would charge for the same day. */
  windowRate: number;
  kind: PriceKind;
  /** Days between buying and skiing, which is what dynamic pricing keys off. */
  purchasedDaysAhead: number;
  /** One short line of context, e.g. "Peak weekend pricing". */
  note: string;
}

const FORMATTERS = new Map<Currency, Intl.NumberFormat>();

export function formatPrice(amount: number, currency: Currency = 'USD'): string {
  let formatter = FORMATTERS.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    FORMATTERS.set(currency, formatter);
  }
  return formatter.format(Math.round(amount));
}

/** Savings against the walk-up rate, as a whole-dollar amount (0 when none). */
export const savingsVsWindow = (price: TicketPrice): number =>
  Math.max(0, Math.round(price.windowRate - price.adultDay));
