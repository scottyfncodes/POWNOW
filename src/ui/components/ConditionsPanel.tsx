import type { SkiDayPlan } from '@/domain/plan';
import { formatClock } from '@/domain/time';
import { AlertBanner } from './AlertBanner';
import { BasePeakConditions } from './BasePeakConditions';
import { SnowpackPanel } from './SnowpackPanel';
import { SnowTimeline } from './SnowTimeline';

export interface ConditionsPanelProps {
  plan: SkiDayPlan;
}

/**
 * Everything about "what's actually happening at the mountain right now" in
 * one place: temperature/wind at both elevations, measured or modeled depth, the 5-day snow
 * cycle, lift/terrain status, and any official alert. Only ever shows a
 * metric a real provider returned — `BasePeakConditions` already renders
 * "Unavailable" rather than a guess, and this panel follows the same rule
 * for lifts/terrain.
 */
export function ConditionsPanel({ plan }: ConditionsPanelProps) {
  const ops = plan.operations;

  return (
    <section className="panel conditionspanel" aria-labelledby="conditions-heading">
      <h2 id="conditions-heading" className="section-title">
        Conditions
      </h2>

      <AlertBanner alerts={plan.alerts} />

      {plan.freshSnowIn != null && (
        <p className="conditionspanel-fresh numeral">
          {plan.freshSnowIn >= 0.1 ? `${plan.freshSnowIn.toFixed(1)}" new overnight` : 'No new snow overnight'}
        </p>
      )}

      <BasePeakConditions base={plan.baseConditions} peak={plan.peakConditions} />

      <SnowpackPanel
        snowpack={plan.snowpack}
        modelSnowDepthIn={plan.modelSnowDepthIn}
        demo={plan.provenance.source === 'demo'}
      />

      <SnowTimeline history={plan.snowHistory} />

      {ops ? (
        <dl className="conditionspanel-ops">
          <div>
            <dt>Lifts</dt>
            <dd className="numeral">
              {ops.liftsOpen != null ? ops.liftsOpen : ops.liftsExpectedOpen} / {ops.liftsTotal}
            </dd>
          </div>
          <div>
            <dt>Terrain open</dt>
            <dd className="numeral">
              {ops.trailsOpen != null && ops.trailsTotal
                ? `${ops.trailsOpen} / ${ops.trailsTotal} trails`
                : `${Math.round(ops.terrainOpenShare * 100)}%`}
            </dd>
          </div>
          <div>
            <dt>First chair</dt>
            <dd className="numeral">{formatClock(ops.expectedOpen)}</dd>
          </div>
        </dl>
      ) : (
        <p className="conditionspanel-unavailable">Lift and terrain status unavailable.</p>
      )}

      {ops?.notes && ops.notes.length > 0 && (
        <ul className="conditionspanel-notes">
          {ops.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
