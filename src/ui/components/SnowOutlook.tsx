import type { SnowHistory } from '@/domain/conditions';
import { weekdayShort } from '@/domain/dates';
import type { Availability } from '@/domain/provenance';

/**
 * One day's bar is full at this many inches. A fixed scale, not each card's
 * own maximum, so a 2" day looks small next to a 14" day on the card below:
 * the point of the strip is comparing mountains.
 */
const FULL_BAR_IN = 8;

export interface SnowOutlookProps {
  /** `undefined` while the forecasts load. */
  outlook: Availability<SnowHistory> | undefined;
}

/**
 * The next five days' snowfall for one mountain, small enough to sit on a
 * list card: the total, plus one bar per day. Spans only, so it can live
 * inside the card's button.
 */
export function SnowOutlook({ outlook }: SnowOutlookProps) {
  if (outlook === undefined) {
    return (
      <span className="snowoutlook is-loading">
        <span className="snowoutlook-label">Next 5 days</span>
        <span className="snowoutlook-total numeral">…</span>
      </span>
    );
  }
  if (outlook.status !== 'ok' || outlook.data.future.length === 0) {
    return (
      <span className="snowoutlook is-none">
        <span className="snowoutlook-label">Next 5 days</span>
        <span className="snowoutlook-none">Forecast unavailable</span>
      </span>
    );
  }

  const { future, futureTotalIn } = outlook.data;
  const days = future.map((day) => `${weekdayShort(day.date)} ${day.snowfallIn.toFixed(1)} inches`).join(', ');
  const total = futureTotalIn >= 0.05 ? `${futureTotalIn.toFixed(1)}″` : 'None';

  return (
    <span
      className={`snowoutlook${futureTotalIn >= 6 ? ' is-big' : futureTotalIn < 0.05 ? ' is-dry' : ''}`}
      role="img"
      aria-label={`Snow forecast, next 5 days: ${futureTotalIn.toFixed(1)} inches. ${days}.`}
    >
      <span className="snowoutlook-label" aria-hidden="true">
        Next 5 days
      </span>
      <span className="snowoutlook-total numeral" aria-hidden="true">
        {total}
      </span>
      <span className="snowoutlook-bars" aria-hidden="true">
        {future.map((day) => (
          <span key={day.date} className="snowoutlook-day">
            <span className="snowoutlook-track">
              <span
                className="snowoutlook-fill"
                style={{ height: `${day.snowfallIn < 0.05 ? 0 : Math.max(12, Math.min(100, (day.snowfallIn / FULL_BAR_IN) * 100))}%` }}
              />
            </span>
            <span className="snowoutlook-dow">{weekdayShort(day.date).slice(0, 2)}</span>
          </span>
        ))}
      </span>
    </span>
  );
}
