import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOUNTAINS } from '@/data/mountains';
import { SNOTEL_STATIONS, snotelStationFor, stationNameMatches } from '@/data/snotelStations';
import { at } from '@/domain/time';
import { makeContext } from '@/engine/inputs';
import { testMountain } from '@/test/fixtures';
import { SnotelSnowpackProvider } from './snotelSnowpack';

const TODAY = '2026-01-17';
const context = makeContext(TODAY, TODAY, at(5));
const vail = testMountain({ id: 'vail', name: 'Vail', coordinates: { lat: 39.6403, lon: -106.3742 } });
const provider = () => new SnotelSnowpackProvider({ apiBaseUrl: 'https://proxy.test' });

afterEach(() => {
  vi.unstubAllGlobals();
});

/** What the proxy's /api/snotel returns — see server/index.mjs. */
function proxyReading(overrides: Record<string, unknown> = {}) {
  return {
    stationId: '842:CO:SNTL',
    stationName: 'Vail Mountain',
    elevationFt: 10300,
    latitude: 39.6183,
    longitude: -106.3811,
    series: [
      { date: '2026-01-11', snowDepthIn: 40, sweIn: 10.2 },
      { date: '2026-01-12', snowDepthIn: 39, sweIn: 10.2 },
      { date: '2026-01-13', snowDepthIn: 45, sweIn: 10.9 }, // +6
      { date: '2026-01-14', snowDepthIn: 44, sweIn: 10.9 },
      { date: '2026-01-15', snowDepthIn: 43, sweIn: 10.9 },
      { date: '2026-01-16', snowDepthIn: 42, sweIn: 10.9 },
      { date: '2026-01-17', snowDepthIn: 50, sweIn: 11.8 }, // +8
    ],
    sourceTimestamp: '2026-01-17T12:00:00Z',
    ...overrides,
  };
}

const respond = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('the station registry', () => {
  it('names a station for every mountain in the dataset', () => {
    for (const mountain of MOUNTAINS) {
      expect(snotelStationFor(mountain.id), `${mountain.id} needs a SNOTEL station`).not.toBeNull();
    }
  });

  it('uses well-formed NRCS triplets and sits within 25 miles of the mountain it witnesses', () => {
    for (const mountain of MOUNTAINS) {
      const station = SNOTEL_STATIONS[mountain.id]!;
      expect(station.triplet).toMatch(/^\d{3,4}:CO:SNTL$/);
      const dLat = Math.abs(station.coordinates.lat - mountain.coordinates.lat);
      const dLon = Math.abs(station.coordinates.lon - mountain.coordinates.lon);
      expect(dLat + dLon, `${mountain.id} → ${station.expectedName} looks too far away`).toBeLessThan(0.5);
    }
  });

  it('matches station names loosely on case and punctuation only', () => {
    expect(stationNameMatches('Cascade #2', 'CASCADE #2')).toBe(true);
    expect(stationNameMatches('Vail Mountain', 'vail mountain ')).toBe(true);
    expect(stationNameMatches('Vail Mountain', 'Copper Mountain')).toBe(false);
    expect(stationNameMatches('Vail Mountain', null)).toBe(false);
  });
});

describe('SnotelSnowpackProvider — a measured reading', () => {
  it('derives depth, water, density, 24h change and a 5-day new-snow floor from the daily series', async () => {
    vi.stubGlobal('fetch', respond(proxyReading()));
    const result = await provider().getSnowpack(vail, context);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.stationName).toBe('Vail Mountain');
    expect(result.data.snowDepthIn).toBe(50);
    expect(result.data.sweIn).toBe(11.8);
    expect(result.data.packDensity).toBeCloseTo(0.24, 2);
    expect(result.data.depthChange24hIn).toBe(8);
    // Positive deltas over the last five days (12→13: +6, 16→17: +8), not the net change.
    expect(result.data.newSnow5dIn).toBe(14);
    expect(result.data.distanceMiles).toBeGreaterThan(0);
    expect(result.data.distanceMiles).toBeLessThan(5);
    expect(result.data.observedOn).toBe(TODAY);
    expect(result.data.sourceUrl).toContain('sitenum=842');
    expect(result.provenance.source).toBe('live');
    expect(result.provenance.observation).toBe('observed');
    expect(result.provenance.attribution).toMatch(/SNOTEL/);
  });

  it('asks the proxy, never NRCS directly, for the registry\'s triplet', async () => {
    const fetchSpy = vi.fn(async (_url: string) => new Response(JSON.stringify(proxyReading()), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    await provider().getSnowpack(vail, context);
    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url.startsWith('https://proxy.test/api/snotel?station=842%3ACO%3ASNTL')).toBe(true);
  });

  it('tolerates a missing SWE or depth on individual days', async () => {
    vi.stubGlobal(
      'fetch',
      respond(
        proxyReading({
          series: [
            { date: '2026-01-15', snowDepthIn: 43, sweIn: null },
            { date: '2026-01-16', snowDepthIn: null, sweIn: 10.9 },
            { date: '2026-01-17', snowDepthIn: 50, sweIn: null },
          ],
        }),
      ),
    );
    const result = await provider().getSnowpack(vail, context);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.snowDepthIn).toBe(50);
    expect(result.data.sweIn).toBeNull();
    expect(result.data.packDensity).toBeNull();
    expect(result.data.depthChange24hIn).toBe(7); // against the last day that had a depth
  });
});

describe('SnotelSnowpackProvider — fails safe', () => {
  it('refuses a station whose NRCS name does not match the registry, naming the mismatch', async () => {
    vi.stubGlobal('fetch', respond(proxyReading({ stationName: 'Copper Mountain' })));
    const result = await provider().getSnowpack(vail, context);
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') expect(result.reason).toMatch(/Copper Mountain/);
  });

  it('refuses a reading that is more than three days old', async () => {
    vi.stubGlobal(
      'fetch',
      respond(proxyReading({ series: [{ date: '2026-01-10', snowDepthIn: 40, sweIn: 10 }, { date: '2026-01-12', snowDepthIn: 41, sweIn: 10 }] })),
    );
    const result = await provider().getSnowpack(vail, context);
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') expect(result.reason).toMatch(/2026-01-12/);
  });

  it('is unavailable without a request for a mountain with no station', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect((await provider().getSnowpack(testMountain({ id: 'nowhere' }), context)).status).toBe('unavailable');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('is unavailable on an empty series, a 502, malformed JSON and a network failure', async () => {
    const { clearProviderCaches } = await import('./fetchCache');
    for (const make of [
      async () => new Response(JSON.stringify(proxyReading({ series: [] })), { status: 200 }),
      async () => new Response(JSON.stringify({ error: 'nope' }), { status: 502 }),
      async () => new Response('{broken', { status: 200 }),
      async () => {
        throw new TypeError('Failed to fetch');
      },
    ]) {
      clearProviderCaches();
      vi.stubGlobal('fetch', vi.fn(make));
      expect((await provider().getSnowpack(vail, context)).status).toBe('unavailable');
    }
  });
});
