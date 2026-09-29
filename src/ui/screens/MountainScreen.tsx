import { findMountain } from '@/data/mountains';
import { mountainProfileFor } from '@/data/mountainProfiles';
import { type DateKey, formatDateLabel, relativeDateLabel } from '@/domain/dates';
import { passCovering } from '@/domain/mountain';
import type { Recommendation } from '@/domain/plan';
import { MountainProfilePanel } from '@/ui/components/MountainProfilePanel';
import { ScreenHeader } from '@/ui/components/ScreenHeader';
import type { ClockState } from '@/ui/hooks/useClock';
import type { RiderSettings } from '@/ui/hooks/usePreferences';
import type { AsyncState } from '@/ui/hooks/useRecommendation';
import { ErrorScreen } from './ErrorScreen';
import { LoadingScreen } from './LoadingScreen';
import { PlanView } from './PlanView';

export interface MountainScreenProps {
  mountainId: string;
  state: AsyncState<Recommendation> & { reload: () => void };
  clock: ClockState;
  date: DateKey;
  settings: RiderSettings;
  onBack: () => void;
  /** Switching to another mountain's day, from the alternatives. */
  onSelectMountain: (mountainId: string) => void;
}

/**
 * One mountain's whole day: the verdict card, parking, the route, the
 * trail map, the snow clock, the timeline, when to leave and when to head
 * home, the alternatives, how the score was built, and the reference sheet
 * with Grub & Brews. Reached from the ranked picks, the list or the map —
 * all three land here, on the same `SkiDayPlan` the ranking computed, so a
 * mountain never has two different days depending on the door you came in.
 */
export function MountainScreen({ mountainId, state, clock, date, settings, onBack, onSelectMountain }: MountainScreenProps) {
  const mountain = findMountain(mountainId) ?? null;
  const isToday = date === clock.today;

  if (!mountain) {
    return <ErrorScreen message={`We don't know a mountain called "${mountainId}".`} onBack={onBack} />;
  }

  const header = (
    <ScreenHeader
      onBack={onBack}
      title={mountain.shortName}
      right={<span className="screenhead-date">{isToday ? formatDateLabel(date) : relativeDateLabel(date, clock.today)}</span>}
    />
  );

  if (state.status === 'loading' || state.status === 'idle') {
    return <LoadingScreen label={`Checking ${mountain.name}, the snow and the roads`} />;
  }
  if (state.status === 'error') {
    return <ErrorScreen message={state.message} onRetry={state.reload} onBack={onBack} />;
  }

  const recommendation = state.data;
  const plan = recommendation.all.find((candidate) => candidate.mountain.id === mountain.id) ?? null;

  if (!plan) {
    // Ranked out, not broken: the mountain exists, this rider's day just
    // doesn't include it. Say which rule kept it out, then show what we know.
    const onPass = passCovering(mountain, settings.passes) !== null;
    const reason =
      settings.onlyMyPasses && settings.passes.length > 0 && !onPass
        ? "it isn't on a pass you hold, and you asked to see only mountains on your pass."
        : `no route is known from ${recommendation.origin.id === 'gps' ? 'your location' : recommendation.origin.shortName}.`;
    return (
      <div className="screen">
        {header}
        <div className="screen-body shell stack mountainscreen-out">
          <section className="panel">
            <h1 className="mountainscreen-name">{mountain.name}</h1>
            <p className="mountainscreen-outnote">
              Not in your ranking for {relativeDateLabel(date, clock.today).toLowerCase()}: {reason}
            </p>
            <button type="button" className="linkbutton" onClick={onBack}>
              Back to your mountains
            </button>
          </section>
          <MountainProfilePanel mountain={mountain} profile={mountainProfileFor(mountain.id)} />
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      {header}
      <div className="screen-body shell">
        <PlanView
          recommendation={recommendation}
          now={isToday ? clock.now : null}
          projected={!isToday}
          onRefresh={isToday ? state.reload : undefined}
          selectedId={mountain.id}
          onSelectMountain={onSelectMountain}
          profile={mountainProfileFor(mountain.id)}
        />
      </div>
    </div>
  );
}
