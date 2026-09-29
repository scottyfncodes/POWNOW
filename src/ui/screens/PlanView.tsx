import { useCallback, useRef, useState } from 'react';
import type { MountainProfile as MountainReference } from '@/domain/mountainProfile';
import type { Recommendation, SkiDayPlan } from '@/domain/plan';
import type { MinuteOfDay } from '@/domain/time';
import { planSummary } from '@/engine/explain';
import { AlertBanner } from '@/ui/components/AlertBanner';
import { AlternativeList } from '@/ui/components/AlternativeList';
import { Caveats } from '@/ui/components/Caveats';
import { DataSources } from '@/ui/components/DataSources';
import { DepartureWhatIf } from '@/ui/components/DepartureWhatIf';
import { FactorBreakdown } from '@/ui/components/FactorBreakdown';
import { GetTherePanel } from '@/ui/components/GetTherePanel';
import { MountainProfilePanel } from '@/ui/components/MountainProfilePanel';
import { ParkingPanel } from '@/ui/components/ParkingPanel';
import { RecommendationCard } from '@/ui/components/RecommendationCard';
import { ReturnPlanner } from '@/ui/components/ReturnPlanner';
import { SnowClockPanel } from '@/ui/components/SnowClockPanel';
import { Timeline } from '@/ui/components/Timeline';
import { TrailMapPanel } from '@/ui/components/TrailMapPanel';

export interface PlanViewProps {
  recommendation: Recommendation;
  now?: MinuteOfDay | null;
  projected?: boolean;
  /** Present for today's plan: re-runs the recommendation. */
  onRefresh?: () => void;
  /**
   * Which mountain's day to show. Uncontrolled (the winner, switchable from
   * the alternatives) when omitted; a screen that owns the choice — the
   * mountain screen, where the URL names the mountain — passes both.
   */
  selectedId?: string;
  onSelectMountain?: (mountainId: string) => void;
  /**
   * The mountain's researched reference, when this view *is* the mountain's
   * page: adds parking, the route panel, the trail map and the reference
   * sheet (links, season dates, Grub & Brews) to the day plan. `undefined`
   * leaves the plan alone; `null` means "this is the mountain page, but
   * nobody has researched this mountain yet", which the panels say honestly.
   */
  profile?: MountainReference | null;
}

/**
 * One full ski-day answer, whether it is today's call, a future day's
 * projection or a day out of the range planner. Every path asks the same
 * question, so they all get the same anatomy.
 */
export function PlanView({
  recommendation,
  now,
  projected = false,
  onRefresh,
  selectedId: controlledId,
  onSelectMountain,
  profile,
}: PlanViewProps) {
  const [ownId, setOwnId] = useState(recommendation.best.mountain.id);
  const selectedId = controlledId ?? ownId;
  const setSelectedId = (mountainId: string) => {
    setOwnId(mountainId);
    onSelectMountain?.(mountainId);
  };
  const isMountainPage = profile !== undefined;
  const [showFactors, setShowFactors] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const alternativesRef = useRef<HTMLElement | null>(null);

  const scrollToAlternatives = useCallback(() => {
    const node = alternativesRef.current;
    if (!node) return;

    // Smooth scrolling is the nicety; moving focus is the part that matters,
    // because it is what makes the jump work for keyboard and screen-reader
    // users rather than only for people who can watch the page slide. So the
    // scroll is optional, and where it is unavailable focus does the scrolling
    // instead of being told to suppress it.
    const canScroll = typeof node.scrollIntoView === 'function';
    if (canScroll) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    node.focus({ preventScroll: canScroll });
  }, []);

  const plan: SkiDayPlan =
    recommendation.all.find((candidate) => candidate.mountain.id === selectedId) ??
    recommendation.best;
  const others = recommendation.all.filter((candidate) => candidate.mountain.id !== plan.mountain.id);

  return (
    <div className="planview stack">
      <p className="visually-hidden" role="status">
        {planSummary(plan)}
      </p>

      <AlertBanner alerts={plan.alerts} />

      <RecommendationCard
        plan={plan}
        projected={projected}
        why={
          plan.mountain.id === recommendation.best.mountain.id
            ? recommendation.comparison
            : `${recommendation.best.mountain.shortName} is still the better overall day.`
        }
        onCompare={others.length > 0 ? scrollToAlternatives : undefined}
        generatedAt={recommendation.generatedAt}
        onRefresh={onRefresh}
        nowTick={now ?? undefined}
      />

      {isMountainPage && (
        <>
          <ParkingPanel parking={plan.parking} />
          <GetTherePanel plan={plan} />
          <TrailMapPanel mountain={plan.mountain} trailMap={profile?.trailMap ?? null} />
        </>
      )}

      <SnowClockPanel
        clock={plan.snowClock}
        snowState={plan.snowState}
        firstTurn={plan.departure?.firstTurn ?? null}
        leaveAt={plan.return?.departure ?? null}
        now={plan.isToday ? now : null}
      />

      <Timeline events={plan.timeline} />

      <DepartureWhatIf plan={plan} />

      <ReturnPlanner plan={plan} now={now} />

      <AlternativeList
        ref={alternativesRef}
        alternatives={others}
        comparison={
          plan.mountain.id === recommendation.best.mountain.id
            ? `Every mountain within reach, ranked. Tap one to see its whole day.`
            : `Showing ${plan.mountain.shortName}. ${recommendation.best.mountain.shortName} is still the better overall day.`
        }
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <section className="panel">
        <button
          type="button"
          className="disclosure"
          onClick={() => setShowFactors((value) => !value)}
          aria-expanded={showFactors}
        >
          <span className="section-title">How we got {plan.score.score.toFixed(1)}</span>
          <span aria-hidden="true">{showFactors ? '−' : '+'}</span>
        </button>
        {showFactors && <FactorBreakdown score={plan.score} />}
      </section>

      <section className="panel">
        <button
          type="button"
          className="disclosure"
          onClick={() => setShowSources((value) => !value)}
          aria-expanded={showSources}
        >
          <span className="section-title">Where this data came from</span>
          <span aria-hidden="true">{showSources ? '−' : '+'}</span>
        </button>
        {showSources && <DataSources sources={plan.dataSources} />}
      </section>

      <Caveats items={plan.caveats} />

      {isMountainPage && <MountainProfilePanel mountain={plan.mountain} profile={profile} />}
    </div>
  );
}
