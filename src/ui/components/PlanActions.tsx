import { useEffect, useState } from 'react';
import type { SkiDayPlan } from '@/domain/plan';
import { downloadText, planCalendarIcs, sharePlan } from '@/lib/share';

export interface PlanActionsProps {
  plan: SkiDayPlan;
  /** When this plan was computed, ISO 8601. */
  generatedAt?: string;
  /** Present for NOW: re-runs the recommendation. */
  onRefresh?: () => void;
  /** The current minute, so "updated N min ago" ticks without a re-fetch. */
  nowTick?: number;
}

/**
 * What you do with the answer: send it to the people you're skiing with, put
 * the alarm on the calendar, or ask again. Also where the plan admits its
 * age — a recommendation computed at 5:02 should say so at 6:40.
 */
export function PlanActions({ plan, generatedAt, onRefresh, nowTick }: PlanActionsProps) {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 2500);
    return () => window.clearTimeout(timer);
  }, [status]);

  const canCalendar = plan.departure !== null && plan.return !== null;

  const share = async () => {
    const outcome = await sharePlan(plan, typeof window !== 'undefined' ? window.location.href : undefined);
    setStatus(outcome === 'shared' ? 'Shared.' : outcome === 'copied' ? 'Copied to clipboard.' : "Couldn't share from this browser.");
  };

  const calendar = () => {
    const ics = planCalendarIcs(plan);
    if (!ics) return;
    downloadText(`snownow-${plan.mountain.id}-${plan.date}.ics`, ics);
    setStatus('Calendar event saved.');
  };

  return (
    <div className="planactions">
      <div className="planactions-buttons">
        <button type="button" className="planactions-button" onClick={share}>
          Share plan
        </button>
        {canCalendar && (
          <button type="button" className="planactions-button" onClick={calendar}>
            Add to calendar
          </button>
        )}
        {onRefresh && (
          <button type="button" className="planactions-button is-quiet" onClick={onRefresh}>
            Refresh
          </button>
        )}
      </div>
      <p className="planactions-meta" aria-live="polite">
        {status ?? (generatedAt ? `Updated ${relativeAge(generatedAt, nowTick)}` : '')}
      </p>
    </div>
  );
}

function relativeAge(iso: string, _tick?: number): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes <= 0) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? '1 hr ago' : `${hours} hr ago`;
}
