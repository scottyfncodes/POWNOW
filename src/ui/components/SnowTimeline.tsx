import type { DailySnowfall, SnowHistory } from '@/domain/conditions';
import { monthDay } from '@/domain/dates';

export interface SnowTimelineProps {
  history: SnowHistory | null;
}

/**
 * The snow cycle as a decision-support strip, not a decoration: five real
 * days back, five projected days forward, split visibly into OBSERVED vs
 * FORECAST so nobody mistakes a projection for a measurement.
 */
export function SnowTimeline({ history }: SnowTimelineProps) {
  if (!history || (history.past.length === 0 && history.future.length === 0)) return null;

  const allDays = [...history.past, ...history.future];
  const max = Math.max(1, ...allDays.map((day) => day.snowfallIn));

  return (
    <div className="snowtimeline">
      <div className="snowtimeline-totals">
        <div className="snowtimeline-total">
          <p className="snowtimeline-total-label">Past 5 days</p>
          <p className="snowtimeline-total-value numeral">{history.pastTotalIn.toFixed(1)}&Prime;</p>
        </div>
        <div className="snowtimeline-total is-future">
          <p className="snowtimeline-total-label">Next 5 days</p>
          <p className="snowtimeline-total-value numeral">{history.futureTotalIn.toFixed(1)}&Prime;</p>
        </div>
      </div>

      <ol className="snowtimeline-bars scroll-x" aria-label="Five-day snowfall history and forecast">
        {history.past.map((day) => (
          <Bar key={day.date} day={day} max={max} />
        ))}
        <li className="snowtimeline-today" aria-hidden="true">
          <span>TODAY</span>
        </li>
        {history.future.map((day) => (
          <Bar key={day.date} day={day} max={max} />
        ))}
      </ol>

      <p className="snowtimeline-legend">
        <span className="chip chip-live snowtimeline-chip">OBSERVED</span>
        <span className="chip chip-projected snowtimeline-chip">FORECAST</span>
      </p>
    </div>
  );
}

function Bar({ day, max }: { day: DailySnowfall; max: number }) {
  const heightPct = Math.max(6, Math.round((day.snowfallIn / max) * 100));
  return (
    <li className={`snowtimeline-bar${day.kind === 'forecast' ? ' is-forecast' : ' is-observed'}`}>
      <span className="snowtimeline-bar-track">
        <span className="snowtimeline-bar-fill" style={{ height: `${heightPct}%` }} />
      </span>
      <span className="snowtimeline-bar-value numeral">
        {day.snowfallIn >= 0.05 ? `${day.snowfallIn.toFixed(1)}"` : '–'}
      </span>
      <span className="snowtimeline-bar-day">{monthDay(day.date)}</span>
    </li>
  );
}
