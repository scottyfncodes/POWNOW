import { forwardRef } from 'react';
import type { SkiDayPlan } from '@/domain/plan';
import { formatPrice } from '@/domain/pricing';
import { formatClock, formatDuration } from '@/domain/time';

export interface AlternativeListProps {
  alternatives: SkiDayPlan[];
  comparison: string;
  selectedId: string;
  onSelect: (mountainId: string) => void;
}

/**
 * Alternatives are shown as *trade-offs*, never as a table of metrics to
 * compare by hand. Each chip says which way it cuts, so the list can be
 * scanned rather than read — the point is to make the winner's win legible,
 * not to hand the user a spreadsheet and wish them luck.
 */
export const AlternativeList = forwardRef<HTMLElement, AlternativeListProps>(
  function AlternativeList({ alternatives, comparison, selectedId, onSelect }, ref) {
    if (alternatives.length === 0) return null;

    return (
      <section className="panel" aria-labelledby="alts-heading" ref={ref} tabIndex={-1}>
        <header className="panel-head">
          <h2 id="alts-heading" className="section-title">
            The alternatives
          </h2>
        </header>
        <p className="alts-comparison">{comparison}</p>

        <ul className="alts">
          {alternatives.map((plan) => (
            <li key={plan.mountain.id}>
              <button
                type="button"
                className={`alt${plan.mountain.id === selectedId ? ' is-selected' : ''}`}
                onClick={() => onSelect(plan.mountain.id)}
                aria-pressed={plan.mountain.id === selectedId}
              >
                <span className="alt-head">
                  <span className="alt-names">
                    <span className="alt-name">{plan.mountain.shortName}</span>
                    {plan.mountain.name.toUpperCase() !== plan.mountain.shortName.toUpperCase() && (
                      <span className="alt-fullname">{plan.mountain.name}</span>
                    )}
                  </span>
                  <span className="alt-score numeral">{plan.score.score.toFixed(1)}</span>
                </span>
                <span className="alt-meta">
                  {plan.departure && plan.return ? (
                    <>
                      Leave {formatClock(plan.departure.departure)} ·{' '}
                      {formatDuration(plan.departure.driveMinutes)} up ·{' '}
                      {formatDuration(plan.return.mountainMinutes)} on snow
                      {plan.passCoverage
                        ? ' · on your pass'
                        : plan.ticket && ` · ${formatPrice(plan.ticket.adultDay, plan.ticket.currency)}`}
                    </>
                  ) : (
                    <>Too far to time from here</>
                  )}
                </span>
                <span className="alt-tradeoffs">
                  {plan.tradeoffs.map((tradeoff) => (
                    <span
                      key={tradeoff.text}
                      className={`alt-tradeoff${tradeoff.better ? ' is-better' : ' is-worse'}`}
                    >
                      <span aria-hidden="true">{tradeoff.better ? '+' : '−'}</span> {tradeoff.text}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  },
);
