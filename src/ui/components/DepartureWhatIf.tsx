import { useEffect, useState } from 'react';
import type { DepartureOption, SkiDayPlan } from '@/domain/plan';
import { formatClock, formatDelta, formatDuration } from '@/domain/time';
import { TRAFFIC_WORD } from './chart';
import { trafficLightFor } from '@/engine/travel';
import { TravelCurveChart } from './TravelCurveChart';

/**
 * "What if I leave at 6?"
 *
 * Every position on this slider is a genuine re-optimisation: the arrival, the
 * prime snow you catch and the score are all recomputed for that departure,
 * not interpolated from the recommendation.
 */
export function DepartureWhatIf({ plan }: { plan: SkiDayPlan }) {
  const options = plan.departureOptions;
  const recommendedIndex = Math.max(
    0,
    options.findIndex((option) => option.recommended),
  );
  const [index, setIndex] = useState(recommendedIndex);

  useEffect(() => setIndex(recommendedIndex), [recommendedIndex, plan.mountain.id]);

  if (options.length < 2 || !plan.departure) return null;

  const selected = options[Math.min(index, options.length - 1)] as DepartureOption;
  const recommended = options[recommendedIndex] as DepartureOption;
  const primeDelta = selected.primeCaptured - recommended.primeCaptured;
  const light = trafficLightFor(selected.congestion);

  return (
    <section className="panel" aria-labelledby="departure-heading">
      <header className="panel-head">
        <h2 id="departure-heading" className="section-title">
          When to leave
        </h2>
        <p className="panel-head-note">
          Sweet spot <strong>{formatClock(recommended.departure)}</strong>
        </p>
      </header>

      <TravelCurveChart
        points={options.map((option) => ({
          departure: option.departure,
          driveMinutes: option.driveMinutes,
        }))}
        markedMinute={selected.departure}
        label={`Drive time from ${plan.origin.shortName} by departure time`}
      />

      <label className="slider">
        <span className="visually-hidden">Departure time</span>
        <input
          type="range"
          min={0}
          max={options.length - 1}
          step={1}
          value={Math.min(index, options.length - 1)}
          onChange={(event) => setIndex(Number(event.target.value))}
          aria-valuetext={`Leave ${formatClock(selected.departure)}, arrive ${formatClock(selected.arrival)}, day score ${(selected.score / 10).toFixed(1)}`}
        />
      </label>

      <div className="whatif">
        <div className="whatif-lead">
          <p className="eyebrow">Leave at</p>
          <p className="whatif-time numeral">{formatClock(selected.departure)}</p>
          {!selected.recommended && (
            <button type="button" className="linkbutton" onClick={() => setIndex(recommendedIndex)}>
              Back to the sweet spot
            </button>
          )}
        </div>
        <dl className="whatif-grid">
          <div>
            <dt>Arrive</dt>
            <dd className="numeral">{formatClock(selected.arrival)}</dd>
          </div>
          <div>
            <dt>Drive</dt>
            <dd className="numeral">{formatDuration(selected.driveMinutes)}</dd>
          </div>
          <div>
            <dt>Prime snow</dt>
            <dd className="numeral">{formatDuration(selected.primeCaptured)}</dd>
          </div>
          <div>
            <dt>Traffic</dt>
            <dd className={`trafficword is-${light}`}>{TRAFFIC_WORD[light]}</dd>
          </div>
          <div>
            <dt>Day score</dt>
            <dd className="numeral">{(selected.score / 10).toFixed(1)}</dd>
          </div>
          <div>
            <dt>vs best</dt>
            <dd className="numeral">
              {primeDelta === 0 ? 'even' : `${formatDelta(primeDelta)} prime`}
            </dd>
          </div>
        </dl>
      </div>

      <p className="whatif-verdict">{departureVerdict(selected, recommended)}</p>
    </section>
  );
}

function departureVerdict(selected: DepartureOption, recommended: DepartureOption): string {
  if (selected.departure === recommended.departure) {
    return `${formatClock(recommended.departure)} is the move — early enough for the good snow, late enough that you're not sitting in the lot.`;
  }
  const scoreDelta = (selected.score - recommended.score) / 10;
  const primeLost = recommended.primeCaptured - selected.primeCaptured;
  if (selected.departure > recommended.departure) {
    return primeLost > 20
      ? `Leaving ${formatDuration(selected.departure - recommended.departure)} later costs you ${formatDuration(primeLost)} of the best snow and ${Math.abs(scoreDelta).toFixed(1)} off the day.`
      : `A little later is fine — you give up ${Math.abs(scoreDelta).toFixed(1)} and barely touch the good snow.`;
  }
  return `Going ${formatDuration(recommended.departure - selected.departure)} earlier buys ${primeLost < 0 ? formatDuration(-primeLost) : 'nothing'} of extra prime snow. Worth the alarm? Probably not.`;
}
