import type { SkiDayPlan } from '@/domain/plan';

/**
 * The few words a compact card shows when a day has no departure — naming
 * the real reason, so "too late tonight" never reads as "the route service
 * is down". The full sentence is `plan.timingNote`.
 */
export function shortTimingLabel(plan: SkiDayPlan): string {
  switch (plan.timingIssue) {
    case 'too-late':
      return plan.isToday ? 'Too late for today' : 'Not enough ski time';
    case 'too-far':
      return 'Past your drive limit';
    case 'no-route':
      return 'Route data down';
    default:
      return "Can't time this day";
  }
}
