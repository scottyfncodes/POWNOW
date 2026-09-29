/** Shared plumbing for the hand-drawn SVG charts. No charting library, no runtime cost. */

export interface Scale {
  (value: number): number;
}

export function linearScale(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  const scale = ((value: number) => r0 + ((value - d0) / span) * (r1 - r0)) as Scale;
  return scale;
}

/** Catmull-Rom smoothed path — reads as a curve, not a polygon of measurements. */
export function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length < 3) {
    return points.map((point, i) => `${i === 0 ? 'M' : 'L'}${round(point.x)},${round(point.y)}`).join(' ');
  }
  let d = `M${round(points[0]!.x)},${round(points[0]!.y)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${round(c1.x)},${round(c1.y)} ${round(c2.x)},${round(c2.y)} ${round(p2.x)},${round(p2.y)}`;
  }
  return d;
}

const round = (value: number): number => Math.round(value * 10) / 10;

/** Non-colour status encoding, so the charts survive colour blindness and greyscale. */
export const TRAFFIC_GLYPH: Record<'green' | 'yellow' | 'red', string> = {
  green: '●',
  yellow: '◐',
  red: '○',
};

export const TRAFFIC_WORD: Record<'green' | 'yellow' | 'red', string> = {
  green: 'Flowing',
  yellow: 'Slow',
  red: 'Jammed',
};
