import { afterEach, describe, expect, it, vi } from 'vitest';
import { at } from '@/domain/time';
import { makeContext } from '@/engine/inputs';
import { testMountain } from '@/test/fixtures';
import { NwsAlertsProvider, overlapsPlannedDay } from './nwsAlerts';

const TODAY = '2026-01-17';
const usMountain = testMountain({ country: 'US' });
const context = makeContext(TODAY, TODAY, at(5));

afterEach(() => {
  vi.unstubAllGlobals();
});

function alertFeature(overrides: Record<string, unknown> = {}) {
  return {
    id: 'urn:test:1',
    properties: {
      event: 'Winter Storm Warning',
      headline: 'Winter Storm Warning issued',
      severity: 'Severe',
      effective: '2026-01-17T00:00:00-07:00',
      onset: '2026-01-17T03:00:00-07:00',
      ends: '2026-01-18T06:00:00-07:00',
      expires: '2026-01-17T15:00:00-07:00',
      areaDesc: 'Summit County',
      ...overrides,
    },
  };
}

describe('NwsAlertsProvider — normalization', () => {
  it('maps active features into WeatherAlert[], using the hazard end (ends) rather than the product expiry', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ features: [alertFeature()] }), { status: 200 })));
    const result = await new NwsAlertsProvider().getAlerts(usMountain, context);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ event: 'Winter Storm Warning', severity: 'severe' });
    expect(result.data[0]?.expires).toBe('2026-01-18T06:00:00-07:00');
    expect(result.provenance.source).toBe('live');
  });

  it('falls back to the product expiry only when NWS gives no hazard end', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ features: [alertFeature({ ends: null })] }), { status: 200 })),
    );
    const result = await new NwsAlertsProvider().getAlerts(usMountain, context);
    if (result.status === 'ok') expect(result.data[0]?.expires).toBe('2026-01-17T15:00:00-07:00');
  });

  it('returns a confident empty list when there are no active alerts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ features: [] }), { status: 200 })));
    const result = await new NwsAlertsProvider().getAlerts(usMountain, context);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data).toEqual([]);
  });

  it('skips malformed individual features rather than failing the whole call', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ features: [{ properties: {} }, alertFeature()] }), { status: 200 })),
    );
    const result = await new NwsAlertsProvider().getAlerts(usMountain, context);
    if (result.status === 'ok') expect(result.data).toHaveLength(1);
  });

  it('maps an unrecognized severity to "unknown" rather than guessing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ features: [alertFeature({ severity: 'Weird' })] }), { status: 200 })),
    );
    const result = await new NwsAlertsProvider().getAlerts(usMountain, context);
    if (result.status === 'ok') expect(result.data[0]?.severity).toBe('unknown');
  });
});

describe('NwsAlertsProvider — only alerts that touch the planned day', () => {
  it('drops an alert that ends before the planned day', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ features: [alertFeature()] }), { status: 200 })));
    const saturday = makeContext('2026-01-24', TODAY, at(5));
    const result = await new NwsAlertsProvider().getAlerts(usMountain, saturday);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data).toEqual([]);
  });

  it('keeps an advance warning whose onset is the planned day, and drops it for today', async () => {
    const advance = alertFeature({
      onset: '2026-01-19T06:00:00-07:00',
      ends: '2026-01-20T00:00:00-07:00',
      expires: '2026-01-17T20:00:00-07:00',
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ features: [advance] }), { status: 200 })));
    const monday = await new NwsAlertsProvider().getAlerts(usMountain, makeContext('2026-01-19', TODAY, at(5)));
    expect(monday.status === 'ok' && monday.data.length).toBe(1);

    const { clearProviderCaches } = await import('./fetchCache');
    clearProviderCaches();
    const today = await new NwsAlertsProvider().getAlerts(usMountain, context);
    expect(today.status === 'ok' && today.data.length).toBe(0);
  });

  it('overlapsPlannedDay handles zone offsets and keeps unparseable dates rather than dropping them', () => {
    expect(overlapsPlannedDay('2026-01-17T22:00:00-07:00', '2026-01-18T04:00:00-07:00', '2026-01-18')).toBe(true);
    expect(overlapsPlannedDay('2026-01-17T22:00:00-07:00', '2026-01-17T23:00:00-07:00', '2026-01-18')).toBe(false);
    expect(overlapsPlannedDay('garbage', 'also garbage', '2026-01-18')).toBe(true);
  });
});

describe('NwsAlertsProvider — scope', () => {
  it('reports unavailable, without a network call, for a non-US mountain — not a confident "no alerts"', async () => {
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const result = await new NwsAlertsProvider().getAlerts(testMountain({ country: 'CA' }), context);
    expect(result.status).toBe('unavailable');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('NwsAlertsProvider — failure handling', () => {
  it('returns unavailable on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 500 })));
    expect((await new NwsAlertsProvider().getAlerts(usMountain, context)).status).toBe('unavailable');
  });

  it('returns unavailable when the payload has no features array', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ weird: true }), { status: 200 })));
    expect((await new NwsAlertsProvider().getAlerts(usMountain, context)).status).toBe('unavailable');
  });

  it('returns unavailable on a network failure, never a fabricated "no alerts"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    expect((await new NwsAlertsProvider().getAlerts(usMountain, context)).status).toBe('unavailable');
  });
});
