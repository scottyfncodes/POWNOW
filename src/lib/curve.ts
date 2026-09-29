import { clamp, lerp, type MinuteOfDay } from '@/domain/time';

export interface ControlPoint {
  minute: MinuteOfDay;
  value: number;
}

/**
 * Piecewise-linear sampling of a control-point curve. Everything time-varying
 * in POW NOW (traffic congestion, crowding, snowfall rate) is expressed this
 * way so it can be reasoned about, charted and tested as plain data.
 */
export function sampleCurve(points: ControlPoint[], minute: MinuteOfDay): number {
  if (points.length === 0) return 0;
  const first = points[0] as ControlPoint;
  const last = points[points.length - 1] as ControlPoint;
  if (minute <= first.minute) return first.value;
  if (minute >= last.minute) return last.value;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1] as ControlPoint;
    const b = points[i] as ControlPoint;
    if (minute <= b.minute) {
      const span = b.minute - a.minute;
      return span <= 0 ? b.value : lerp(a.value, b.value, (minute - a.minute) / span);
    }
  }
  return last.value;
}

/** Smooth bell used for storm intensity and crowd build. */
export function bell(minute: MinuteOfDay, center: MinuteOfDay, width: number): number {
  if (width <= 0) return 0;
  const z = (minute - center) / width;
  return Math.exp(-0.5 * z * z);
}

/** Saturating response: 0 at 0, approaching 1 as value grows past `scale`. */
export const saturate = (value: number, scale: number): number =>
  scale <= 0 ? 0 : 1 - Math.exp(-Math.max(0, value) / scale);

/** Map a value onto 0..100 given a good/bad reference pair (bad may exceed good). */
export function scoreBetween(value: number, bad: number, good: number): number {
  if (bad === good) return 50;
  return clamp(((value - bad) / (good - bad)) * 100, 0, 100);
}
