/**
 * Pure math for the trail-map viewer's pinch/pan/zoom — kept separate from
 * the pointer-event wiring in `TrailMapViewer.tsx` so the actual arithmetic
 * (which is easy to get subtly wrong — zooming "around" a point, keeping
 * panned content from drifting off screen entirely) is unit-testable without
 * simulating real multi-touch pointer events in jsdom.
 */

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;

export interface Transform {
  scale: number;
  x: number;
  y: number;
}

export const clampScale = (scale: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

/**
 * Keeps the pan offset from carrying the image fully off-screen. At `scale`
 * 1 there is no slack to pan at all (offset pinned to 0,0); above that, the
 * offset may move up to half the extra (scaled) size in either direction —
 * enough to inspect any corner of a zoomed-in map without losing it.
 */
export function clampTranslate(
  transform: Transform,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  if (transform.scale <= MIN_SCALE) return { x: 0, y: 0 };
  const maxX = (viewportWidth * (transform.scale - 1)) / 2;
  const maxY = (viewportHeight * (transform.scale - 1)) / 2;
  return {
    x: Math.min(maxX, Math.max(-maxX, transform.x)),
    y: Math.min(maxY, Math.max(-maxY, transform.y)),
  };
}

/**
 * Zooming "around" a fixed point (the pinch midpoint, or the cursor on a
 * wheel event): the point under the cursor/fingers should stay under them
 * as the scale changes, which means the pan offset has to shift by exactly
 * the amount the content grew/shrank at that point.
 */
export function zoomAroundPoint(
  current: Transform,
  nextScale: number,
  focalPoint: { x: number; y: number },
  viewportCenter: { x: number; y: number },
): Transform {
  const clamped = clampScale(nextScale);
  const scaleRatio = clamped / current.scale;
  // Focal point relative to the current visual center of the content.
  const dx = focalPoint.x - viewportCenter.x - current.x;
  const dy = focalPoint.y - viewportCenter.y - current.y;
  return {
    scale: clamped,
    x: current.x - dx * (scaleRatio - 1),
    y: current.y - dy * (scaleRatio - 1),
  };
}

export const distanceBetween = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

export const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/** Double-tap/double-click: toggle between fit (1x) and a comfortable inspection zoom. */
export const DOUBLE_TAP_SCALE = 2.5;

export const toggleDoubleTapScale = (currentScale: number): number =>
  currentScale > MIN_SCALE + 0.01 ? MIN_SCALE : DOUBLE_TAP_SCALE;
