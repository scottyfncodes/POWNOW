import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AccessRoute } from '@/domain/mountain';
import { makeContext } from '@/engine/inputs';
import { at } from '@/domain/time';
import { clearProviderCaches } from './fetchCache';
import { RankingTrafficProvider } from './rankingTraffic';

const route = (id: string, lat: number, lon: number): AccessRoute =>
  ({
    id,
    label: `Denver to ${id}`,
    corridorId: 'i70',
    originId: 'denver',
    originPoint: { lat: 39.7392, lon: -104.9903 },
    destinationPoint: { lat, lon },
    distanceMiles: 80,
  }) as unknown as AccessRoute;

const context = makeContext('2099-01-17', '2099-01-16', at(18, 0));

describe('RankingTrafficProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearProviderCaches();
  });

  it('asks for every mountain of one ranking in a single request, and labels each curve an estimate', async () => {
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          drives: body.destinations.map((_: unknown, i: number) => ({
            outbound: { departure: 360, durationMinutes: 90 + i, sampledAt: '2099-01-16T20:00:00Z' },
            return: { departure: 900, durationMinutes: 100 + i, sampledAt: '2099-01-16T20:00:00Z' },
            distanceMiles: 75,
          })),
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new RankingTrafficProvider({ apiBaseUrl: '' });
    const a = route('vail', 39.6403, -106.3742);
    const b = route('eldora', 39.9375, -105.5828);
    const [aOut, aBack, bOut] = await Promise.all([
      provider.getTravelCurve(a, 'outbound', context),
      provider.getTravelCurve(a, 'return', context),
      provider.getTravelCurve(b, 'outbound', context),
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)).destinations).toHaveLength(2);
    expect(aOut.status === 'ok' && aOut.data).toMatchObject({ sampling: 'estimate', samples: [{ departure: 360, durationMinutes: 90 }], distanceMiles: 75 });
    expect(aBack.status === 'ok' && aBack.data.samples).toEqual([{ departure: 900, durationMinutes: 100, congestion: 0 }]);
    expect(bOut.status === 'ok' && bOut.data.samples[0]?.durationMinutes).toBe(91);
  });

  it('reports every mountain unavailable when the ranking budget is spent, never a drive time', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'spent' }), { status: 503 })));
    const provider = new RankingTrafficProvider({ apiBaseUrl: '' });
    const result = await provider.getTravelCurve(route('vail', 39.6403, -106.3742), 'outbound', context);
    expect(result.status).toBe('unavailable');
    expect(result.status === 'unavailable' && result.reason).toMatch(/budget/i);
  });

  it('retries once, after a short Retry-After, when the server ran out of time mid-ranking', async () => {
    const answers = [
      new Response(JSON.stringify({ error: 'slow' }), { status: 503, headers: { 'Retry-After': '0.01' } }),
      new Response(
        JSON.stringify({ drives: [{ outbound: { departure: 360, durationMinutes: 95, sampledAt: '2099-01-16T20:00:00Z' }, return: null }] }),
        { status: 200 },
      ),
    ];
    const fetchSpy = vi.fn(async () => answers.shift()!);
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new RankingTrafficProvider({ apiBaseUrl: '' });
    const result = await provider.getTravelCurve(route('vail', 39.6403, -106.3742), 'outbound', context);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.status === 'ok' && result.data.samples[0]?.durationMinutes).toBe(95);
  });

  it('does not wait out a spent daily budget: a long Retry-After is answered at once', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ error: 'spent' }), { status: 503, headers: { 'Retry-After': '36000' } }));
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new RankingTrafficProvider({ apiBaseUrl: '' });
    const result = await provider.getTravelCurve(route('vail', 39.6403, -106.3742), 'outbound', context);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.status === 'unavailable' && result.reason).toMatch(/budget/i);
  });

  it('says so plainly when the retry is cut short too', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503, headers: { 'Retry-After': '0.01' } })));
    const provider = new RankingTrafficProvider({ apiBaseUrl: '' });
    const result = await provider.getTravelCurve(route('vail', 39.6403, -106.3742), 'outbound', context);
    expect(result.status === 'unavailable' && result.reason).toBe('Google Routes was too slow to answer in time. Try again in a moment.');
  });
});
