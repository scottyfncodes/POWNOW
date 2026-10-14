import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES } from '@/config/weights';
import { CORRIDORS, CORRIDOR_REGION, CORRIDOR_SEVERITY } from '@/data/corridors';
import { MOUNTAINS, findMountain } from '@/data/mountains';
import { ORIGINS, findOrigin } from '@/data/origins';
import { TICKET_PRICING, pricingFor } from '@/data/pricing';
import { at } from '@/domain/time';
import { buildPlan } from '@/engine/plan';
import { loadDayInputs, makeContext } from '@/engine/inputs';
import { createDemoRegistry } from '@/providers/demo';
import { testMountain } from '@/test/fixtures';

const TODAY = '2026-01-17';
const context = makeContext(TODAY, TODAY, at(5, 0));

describe('mountain dataset integrity', () => {
  it('gives every mountain the fields the engine relies on', () => {
    for (const mountain of MOUNTAINS) {
      expect(mountain.snowRegion, mountain.id).toBeTruthy();
      expect(mountain.accessRoutes.length, mountain.id).toBeGreaterThan(0);
      expect(mountain.elevations.verticalFt, mountain.id).toBeGreaterThan(0);
      expect(mountain.passAffiliations.length, mountain.id).toBeGreaterThan(0);
    }
  });

  it('points every access route at a real origin and a known corridor', () => {
    const originIds = new Set(ORIGINS.map((origin) => origin.id));
    for (const mountain of MOUNTAINS) {
      for (const route of mountain.accessRoutes) {
        expect(originIds.has(route.originId), `${mountain.id} → ${route.originId}`).toBe(true);
        expect(CORRIDORS[route.corridorId], route.corridorId).toBeDefined();
        expect(CORRIDOR_SEVERITY[route.corridorId], route.corridorId).toBeGreaterThan(0);
        expect(CORRIDOR_REGION[route.corridorId], route.corridorId).toBeTruthy();
      }
    }
  });

  it('prices every mountain in the dataset', () => {
    for (const mountain of MOUNTAINS) {
      const profile = TICKET_PRICING[mountain.id];
      expect(profile, `${mountain.id} has no pricing profile`).toBeDefined();
      expect(profile!.advanceFloor).toBeLessThan(profile!.windowRate);
    }
  });

  it('falls back to a generic rate for a mountain nobody has priced yet', () => {
    const profile = pricingFor('brand-new-mountain');
    expect(profile.windowRate).toBeGreaterThan(0);
    expect(profile.mountainId).toBe('brand-new-mountain');
  });

  it('covers more than one pass network and more than one snow region', () => {
    const passes = new Set(MOUNTAINS.flatMap((mountain) => mountain.passAffiliations));
    const regions = new Set(MOUNTAINS.map((mountain) => mountain.snowRegion));
    expect(passes.size).toBeGreaterThan(1);
    expect(regions.size).toBeGreaterThan(1);
  });
});

describe('Purgatory', () => {
  const purgatory = findMountain('purgatory')!;

  it('is in the dataset as an ordinary mountain', () => {
    expect(purgatory).toBeDefined();
    expect(purgatory.snowRegion).toBe('san-juans');
    expect(purgatory.passAffiliations).toEqual(['independent']);
  });

  it('has an identity, not just lower numbers than everyone else', () => {
    const keystone = findMountain('keystone')!;
    // Lower, sunnier, smaller, sheltered — different, not simply worse.
    expect(purgatory.weatherLocation.aspect).toBe('south-facing');
    expect(purgatory.weatherLocation.forecastElevationFt).toBeLessThan(
      keystone.weatherLocation.forecastElevationFt,
    );
    expect(purgatory.terrain.aboveTreelineShare).toBeLessThan(keystone.terrain.aboveTreelineShare);
    expect(purgatory.popularity).toBeLessThan(keystone.popularity);
    expect(pricingFor('purgatory').windowRate).toBeLessThan(pricingFor('keystone').windowRate);
  });

  it('is a local mountain from Durango and a road trip from the Front Range', () => {
    const fromDurango = purgatory.accessRoutes.find((route) => route.originId === 'durango')!;
    const fromSprings = purgatory.accessRoutes.find(
      (route) => route.originId === 'colorado-springs',
    )!;
    expect(fromDurango.freeFlowMinutes).toBeLessThan(45);
    expect(fromSprings.freeFlowMinutes).toBeGreaterThan(240);
    expect(purgatory.accessRoutes.some((route) => route.originId === 'denver')).toBe(false);
  });

  it('produces a complete plan through the ordinary pipeline', async () => {
    const inputs = await loadDayInputs(
      createDemoRegistry(),
      purgatory,
      findOrigin('durango'),
      context,
    );
    const plan = buildPlan(inputs, { preferences: { ...DEFAULT_PREFERENCES, originId: 'durango' } });
    expect(plan.departure).not.toBeNull();
    expect(plan.return).not.toBeNull();
    expect(plan.ticket).not.toBeNull();
    expect(plan.snowClock.points.length).toBeGreaterThan(10);
  });
});

describe('Copper', () => {
  const copper = findMountain('copper')!;

  it('is the closest big mountain to Denver on the corridor', () => {
    const drive = (id: string) =>
      findMountain(id)!.accessRoutes.find((r) => r.originId === 'denver' && r.isPrimary)!
        .freeFlowMinutes;
    for (const rival of ['keystone', 'breckenridge', 'vail', 'beaver-creek']) {
      expect(drive('copper'), `copper vs ${rival}`).toBeLessThan(drive(rival));
    }
  });

  it('pays for that with exposure up high and a later first chair', () => {
    const keystone = findMountain('keystone')!;
    expect(copper.terrain.aboveTreelineShare).toBeGreaterThan(keystone.terrain.aboveTreelineShare);
    expect(copper.operations.weekendOpen).toBeGreaterThan(keystone.operations.weekendOpen);
  });

  it('rounds out the Ikon side of the dataset', () => {
    expect(copper.passAffiliations).toEqual(['ikon']);
    expect(copper.snowRegion).toBe('i70-corridor');
  });
});

describe('Wolf Creek', () => {
  const wolfCreek = findMountain('wolf-creek')!;

  it('is the snowiest and the cheapest of Colorado\'s full-size mountains', () => {
    // Small community hills (Howelsen, Sipapu and friends) are cheaper still;
    // the claim is about the mountains a Front Range skier weighs it against.
    const rivals = ['vail', 'beaver-creek', 'breckenridge', 'keystone', 'crested-butte', 'winter-park', 'purgatory', 'copper', 'arapahoe-basin', 'loveland', 'eldora', 'steamboat', 'monarch', 'telluride', 'wolf-creek'];
    const pricing = rivals.map((id) => pricingFor(id).windowRate);
    expect(pricingFor('wolf-creek').windowRate).toBe(Math.min(...pricing));
    // Barely flexes with demand, which is most of the point of the place.
    expect(pricingFor('wolf-creek').dynamicRange).toBeLessThan(0.3);
  });

  it('trades all of that against being a long way from anywhere', () => {
    const fromDurango = wolfCreek.accessRoutes.find((r) => r.originId === 'durango')!;
    const fromDenver = wolfCreek.accessRoutes.find((r) => r.originId === 'denver')!;
    expect(fromDurango.freeFlowMinutes).toBeLessThan(120);
    expect(fromDenver.freeFlowMinutes).toBeGreaterThan(240);
    // Small hill, high up, on the divide — not a big-vertical destination.
    expect(wolfCreek.elevations.verticalFt).toBeLessThan(2000);
    expect(wolfCreek.weatherLocation.forecastElevationFt).toBeGreaterThan(11_000);
  });

  it('gives Durango a real choice rather than one option', () => {
    const fromDurango = MOUNTAINS.filter((m) =>
      m.accessRoutes.some((r) => r.originId === 'durango'),
    );
    expect(fromDurango.length).toBeGreaterThan(2);
    expect(fromDurango.map((m) => m.id)).toContain('purgatory');
    expect(fromDurango.map((m) => m.id)).toContain('wolf-creek');
  });
});

describe('adding a mountain is a data change', () => {
  it('plans a mountain the engine has never seen, with no code path of its own', async () => {
    // A wholly invented mountain, no profile, no pricing entry, new corridor.
    const invented = testMountain({
      id: 'invented-peak',
      name: 'Invented Peak',
      shortName: 'INVENTED',
      snowRegion: 'somewhere-else',
      accessRoutes: [
        {
          id: 'invented-route',
          originId: 'denver',
          label: 'Made-up Highway',
          corridorId: 'i70-west',
          originPoint: findOrigin('denver').coordinates,
          destinationPoint: { lat: 39.5, lon: -106.2 },
          distanceMiles: 90,
          freeFlowMinutes: 95,
          stormPenaltyMinutes: 15,
          weatherSensitivity: 0.5,
          isPrimary: true,
        },
      ],
    });

    const inputs = await loadDayInputs(
      createDemoRegistry(),
      invented,
      findOrigin('denver'),
      context,
    );
    const plan = buildPlan(inputs);
    expect(plan.mountain.id).toBe('invented-peak');
    expect(plan.score.score).toBeGreaterThan(0);
    expect(plan.departure).not.toBeNull();
    expect(plan.ticket).not.toBeNull();
    expect(plan.reasons.length).toBeGreaterThan(0);
  });
});
