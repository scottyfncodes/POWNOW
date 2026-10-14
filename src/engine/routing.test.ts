import { describe, expect, it } from 'vitest';
import { ORIGINS, findOrigin, gpsOrigin } from '@/data/origins';
import { MOUNTAINS, findMountain } from '@/data/mountains';
import { GPS_REACH_MILES, mountainsInReach, resolveAccessRoutes } from './routing';
import { haversineMiles } from '@/lib/geo';

describe('resolveAccessRoutes — origin resolution', () => {
  it('resolves a manual city origin to its exact hand-authored coordinates', () => {
    const denver = findOrigin('denver');
    const vail = findMountain('vail')!;
    const routes = resolveAccessRoutes(vail, denver);
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(route.originPoint).toEqual(denver.coordinates);
    }
  });

  it('resolves every one of the manual cities', () => {
    const vail = findMountain('vail')!;
    for (const city of ORIGINS) {
      const routes = resolveAccessRoutes(vail, city);
      expect(routes.every((route) => route.originId === city.id)).toBe(true);
    }
  });

  it('preserves an intentionally missing route for a manual city (Purgatory has none from Denver)', () => {
    const purgatory = findMountain('purgatory')!;
    const routes = resolveAccessRoutes(purgatory, findOrigin('denver'));
    expect(routes).toEqual([]);
  });

  it('resolves a GPS origin to its exact coordinates, never snapped to the nearest city', () => {
    // A real point in Lakewood, CO — physically close to Denver but not
    // Denver's own coordinates.
    const lakewood = gpsOrigin(39.7047, -105.0814);
    const vail = findMountain('vail')!;
    const routes = resolveAccessRoutes(vail, lakewood);

    expect(routes).toHaveLength(1);
    expect(routes[0]!.originPoint).toEqual({ lat: 39.7047, lon: -105.0814 });
    expect(routes[0]!.originPoint).not.toEqual(findOrigin('denver').coordinates);
    expect(routes[0]!.destinationPoint).toEqual(vail.coordinates);
  });

  it('malformed coordinates still resolve deterministically rather than throwing', () => {
    const zero = gpsOrigin(0, 0);
    const vail = findMountain('vail')!;
    expect(() => resolveAccessRoutes(vail, zero)).not.toThrow();
    const routes = resolveAccessRoutes(vail, zero);
    expect(routes[0]!.originPoint).toEqual({ lat: 0, lon: 0 });
    expect(Number.isFinite(routes[0]!.distanceMiles)).toBe(true);
  });

  it('resolves a GPS origin to every mountain in the dataset, not just the ones with a manual-city route', () => {
    const farAway = gpsOrigin(37.6303, -107.8); // near Purgatory, unreachable from Denver manually
    const routesFromEveryMountain = MOUNTAINS.map((mountain) => resolveAccessRoutes(mountain, farAway));
    expect(routesFromEveryMountain.every((routes) => routes.length === 1)).toBe(true);
  });

  it('gives a GPS user physically outside Colorado a route rather than nothing', () => {
    // Somewhere in Kansas — nowhere near any manual city or mountain.
    const kansas = gpsOrigin(39.0, -98.0);
    const vail = findMountain('vail')!;
    const routes = resolveAccessRoutes(vail, kansas);
    expect(routes).toHaveLength(1);
    expect(routes[0]!.distanceMiles).toBeGreaterThan(300);
  });
});

describe('mountainsInReach — which mountains compete for a day', () => {
  it('competes exactly the mountains a manual city has routes to', () => {
    const denver = findOrigin('denver');
    const inReach = mountainsInReach(MOUNTAINS, denver);
    expect(inReach.map((m) => m.id)).toContain('vail');
    expect(inReach.map((m) => m.id)).not.toContain('purgatory');
    for (const mountain of inReach) {
      expect(resolveAccessRoutes(mountain, denver).length).toBeGreaterThan(0);
    }
  });

  it('keeps a GPS rider in Denver to Colorado-and-nearby, not the whole West', () => {
    const lakewood = gpsOrigin(39.7047, -105.0814);
    const inReach = mountainsInReach(MOUNTAINS, lakewood);
    expect(inReach.map((m) => m.id)).toContain('vail');
    expect(inReach.map((m) => m.id)).toContain('telluride');
    expect(inReach.every((m) => m.state !== 'CA')).toBe(true);
    for (const mountain of inReach) {
      expect(haversineMiles(lakewood.coordinates, mountain.coordinates)).toBeLessThanOrEqual(GPS_REACH_MILES);
    }
  });

  it('still answers a GPS rider nowhere near a mountain, with the nearest few', () => {
    const kansas = gpsOrigin(39.0, -98.0);
    const inReach = mountainsInReach(MOUNTAINS, kansas);
    expect(inReach.length).toBeGreaterThan(0);
    expect(inReach.length).toBeLessThanOrEqual(5);
    expect(inReach.every((m) => m.state === 'CO')).toBe(true);
  });
});
