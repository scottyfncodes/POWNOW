import { useMemo, useState } from 'react';
import { MOUNTAINS } from '@/data/mountains';
import type { RiderPreferences } from '@/config/weights';
import type { Origin } from '@/domain/mountain';
import {
  addDays,
  type DateKey,
  dateRange,
  formatDateLabel,
  monthDay,
  nextWeekday,
  relativeDateLabel,
  weekdayShort,
} from '@/domain/dates';
import { confidenceLabel } from '@/domain/provenance';
import { at } from '@/domain/time';
import { projectRange } from '@/engine/future';
import type { ProviderRegistry } from '@/providers/types';
import { ScreenHeader } from '@/ui/components/ScreenHeader';
import { useAsync } from '@/ui/hooks/useRecommendation';
import type { ClockState } from '@/ui/hooks/useClock';
import { Caveats } from '@/ui/components/Caveats';
import { LoadingScreen } from './LoadingScreen';
import { ErrorScreen } from './ErrorScreen';
import { PlanView } from './PlanView';

export interface LaterScreenProps {
  registry: ProviderRegistry;
  clock: ClockState;
  origin: Origin;
  preferences: RiderPreferences;
  onBack: () => void;
}

type Selection =
  | { kind: 'single'; date: DateKey; label: string }
  | { kind: 'range'; dates: DateKey[]; label: string };

function presetsFor(today: DateKey): Selection[] {
  const saturday = nextWeekday(today, 6, false);
  const sunday = nextWeekday(today, 0, false);
  return [
    { kind: 'single', date: addDays(today, 1), label: 'Tomorrow' },
    { kind: 'single', date: saturday, label: 'Saturday' },
    { kind: 'single', date: sunday, label: 'Sunday' },
    { kind: 'range', dates: [saturday, sunday], label: 'This weekend' },
    { kind: 'range', dates: dateRange(addDays(today, 1), 7), label: 'Next 7 days' },
    { kind: 'range', dates: dateRange(addDays(today, 1), 14), label: 'Next 2 weeks' },
  ];
}

/**
 * LATER always means a future date or range. Same engine, same question, with
 * forecast uncertainty carried all the way to the surface.
 */
export function LaterScreen({ registry, clock, origin, preferences, onBack }: LaterScreenProps) {
  const presets = useMemo(() => presetsFor(clock.today), [clock.today]);
  const [selection, setSelection] = useState<Selection>(presets[1] as Selection);
  const [openDate, setOpenDate] = useState<DateKey | null>(null);

  const dates = selection.kind === 'single' ? [selection.date] : selection.dates;

  const state = useAsync(
    () =>
      projectRange(registry, {
        mountains: MOUNTAINS,
        origin,
        dates,
        today: clock.today,
        now: at(6, 0),
        preferences,
      }),
    [origin.id, origin.coordinates.lat, origin.coordinates.lon, clock.today, dates.join(','), preferences],
    { minimumMs: 1400 },
  );

  const header = (
    <ScreenHeader
      onBack={onBack}
      title="LATER"
      right={<span className="screenhead-date">{selection.label}</span>}
    />
  );

  const picker = (
    <div className="datepicker">
      <div className="chiprow scroll-x" role="group" aria-label="When">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={`pickchip${preset.label === selection.label ? ' is-active' : ''}`}
            onClick={() => {
              setSelection(preset);
              setOpenDate(null);
            }}
            aria-pressed={preset.label === selection.label}
          >
            {preset.label}
            {preset.kind === 'single' && (
              <span className="pickchip-sub">{formatDateLabel(preset.date)}</span>
            )}
          </button>
        ))}
      </div>
      <label className="datepicker-exact">
        <span>Or pick a date</span>
        <input
          type="date"
          min={addDays(clock.today, 1)}
          max={addDays(clock.today, 60)}
          value={selection.kind === 'single' && !presets.some((p) => p.label === selection.label) ? selection.date : ''}
          onChange={(event) => {
            const value = event.target.value;
            if (!value) return;
            setSelection({ kind: 'single', date: value, label: formatDateLabel(value) });
            setOpenDate(null);
          }}
        />
      </label>
    </div>
  );

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="screen">
        {header}
        <div className="screen-body shell">
          {picker}
          <LoadingScreen label="Projecting the ski day" />
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return <ErrorScreen message={state.message} onRetry={state.reload} onBack={onBack} />;
  }

  const projection = state.data;
  const focused =
    openDate !== null
      ? projection.days.find((day) => day.date === openDate)
      : projection.days.length === 1
        ? projection.days[0]
        : undefined;

  return (
    <div className="screen">
      {header}
      <div className="screen-body shell stack">
        {picker}

        {projection.days.length > 1 && (
          <section className="panel" aria-labelledby="range-heading">
            <header className="panel-head">
              <h2 id="range-heading" className="section-title">
                {selection.label}
              </h2>
            </header>

            {projection.bestBet && (
              <div className="bestbet">
                <p className="eyebrow">Best bet</p>
                <p className="bestbet-line">
                  <strong>{relativeDateLabel(projection.bestBet.date, clock.today)}</strong> at{' '}
                  <strong>{projection.bestBet.recommendation.best.mountain.shortName}</strong>
                </p>
                <p className="bestbet-note">
                  {projection.bestBet.recommendation.best.score.score.toFixed(1)} projected ·{' '}
                  {confidenceLabel(projection.bestBet.confidence)}
                </p>
              </div>
            )}

            <div className="scroll-x">
            <table className="rangetable">
              <caption className="visually-hidden">Projected best mountain by day</caption>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Mountain</th>
                  <th scope="col">Score</th>
                  <th scope="col">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {projection.days.map((day) => {
                  const best = day.recommendation.best;
                  const isBet = projection.bestBet?.date === day.date;
                  return (
                    <tr key={day.date} className={isBet ? 'is-bet' : ''}>
                      <th scope="row">
                        <button
                          type="button"
                          className="rangetable-open"
                          onClick={() => setOpenDate(day.date)}
                        >
                          <span className="rangetable-dow">{weekdayShort(day.date)}</span>
                          <span className="rangetable-date">{monthDay(day.date)}</span>
                        </button>
                      </th>
                      <td>{best.mountain.shortName}</td>
                      <td className="numeral">{best.score.score.toFixed(1)}</td>
                      <td>
                        <span className={`confidence-dot is-${day.confidence}`} aria-hidden="true" />
                        <span className="confidence-word">{day.confidence}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            <p className="rangetable-note">
              Further out, the forecast leans harder on pattern and history than on any single
              model run. Confidence is ranked alongside the score — a 9.0 twelve days out does not
              beat an 8.6 on Saturday.
            </p>
          </section>
        )}

        {focused ? (
          <>
            {projection.days.length > 1 && (
              <div className="focusbar">
                <p className="eyebrow">
                  {relativeDateLabel(focused.date, clock.today)} · {formatDateLabel(focused.date)}
                </p>
                <button type="button" className="linkbutton" onClick={() => setOpenDate(null)}>
                  Close
                </button>
              </div>
            )}
            <PlanView recommendation={focused.recommendation} projected />
          </>
        ) : (
          projection.days.length > 1 && (
            <p className="rangehint">Tap a day to see the whole projected ski day.</p>
          )
        )}

        <Caveats items={projection.caveats} />
      </div>
    </div>
  );
}
