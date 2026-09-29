import type { SkiDayPlan } from '@/domain/plan';
import { formatClock, formatDuration, formatWindowLabel } from '@/domain/time';

/**
 * The plan, in the form it leaves the app: a text message to the group
 * chat, and a calendar event for the alarm. Both are derived from the plan
 * alone so they say exactly what the card said — no re-computation, no
 * second opinion.
 */

export function planShareText(plan: SkiDayPlan, appUrl?: string): string {
  const lines: string[] = [];
  lines.push(`${plan.mountain.shortName} — ${plan.verdict} (${plan.score.score.toFixed(1)}/10)`);
  if (plan.departure && plan.return) {
    lines.push(
      `Leave ${plan.origin.shortName} ${formatClock(plan.departure.departure)} · first turn ${formatClock(plan.departure.firstTurn)}`,
    );
    if (plan.snowClock.prime) {
      lines.push(`Best snow ${formatWindowLabel(plan.snowClock.prime.start, plan.snowClock.prime.end)}`);
    }
    lines.push(`Head home ${formatClock(plan.return.departure)} · home ${formatClock(plan.return.homeArrival)}`);
  } else {
    lines.push(plan.headline);
  }
  if (plan.reasons[0]) lines.push(plan.reasons[0]);
  if (plan.provenance.source === 'demo') lines.push('(demo data)');
  if (appUrl) lines.push(appUrl);
  return lines.join('\n');
}

/** Try the native share sheet; fall back to the clipboard. Returns how it went, for a one-line confirmation. */
export async function sharePlan(plan: SkiDayPlan, appUrl?: string): Promise<'shared' | 'copied' | 'failed'> {
  const text = planShareText(plan, appUrl);
  const title = `POW NOW: ${plan.mountain.shortName} on ${plan.date}`;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title, text });
      return 'shared';
    }
  } catch (error) {
    // A dismissed share sheet is not a failure worth reporting; anything else falls through to the clipboard.
    if (error instanceof Error && error.name === 'AbortError') return 'failed';
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return 'copied';
    }
  } catch {
    // Clipboard blocked.
  }
  return 'failed';
}

/** Local wall-clock minute on a YYYY-MM-DD → iCalendar floating local time (no zone: the phone's own). */
function icsLocal(date: string, minute: number): string {
  const [y, m, d] = date.split('-');
  const hh = String(Math.floor(minute / 60) % 24).padStart(2, '0');
  const mm = String(minute % 60).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}00`;
}

const escapeIcs = (value: string): string => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/**
 * One calendar event: the drive up, starting when the plan says to leave and
 * ending when you arrive, with a 30-minute alarm so the phone wakes you.
 * Floating local time on purpose — the rider is in the mountain's zone.
 */
export function planCalendarIcs(plan: SkiDayPlan): string | null {
  if (!plan.departure || !plan.return) return null;
  const summary = `Ski ${plan.mountain.shortName} — leave ${formatClock(plan.departure.departure)}`;
  const description = planShareText(plan);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const uid = `pownow-${plan.mountain.id}-${plan.date}@pownow`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//POW NOW//Ski day//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsLocal(plan.date, plan.departure.departure)}`,
    `DTEND:${icsLocal(plan.date, plan.departure.arrival)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(plan.mountain.name)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(`Leave for ${plan.mountain.shortName} in 30 minutes · ${formatDuration(plan.departure.driveMinutes)} drive`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Hand the browser a file to save. */
export function downloadText(filename: string, contents: string, mime = 'text/calendar'): void {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
