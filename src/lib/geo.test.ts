import { describe, expect, it } from 'vitest';
import { haversineMiles, nearest, timeZoneForPoint } from './geo';

const DENVER = { lat: 39.7392, lon: -104.9903 };
const BOULDER = { lat: 40.015, lon: -105.2705 };
const DURANGO = { lat: 37.2753, lon: -107.8801 };

describe('haversineMiles', () => {
  it('is zero for the same point', () => {
    expect(haversineMiles(DENVER, DENVER)).toBeCloseTo(0, 5);
  });

  it('roughly matches the known Denver–Boulder distance', () => {
    // Real road distance is ~28mi; straight-line should be a bit less.
    expect(haversineMiles(DENVER, BOULDER)).toBeGreaterThan(15);
    expect(haversineMiles(DENVER, BOULDER)).toBeLessThan(28);
  });

  it('is symmetric', () => {
    expect(haversineMiles(DENVER, DURANGO)).toBeCloseTo(haversineMiles(DURANGO, DENVER), 6);
  });
});

describe('nearest', () => {
  it('picks the closest candidate by straight-line distance', () => {
    const candidates = [
      { id: 'denver', coordinates: DENVER },
      { id: 'boulder', coordinates: BOULDER },
      { id: 'durango', coordinates: DURANGO },
    ];
    // A point just outside Boulder should still resolve to Boulder, not Denver.
    expect(nearest({ lat: 40.02, lon: -105.28 }, candidates).id).toBe('boulder');
    expect(nearest(DURANGO, candidates).id).toBe('durango');
  });

  it('throws on an empty candidate list rather than returning something wrong', () => {
    expect(() => nearest(DENVER, [])).toThrow();
  });
});

describe('timeZoneForPoint', () => {
  it('puts Colorado, Utah and New Mexico mountains on Mountain time', () => {
    expect(timeZoneForPoint({ lat: 39.64, lon: -106.37 })).toBe('America/Denver');
    expect(timeZoneForPoint({ lat: 37.7, lon: -112.85 })).toBe('America/Denver');
    expect(timeZoneForPoint({ lat: 36.6, lon: -105.45 })).toBe('America/Denver');
  });

  it('puts California mountains on Pacific time', () => {
    expect(timeZoneForPoint({ lat: 37.65, lon: -119.03 })).toBe('America/Los_Angeles');
    expect(timeZoneForPoint({ lat: 34.24, lon: -116.89 })).toBe('America/Los_Angeles');
  });
});
