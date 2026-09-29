/**
 * POW NOW works in *minutes since local midnight* for the day being planned.
 *
 * Ski days are single-day, single-timezone reasoning problems: everything the
 * engine cares about (first chair, prime snow, the 4pm traffic wall) is a wall
 * clock time in the mountain's local zone. Modelling that as a plain number
 * keeps the optimizers deterministic and trivially testable, and keeps
 * Date/timezone handling at the edges of the system.
 */
export type MinuteOfDay = number;

/** Minutes of duration. */
export type Minutes = number;

export const HOUR = 60;

export const at = (hour: number, minute = 0): MinuteOfDay => hour * HOUR + minute;

/** 5:18 -> "5:18 AM". Handles values past midnight (1500 -> "1:00 AM"). */
export function formatClock(minute: MinuteOfDay): string {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const suffix = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${suffix}`;
}

/** 5:18 -> "5:18" (no meridiem, for dense chart labels). */
export function formatClockShort(minute: MinuteOfDay): string {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m % 60).padStart(2, '0')}`;
}

/** 106 -> "1h46". 47 -> "47m". */
export function formatDuration(minutes: Minutes): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/** Signed duration for deltas: +32 -> "+32m", -18 -> "-18m". */
export function formatDelta(minutes: Minutes): string {
  const rounded = Math.round(minutes);
  if (rounded === 0) return 'even';
  const sign = rounded > 0 ? '+' : '−';
  return `${sign}${formatDuration(Math.abs(rounded))}`;
}

export function formatWindowLabel(start: MinuteOfDay, end: MinuteOfDay): string {
  const sameMeridiem = Math.floor((start % 1440) / 720) === Math.floor((end % 1440) / 720);
  return sameMeridiem
    ? `${formatClockShort(start)}–${formatClock(end)}`
    : `${formatClock(start)} – ${formatClock(end)}`;
}

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

export const clamp01 = (value: number): number => clamp(value, 0, 1);

/** Linear interpolation between control points; used for all curve sampling. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

/** Overlap in minutes between two [start, end) windows. */
export function overlapMinutes(
  aStart: MinuteOfDay,
  aEnd: MinuteOfDay,
  bStart: MinuteOfDay,
  bEnd: MinuteOfDay,
): Minutes {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/** Inclusive range of minute marks, stepping by `step`. */
export function minuteRange(start: MinuteOfDay, end: MinuteOfDay, step: Minutes): MinuteOfDay[] {
  const out: MinuteOfDay[] = [];
  if (step <= 0) return out;
  for (let m = start; m <= end + 1e-9; m += step) out.push(Math.round(m));
  return out;
}
