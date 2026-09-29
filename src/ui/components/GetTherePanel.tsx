import type { SkiDayPlan } from '@/domain/plan';
import { formatClock, formatDuration } from '@/domain/time';
import { trafficLightFor } from '@/engine/travel';
import { TRAFFIC_GLYPH, TRAFFIC_WORD } from './chart';

export interface GetTherePanelProps {
  plan: SkiDayPlan;
}

/**
 * The route, as a decision input rather than a map widget: where from, where
 * to, how far, how long right now, and — when the live curve actually
 * supports it — how much of that is traffic. Every number here traces back
 * to `plan.departure`/`plan.routeDistanceMiles`, which are the same
 * optimizer-computed figures the rest of the plan already uses; this panel
 * never issues its own route request.
 */
export function GetTherePanel({ plan }: GetTherePanelProps) {
  const departure = plan.departure;

  return (
    <section className="panel gettherepanel" aria-labelledby="getthere-heading">
      <header className="panel-head">
        <h2 id="getthere-heading" className="section-title">
          🚗 Get there
        </h2>
      </header>

      <p className="gettherepanel-route">
        {plan.origin.shortName} → {plan.mountain.shortName}
        {plan.routeLabel && <span className="faint"> · {plan.routeLabel}</span>}
      </p>

      {departure ? (
        <>
          <dl className="gettherepanel-stats">
            <div>
              <dt>Leave {plan.origin.shortName}</dt>
              <dd className="numeral">{formatClock(departure.departure)}</dd>
            </div>
            <div>
              <dt>Arrive</dt>
              <dd className="numeral">{formatClock(departure.arrival)}</dd>
            </div>
            <div>
              <dt>Drive</dt>
              <dd className="numeral">{formatDuration(departure.driveMinutes)}</dd>
            </div>
            <div>
              <dt>Distance</dt>
              <dd className="numeral">
                {plan.routeDistanceMiles != null ? `${Math.round(plan.routeDistanceMiles)} mi` : '—'}
              </dd>
            </div>
          </dl>
          <TrafficLine congestion={departure.congestion} />
        </>
      ) : (
        <p className="gettherepanel-unavailable">
          Route service unavailable — we can't time this drive right now.
        </p>
      )}
    </section>
  );
}

function TrafficLine({ congestion }: { congestion: number }) {
  const light = trafficLightFor(congestion);
  return (
    <p className={`gettherepanel-traffic traffic is-${light}`}>
      <span aria-hidden="true">{TRAFFIC_GLYPH[light]}</span> {TRAFFIC_WORD[light]} at this departure time
    </p>
  );
}
