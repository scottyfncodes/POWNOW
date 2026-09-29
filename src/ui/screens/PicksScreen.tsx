import type { Recommendation } from '@/domain/plan';
import { type DateKey, formatDateLabel, relativeDateLabel } from '@/domain/dates';
import { Caveats } from '@/ui/components/Caveats';
import { MountainCard } from '@/ui/components/MountainCard';
import { summarizeSettings } from '@/ui/components/RiderSettings';
import { ScreenHeader } from '@/ui/components/ScreenHeader';
import type { ClockState } from '@/ui/hooks/useClock';
import type { RiderSettings } from '@/ui/hooks/usePreferences';
import type { AsyncState } from '@/ui/hooks/useRecommendation';
import { ErrorScreen } from './ErrorScreen';
import { LoadingScreen } from './LoadingScreen';

export interface PicksScreenProps {
  state: AsyncState<Recommendation> & { reload: () => void };
  clock: ClockState;
  date: DateKey;
  settings: RiderSettings;
  onBack: () => void;
  /** Back to the Your ride step to change something. */
  onEdit: () => void;
  onOpenMountain: (mountainId: string) => void;
}

/**
 * Every mountain the rider can reach, ranked for their day — the answer
 * POW NOW promised, as cards. The ranking is `recommend()`'s, the same
 * pipeline the map and every plan use; this screen only lays it out. The
 * winner leads with why it won; every other card wears its trade-offs
 * against the winner, so the list can be scanned rather than studied.
 */
export function PicksScreen({ state, clock, date, settings, onBack, onEdit, onOpenMountain }: PicksScreenProps) {
  const isToday = date === clock.today;
  const dayLabel = relativeDateLabel(date, clock.today);

  const header = (
    <ScreenHeader
      onBack={onBack}
      title="YOUR MOUNTAINS"
      right={<span className="screenhead-date">{isToday ? formatDateLabel(date) : dayLabel}</span>}
    />
  );

  const summary = (
    <button type="button" className="picks-summary" onClick={onEdit}>
      <span className="picks-summary-text">{summarizeSettings(settings)}</span>
      <span className="picks-summary-edit">Edit</span>
    </button>
  );

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="screen">
        {header}
        <div className="screen-body shell">
          {summary}
          <LoadingScreen label="Checking the mountain, the snow and the roads" />
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return <ErrorScreen message={state.message} onRetry={state.reload} onBack={onBack} />;
  }

  const recommendation = state.data;
  const narrowedToPasses = settings.onlyMyPasses && settings.passes.length > 0 && recommendation.all.every((plan) => plan.passCoverage !== null);

  return (
    <div className="screen">
      {header}
      <div className="screen-body shell stack picks-body">
        {summary}

        <p className="picks-lead">
          {recommendation.all.length === 1 ? 'One mountain' : `${recommendation.all.length} mountains`} within reach
          of {recommendation.origin.id === 'gps' ? 'you' : recommendation.origin.shortName}, ranked for{' '}
          {dayLabel.toLowerCase()}.
          {narrowedToPasses && ' Only mountains on your pass, as you asked.'}
          {!isToday && ' A projection, not a promise — open a mountain to see how sure each call is.'}
        </p>

        {recommendation.usingDemoData && (
          <p className="picks-demo">
            <span className="chip chip-demo">DEMO DATA</span>
            <span>Every number here is simulated and labelled as such.</span>
          </p>
        )}

        <ol className="picks" aria-label="Mountains, best first">
          {recommendation.all.map((plan, index) => (
            <MountainCard
              key={plan.mountain.id}
              plan={plan}
              rank={index + 1}
              why={index === 0 ? recommendation.comparison : undefined}
              projected={!isToday}
              onOpen={() => onOpenMountain(plan.mountain.id)}
            />
          ))}
        </ol>

        <Caveats items={recommendation.caveats} />
      </div>
    </div>
  );
}
