import { describe, expect, it } from 'vitest';
import { at } from '@/domain/time';
import { makeContext } from '@/engine/inputs';
import {
  DemoAlertsProvider,
  DemoMountainProvider,
  DemoPlacesProvider,
  DemoPricingProvider,
  DemoRoadConditionProvider,
  DemoSnowpackProvider,
  DemoTrafficProvider,
  DemoWeatherProvider,
} from '@/providers/demo';
import { createLiveRegistry } from '@/providers/live';
import { testMountain } from '@/test/fixtures';
import { createProviderRegistry } from './index';

/**
 * The production data gate.
 *
 * These tests exist to make one claim mechanically checkable rather than
 * merely documented: a registry built for live mode can never return a
 * `Demo*Provider` instance, in any slot, under any configuration — not as a
 * fallback for a missing option, not as a default. If someone reintroduces
 * `new DemoXProvider()` into `createLiveRegistry` (or the top-level
 * `createProviderRegistry` dispatcher grows a silent demo fallback), this
 * file fails, not a code reviewer's memory of a docblock.
 */
const DEMO_CLASSES = [
  DemoAlertsProvider,
  DemoMountainProvider,
  DemoPlacesProvider,
  DemoPricingProvider,
  DemoRoadConditionProvider,
  DemoSnowpackProvider,
  DemoTrafficProvider,
  DemoWeatherProvider,
] as const;

function expectNoDemoInstances(registry: ReturnType<typeof createLiveRegistry>) {
  const slots = [
    registry.weather,
    registry.traffic,
    registry.mountain,
    registry.pricing,
    registry.places,
    registry.alerts,
    registry.roads,
    registry.snowpack,
  ];
  for (const provider of slots) {
    for (const DemoClass of DEMO_CLASSES) {
      expect(provider).not.toBeInstanceOf(DemoClass);
    }
  }
}

describe('createLiveRegistry — no configuration', () => {
  const registry = createLiveRegistry();

  it('never returns a demo provider in any slot', () => {
    expectNoDemoInstances(registry);
  });

  it('reports usingDemoData: false — nothing in this bundle is ever demo', () => {
    expect(registry.usingDemoData).toBe(false);
  });

  it('traffic is unavailable, not a synthesized number, when no server is configured', async () => {
    const route = testMountain().accessRoutes[0]!;
    const result = await registry.traffic.getTravelCurve(route, 'outbound', makeContext('2026-01-17', '2026-01-17', at(5)));
    expect(result.status).toBe('unavailable');
  });
});

describe('createLiveRegistry — snowpack', () => {
  it('is unavailable, never demo, when no proxy is configured to reach SNOTEL', async () => {
    const registry = createLiveRegistry();
    const result = await registry.snowpack.getSnowpack(testMountain({ id: 'vail' }), makeContext('2026-01-17', '2026-01-17', at(5)));
    expect(result.status).toBe('unavailable');
  });
});

describe('createLiveRegistry — road conditions explicitly disabled', () => {
  it('is unavailable, never demo, when disabled', async () => {
    const registry = createLiveRegistry({ enableRoadConditions: false });
    expectNoDemoInstances(registry);
    const result = await registry.roads.getCorridorStatus('i70-west', makeContext('2026-01-17', '2026-01-17', at(5)));
    expect(result.status).toBe('unavailable');
  });
});

describe('createLiveRegistry — every slot, every configuration', () => {
  it('places is always unavailable — no live source exists, and it is never demo either', async () => {
    const registry = createLiveRegistry();
    const result = await registry.places.getPlaces(
      testMountain(),
      { id: 'home', name: 'Home', shortName: 'Home', coordinates: { lat: 39.7, lon: -105 } },
      ['coffee'],
      makeContext('2026-01-17', '2026-01-17', at(5)),
    );
    expect(result.status).toBe('unavailable');
  });

  it('pricing cannot silently fall back to the demo rate card', async () => {
    const registry = createLiveRegistry();
    const result = await registry.pricing.getTicketPrice(testMountain(), makeContext('2026-01-17', '2026-01-17', at(5)));
    expect(result.status).toBe('unavailable');
    // The demo rate card produces a plausible number in the $80-$300 range;
    // there must be no `data` field on this result at all to compare against.
    expect('data' in result).toBe(false);
  });

  it('crowd forecast cannot silently fall back to a synthetic heuristic', async () => {
    const registry = createLiveRegistry();
    const result = await registry.mountain.getCrowdForecast(testMountain(), makeContext('2026-01-17', '2026-01-17', at(5)));
    expect(result.status).toBe('unavailable');
  });
});

describe('createLiveRegistry — a same-origin proxy', () => {
  it('treats an empty base URL as a configured proxy at /api, not as "no proxy"', async () => {
    const registry = createLiveRegistry({ trafficApiBaseUrl: '' });
    expect(registry.label).toBe('Live data');
    // The traffic slot is a real live provider that will call `/api/travel-curve` on this origin.
    expect(registry.traffic.id).toBe('google-routes');
    expect(registry.snowpack.id).toBe('snotel');
    expect(registry.roads.id).toBe('cotrip');
  });

  it('the dispatcher passes same-origin through and still treats unset as unavailable', () => {
    const sameOrigin = createProviderRegistry({ dataMode: 'live', trafficApiBaseUrl: '', proxyConfigured: true, enableRoadConditions: true });
    expect(sameOrigin.traffic.id).toBe('google-routes');
    const none = createProviderRegistry({ dataMode: 'live', trafficApiBaseUrl: '', proxyConfigured: false, enableRoadConditions: true });
    expect(none.traffic.id).toBe('traffic-unconfigured');
  });
});

describe('createProviderRegistry — the dispatcher', () => {
  it('missing environment configuration does not activate demo mode when dataMode is live', () => {
    // Every optional knob left at its type default (empty/false) — the one
    // thing that must NOT happen is silently falling back to demo.
    const registry = createProviderRegistry({
      dataMode: 'live',
      trafficApiBaseUrl: '',
      proxyConfigured: false,
      enableRoadConditions: false,
    });
    expectNoDemoInstances(registry);
    expect(registry.usingDemoData).toBe(false);
  });

  it('still returns the real demo registry when dataMode is demo — this is the one legitimate path to it', () => {
    const registry = createProviderRegistry({
      dataMode: 'demo',
      trafficApiBaseUrl: '',
      proxyConfigured: false,
      enableRoadConditions: false,
    });
    expect(registry.weather).toBeInstanceOf(DemoWeatherProvider);
    expect(registry.usingDemoData).toBe(true);
  });
});

