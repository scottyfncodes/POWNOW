import { afterEach, describe, expect, it, vi } from 'vitest';
import { at } from '@/domain/time';
import { makeContext } from '@/engine/inputs';
import { testMountain } from '@/test/fixtures';
import { LiveTrafficProvider } from './googleRoutesTraffic';

const TODAY = '2026-01-17';
const context = makeContext(TODAY, TODAY, at(5));
const route = testMountain().accessRoutes[0]!;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('LiveTrafficProvider — talks to the server, never to Google', () => {
  it('posts origin/destination/direction/date to the configured server endpoint', async () => {
    const fetchSpy = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(
          JSON.stringify({ samples: [{ departure: at(6), durationMinutes: 90, congestion: 0.1 }] }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new LiveTrafficProvider({ apiBaseUrl: 'https://proxy.example.test' });
    await provider.getTravelCurve(route, 'outbound', context);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('https://proxy.example.test/api/travel-curve');
    const body = JSON.parse(init!.body as string);
    expect(body).toMatchObject({
      origin: route.originPoint,
      destination: route.destinationPoint,
      direction: 'outbound',
      date: TODAY,
    });

    // Never a Google Routes URL or an API key anywhere in this request.
    expect(url).not.toContain('googleapis.com');
    expect(JSON.stringify(init)).not.toMatch(/api[_-]?key/i);
  });

  it('normalizes a successful server response into a TravelCurve', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              routeLabel: 'I-70 west',
              corridorShorthand: 'I-70',
              samples: [
                { departure: at(5), durationMinutes: 95, congestion: 0.1 },
                { departure: at(7), durationMinutes: 140, congestion: 0.8 },
              ],
              roadCondition: 'snow-packed',
              incidents: [],
            }),
            { status: 200 },
          ),
      ),
    );
    const provider = new LiveTrafficProvider({ apiBaseUrl: 'https://proxy.example.test' });
    const result = await provider.getTravelCurve(route, 'outbound', context);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.samples).toHaveLength(2);
    expect(result.data.roadCondition).toBe('snow-packed');
    expect(result.provenance.source).toBe('live');
    expect(result.provenance.provider).toBe('google-routes');
    expect(result.provenance.fetchedAt).toBeTruthy();
  });

  it('prefers the server-reported real distance over the hand-authored fallback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              samples: [{ departure: at(6), durationMinutes: 90, congestion: 0.1 }],
              distanceMiles: 42.7,
            }),
            { status: 200 },
          ),
      ),
    );
    const provider = new LiveTrafficProvider({ apiBaseUrl: 'https://proxy.example.test' });
    const result = await provider.getTravelCurve(route, 'outbound', context);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.distanceMiles).toBe(42.7);
  });

  it('falls back to the route\'s own distance when the server does not report one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ samples: [{ departure: at(6), durationMinutes: 90, congestion: 0.1 }] }),
            { status: 200 },
          ),
      ),
    );
    const provider = new LiveTrafficProvider({ apiBaseUrl: 'https://proxy.example.test' });
    const result = await provider.getTravelCurve(route, 'outbound', context);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.distanceMiles).toBe(route.distanceMiles);
  });

  it('returns unavailable when the server has no key configured (503)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'no key' }), { status: 503 })),
    );
    const provider = new LiveTrafficProvider({ apiBaseUrl: 'https://proxy.example.test' });
    const result = await provider.getTravelCurve(route, 'outbound', context);
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable when Google refuses the proxy (502 with a reason), never a drive time', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: "The Routes API key's restrictions do not allow this request.",
              upstream: { service: 'google-routes', kind: 'key_restricted', status: 403, googleStatus: 'PERMISSION_DENIED', reason: 'API_KEY_SERVICE_BLOCKED' },
            }),
            { status: 502 },
          ),
      ),
    );
    const provider = new LiveTrafficProvider({ apiBaseUrl: 'https://proxy.example.test' });
    const result = await provider.getTravelCurve(route, 'outbound', context);
    expect(result.status).toBe('unavailable');
    expect(result).not.toHaveProperty('data');
  });

  it('returns unavailable when the server reports no samples at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ samples: [] }), { status: 200 })),
    );
    const provider = new LiveTrafficProvider({ apiBaseUrl: 'https://proxy.example.test' });
    const result = await provider.getTravelCurve(route, 'outbound', context);
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable on a malformed response shape', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ nope: true }), { status: 200 })));
    const provider = new LiveTrafficProvider({ apiBaseUrl: 'https://proxy.example.test' });
    const result = await provider.getTravelCurve(route, 'outbound', context);
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable on a timeout, never a fabricated drive time', async () => {
    // The provider's own timeout for this call is 15s (real routing calls are
    // slower than a JSON GET) — fake timers let this test that without an
    // actual 15-second wait.
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              const err = new Error('aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }),
      ),
    );
    const provider = new LiveTrafficProvider({ apiBaseUrl: 'https://proxy.example.test' });
    const pending = provider.getTravelCurve(route, 'outbound', context);
    await vi.advanceTimersByTimeAsync(15000);
    const result = await pending;
    expect(result.status).toBe('unavailable');
    vi.useRealTimers();
  });

  it('returns unavailable on a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const provider = new LiveTrafficProvider({ apiBaseUrl: 'https://proxy.example.test' });
    const result = await provider.getTravelCurve(route, 'outbound', context);
    expect(result.status).toBe('unavailable');
  });
});
