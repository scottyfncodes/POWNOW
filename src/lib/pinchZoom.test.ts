import { describe, expect, it } from 'vitest';
import {
  MAX_SCALE,
  MIN_SCALE,
  clampScale,
  clampTranslate,
  distanceBetween,
  midpoint,
  toggleDoubleTapScale,
  zoomAroundPoint,
} from './pinchZoom';

describe('clampScale', () => {
  it('never goes below the minimum (fit) scale', () => {
    expect(clampScale(0.2)).toBe(MIN_SCALE);
    expect(clampScale(-5)).toBe(MIN_SCALE);
  });

  it('never exceeds the maximum scale', () => {
    expect(clampScale(50)).toBe(MAX_SCALE);
  });

  it('passes through an in-range scale unchanged', () => {
    expect(clampScale(2.5)).toBe(2.5);
  });
});

describe('clampTranslate', () => {
  it('pins the pan offset to the origin at the minimum (fit) scale — there is nothing to pan yet', () => {
    expect(clampTranslate({ scale: 1, x: 500, y: 500 }, 300, 400)).toEqual({ x: 0, y: 0 });
  });

  it('allows panning proportional to how far zoomed in the content is', () => {
    const result = clampTranslate({ scale: 2, x: 1000, y: 1000 }, 300, 400);
    // At 2x, half the extra width/height is the maximum pan distance.
    expect(result.x).toBe(150);
    expect(result.y).toBe(200);
  });

  it('leaves an in-bounds offset untouched', () => {
    expect(clampTranslate({ scale: 2, x: 10, y: -10 }, 300, 400)).toEqual({ x: 10, y: -10 });
  });
});

describe('zoomAroundPoint', () => {
  it('keeps the focal point visually fixed when zooming in from 1x centered on itself', () => {
    const start = { scale: 1, x: 0, y: 0 };
    const center = { x: 200, y: 200 };
    // Zooming centered exactly on the viewport's own center should produce no pan shift.
    const result = zoomAroundPoint(start, 2, center, center);
    expect(result.scale).toBe(2);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('shifts the pan offset when the focal point is off-center, so that point stays under the fingers', () => {
    const start = { scale: 1, x: 0, y: 0 };
    const center = { x: 200, y: 200 };
    const focal = { x: 250, y: 200 }; // 50px right of center
    const result = zoomAroundPoint(start, 2, focal, center);
    expect(result.scale).toBe(2);
    // Content right of the focal point grows away from it — the pan offset
    // compensates in the opposite direction of the focal point's offset.
    expect(result.x).toBeLessThan(0);
    expect(result.y).toBe(0);
  });

  it('clamps the resulting scale the same way clampScale does', () => {
    const result = zoomAroundPoint({ scale: 1, x: 0, y: 0 }, 99, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(result.scale).toBe(MAX_SCALE);
  });
});

describe('distanceBetween / midpoint', () => {
  it('computes straight-line distance between two touch points', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('computes the midpoint between two touch points', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 });
  });
});

describe('toggleDoubleTapScale', () => {
  it('zooms in from the fit scale', () => {
    expect(toggleDoubleTapScale(MIN_SCALE)).toBeGreaterThan(MIN_SCALE);
  });

  it('zooms back out to fit from any zoomed-in scale', () => {
    expect(toggleDoubleTapScale(3)).toBe(MIN_SCALE);
  });
});
