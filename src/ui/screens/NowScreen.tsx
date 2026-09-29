import { MOUNTAINS } from '@/data/mountains';
import type { RiderPreferences } from '@/config/weights';
import type { Origin } from '@/domain/mountain';
import { formatDateLabel } from '@/domain/dates';
import { recommend } from '@/engine/plan';
import type { ProviderRegistry } from '@/providers/types';
import { useAsync } from '@/ui/hooks/useRecommendation';
import type { ClockState } from '@/ui/hooks/useClock';
import { ScreenHeader } from '@/ui/components/ScreenHeader';
import { LoadingScreen } from './LoadingScreen';
import { ErrorScreen } from './ErrorScreen';
import { PlanView } from './PlanView';

export interface NowScreenProps {
  registry: ProviderRegistry;
  clock: ClockState;
  origin: Origin;
  preferences: RiderPreferences;
  onBack: () => void;
}

/**
 * NOW always means today. One tap, no configuration, an answer.
 *
 * `origin` is resolved once (a manual city, or a single GPS fix) and reused
 * for every mountain's route in this recommendation — the browser is never
 * asked for a fresh location per mountain.
 */
export function NowScreen({ registry, clock, origin, preferences, onBack }: NowScreenProps) {
  const state = useAsync(
    () =>
      recommend(registry, {
        mountains: MOUNTAINS,
        origin,
        date: clock.today,
        today: clock.today,
        now: clock.now,
        preferences,
      }),
    [origin.id, origin.coordinates.lat, origin.coordinates.lon, clock.today, preferences],
    { minimumMs: 1900 },
  );

  if (state.status === 'loading' || state.status === 'idle') {
    return <LoadingScreen label="Checking the mountain, the snow and the roads" />;
  }
  if (state.status === 'error') {
    return <ErrorScreen message={state.message} onRetry={state.reload} onBack={onBack} />;
  }

  return (
    <div className="screen">
      <ScreenHeader
        onBack={onBack}
        title="NOW"
        right={<span className="screenhead-date">{formatDateLabel(clock.today)}</span>}
      />
      <div className="screen-body shell">
        <PlanView recommendation={state.data} now={clock.now} onRefresh={state.reload} />
      </div>
    </div>
  );
}
