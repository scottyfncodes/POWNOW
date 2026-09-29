import { describe, expect, it } from 'vitest';
import { MOUNTAINS, findMountain } from '@/data/mountains';
import { findOrigin } from '@/data/origins';
import { ok, unavailable } from '@/domain/provenance';
import { at } from '@/domain/time';
import { createDemoRegistry } from '@/providers/demo';
import type { ProviderRegistry } from '@/providers/types';
import { testAlert } from '@/test/fixtures';
import { loadDayInputs, makeContext } from './inputs';

const TODAY = '2026-01-17';
const context = makeContext(TODAY, TODAY, at(5, 0));
const denver = findOrigin('denver');

describe('loadDayInputs', () => {
  it('gathers every feed for one mountain on one day', async () => {
    const inputs = await loadDayInputs(createDemoRegistry(), MOUNTAINS[0]!, denver, context);
    expect(inputs.weather.status).toBe('ok');
    expect(inputs.operations.status).toBe('ok');
    expect(inputs.outbound.status).toBe('ok');
    expect(inputs.inbound.status).toBe('ok');
    expect(inputs.isToday).toBe(true);
  });

  it('considers every route from the origin and picks the quickest', async () => {
    const breck = findMountain('breckenridge')!;
    const inputs = await loadDayInputs(createDemoRegistry(), breck, denver, context);
    expect(inputs.routes.length).toBeGreaterThan(1);
    expect(inputs.outboundOptions.length).toBe(inputs.routes.length);
  });

  it('degrades one feed at a time rather than failing the day', async () => {
    const registry = createDemoRegistry({ mountain: { failOperationsFor: () => true } });
    const inputs = await loadDayInputs(registry, MOUNTAINS[0]!, denver, context);
    expect(inputs.operations.status).toBe('unavailable');
    expect(inputs.weather.status).toBe('ok');
  });

  it('turns a thrown provider error into an honest empty state', async () => {
    const registry: ProviderRegistry = {
      ...createDemoRegistry(),
      weather: {
        id: 'exploding-weather',
        getMountainWeather: async () => {
          throw new Error('upstream 503');
        },
      },
    };
    const inputs = await loadDayInputs(registry, MOUNTAINS[0]!, denver, context);
    expect(inputs.weather.status).toBe('unavailable');
    if (inputs.weather.status === 'unavailable') {
      expect(inputs.weather.reason).toBe('upstream 503');
    }
  });

  it('reports no route when the origin cannot reach the mountain', async () => {
    const isolated = { ...MOUNTAINS[0]!, accessRoutes: [] };
    const inputs = await loadDayInputs(createDemoRegistry(), isolated, denver, context);
    expect(inputs.outbound.status).toBe('unavailable');
    expect(inputs.routes).toEqual([]);
  });

  it('computes the forecast horizon from today', () => {
    expect(makeContext('2026-01-20', TODAY, 0).horizonDays).toBe(3);
    expect(makeContext('2026-01-10', TODAY, 0).horizonDays).toBe(0);
  });

  it('carries the alert feed alongside every other input', async () => {
    const registry: ProviderRegistry = {
      ...createDemoRegistry(),
      alerts: {
        id: 'test-alerts',
        getAlerts: async () =>
          ok([testAlert()], {
            source: 'live',
            observation: 'observed',
            confidence: 'high',
            provider: 'test-alerts',
            horizonDays: 0,
          }),
      },
    };
    const inputs = await loadDayInputs(registry, MOUNTAINS[0]!, denver, context);
    expect(inputs.alerts.status).toBe('ok');
    if (inputs.alerts.status === 'ok') expect(inputs.alerts.data).toHaveLength(1);
  });
});

describe('road closures — a corridor can become unavailable, not just worse', () => {
  const breck = findMountain('breckenridge')!;

  it('drops a route entirely when its corridor is reported closed', async () => {
    const registry: ProviderRegistry = {
      ...createDemoRegistry(),
      roads: {
        id: 'test-roads',
        getCorridorStatus: async (corridorId) =>
          ok(
            {
              corridorId,
              condition: corridorId === 'i70-west' ? 'closed' : 'clear',
              closures: [
                {
                  description: 'Avalanche mitigation',
                  location: 'Eisenhower Tunnel',
                  startedAt: '2026-01-17T06:00:00Z',
                },
              ],
              tractionLawInEffect: false,
              sourceTimestamp: '2026-01-17T06:00:00Z',
              source: 'test',
            },
            {
              source: 'live',
              observation: 'observed',
              confidence: 'high',
              provider: 'test-roads',
              horizonDays: 0,
            },
          ),
      },
    };

    const inputs = await loadDayInputs(registry, breck, denver, context);
    // Breck has a second, non-I-70 route from Denver (US-285 over Hoosier
    // Pass) — closing I-70 should remove only the routes on that corridor,
    // not the mountain.
    const i70Route = breck.accessRoutes.find(
      (route) => route.originId === 'denver' && route.corridorId === 'i70-west',
    )!;
    const hoosierRoute = breck.accessRoutes.find(
      (route) => route.originId === 'denver' && route.corridorId === 'us285-hoosier',
    )!;
    expect(inputs.outboundOptions.some((curve) => curve.routeId === i70Route.id)).toBe(false);
    expect(inputs.outboundOptions.some((curve) => curve.routeId === hoosierRoute.id)).toBe(true);
    expect(inputs.closedCorridors.length).toBeGreaterThan(0);
    expect(inputs.outbound.status).toBe('ok'); // the Hoosier Pass route still works
  });

  it('makes the mountain unreachable when every route to it is closed', async () => {
    const registry: ProviderRegistry = {
      ...createDemoRegistry(),
      roads: {
        id: 'test-roads',
        getCorridorStatus: async (corridorId) =>
          ok(
            {
              corridorId,
              condition: 'closed',
              closures: [],
              tractionLawInEffect: false,
              sourceTimestamp: '2026-01-17T06:00:00Z',
              source: 'test',
            },
            {
              source: 'live',
              observation: 'observed',
              confidence: 'high',
              provider: 'test-roads',
              horizonDays: 0,
            },
          ),
      },
    };

    const inputs = await loadDayInputs(registry, breck, denver, context);
    expect(inputs.outbound.status).toBe('unavailable');
    expect(inputs.inbound.status).toBe('unavailable');
    expect(inputs.outboundOptions).toEqual([]);
    expect(inputs.closedCorridors.length).toBeGreaterThan(0);
  });

  it('does not close anything when the road provider itself is unavailable', async () => {
    const registry: ProviderRegistry = {
      ...createDemoRegistry(),
      roads: {
        id: 'test-roads',
        getCorridorStatus: async () => unavailable('test-roads', 'CDOT feed is down.'),
      },
    };
    const inputs = await loadDayInputs(registry, breck, denver, context);
    // A missing road-status signal is not evidence of a closure — the route
    // stays exactly as reachable as it would be without this provider at all.
    expect(inputs.closedCorridors).toEqual([]);
    expect(inputs.outbound.status).toBe('ok');
  });
});

describe('mixed live and demo inputs', () => {
  it('produces a coherent set of inputs when some feeds are live and others are demo', async () => {
    const registry: ProviderRegistry = {
      ...createDemoRegistry(),
      weather: {
        id: 'fixture-live-weather',
        getMountainWeather: async (_mountain, ctx) =>
          ok(
            {
              overnightSnowIn: 6,
              recentSnow72hIn: 9,
              daysSinceStorm: 0,
              hourly: [],
              summary: 'Fixture live weather.',
              base: null,
              peak: null,
              snowHistory: null,
              modelSnowDepthIn: null,
            },
            {
              source: 'live',
              observation: 'observed',
              confidence: 'high',
              provider: 'fixture-live-weather',
              horizonDays: ctx.horizonDays,
              fetchedAt: new Date().toISOString(),
              validUntil: new Date(Date.now() + 30 * 60_000).toISOString(),
            },
          ),
      },
    };

    const inputs = await loadDayInputs(registry, MOUNTAINS[0]!, denver, context);
    expect(inputs.weather.status).toBe('ok');
    if (inputs.weather.status === 'ok') expect(inputs.weather.provenance.source).toBe('live');
    expect(inputs.operations.status).toBe('ok');
    if (inputs.operations.status === 'ok') expect(inputs.operations.provenance.source).toBe('demo');
    // Nothing about mixing sources should break the pipeline downstream.
    expect(inputs.outbound.status).toBe('ok');
  });
});
