import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearProviderCaches } from '@/providers/live/fetchCache';
import { ProviderTimeoutError } from '@/lib/http';
import { describeRoutePreviewFailure, fetchRoutePreview } from './routePreview';

const origin = { lat: 39.7392, lon: -104.9903 };
const destination = { lat: 39.6403, lon: -106.3742 };

afterEach(() => {
  clearProviderCaches();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchRoutePreview — one call, not a curve', () => {
  it('posts exactly one request to /api/route-preview with origin and destination only', async () => {
    const fetchSpy = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ durationMinutes: 105, distanceMiles: 100 }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const result = await fetchRoutePreview(origin, destination, 'https://proxy.example.test');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('https://proxy.example.test/api/route-preview');
    const body = JSON.parse(init!.body as string);
    expect(body).toEqual({ origin, destination });
    // No direction, no date, no departure grid — this is a single-shot request.
    expect(body.direction).toBeUndefined();
    expect(body.date).toBeUndefined();

    expect(result).toEqual({ durationMinutes: 105, distanceMiles: 100, routePoints: null });
  });

  it('decodes a real route polyline into road points when the proxy sends one', async () => {
    // Google's documented example: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" → (38.5,-120.2) (40.7,-120.95) (43.252,-126.453)
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ durationMinutes: 105, distanceMiles: 100, polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' }), {
            status: 200,
          }),
      ),
    );
    const result = await fetchRoutePreview(origin, destination, 'https://proxy.example.test');
    expect(result.routePoints).toHaveLength(3);
    expect(result.routePoints![0]).toEqual({ lat: 38.5, lon: -120.2 });
    expect(result.routePoints![2]!.lat).toBeCloseTo(43.252, 3);
  });

  it('reports no distance as null rather than 0 or a guess', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ durationMinutes: 40 }), { status: 200 })),
    );
    const result = await fetchRoutePreview(origin, destination, 'https://proxy.example.test');
    expect(result.distanceMiles).toBeNull();
  });

  it('throws rather than fabricating a duration on a server error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'no route' }), { status: 502 })),
    );
    await expect(fetchRoutePreview(origin, destination, 'https://proxy.example.test')).rejects.toThrow();
  });

  it('throws rather than fabricating a duration on a timeout', async () => {
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
    const pending = fetchRoutePreview(origin, destination, 'https://proxy.example.test');
    const assertion = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(10000);
    await assertion;
  });
});

describe('describeRoutePreviewFailure — never leaks a raw status code', () => {
  it('gives an honest, friendly reason for a generic failure', () => {
    const { message, likelySlowWake } = describeRoutePreviewFailure(new Error('502 Bad Gateway'));
    expect(message).not.toMatch(/^\d{3}/);
    expect(message.length).toBeGreaterThan(0);
    expect(likelySlowWake).toBe(false);
  });

  it('flags a timeout as a likely slow wake-up, in plain language', () => {
    const { message, likelySlowWake } = describeRoutePreviewFailure(
      new ProviderTimeoutError('https://proxy.example.test/api/route-preview', 10000),
    );
    expect(likelySlowWake).toBe(true);
    expect(message.toLowerCase()).toMatch(/wake|nap|quiet/);
  });
});
