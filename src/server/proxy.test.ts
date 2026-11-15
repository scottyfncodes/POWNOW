import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classifyRoutesFailure,
  dominantFailure,
  localToUtcIso,
  planDepartureMinutes,
  publicRoutesFailure,
  readBody,
  redactForLog,
  resolveTimeZone,
} from '../../server/index.mjs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

/**
 * The proxy's pure helpers, tested from the same suite as everything else.
 * The server's network paths (Google, CDOT, SNOTEL) are not exercised here —
 * they are thin fetch-and-normalize wrappers whose shapes the client-side
 * provider tests cover — but the time arithmetic is exactly the kind of
 * thing that fails silently in production and never in a demo.
 */
const TZ = 'America/Denver';
const OUTBOUND = [240, 270, 300, 330, 360, 390, 420, 450, 480];

/** A UTC instant for a Denver wall-clock time on a given date. */
const denver = (date: string, hour: number, minute = 0) => new Date(localToUtcIso(date, hour * 60 + minute, TZ)).getTime();

describe('localToUtcIso', () => {
  it('converts Mountain Standard Time (UTC−7) in January', () => {
    expect(localToUtcIso('2026-01-17', 5 * 60 + 18, TZ)).toBe('2026-01-17T12:18:00.000Z');
  });

  it('converts Mountain Daylight Time (UTC−6) in April', () => {
    expect(localToUtcIso('2026-04-11', 5 * 60, TZ)).toBe('2026-04-11T11:00:00.000Z');
  });

  it('converts Pacific Standard Time (UTC−8) for a California mountain', () => {
    expect(localToUtcIso('2026-01-17', 5 * 60, 'America/Los_Angeles')).toBe('2026-01-17T13:00:00.000Z');
  });
});

describe('resolveTimeZone', () => {
  it('honors the two zones the dataset uses', () => {
    expect(resolveTimeZone('America/Los_Angeles')).toBe('America/Los_Angeles');
    expect(resolveTimeZone('America/Denver')).toBe('America/Denver');
  });

  it('falls back to the server default for anything else', () => {
    expect(resolveTimeZone('Europe/Paris')).toBe('America/Denver');
    expect(resolveTimeZone(undefined)).toBe('America/Denver');
    expect(resolveTimeZone(42)).toBe('America/Denver');
  });
});

describe('planDepartureMinutes — never asks Google about a departure already behind us', () => {
  it('leaves a future date untouched', () => {
    const plan = planDepartureMinutes(OUTBOUND, '2026-01-18', denver('2026-01-17', 20), TZ);
    expect(plan.map((p) => p.minute)).toEqual(OUTBOUND);
    expect(plan.every((p) => p.departureIso !== null)).toBe(true);
  });

  it('leaves today untouched when the whole grid is still ahead', () => {
    const plan = planDepartureMinutes(OUTBOUND, '2026-01-17', denver('2026-01-17', 3, 30), TZ);
    expect(plan.map((p) => p.minute)).toEqual(OUTBOUND);
  });

  it('drops past grid points and anchors the curve at "now" (no departureTime) once the day is under way', () => {
    const plan = planDepartureMinutes(OUTBOUND, '2026-01-17', denver('2026-01-17', 6, 12), TZ);
    expect(plan[0]).toEqual({ minute: 372, departureIso: null });
    expect(plan.slice(1).map((p) => p.minute)).toEqual([390, 420, 450, 480]);
    expect(plan.slice(1).every((p) => p.departureIso !== null)).toBe(true);
  });

  it('keeps a single "now" sample when every grid point is already past, rather than returning nothing', () => {
    const plan = planDepartureMinutes(OUTBOUND, '2026-01-17', denver('2026-01-17', 9, 5), TZ);
    expect(plan).toEqual([{ minute: 545, departureIso: null }]);
  });

  it('treats a grid point within two minutes of now as past — Google would reject it by the time it arrives', () => {
    const plan = planDepartureMinutes(OUTBOUND, '2026-01-17', denver('2026-01-17', 4, 59), TZ);
    expect(plan[0]?.departureIso).toBeNull();
    expect(plan[1]?.minute).toBe(330);
  });
});

describe('readBody — the same router serves a stream (node:http) and a pre-parsed body (Vercel)', () => {
  it('reads a raw stream', async () => {
    const req = Readable.from([Buffer.from('{"a":1}')]) as unknown as IncomingMessage;
    expect(await readBody(req)).toBe('{"a":1}');
  });

  it('accepts a body a serverless runtime already parsed, as an object or a string', async () => {
    const parsed = { body: { a: 1 } } as unknown as IncomingMessage & { body?: unknown };
    expect(await readBody(parsed)).toBe('{"a":1}');
    const raw = { body: '{"b":2}' } as unknown as IncomingMessage & { body?: unknown };
    expect(await readBody(raw)).toBe('{"b":2}');
  });
});

/** Google's error envelope, as the Routes API sends it. */
const googleError = (code: number, status: string, reason: string | null, message: string) => ({
  error: {
    code,
    message,
    status,
    details: reason ? [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason, domain: 'googleapis.com' }] : [],
  },
});

describe('classifyRoutesFailure: says which thing is wrong with Google Routes', () => {
  it.each([
    [403, 'PERMISSION_DENIED', 'API_KEY_SERVICE_BLOCKED', 'key_restricted'],
    [403, 'PERMISSION_DENIED', 'API_KEY_HTTP_REFERRER_BLOCKED', 'key_restricted'],
    [403, 'PERMISSION_DENIED', 'API_KEY_IP_ADDRESS_BLOCKED', 'key_restricted'],
    [403, 'PERMISSION_DENIED', 'SERVICE_DISABLED', 'api_not_enabled'],
    [403, 'PERMISSION_DENIED', 'BILLING_DISABLED', 'billing_disabled'],
    [400, 'INVALID_ARGUMENT', 'API_KEY_INVALID', 'key_invalid'],
    [429, 'RESOURCE_EXHAUSTED', 'RATE_LIMIT_EXCEEDED', 'quota_exceeded'],
    [403, 'PERMISSION_DENIED', 'CONSUMER_SUSPENDED', 'project_suspended'],
  ])('%i %s %s is %s', (code, status, reason, kind) => {
    const failure = classifyRoutesFailure(code, googleError(code, status, reason, 'text'));
    expect(failure).toMatchObject({ kind, upstreamStatus: code, googleStatus: status, reason });
  });

  it('falls back to the HTTP status when Google names no reason', () => {
    expect(classifyRoutesFailure(429, googleError(429, 'RESOURCE_EXHAUSTED', null, 'Quota exceeded')).kind).toBe('quota_exceeded');
    expect(classifyRoutesFailure(403, googleError(403, 'PERMISSION_DENIED', null, 'Denied')).kind).toBe('permission_denied');
    expect(classifyRoutesFailure(400, googleError(400, 'INVALID_ARGUMENT', null, 'Timestamp must be set to a future time.')).kind).toBe('bad_request');
    expect(classifyRoutesFailure(400, googleError(400, 'INVALID_ARGUMENT', null, 'API key not valid. Please pass a valid API key.')).kind).toBe('key_invalid');
    expect(classifyRoutesFailure(503, null).kind).toBe('upstream_error');
  });

  it('calls a 200 with no route what it is, rather than an error of ours', () => {
    expect(classifyRoutesFailure(200, {}).kind).toBe('no_route');
    expect(classifyRoutesFailure(200, { routes: [] }).kind).toBe('no_route');
  });

  it('passes through only values shaped like Google enums', () => {
    const failure = classifyRoutesFailure(403, {
      error: { status: 'see https://evil.example', details: [{ reason: '<script>' }] },
    });
    expect(failure.googleStatus).toBeNull();
    expect(failure.reason).toBeNull();
    expect(failure.kind).toBe('permission_denied');
  });
});

describe('publicRoutesFailure: what a browser is told', () => {
  it('carries the codes and a fixed sentence, never Google\'s own text', () => {
    const failure = classifyRoutesFailure(
      403,
      googleError(403, 'PERMISSION_DENIED', 'BILLING_DISABLED', 'Billing is disabled for project #123456789012.'),
    );
    const body = publicRoutesFailure(failure);
    expect(body.upstream).toEqual({
      service: 'google-routes',
      kind: 'billing_disabled',
      status: 403,
      googleStatus: 'PERMISSION_DENIED',
      reason: 'BILLING_DISABLED',
      circuitOpen: false,
    });
    expect(body.error).toMatch(/billing/i);
    expect(JSON.stringify(body)).not.toContain('123456789012');
  });
});

describe('redactForLog: Google\'s message is logged, a credential never is', () => {
  it('removes the configured key and anything shaped like one', () => {
    const text = 'Bad key secret-key-value and AIzaSyA1234567890abcdefghij, see ?key=abc123&x=1';
    const out = redactForLog(text, ['secret-key-value']);
    expect(out).not.toContain('secret-key-value');
    expect(out).not.toContain('AIzaSyA1234567890abcdefghij');
    expect(out).not.toContain('abc123');
    expect(out).toContain('[redacted]');
  });

  it('is null when Google sent no message', () => {
    expect(redactForLog(null)).toBeNull();
  });
});

describe('dominantFailure: one stray timeout does not hide the real reason', () => {
  it('reports the reason most samples hit', () => {
    const blocked = classifyRoutesFailure(403, googleError(403, 'PERMISSION_DENIED', 'API_KEY_SERVICE_BLOCKED', 'x'));
    const timeout = { kind: 'timeout', upstreamStatus: null, googleStatus: null, reason: null, message: null };
    expect(dominantFailure([timeout, blocked, blocked]).kind).toBe('key_restricted');
  });
});

describe('the traffic routes, end to end with Google stubbed', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  /** The router with a key configured, and a Google that answers every call the same way. */
  async function routerWithGoogle(status: number, payload: unknown) {
    vi.resetModules();
    vi.stubEnv('GOOGLE_ROUTES_API_KEY', 'test-key-not-a-real-one');
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchSpy);
    const { handleRequest } = await import('../../server/index.mjs');
    return { handleRequest, fetchSpy };
  }

  async function call(handleRequest: (req: never, res: never) => Promise<void>, path: string, body: unknown) {
    const req = Object.assign(Readable.from([]), {
      method: 'POST',
      url: path,
      headers: { host: 'localhost', 'content-type': 'application/json' },
      body,
      socket: { remoteAddress: '127.0.0.1' },
    }) as unknown as IncomingMessage;
    let status = 0;
    let text = '';
    const res = {
      headersSent: false,
      writeHead(code: number) {
        status = code;
        return res;
      },
      setHeader() {},
      end(chunk?: string) {
        text = chunk ?? '';
      },
    } as unknown as ServerResponse;
    await handleRequest(req as never, res as never);
    return { status, json: JSON.parse(text) };
  }

  const curveBody = {
    origin: { lat: 39.7392, lon: -104.9903 },
    destination: { lat: 39.4817, lon: -106.1614 },
    direction: 'outbound',
    date: '2099-01-17',
  };

  it('answers a blocked key with a 502 that names the reason, logs it once, and leaks nothing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { handleRequest } = await routerWithGoogle(
      403,
      googleError(403, 'PERMISSION_DENIED', 'API_KEY_SERVICE_BLOCKED', 'Requests to this API routes.googleapis.com are blocked. key test-key-not-a-real-one'),
    );
    const { status, json } = await call(handleRequest, '/api/travel-curve', curveBody);
    expect(status).toBe(502);
    expect(json.upstream).toMatchObject({ kind: 'key_restricted', status: 403, reason: 'API_KEY_SERVICE_BLOCKED' });
    expect(json.samples).toBeUndefined();
    expect(JSON.stringify(json)).not.toContain('test-key-not-a-real-one');
    const lines = warn.mock.calls.map((call) => String(call[0]));
    const curveFailures = lines.filter((line) => line.includes('travel curve'));
    expect(curveFailures).toHaveLength(1);
    expect(curveFailures[0]).toContain('API_KEY_SERVICE_BLOCKED');
    // The breaker opens once, and nothing logged carries the key.
    expect(lines.filter((line) => line.includes('circuit breaker open'))).toHaveLength(1);
    for (const line of lines) expect(line).not.toContain('test-key-not-a-real-one');
  });

  it('does the same for the single-call route preview', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { handleRequest } = await routerWithGoogle(403, googleError(403, 'PERMISSION_DENIED', 'BILLING_DISABLED', 'x'));
    const { status, json } = await call(handleRequest, '/api/route-preview', curveBody);
    expect(status).toBe(502);
    expect(json.upstream.kind).toBe('billing_disabled');
  });

  it('still returns a real curve, built only from what Google reported', async () => {
    const { handleRequest, fetchSpy } = await routerWithGoogle(200, { routes: [{ duration: '5400s', distanceMeters: 120_000 }] });
    const { status, json } = await call(handleRequest, '/api/travel-curve', curveBody);
    expect(status).toBe(200);
    expect(json.samples).toHaveLength(9);
    expect(json.samples[0]).toEqual({ departure: 240, durationMinutes: 90, congestion: 0 });
    expect(json.distanceMiles).toBeCloseTo(74.6, 1);
    expect(fetchSpy).toHaveBeenCalledTimes(9);
  });

  it('reports a 200 with no route as no_route, not as a fabricated time', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { handleRequest } = await routerWithGoogle(200, {});
    const { status, json } = await call(handleRequest, '/api/travel-curve', curveBody);
    expect(status).toBe(502);
    expect(json.upstream.kind).toBe('no_route');
    expect(json.samples).toBeUndefined();
  });
});

describe('the Google budget: cache, de-duplication, ceiling, breaker, concurrency', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  const curve = (overrides: Record<string, unknown> = {}) => ({
    origin: { lat: 39.7392, lon: -104.9903 },
    destination: { lat: 39.4817, lon: -106.1614 },
    direction: 'outbound',
    date: '2099-01-17',
    ...overrides,
  });

  /** The router, and a Google that answers `respond()` after `delayMs`, counting calls and the most at once. */
  async function router(env: Record<string, string>, respond: () => { status: number; body: unknown }, delayMs = 0) {
    vi.resetModules();
    vi.stubEnv('GOOGLE_ROUTES_API_KEY', 'test-key-not-a-real-one');
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('VERCEL', '');
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const google = { calls: 0, active: 0, mostAtOnce: 0 };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        google.calls += 1;
        google.active += 1;
        google.mostAtOnce = Math.max(google.mostAtOnce, google.active);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        google.active -= 1;
        const { status, body } = respond();
        return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
      }),
    );
    const mod = await import('../../server/index.mjs');
    return { ...mod, google };
  }

  async function request(handleRequest: (req: never, res: never) => Promise<void>, method: string, path: string, body?: unknown) {
    const req = Object.assign(Readable.from([]), {
      method,
      url: path,
      headers: { host: 'localhost', 'content-type': 'application/json' },
      body,
      socket: { remoteAddress: '127.0.0.1' },
    }) as unknown as IncomingMessage;
    let status = 0;
    let headers: Record<string, string> = {};
    let text = '';
    const res = {
      headersSent: false,
      writeHead(code: number, h?: Record<string, string>) {
        status = code;
        headers = h ?? {};
        return res;
      },
      setHeader() {},
      end(chunk?: string) {
        text = chunk ?? '';
      },
    } as unknown as ServerResponse;
    await handleRequest(req as never, res as never);
    return { status, headers, json: JSON.parse(text) };
  }

  const route = () => ({ status: 200, body: { routes: [{ duration: '5400s', distanceMeters: 120_000 }] } });

  it('buys a curve once: the same request again costs no Google call', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { handleRequest, google } = await router({}, route);
    const first = await request(handleRequest, 'POST', '/api/travel-curve', curve());
    const again = await request(handleRequest, 'POST', '/api/travel-curve', curve());
    expect(first.status).toBe(200);
    expect(again.json.samples).toEqual(first.json.samples);
    expect(google.calls).toBe(9);
  });

  it('shares one call between identical requests in flight at the same time', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { handleRequest, google } = await router({}, route, 20);
    const [a, b] = await Promise.all([
      request(handleRequest, 'POST', '/api/travel-curve', curve()),
      request(handleRequest, 'POST', '/api/travel-curve', curve()),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(google.calls).toBe(9);
  });

  it('starting points a few hundred metres apart share samples', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { handleRequest, google } = await router({}, route);
    await request(handleRequest, 'POST', '/api/travel-curve', curve({ origin: { lat: 39.7392, lon: -104.9903 } }));
    await request(handleRequest, 'POST', '/api/travel-curve', curve({ origin: { lat: 39.7411, lon: -104.9881 } }));
    expect(google.calls).toBe(9);
  });

  it('never spends past the daily ceiling, and never half-buys a curve', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { handleRequest, google } = await router({ ROUTES_DAILY_BUDGET: '12' }, route);
    const first = await request(handleRequest, 'POST', '/api/travel-curve', curve());
    const second = await request(handleRequest, 'POST', '/api/travel-curve', curve({ date: '2099-01-18' }));
    expect(first.status).toBe(200);
    expect(second.status).toBe(503);
    expect(second.json.upstream.kind).toBe('daily_budget_reached');
    expect(second.json.samples).toBeUndefined();
    expect(Number(second.headers['Retry-After'])).toBeGreaterThan(0);
    expect(google.calls).toBe(9);
    // What is already bought is still served once the budget is spent.
    expect((await request(handleRequest, 'POST', '/api/travel-curve', curve())).status).toBe(200);
    expect(google.calls).toBe(9);
  });

  it('stops calling Google after a quota refusal, and keeps saying why', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const quota = {
      status: 429,
      body: { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded', details: [{ reason: 'RATE_LIMIT_EXCEEDED' }] } },
    };
    const { handleRequest, google } = await router({}, () => quota);
    const first = await request(handleRequest, 'POST', '/api/travel-curve', curve());
    const callsAfterFirst = google.calls;
    const later = await request(handleRequest, 'POST', '/api/travel-curve', curve({ date: '2099-01-18', direction: 'return' }));
    expect(first.status).toBe(502);
    expect(first.json.upstream.kind).toBe('quota_exceeded');
    expect(callsAfterFirst).toBeLessThanOrEqual(4);
    expect(later.status).toBe(502);
    expect(later.json.upstream).toMatchObject({ kind: 'quota_exceeded', circuitOpen: true });
    expect(google.calls).toBe(callsAfterFirst);
    const health = await request(handleRequest, 'GET', '/api/health');
    expect(health.json.googleRoutes.breakerOpenUntil).not.toBeNull();
    // Calls that never left are given back to the budget.
    expect(health.json.googleRoutes.usedToday).toBe(callsAfterFirst);
  });

  it('keeps at most four Google calls in flight', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { handleRequest, google } = await router({}, route, 15);
    await Promise.all([
      request(handleRequest, 'POST', '/api/travel-curve', curve()),
      request(handleRequest, 'POST', '/api/travel-curve', curve({ direction: 'return' })),
    ]);
    expect(google.calls).toBe(20);
    expect(google.mostAtOnce).toBe(4);
  });

  it('makes no call on a serverless host without the shared store: a per-instance budget is no ceiling', async () => {
    const { handleRequest, google } = await router({ VERCEL: '1' }, route);
    const res = await request(handleRequest, 'POST', '/api/travel-curve', curve());
    expect(res.status).toBe(503);
    expect(res.json.upstream.kind).toBe('budget_unverifiable');
    expect(google.calls).toBe(0);
  });

  it('reports the budget on /api/health without anything secret', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { handleRequest } = await router({ ROUTES_DAILY_BUDGET: '100' }, route);
    await request(handleRequest, 'POST', '/api/travel-curve', curve());
    const { json } = await request(handleRequest, 'GET', '/api/health');
    expect(json.googleRoutes).toMatchObject({ dailyBudget: 100, usedToday: 9, sharedStore: false, breakerOpenUntil: null });
    expect(JSON.stringify(json)).not.toContain('test-key-not-a-real-one');
  });
});

describe('sample lifetimes and quota resets', () => {
  it('keeps a sample for half its lead time, between 15 minutes and a day', async () => {
    const { sampleTtlMs } = await import('../../server/index.mjs');
    const now = Date.parse('2026-12-12T12:00:00Z');
    const at = (hours: number) => new Date(now + hours * 3_600_000).toISOString();
    expect(sampleTtlMs(null, now)).toBe(15 * 60_000);
    expect(sampleTtlMs(at(0.25), now)).toBe(15 * 60_000);
    expect(sampleTtlMs(at(4), now)).toBe(2 * 3_600_000);
    expect(sampleTtlMs(at(24 * 7), now)).toBe(24 * 3_600_000);
  });

  it('opens a quota breaker until just after midnight Pacific, a key or billing one for 30 minutes', async () => {
    const { breakerUntilMs, nextQuotaResetMs } = await import('../../server/index.mjs');
    const now = Date.parse('2026-11-15T18:00:00Z');
    expect(new Date(nextQuotaResetMs(now)).toISOString()).toBe('2026-11-16T08:00:00.000Z');
    expect(breakerUntilMs('quota_exceeded', now)).toBe(Date.parse('2026-11-16T08:05:00Z'));
    expect(breakerUntilMs('billing_disabled', now)).toBe(now + 30 * 60_000);
  });
});

describe('the shared Neon store', () => {
  it('creates its tables once, reserves atomically and reports a refused reservation', async () => {
    const { createNeonStore } = await import('../../server/routesStore.mjs');
    const queries: string[] = [];
    let used = 95;
    const sql = {
      query: vi.fn(async (text: string, params: unknown[] = []) => {
        queries.push(text);
        if (text.startsWith('INSERT INTO routes_budget')) {
          const [, n, limit] = params as [string, number, number];
          if (used + n > limit) return [];
          used += n;
          return [{ used }];
        }
        if (text.startsWith('SELECT used')) return [{ used }];
        return [];
      }),
    };
    const store = createNeonStore('postgres://unused', { sql: sql as never });
    expect(await store.reserve('2026-11-16', 4, 100)).toEqual({ ok: true, used: 99 });
    expect(await store.reserve('2026-11-16', 4, 100)).toEqual({ ok: false, used: 99 });
    expect(queries.filter((q) => q.startsWith('CREATE TABLE'))).toHaveLength(2);
    expect(queries.find((q) => q.startsWith('INSERT INTO routes_budget'))).toMatch(/WHERE routes_budget\.used \+ EXCLUDED\.used <= \$3/);
  });
});
