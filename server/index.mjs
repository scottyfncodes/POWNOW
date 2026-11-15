#!/usr/bin/env node
/**
 * POW NOW data proxy.
 *
 * The one server-side thing this project needs. It exists for three reasons,
 * all of them "a browser can't":
 *
 *   1. Hold secrets. Google Routes (traffic) and CDOT (road conditions) both
 *      need an API key, and a key in a static bundle belongs to whoever opens
 *      devtools. The keys live here and never appear in any response.
 *   2. Reach hosts that don't serve CORS. The NRCS SNOTEL API (measured
 *      snowpack) and CDOT's feed are server-to-server APIs.
 *   3. Share a cache. Every Google Routes departure sample is bought once,
 *      under one global daily budget, and served to every visitor while it is
 *      fresh (see "the Google budget"); the same statewide road feed answers
 *      every corridor question for 5 minutes.
 *
 * Deliberately framework-free (no Express; two dependencies, an HTML parser for resort pages and the Neon driver for the shared Google budget): a plain `node:http` router is
 * easier to audit for "does this leak a key anywhere" than a framework.
 *
 * It runs two ways from the same file:
 *   - as a long-lived process: `node server/index.mjs` (Render, a VPS, local dev)
 *   - as a Vercel serverless function: `api/[...path].mjs` imports
 *     `handleRequest` and hands it Vercel's request/response, which are the
 *     same Node objects. Deployed next to the static frontend, the proxy is
 *     same-origin and needs no CORS configuration at all.
 *
 * Caching in the serverless case: each warm instance keeps its own
 * in-memory cache, and when `KV_REST_API_URL` / `KV_REST_API_TOKEN` are set
 * (Vercel KV / Upstash Redis, REST) the cache is also written through to a
 * shared store so a cold instance starts warm. GET endpoints additionally
 * send `Cache-Control: s-maxage` so a CDN in front (Vercel's) serves repeats
 * without invoking the function at all.
 *
 * See .env.example for every variable this reads.
 */
import { createServer } from 'node:http';
import { parse as parseHtml } from 'node-html-parser';
import { createMemoryStore, createNeonStore } from './routesStore.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const API_KEY = process.env.GOOGLE_ROUTES_API_KEY ?? '';
const COTRIP_API_KEY = process.env.COTRIP_API_KEY ?? '';
const CACHE_TTL_MS = Number(process.env.TRAFFIC_CACHE_TTL_SECONDS ?? 900) * 1000;
const ROAD_CACHE_TTL_MS = Number(process.env.ROAD_CACHE_TTL_SECONDS ?? 300) * 1000;
const SNOTEL_CACHE_TTL_MS = Number(process.env.SNOTEL_CACHE_TTL_SECONDS ?? 1800) * 1000;
const TIME_ZONE = process.env.POWNOW_TIME_ZONE ?? process.env.SNOWNOW_TIME_ZONE ?? 'America/Denver';

/**
 * Which browser origins may call this. "*" (the default, for local dev)
 * answers anyone. In production set it to the deployed frontend, e.g.
 * "https://scottyfncodes.github.io" — several may be comma-separated. A
 * browser request from any other origin is refused before it costs a Google
 * call. Requests with no Origin header at all (curl, a health checker) are
 * still served; the per-IP rate limit below is what bounds those.
 */
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN ?? '*')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

/** Per-IP request budget: this many requests per minute, then 429. */
const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 90);

const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const COTRIP_ENDPOINT = process.env.COTRIP_BASE_URL ?? 'https://data.cotrip.org/api/v1';
const SNOTEL_ENDPOINT = process.env.SNOTEL_BASE_URL ?? 'https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1';
const REQUEST_TIMEOUT_MS = 6000;

/*
 * Departure-time grids, in minutes since local midnight. Kept deliberately
 * coarse — every point here is a real, billed Google Routes call — and the
 * client-side `travelAt` interpolation fills the gaps exactly as it already
 * does for the 6-minute-resolution demo curve. 9 + 11 = 20 calls per
 * (corridor, direction, date) combination, cached for CACHE_TTL_MS and
 * shared across every visitor asking about that corridor in that window —
 * not 20 calls per page load.
 */
const OUTBOUND_MINUTES = [240, 270, 300, 330, 360, 390, 420, 450, 480]; // 4:00–8:00
const RETURN_MINUTES = [630, 660, 690, 780, 810, 840, 870, 900, 960, 1020, 1080]; // 10:30–18:00

/* ------------------------------------------------------------------ cache */

/** Tier 1: in-memory, per process/instance. */
const cache = new Map();

/**
 * Tier 2 (optional): a shared Redis-compatible REST store — Vercel KV and
 * Upstash both speak this protocol — so serverless instances share one cache.
 * Spoken directly over fetch to stay dependency-free. Absent the env vars,
 * this tier is simply skipped.
 */
const KV_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? '';
const KV_PREFIX = process.env.KV_PREFIX ?? 'pownow:';

async function kvCommand(command) {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const response = await fetchWithTimeout(
      KV_URL,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      },
      1500,
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data && typeof data === 'object' && 'result' in data ? data.result : null;
  } catch {
    // A cache is never allowed to take a request down.
    return null;
  }
}

async function cacheGet(key) {
  const entry = cache.get(key);
  if (entry) {
    if (entry.expiresAt > Date.now()) return entry.value;
    cache.delete(key);
  }
  const raw = await kvCommand(['GET', KV_PREFIX + key]);
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.expiresAt > Date.now()) {
      cache.set(key, parsed);
      return parsed.value;
    }
  } catch {
    // Unreadable entry: treat as a miss.
  }
  return null;
}

async function cacheSet(key, value, ttlMs = CACHE_TTL_MS) {
  const entry = { value, expiresAt: Date.now() + ttlMs };
  cache.set(key, entry);
  await kvCommand(['SET', KV_PREFIX + key, JSON.stringify(entry), 'PX', String(ttlMs)]);
}

/**
 * In-flight de-duplication. Thirteen mountains on one NOW screen can ask for
 * the same corridor's curve within the same second; without this each one
 * would miss the cold cache and pay its own 20 Google calls. With it, the
 * first request does the work and the other twelve await the same promise.
 */
const inFlight = new Map();

async function cachedOrCompute(key, ttlMs, compute) {
  const hit = await cacheGet(key);
  if (hit) return hit;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const promise = (async () => {
    try {
      const value = await compute();
      if (value !== null && value !== undefined) await cacheSet(key, value, ttlMs);
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, promise);
  return promise;
}

/* ------------------------------------------------------------- rate limit */

/** Fixed-window per-IP counter: cheap, and enough to stop one client from draining the Google budget. */
const rateWindows = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const windowStart = Math.floor(now / 60_000) * 60_000;
  let entry = rateWindows.get(ip);
  if (!entry || entry.windowStart !== windowStart) {
    entry = { windowStart, count: 0 };
    rateWindows.set(ip, entry);
  }
  entry.count += 1;
  // Keep the map from growing forever under a slow trickle of new IPs.
  if (rateWindows.size > 5000) {
    for (const [key, value] of rateWindows) {
      if (value.windowStart !== windowStart) rateWindows.delete(key);
    }
  }
  return entry.count > RATE_LIMIT_PER_MINUTE;
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress ?? 'unknown';
}

/* ------------------------------------------------------------------- time */

/**
 * Local wall-clock parts for an instant in TIME_ZONE. Used both to convert a
 * requested local departure time to UTC and to know what "now" is on the
 * mountain's clock regardless of where this server runs.
 */
function localParts(instantMs, timeZone) {
  const rendered = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(instantMs));
  const parts = Object.fromEntries(rendered.map((p) => [p.type, p.value]));
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** Local wall-clock time (DST-aware) → an RFC3339 UTC instant Google Routes accepts. */
function localToUtcMs(dateKey, minuteOfDay, timeZone) {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const [year, month, day] = dateKey.split('-').map(Number);

  // Guess UTC = local, then correct by however far that guess's own rendered
  // local time is from the wall-clock time we actually wanted — two passes
  // converge because DST offsets are stable within a single day.
  let guessMs = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 2; i += 1) {
    const rendered = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date(guessMs));
    const parts = Object.fromEntries(rendered.map((p) => [p.type, p.value]));
    const renderedMs = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    );
    const wantedMs = Date.UTC(year, month - 1, day, hour, minute);
    guessMs += wantedMs - renderedMs;
  }
  return guessMs;
}

export function localToUtcIso(dateKey, minuteOfDay, timeZone) {
  return new Date(localToUtcMs(dateKey, minuteOfDay, timeZone)).toISOString();
}

/* ------------------------------------------------------------------- http */

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------------------------------------------- traffic */

/**
 * Why Google Routes did not give us a route, reduced to what is safe to say out
 * loud. A failure used to collapse into `null`, so "the key is restricted",
 * "billing is off", "over quota" and "no road between these points" all
 * surfaced as the same bare 502 with nothing in the logs to tell them apart.
 *
 * Only Google's own enumerated codes pass through (`PERMISSION_DENIED`,
 * `API_KEY_SERVICE_BLOCKED`...), and only if they look like one. Its free-text
 * message can carry a project number and is kept for the server log alone.
 */
const ROUTES_REASON_KINDS = {
  API_KEY_INVALID: 'key_invalid',
  API_KEY_SERVICE_BLOCKED: 'key_restricted',
  API_KEY_HTTP_REFERRER_BLOCKED: 'key_restricted',
  API_KEY_IP_ADDRESS_BLOCKED: 'key_restricted',
  API_KEY_ANDROID_APP_BLOCKED: 'key_restricted',
  API_KEY_IOS_APP_BLOCKED: 'key_restricted',
  SERVICE_DISABLED: 'api_not_enabled',
  BILLING_DISABLED: 'billing_disabled',
  RATE_LIMIT_EXCEEDED: 'quota_exceeded',
  RESOURCE_QUOTA_EXCEEDED: 'quota_exceeded',
  CONSUMER_SUSPENDED: 'project_suspended',
  CONSUMER_INVALID: 'project_invalid',
};

const ROUTES_FAILURE_TEXT = {
  key_invalid: 'Google rejected the Routes API key as invalid.',
  key_restricted: "The Routes API key's restrictions do not allow this request.",
  api_not_enabled: 'The Routes API is not enabled for the key\'s Google Cloud project.',
  billing_disabled: 'Billing is not enabled on the Google Cloud project behind the Routes API key.',
  quota_exceeded: 'The Google Routes quota is exhausted.',
  project_suspended: 'The Google Cloud project behind the Routes API key is suspended.',
  project_invalid: 'The Google Cloud project behind the Routes API key is not valid.',
  permission_denied: 'Google refused the Routes request.',
  bad_request: 'Google rejected the Routes request as malformed.',
  upstream_error: 'Google Routes had an error of its own.',
  timeout: 'Google Routes did not answer in time.',
  network: 'Google Routes could not be reached.',
  unreadable: 'Google Routes answered with something this proxy could not read.',
  no_route: 'Google Routes found no drivable route for this request.',
  daily_budget_reached: "Today's Google Routes budget is spent; drive times come back when it resets at midnight Pacific.",
  budget_unverifiable: 'The Google Routes budget could not be checked, so no call was made.',
};

/** Kinds that are this proxy's own spending limits, not Google refusing: answered 503, not 502. */
const OWN_LIMIT_KINDS = new Set(['daily_budget_reached', 'budget_unverifiable']);

/** The HTTP status for a Routes failure: our own limit is 503 (try later), Google's refusal is 502. */
export const routesFailureStatus = (failure) => (OWN_LIMIT_KINDS.has(failure.kind) ? 503 : 502);

const enumLike = (value) => (typeof value === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(value) ? value : null);

/** A Routes response that is not a usable route, as `{ kind, upstreamStatus, googleStatus, reason, message }`. */
export function classifyRoutesFailure(upstreamStatus, body) {
  const error = body && typeof body === 'object' ? body.error : null;
  const googleStatus = enumLike(error?.status);
  const details = Array.isArray(error?.details) ? error.details : [];
  const reason = enumLike(details.find((detail) => enumLike(detail?.reason))?.reason);
  const message = typeof error?.message === 'string' ? error.message : null;

  let kind = reason ? ROUTES_REASON_KINDS[reason] : undefined;
  if (!kind) {
    if (upstreamStatus === 429 || googleStatus === 'RESOURCE_EXHAUSTED') kind = 'quota_exceeded';
    else if (upstreamStatus === 400 && /api key not valid/i.test(message ?? '')) kind = 'key_invalid';
    else if (upstreamStatus === 400) kind = 'bad_request';
    else if (upstreamStatus === 401 || upstreamStatus === 403) kind = 'permission_denied';
    else if (upstreamStatus >= 500) kind = 'upstream_error';
    else if (upstreamStatus >= 200 && upstreamStatus < 300) kind = 'no_route';
    else kind = 'unreadable';
  }
  return { kind, upstreamStatus, googleStatus, reason, message };
}

/** What a client may be told about a Routes failure: codes and a fixed sentence, never Google's own text. */
export function publicRoutesFailure(failure) {
  return {
    error: ROUTES_FAILURE_TEXT[failure.kind] ?? 'Google Routes returned no usable route.',
    upstream: {
      service: 'google-routes',
      kind: failure.kind,
      status: failure.upstreamStatus ?? null,
      googleStatus: failure.googleStatus ?? null,
      reason: failure.reason ?? null,
      // True when no call was made: an earlier failure of the same kind tripped the circuit breaker.
      circuitOpen: failure.circuitOpen === true,
      // For our own limits: which daily pool ("ranking" or "detail") ran out.
      ...(failure.pool ? { pool: failure.pool } : {}),
    },
  };
}

/** Google's message for the server log, with anything shaped like a credential removed. */
export function redactForLog(text, secrets = []) {
  if (typeof text !== 'string') return null;
  let out = text;
  for (const secret of secrets) if (secret) out = out.split(secret).join('[redacted]');
  return out.replace(/AIza[0-9A-Za-z_-]{10,}/g, '[redacted]').replace(/([?&]key=)[^&\s]+/gi, '$1[redacted]').slice(0, 400);
}

/** Answer a Routes failure: 503 with Retry-After for our own limit, 502 for Google's refusal (breaker or not). */
function sendRoutesFailure(req, res, failure) {
  const headers = failure.kind === 'daily_budget_reached' || failure.kind === 'quota_exceeded'
    ? { 'Retry-After': String(Math.max(60, Math.ceil((nextQuotaResetMs() - Date.now()) / 1000))) }
    : {};
  sendJson(req, res, routesFailureStatus(failure), publicRoutesFailure(failure), headers);
}

/** Thrown when no sampled departure produced a route; carries the commonest reason why. */
export class RoutesUnavailableError extends Error {
  constructor(failure) {
    super(ROUTES_FAILURE_TEXT[failure.kind] ?? 'Google Routes returned no usable route.');
    this.name = 'RoutesUnavailableError';
    this.failure = failure;
  }
}

/** The failure most of the samples hit, so one stray timeout does not hide that the key is blocked. */
export function dominantFailure(failures) {
  const counts = new Map();
  for (const failure of failures) counts.set(failure.kind, (counts.get(failure.kind) ?? 0) + 1);
  let best = null;
  for (const failure of failures) {
    if (!best || counts.get(failure.kind) > counts.get(best.kind)) best = failure;
  }
  return best ?? { kind: 'no_route', upstreamStatus: null, googleStatus: null, reason: null, message: null };
}

/** One line per failed curve or preview, so the function log says what Google actually answered. */
function logRoutesFailure(where, failure, sampled) {
  // Our own budget and a breaker already logged are not news on every request.
  if (OWN_LIMIT_KINDS.has(failure.kind) || failure.circuitOpen) return;
  console.warn(
    `[google-routes] ${where} failed: ` +
      JSON.stringify({
        kind: failure.kind,
        upstreamStatus: failure.upstreamStatus ?? null,
        googleStatus: failure.googleStatus ?? null,
        reason: failure.reason ?? null,
        sampled,
        message: redactForLog(failure.message, [API_KEY]),
      }),
  );
}

/**
 * One Google Routes call for one departure time. `departureIso` may be null,
 * which Google reads as "now". Resolves to `{ sample }` or `{ failure }` and
 * never throws: callers skip a failed point and keep its reason.
 */
async function requestRoute(origin, destination, departureIso, { withPolyline = false } = {}) {
  let response;
  try {
    response = await fetchWithTimeout(
      ROUTES_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          // The polyline is the real driven road geometry; it rides along on
          // the same call at no extra cost, so only the map preview asks for it.
          'X-Goog-FieldMask': withPolyline
            ? 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
            : 'routes.duration,routes.distanceMeters',
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lon } } },
          destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lon } } },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          ...(departureIso ? { departureTime: departureIso } : {}),
        }),
      },
      REQUEST_TIMEOUT_MS,
    );
  } catch (error) {
    const kind = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network';
    return { failure: { kind, upstreamStatus: null, googleStatus: null, reason: null, message: null } };
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Not JSON: classified below from the status alone.
  }
  if (!response.ok) return { failure: classifyRoutesFailure(response.status, data) };
  if (data === null) return { failure: { ...classifyRoutesFailure(response.status, null), kind: 'unreadable' } };

  const route = data.routes?.[0];
  // Google returns duration as e.g. "1234s".
  const seconds = route?.duration ? Number(String(route.duration).replace('s', '')) : NaN;
  if (!Number.isFinite(seconds)) return { failure: classifyRoutesFailure(response.status, data) };
  const distanceMeters = Number(route.distanceMeters);
  return {
    sample: {
      durationMinutes: Math.round(seconds / 60),
      distanceMiles: Number.isFinite(distanceMeters) ? distanceMeters / 1609.344 : null,
      polyline: typeof route.polyline?.encodedPolyline === 'string' ? route.polyline.encodedPolyline : null,
    },
  };
}

/* ------------------------------------------------------- the Google budget */

/*
 * Google Routes is billed per call and the project runs on a fixed daily
 * ceiling, split into two pools so one kind of use cannot starve the other:
 *
 *   ranking  one drive each way per mountain, for the list and Today's pick
 *            (ROUTES_RANKING_BUDGET, 130). A city's ranking for a day is
 *            bought whole or not at all: never a ranking with holes.
 *   detail   the full departure curve, when someone opens a mountain
 *            (ROUTES_DETAIL_BUDGET, 60).
 *
 * Every call goes through one gate:
 *   1. Each departure sample is cached on its own, shared by every instance
 *      (routesStore.mjs), and reused by both pools. The ranking reads any
 *      unexpired sample; a full curve only one younger than half the time left
 *      until that departure, so a curve read near the departure is near-live.
 *   2. Concurrent requests for the same sample in one instance share one call.
 *   3. The calls a request needs are reserved at once, atomically, in its pool
 *      (Pacific day, when Google resets quotas): all of them or none.
 *   4. At most ROUTES_CONCURRENCY calls are in flight per instance.
 *   5. A quota, billing or key refusal opens a circuit breaker shared by every
 *      instance: no call is made until Google's quota resets (quota) or for 30
 *      minutes (key, billing), and every answer meanwhile still names Google's
 *      refusal, so the failure stays visible.
 *
 * Nothing here invents a drive time: a sample is Google's, cached, or absent.
 */
const BUDGET = {
  ranking: Math.max(0, Number(process.env.ROUTES_RANKING_BUDGET ?? 130)),
  detail: Math.max(0, Number(process.env.ROUTES_DETAIL_BUDGET ?? 60)),
};
const ROUTES_CONCURRENCY = Math.max(1, Number(process.env.ROUTES_CONCURRENCY ?? 8));
const QUOTA_TIME_ZONE = 'America/Los_Angeles';
const DATABASE_URL = process.env.DATABASE_URL ?? '';
/** On a serverless host each instance has its own memory: a budget kept there is no ceiling. */
const SERVERLESS = Boolean(process.env.VERCEL);
const routesStore = DATABASE_URL ? createNeonStore(DATABASE_URL) : createMemoryStore();

/** The ranking's two departures: a standard ski day, leave at 6:00, head home at 3:00 (both on the full grids). */
export const RANKING_MINUTES = { outbound: 360, return: 900 };

const MINUTE = 60_000;
const MIN_FRESH_MS = 15 * MINUTE;
const MAX_KEEP_MS = 24 * 60 * MINUTE;
const clampMs = (ms) => Math.min(MAX_KEEP_MS, Math.max(MIN_FRESH_MS, Math.round(ms)));

/** How old a sample a full curve accepts: half its lead time, between 15 minutes and a day. "Now" is 15 minutes. */
export function sampleTtlMs(departureIso, nowMs = Date.now()) {
  return clampMs(departureIso ? (Date.parse(departureIso) - nowMs) / 2 : 0);
}

/** How long a departure sample is kept at all: until that departure, at most a day. */
const keepUntilDepartureMs = (departureIso, nowMs = Date.now()) => clampMs(Date.parse(departureIso) - nowMs);

/** A starting point to about a kilometre, so neighbours share samples (a drive changes by a minute at most). */
export const roundOrigin = (point) => ({ lat: Math.round(point.lat * 100) / 100, lon: Math.round(point.lon * 100) / 100 });

const sampleKey = (origin, destination, departureIso, withPolyline) =>
  ['s', origin.lat.toFixed(2), origin.lon.toFixed(2), destination.lat.toFixed(4), destination.lon.toFixed(4), departureIso ?? 'now', withPolyline ? 'p' : '']
    .join(':');

/** The ranking's stand-in for a departure already behind us today: one drive sampled at first request, kept for the day. */
const rankingNowKey = (origin, destination, date, direction) =>
  ['r', origin.lat.toFixed(2), origin.lon.toFixed(2), destination.lat.toFixed(4), destination.lon.toFixed(4), date, direction].join(':');

/** The instant Google's per-day quotas next reset: midnight Pacific. */
export function nextQuotaResetMs(nowMs = Date.now()) {
  const [year, month, day] = localParts(nowMs, QUOTA_TIME_ZONE).dateKey.split('-').map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  return localToUtcMs(tomorrow, 0, QUOTA_TIME_ZONE);
}

/** Refusals that will repeat on every call until something changes: worth stopping for. */
const BREAKER_KINDS = new Set([
  'quota_exceeded', 'key_invalid', 'key_restricted', 'api_not_enabled', 'billing_disabled', 'project_suspended', 'project_invalid', 'permission_denied',
]);
export function breakerUntilMs(kind, nowMs = Date.now()) {
  return kind === 'quota_exceeded' ? nextQuotaResetMs(nowMs) + 5 * MINUTE : nowMs + 30 * MINUTE;
}

const ownFailure = (kind, pool) => ({ kind, pool, upstreamStatus: null, googleStatus: null, reason: null, message: null });
const warnStore = (what, error) =>
  console.warn(`[google-routes] shared store ${what} failed: ${redactForLog(error instanceof Error ? error.message : String(error), [DATABASE_URL])}`);

/** Tier 1 in front of the shared store: this instance's copy of samples it has seen, with when Google gave them. */
const sampleMemo = new Map();
const pendingSamples = new Map();
let localBreaker = null;

let googleActive = 0;
const googleQueue = [];
async function withGoogleSlot(run) {
  if (googleActive >= ROUTES_CONCURRENCY) await new Promise((resolve) => googleQueue.push(resolve));
  googleActive += 1;
  try {
    return await run();
  } finally {
    googleActive -= 1;
    googleQueue.shift()?.();
  }
}

async function openBreaker() {
  if (localBreaker && localBreaker.until > Date.now()) return localBreaker.failure;
  try {
    const shared = await routesStore.getBreaker();
    if (shared) {
      localBreaker = { until: shared.until, failure: shared.failure };
      return shared.failure;
    }
  } catch (error) {
    warnStore('breaker read', error);
  }
  return null;
}

async function tripBreaker(failure) {
  // Calls already in flight when the breaker opens come back with the same refusal: one trip is enough.
  if (localBreaker && localBreaker.until > Date.now() && localBreaker.failure.kind === failure.kind) return;
  const until = breakerUntilMs(failure.kind);
  localBreaker = { until, failure };
  console.warn(`[google-routes] circuit breaker open until ${new Date(until).toISOString()}: ${failure.kind}`);
  try {
    await routesStore.setBreaker(until, failure);
  } catch (error) {
    warnStore('breaker write', error);
  }
}

/** Buy the samples nobody has: one reservation in the pool for all of them, then at most ROUTES_CONCURRENCY calls at a time. */
async function spendOnGoogle(origin, items, pool, withPolyline) {
  const blocked = await openBreaker();
  if (blocked) return items.map(() => ({ failure: { ...blocked, circuitOpen: true } }));
  if (SERVERLESS && !routesStore.shared) return items.map(() => ({ failure: ownFailure('budget_unverifiable', pool) }));

  const day = localParts(Date.now(), QUOTA_TIME_ZONE).dateKey;
  const limit = BUDGET[pool];
  let reservation;
  try {
    reservation = items.length <= limit ? await routesStore.reserve(day, pool, items.length, limit) : { ok: false };
  } catch (error) {
    warnStore('budget', error);
    return items.map(() => ({ failure: ownFailure('budget_unverifiable', pool) }));
  }
  if (!reservation.ok) return items.map(() => ({ failure: ownFailure('daily_budget_reached', pool) }));
  console.info(`[google-routes] ${pool}: calls ${items.length}, budget ${reservation.used}/${limit} for ${day} (Pacific)`);

  let unspent = 0;
  const results = await Promise.all(
    items.map((item) =>
      withGoogleSlot(async () => {
        // The breaker may have opened while this call waited for a slot.
        if (localBreaker && localBreaker.until > Date.now()) {
          unspent += 1;
          return { failure: { ...localBreaker.failure, circuitOpen: true } };
        }
        const result = await requestRoute(origin, item.destination, item.departureIso, { withPolyline });
        if (result.sample) {
          const sample = { ...result.sample, sampledAt: Date.now() };
          sampleMemo.set(item.key, { value: sample, expiresAt: Date.now() + item.keepMs });
          try {
            await routesStore.putSample(item.key, sample, item.keepMs);
          } catch (error) {
            warnStore('write', error);
          }
          return { sample };
        }
        if (BREAKER_KINDS.has(result.failure.kind)) await tripBreaker(result.failure);
        return result;
      }),
    ),
  );
  if (unspent > 0) await routesStore.release(day, pool, unspent).catch((error) => warnStore('budget release', error));
  return results;
}

/**
 * Google samples for these items, in order, each `{ sample }` or `{ failure }`. An item is
 * `{ destination, departureIso (null = now), key, keepMs, maxAgeMs }`. From this instance, then the
 * shared store (if young enough for this reader), then a call shared with an identical one in flight,
 * and only then new calls, all reserved together in `pool`.
 */
async function getRouteSamples(origin, items, { pool, withPolyline = false }) {
  const now = Date.now();
  const fresh = (value, item) => value && now - (value.sampledAt ?? 0) <= item.maxAgeMs;
  const out = new Array(items.length);
  let missing = [];
  items.forEach((item, i) => {
    const hit = sampleMemo.get(item.key);
    if (hit && hit.expiresAt > now && fresh(hit.value, item)) out[i] = { sample: hit.value };
    else missing.push(i);
  });

  if (missing.length > 0) {
    let stored = new Map();
    try {
      stored = await routesStore.getSamples(missing.map((i) => items[i].key));
    } catch (error) {
      warnStore('read', error);
    }
    missing = missing.filter((i) => {
      const value = stored.get(items[i].key);
      if (!fresh(value, items[i])) return true;
      out[i] = { sample: value };
      // This instance keeps it briefly; the shared store stays the authority on expiry.
      sampleMemo.set(items[i].key, { value, expiresAt: now + Math.min(5 * MINUTE, items[i].keepMs) });
      return false;
    });
  }

  const waits = [];
  const toBuy = [];
  for (const i of missing) {
    const pending = pendingSamples.get(items[i].key);
    if (pending) waits.push(pending.then((result) => (out[i] = result)));
    else toBuy.push(i);
  }

  if (toBuy.length > 0) {
    const settle = new Map();
    for (const i of toBuy) pendingSamples.set(items[i].key, new Promise((resolve) => settle.set(i, resolve)));
    try {
      const results = await spendOnGoogle(origin, toBuy.map((i) => items[i]), pool, withPolyline);
      toBuy.forEach((i, n) => {
        out[i] = results[n];
        settle.get(i)(results[n]);
      });
    } finally {
      for (const i of toBuy) {
        if (out[i] === undefined) settle.get(i)({ failure: ownFailure('budget_unverifiable', pool) });
        pendingSamples.delete(items[i].key);
      }
    }
  }
  await Promise.all(waits);
  return out;
}

/** A full curve's item: shared key, kept until departure, read only while young enough for a curve. */
const detailItem = (origin, destination, departureIso, withPolyline = false) => ({
  destination,
  departureIso,
  key: sampleKey(origin, destination, departureIso, withPolyline),
  keepMs: departureIso ? keepUntilDepartureMs(departureIso) : MIN_FRESH_MS,
  maxAgeMs: sampleTtlMs(departureIso),
});

/**
 * One city's ranking for a day: a drive out at 6:00 and back at 3:00 for every mountain, bought
 * together from the ranking pool or not at all. A departure already behind us today is replaced by one
 * drive sampled now and kept for the rest of that day, and reported at the minute it was sampled.
 */
async function buildRankingDrives(origin, date, destinations, nowMs = Date.now()) {
  const items = [];
  for (const destination of destinations) {
    const timeZone = resolveTimeZone(destination.timeZone);
    for (const direction of ['outbound', 'return']) {
      const minute = RANKING_MINUTES[direction];
      const departureMs = localToUtcMs(date, minute, timeZone);
      if (departureMs > nowMs + 2 * MINUTE) {
        const departureIso = new Date(departureMs).toISOString();
        items.push({ destination, direction, timeZone, minute, departureIso, key: sampleKey(origin, destination, departureIso, false),
          keepMs: keepUntilDepartureMs(departureIso, nowMs), maxAgeMs: Infinity });
      } else {
        const endOfDay = localToUtcMs(date, 24 * 60, timeZone);
        items.push({ destination, direction, timeZone, minute: null, departureIso: null, key: rankingNowKey(origin, destination, date, direction),
          keepMs: clampMs(endOfDay - nowMs), maxAgeMs: Infinity });
      }
    }
  }
  const results = await getRouteSamples(origin, items, { pool: 'ranking' });
  const drives = destinations.map(() => ({}));
  const failures = [];
  items.forEach((item, i) => {
    const index = destinations.indexOf(item.destination);
    const { sample, failure } = results[i];
    if (!sample) {
      failures.push(failure);
      drives[index][item.direction] = null;
      return;
    }
    drives[index][item.direction] = {
      departure: item.minute ?? localParts(sample.sampledAt, item.timeZone).minuteOfDay,
      durationMinutes: sample.durationMinutes,
      sampledAt: new Date(sample.sampledAt).toISOString(),
    };
    if (sample.distanceMiles !== null && drives[index].distanceMiles == null) drives[index].distanceMiles = Math.round(sample.distanceMiles * 10) / 10;
  });
  if (failures.length === items.length) {
    const failure = dominantFailure(failures);
    logRoutesFailure(`ranking (${date}, ${destinations.length} mountains)`, failure, items.length);
    throw new RoutesUnavailableError(failure);
  }
  return { date, origin, departures: RANKING_MINUTES, drives };
}

/** Today's budget, for /api/health: per pool, what was spent, and whether the breaker is open. Never a secret. */
async function budgetStatus() {
  const day = localParts(Date.now(), QUOTA_TIME_ZONE).dateKey;
  const pools = {};
  for (const [pool, limit] of Object.entries(BUDGET)) {
    let used = null;
    try {
      used = await routesStore.used(day, pool);
    } catch {
      // Reported as null: unknown, not zero.
    }
    pools[pool] = { limit, used };
  }
  const breaker = await openBreaker();
  return {
    day,
    dailyBudget: BUDGET.ranking + BUDGET.detail,
    pools,
    sharedStore: routesStore.shared,
    breakerOpenUntil: breaker && localBreaker ? new Date(localBreaker.until).toISOString() : null,
  };
}

/**
 * Which departure minutes to actually ask Google about.
 *
 * Google Routes refuses a TRAFFIC_AWARE request whose `departureTime` is in
 * the past, so a same-day request made at 9am used to lose every outbound
 * sample and report the whole curve unavailable. Past grid points are dropped
 * here instead, and when any were dropped a "now" sample (no departureTime,
 * which Google reads as right now) anchors the curve at the present — so a
 * 9am NOW request gets an honest curve that starts at 9am rather than
 * nothing at all. Future dates are untouched.
 */
export function planDepartureMinutes(gridMinutes, dateKey, nowMs, timeZone) {
  const local = localParts(nowMs, timeZone);
  if (dateKey !== local.dateKey) {
    // Not today: the whole grid is in the future (or the whole day is in the
    // past, in which case Google will refuse every point and the caller
    // reports unavailable — there is no honest curve for yesterday).
    return gridMinutes.map((minute) => ({ minute, departureIso: localToUtcIso(dateKey, minute, timeZone) }));
  }
  // A two-minute margin keeps a sample from going stale between here and Google.
  const cutoff = local.minuteOfDay + 2;
  const future = gridMinutes.filter((minute) => minute > cutoff);
  if (future.length === gridMinutes.length) {
    return future.map((minute) => ({ minute, departureIso: localToUtcIso(dateKey, minute, timeZone) }));
  }
  const nowMinute = Math.max(local.minuteOfDay, 1);
  return [
    { minute: nowMinute, departureIso: null },
    ...future.map((minute) => ({ minute, departureIso: localToUtcIso(dateKey, minute, timeZone) })),
  ];
}

/**
 * The zones a client may ask a travel curve to be built in. Every mountain in
 * the dataset runs on one of these two; anything else falls back to the
 * server's own TIME_ZONE rather than being trusted as-is.
 */
const ALLOWED_TIME_ZONES = new Set(['America/Denver', 'America/Los_Angeles']);

export const resolveTimeZone = (requested) =>
  typeof requested === 'string' && ALLOWED_TIME_ZONES.has(requested) ? requested : TIME_ZONE;

async function buildTravelCurve(origin, destination, direction, date, timeZone = TIME_ZONE) {
  const grid = direction === 'outbound' ? OUTBOUND_MINUTES : RETURN_MINUTES;
  const plan = planDepartureMinutes(grid, date, Date.now(), timeZone);
  const results = await getRouteSamples(origin, plan.map((p) => detailItem(origin, destination, p.departureIso)), { pool: 'detail' });
  const samplesRaw = plan.map(({ minute }, i) => ({ minute, ...results[i] }));

  const resolved = samplesRaw.filter((d) => d.sample);
  if (resolved.length === 0) {
    const failure = dominantFailure(samplesRaw.map((d) => d.failure).filter(Boolean));
    logRoutesFailure(`travel curve (${direction}, ${date})`, failure, samplesRaw.length);
    throw new RoutesUnavailableError(failure);
  }

  const floor = Math.min(...resolved.map((d) => d.sample.durationMinutes));
  const samples = resolved.map(({ minute, sample }) => ({
    departure: minute,
    durationMinutes: sample.durationMinutes,
    // Congestion isn't a field Google returns; it's derived here from how far
    // this sample's duration sits above the fastest sample seen across the
    // whole grid. A real, if approximate, read on relative traffic — not a
    // fabricated one.
    congestion: Math.max(0, Math.min(1, Math.round(((sample.durationMinutes - floor) / floor) * 100) / 100)),
  }));

  // Distance doesn't vary by departure time — one real reading from Google is enough.
  const withDistance = resolved.find((d) => d.sample.distanceMiles !== null);

  return {
    samples,
    // Google does not report surface condition. The client treats an absent
    // value as "not reported" and gets road state from the CDOT feed instead.
    roadCondition: null,
    incidents: [],
    distanceMiles: withDistance ? Math.round(withDistance.sample.distanceMiles * 10) / 10 : null,
    truncatedToNow: plan.some((p) => p.departureIso === null),
    sourceTimestamp: new Date().toISOString(),
  };
}

/**
 * A single "right now" reading — one Google Routes call, no departure grid.
 * Exists for the mountain map, which only ever needs one point-in-time
 * duration/distance for whichever mountain the user actually tapped, plus
 * the route's encoded polyline so the map can draw the real road.
 */
async function fetchRoutePreview(origin, destination) {
  const [{ sample, failure }] = await getRouteSamples(origin, [detailItem(origin, destination, null, true)], { pool: 'detail', withPolyline: true });
  if (!sample) {
    logRoutesFailure('route preview', failure, 1);
    throw new RoutesUnavailableError(failure);
  }
  return {
    durationMinutes: sample.durationMinutes,
    distanceMiles: sample.distanceMiles === null ? null : Math.round(sample.distanceMiles * 10) / 10,
    polyline: sample.polyline,
  };
}

/* ----------------------------------------------------------- CDOT roads */

/**
 * CDOT's public data feed (data.cotrip.org, free registered key). Two GeoJSON
 * collections matter here: `roadConditions` (surface + chain/traction law
 * by segment) and `incidents` (closures, crashes). This normalizes both into
 * one flat list of road events the client can filter by highway and mile
 * marker. Field access is defensive throughout: an event this code doesn't
 * understand contributes nothing, and a feed whose envelope isn't a GeoJSON
 * FeatureCollection makes the whole call fail as 502 — never a false clear.
 */
function pickString(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

function pickNumber(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of keys) {
    const value = Number(obj[key]);
    if (obj[key] !== undefined && obj[key] !== null && Number.isFinite(value)) return value;
  }
  return null;
}

/**
 * A few [lat, lon] points from a GeoJSON geometry, so the client can place an
 * event on the map when it carries no mile markers (road-condition segments
 * never do). GeoJSON order is [lon, lat]; this flips it and rounds, and keeps
 * at most `max` evenly spaced points — enough to test a segment against a
 * corridor's box, not a copy of the line.
 */
export function samplePoints(geometry, max = 5) {
  const flat = [];
  const visit = (value) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
      const [lon, lat] = value;
      if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        flat.push([Math.round(lat * 1e4) / 1e4, Math.round(lon * 1e4) / 1e4]);
      }
      return;
    }
    for (const item of value) visit(item);
  };
  visit(geometry?.coordinates);
  if (flat.length <= max) return flat;
  const step = (flat.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => flat[Math.round(i * step)]);
}

function normalizeRoadConditionFeatures(payload) {
  const features = payload?.features;
  if (!Array.isArray(features)) return null;
  const events = [];
  for (const feature of features) {
    const props = feature?.properties ?? {};
    const routeName = pickString(props, ['routeName', 'route', 'nameId']);
    if (!routeName) continue;
    const conditions = Array.isArray(props.currentConditions) ? props.currentConditions : [props];
    for (const condition of conditions) {
      const description = pickString(condition, ['conditionDescription', 'description']) ?? '';
      const impacts = Array.isArray(condition?.additionalImpacts)
        ? condition.additionalImpacts.filter((v) => typeof v === 'string')
        : [];
      events.push({
        kind: 'condition',
        routeName,
        description,
        impacts,
        startMarker: pickNumber(condition, ['startMarker']) ?? pickNumber(props, ['startMarker']),
        endMarker: pickNumber(condition, ['endMarker']) ?? pickNumber(props, ['endMarker']),
        lastUpdated: pickString(condition, ['lastUpdated']) ?? pickString(props, ['lastUpdated']),
        points: samplePoints(feature?.geometry),
      });
    }
  }
  return events;
}

function normalizeIncidentFeatures(payload) {
  const features = payload?.features;
  if (!Array.isArray(features)) return null;
  const events = [];
  for (const feature of features) {
    const props = feature?.properties ?? {};
    const routeName = pickString(props, ['routeName', 'route']);
    if (!routeName) continue;
    events.push({
      kind: 'incident',
      routeName,
      type: pickString(props, ['type', 'category', 'eventType']) ?? '',
      description: pickString(props, ['travelerInformationMessage', 'description', 'headline']) ?? '',
      direction: pickString(props, ['direction']),
      startMarker: pickNumber(props, ['startMarker']),
      endMarker: pickNumber(props, ['endMarker']),
      startTime: pickString(props, ['startTime', 'startDate']),
      lastUpdated: pickString(props, ['lastUpdated']),
      laneImpacts: Array.isArray(props.laneImpacts) ? props.laneImpacts : [],
      points: samplePoints(feature?.geometry),
    });
  }
  return events;
}

async function fetchCotripFeed(name) {
  const url = `${COTRIP_ENDPOINT}/${name}?apiKey=${encodeURIComponent(COTRIP_API_KEY)}`;
  const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, REQUEST_TIMEOUT_MS);
  if (!response.ok) throw new Error(`CDOT ${name} returned ${response.status}`);
  return response.json();
}

async function buildRoadEvents() {
  const [conditionsPayload, incidentsPayload] = await Promise.all([
    fetchCotripFeed('roadConditions'),
    fetchCotripFeed('incidents'),
  ]);
  const conditions = normalizeRoadConditionFeatures(conditionsPayload);
  const incidents = normalizeIncidentFeatures(incidentsPayload);
  if (conditions === null && incidents === null) return null;
  return {
    events: [...(conditions ?? []), ...(incidents ?? [])],
    feeds: { roadConditions: conditions !== null, incidents: incidents !== null },
    sourceTimestamp: new Date().toISOString(),
  };
}

/* ----------------------------------------------------------------- SNOTEL */

/**
 * NRCS AWDB REST API — the SNOTEL network's own public interface. No key.
 * Returns daily snow depth (SNWD, inches) and snow water equivalent (WTEQ,
 * inches) for one station over the last `days`, plus the station's metadata
 * so the client can confirm the id it asked for is the station it meant.
 */
function isTriplet(value) {
  return typeof value === 'string' && /^\d{1,5}:[A-Z]{2}:SNTL$/.test(value);
}

function isoDateDaysAgo(days) {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

async function buildSnotelReading(triplet, days) {
  const dataUrl =
    `${SNOTEL_ENDPOINT}/data?stationTriplets=${encodeURIComponent(triplet)}` +
    `&elements=SNWD,WTEQ&duration=DAILY&beginDate=${isoDateDaysAgo(days)}&endDate=${isoDateDaysAgo(-1)}` +
    `&returnFlags=false&returnOriginalValues=false`;
  const metaUrl = `${SNOTEL_ENDPOINT}/stations?stationTriplets=${encodeURIComponent(triplet)}`;

  const [dataResponse, metaResponse] = await Promise.all([
    fetchWithTimeout(dataUrl, { headers: { Accept: 'application/json' } }, REQUEST_TIMEOUT_MS),
    fetchWithTimeout(metaUrl, { headers: { Accept: 'application/json' } }, REQUEST_TIMEOUT_MS),
  ]);
  if (!dataResponse.ok) throw new Error(`SNOTEL data returned ${dataResponse.status}`);
  const data = await dataResponse.json();
  const meta = metaResponse.ok ? await metaResponse.json() : null;

  const station = Array.isArray(data) ? data.find((s) => s?.stationTriplet === triplet) ?? data[0] : null;
  if (!station || !Array.isArray(station.data)) return null;

  const byDate = new Map();
  for (const series of station.data) {
    const code = series?.stationElement?.elementCode;
    if (code !== 'SNWD' && code !== 'WTEQ') continue;
    for (const point of series.values ?? []) {
      const date = typeof point?.date === 'string' ? point.date.slice(0, 10) : null;
      const value = point?.value;
      if (!date) continue;
      const entry = byDate.get(date) ?? { date, snowDepthIn: null, sweIn: null };
      if (typeof value === 'number' && Number.isFinite(value)) {
        if (code === 'SNWD') entry.snowDepthIn = value;
        else entry.sweIn = value;
      }
      byDate.set(date, entry);
    }
  }
  const series = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (series.length === 0) return null;

  const metaStation = Array.isArray(meta) ? meta.find((s) => s?.stationTriplet === triplet) ?? meta[0] : null;
  return {
    stationId: triplet,
    stationName: pickString(metaStation, ['name']) ?? null,
    elevationFt: pickNumber(metaStation, ['elevation']),
    latitude: pickNumber(metaStation, ['latitude']),
    longitude: pickNumber(metaStation, ['longitude']),
    series,
    sourceTimestamp: new Date().toISOString(),
  };
}

/* ------------------------------------------------- official resort feeds */

/**
 * Two resort-operated JSON feeds, both checked against the live endpoints on
 * 2026-10-31 (neither sends CORS headers, so the browser can't call them):
 *
 *   - MtnPowder (`mtnpowder.com/feed?resortId=N`), the conditions platform
 *     behind Alterra's resorts and Arapahoe Basin. Per-lift and per-trail
 *     status plus the snow report's own update time. Its top-level
 *     `OperatingStatus` is not trustworthy (A-Basin read "Closed" with a
 *     lift spinning; a summer-only resort read "Open" in October), so it is
 *     ignored and the lift and trail lists are counted instead.
 *   - POWDR's day-of-report API (`api.<resort>.com/api/v1/dor/drupal/...`),
 *     behind Copper, Eldora and Snowbird. Lift and trail arrays with status.
 *
 * Later, Aspen Snowmass's own lift feed and Boyne's (Brighton), both plain
 * lift lists, also checked live.
 *
 * Only the ids and hosts below are reachable through this endpoint, so it is
 * not an open proxy. The response is normalized to counts; a feed this code
 * doesn't understand is a 502, never a guessed "closed".
 */
export const MTNPOWDER_IDS = new Set(['5', '6', '49', '57', '58', '59', '60', '61', '65', '93']);
export const POWDR_HOSTS = {
  copper: 'api.coppercolorado.com',
  eldora: 'api.eldora.com',
  snowbird: 'api.snowbird.com',
  // Found via Liftie's resort list, checked live 2026-10-31.
  boreal: 'api.rideboreal.com',
  'soda-springs': 'api.skisodasprings.com',
};
/** Aspen Snowmass's own lift feed, one per mountain. Checked live 2026-10-31. */
export const ASPEN_MOUNTAINS = new Set(['AspenMountain', 'AspenHighlands', 'Snowmass', 'Buttermilk']);
/** Boyne's resort feed API (no key). `br` is Brighton. Checked live 2026-10-31. */
export const BOYNE_RESORTS = new Set(['br']);
const RESORT_FEED_CACHE_TTL_MS = Number(process.env.RESORT_FEED_CACHE_TTL_SECONDS ?? 300) * 1000;

/** Feed status words → the four this app counts. Anything else is "unknown". */
export function liftWord(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return 'unknown';
  if (/^open/.test(text)) return 'open';
  if (/hold|delay/.test(text)) return 'hold';
  if (/schedul|expected|planned|anticipated|pending/.test(text)) return 'scheduled';
  if (/clos/.test(text)) return 'closed';
  return 'unknown';
}

function tally(items, statusOf) {
  const counts = { open: 0, hold: 0, scheduled: 0, closed: 0, unknown: 0 };
  for (const item of items) counts[liftWord(statusOf(item))] += 1;
  return counts;
}

/** ISO string or epoch seconds/ms → epoch ms, or null. */
function toMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1e12 ? value : value * 1000;
  if (typeof value === 'string' && value.trim()) {
    // MtnPowder writes offsets without a colon ("-0600"), which Date parses.
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

const latest = (values) => {
  const list = values.filter((value) => value !== null);
  return list.length ? Math.max(...list) : null;
};

export function normalizeMtnPowder(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.MountainAreas)) return null;
  const lifts = payload.MountainAreas.flatMap((area) => (Array.isArray(area?.Lifts) ? area.Lifts : []));
  const trails = payload.MountainAreas.flatMap((area) => (Array.isArray(area?.Trails) ? area.Trails : []));
  if (lifts.length === 0) return null;
  const liftCounts = tally(lifts, (lift) => lift?.StatusEnglish ?? lift?.Status);
  if (liftCounts.unknown > lifts.length * 0.4) return null;
  const trailCounts = tally(trails, (trail) => trail?.StatusEnglish ?? trail?.Status);
  const report = payload.SnowReport ?? {};
  const acresOpen = Number(report.OpenTerrainAcres);
  const acresTotal = Number(report.TotalTerrainAcres);
  return {
    feed: 'mtnpowder',
    resortName: typeof payload.Name === 'string' ? payload.Name : null,
    lifts: liftCounts,
    trails: { open: trailCounts.open, total: trails.length },
    acres: Number.isFinite(acresOpen) && Number.isFinite(acresTotal) && acresTotal > 0 ? { open: acresOpen, total: acresTotal } : null,
    // The board is as fresh as its newest stamp: the snow report or any lift change.
    boardUpdatedAt: latest([toMs(report.LastUpdate), ...lifts.map((lift) => toMs(lift?.UpdateDate))]),
  };
}

export function normalizePowdr(liftsPayload, trailsPayload) {
  if (!Array.isArray(liftsPayload)) return null;
  const inWinter = (item) => item && (item.season === 'winter' || item.season === 'all' || item.season === undefined);
  const lifts = liftsPayload.filter(inWinter);
  if (lifts.length === 0) return null;
  const liftCounts = tally(lifts, (lift) => lift.status);
  if (liftCounts.unknown > lifts.length * 0.4) return null;
  const trails = Array.isArray(trailsPayload)
    ? trailsPayload.filter((trail) => inWinter(trail) && trail.type === 'alpine_trail' && trail.include !== false)
    : [];
  const trailCounts = tally(trails, (trail) => trail.status);
  return {
    feed: 'powdr',
    resortName: null,
    lifts: liftCounts,
    trails: { open: trailCounts.open, total: trails.length },
    acres: null,
    boardUpdatedAt: latest([...lifts, ...trails].map((item) => toMs(item.updated))),
  };
}

/**
 * A plain list of lifts with a status word each: Aspen Snowmass
 * (`{ liftStatuses: [{ liftName, status }] }`) and Boyne (`[{ name, status }]`).
 * Neither reports runs or an update time, so `trails` is empty and
 * `boardUpdatedAt` is null; the client then uses the lift share for terrain.
 */
export function normalizeLiftList(payload, feed) {
  const lifts = Array.isArray(payload) ? payload : Array.isArray(payload?.liftStatuses) ? payload.liftStatuses : null;
  if (!lifts || lifts.length === 0) return null;
  const counts = tally(lifts, (lift) => lift?.status);
  if (counts.unknown > lifts.length * 0.4) return null;
  return {
    feed,
    resortName: null,
    lifts: counts,
    trails: { open: 0, total: 0 },
    acres: null,
    boardUpdatedAt: toMs(payload?.lastUpdated),
  };
}

/* --------------------------------------------------- resort status pages */

/**
 * Resorts that publish lift status only on a web page. Each was checked on
 * 2026-10-31: robots.txt allows the page, it serves normally to a server,
 * and the data parses. We identify ourselves in the User-Agent, never try to
 * get past a block, and cache each page (see RESORT_PAGE_CACHE_TTL_MS) so a
 * resort sees one request per window however many people use the app.
 *
 *  - Vail Resorts embed `FR.TerrainStatusFeed = {...}`, strict JSON, in the page.
 *  - Alta embeds `window.Alta = {...}`, strict JSON, with an `operations`
 *    summary of lifts and runs open.
 *  - Loveland renders a TablePress table per lift, titled "Lift 2 - CLOSED".
 */
export const VAIL_PAGES = {
  vail: 'https://www.vail.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
  beavercreek: 'https://www.beavercreek.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
  breckenridge: 'https://www.breckenridge.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
  keystone: 'https://www.keystoneresort.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
  crestedbutte: 'https://www.skicb.com/the-mountain/mountain-conditions/lift-and-terrain-status.aspx',
  parkcity: 'https://www.parkcitymountain.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
  heavenly: 'https://www.skiheavenly.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
  northstar: 'https://www.northstarcalifornia.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
  kirkwood: 'https://www.kirkwood.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
};
const ALTA_PAGE = 'https://www.alta.com/lift-terrain-status';
const LOVELAND_PAGE = 'https://skiloveland.com/trail-lift-report/';
const SCRAPER_UA = 'POW NOW lift status (+https://snownow.vercel.app)';
/** Pages are heavier than feeds and change on the order of minutes; ten is plenty. */
const RESORT_PAGE_CACHE_TTL_MS = Number(process.env.RESORT_PAGE_CACHE_TTL_SECONDS ?? 600) * 1000;

/**
 * The JSON object that begins at the first `{` matched by `pattern`, found by
 * brace matching (string contents respected) and parsed as JSON. Never
 * evaluated as code: a page that isn't strict JSON there returns null.
 */
export function embeddedJson(html, pattern) {
  const match = pattern.exec(html);
  if (!match) return null;
  const start = html.indexOf('{', match.index);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i += 1) {
    const c = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Vail Resorts' numeric lift status, as their own page script uses it. */
const VAIL_STATUS = ['closed', 'open', 'hold', 'scheduled'];

export function parseVailPage(html) {
  const feed = embeddedJson(html, /TerrainStatusFeed\s*=\s*\{/);
  if (!feed || typeof feed !== 'object' || !Array.isArray(feed.GroomingAreas)) return null;
  const areaLifts = feed.GroomingAreas.flatMap((area) => (Array.isArray(area?.Lifts) ? area.Lifts : []));
  const lifts = Array.isArray(feed.Lifts) && feed.Lifts.length > 0 ? feed.Lifts : areaLifts;
  const trails = feed.GroomingAreas.flatMap((area) => (Array.isArray(area?.Trails) ? area.Trails : []));
  // Before a season's board is built the lists are simply empty: report zero
  // lifts (the client reads that as "no lifts listed"), not a guessed closed.
  const counts = tally(lifts, (lift) => VAIL_STATUS[lift?.Status] ?? 'unknown');
  if (lifts.length > 0 && counts.unknown > lifts.length * 0.4) return null;
  return {
    feed: 'vail',
    resortName: null,
    lifts: counts,
    trails: { open: trails.filter((trail) => trail?.IsOpen === true).length, total: trails.length },
    acres: null,
    boardUpdatedAt: null,
  };
}

export function parseAltaPage(html) {
  const data = embeddedJson(html, /window\.Alta\s*=\s*\{/);
  const lifts = data?.liftStatus?.lifts;
  if (!Array.isArray(lifts) || lifts.length === 0) return null;
  const open = lifts.filter((lift) => lift?.open === true).length;
  const runs = data?.operations?.runs;
  const runsOk = runs && Number.isFinite(runs.open) && Number.isFinite(runs.total) && runs.total > 0;
  return {
    feed: 'alta',
    resortName: 'Alta',
    lifts: { open, hold: 0, scheduled: 0, closed: lifts.length - open, unknown: 0 },
    trails: runsOk ? { open: runs.open, total: runs.total } : { open: 0, total: 0 },
    acres: null,
    boardUpdatedAt: null,
  };
}

export function parseLovelandPage(html) {
  const titles = [...html.matchAll(/tablepress-table-name[^>]*>([^<]*)</g)].map((m) => m[1].trim()).filter(Boolean);
  if (titles.length === 0) return null;
  const counts = tally(titles, (title) => title.split(/\s+-\s+/).pop());
  if (counts.unknown > titles.length * 0.4) return null;
  return {
    feed: 'loveland',
    resortName: 'Loveland',
    lifts: counts,
    trails: { open: 0, total: 0 },
    acres: null,
    boardUpdatedAt: null,
  };
}

/**
 * Resorts whose lift status is plain markup, read with a real HTML parser
 * (node-html-parser) and the resort's own markup, each checked against the
 * live page on 2026-10-31 with robots.txt allowing it. Each returns
 * [lift name, status word] pairs; `liftsFromRows` counts them.
 *
 * Not covered, and why: Taos lists lifts in one feed with its restaurant and
 * pickleball courts, no reliable way to tell them apart; Angel Fire builds
 * its report in the browser; Purgatory's and Wolf Creek's pages carry no
 * lift list at all.
 */
const text = (node) => (node ? node.text.replace(/\s+/g, ' ').trim() : '');

export const MARKUP_PAGES = {
  telluride: {
    url: 'https://tellurideskiresort.com/snow-report',
    // The status column's word; the icon beside it disagreed on the town gondola.
    // The free gondola is town transport, not a ski lift.
    rows: (root) =>
      root
        .querySelectorAll('.tsr-report-app-lift-status tbody tr')
        .map((tr) => tr.querySelectorAll('td'))
        .map((td) => [text(td[1]), text(td[3])])
        .filter(([name]) => !/free gondola/i.test(name)),
  },
  monarch: {
    url: 'https://skimonarch.com/conditions/',
    rows: (root) =>
      root
        .querySelectorAll('.lifts-table tbody tr')
        .map((tr) => tr.querySelectorAll('td'))
        .map((td) => [text(td[0]), text(td[1])])
        .filter(([name]) => !/tubing/i.test(name)),
  },
  snowbasin: {
    url: 'https://www.snowbasin.com/the-mountain/conditions',
    // "Lift Closed" / "Lift Open", in the cell's screen-reader text.
    rows: (root) =>
      root
        .querySelectorAll('.mc-lifts__table tbody tr')
        .map((tr) => tr.querySelectorAll('td'))
        .map((td) => [text(td[0]), text(td[2]?.querySelector('.sr-only')).replace(/^lift\s+/i, '')]),
  },
  brianhead: {
    url: 'https://www.brianhead.com/weather-conditions-webcams/',
    // Status is the list item's class: m-lift-status-open / -closed.
    rows: (root) =>
      root
        .querySelectorAll('li')
        .filter((li) => /^m-lift-status-/.test(li.getAttribute('class') ?? ''))
        .map((li) => [text(li.querySelector('h3')), (li.getAttribute('class') ?? '').replace(/^m-lift-status-/, '')]),
  },
  sugarbowl: {
    url: 'https://www.sugarbowl.com/conditions',
    rows: (root) =>
      root
        .querySelectorAll('.lift_status_top')
        .map((card) => [text(card.querySelector('.fw_semi_bold')), text(card.querySelector('[data-update-id$="_status_text"]'))]),
  },
  sierra: {
    url: 'https://www.sierraattahoe.com/lifts-trails-grooming/',
    rows: (root) =>
      root
        .querySelectorAll('.sierra-lift-row')
        .filter((row) => row.getAttribute('data-panel') === 'lift-status')
        .map((row) => [text(row.querySelector('h4')), text(row.querySelector('.sierra-status-badge'))])
        .filter(([name]) => !/tubing/i.test(name)),
  },
};

/** Counts [name, status] rows; null when there are none, or too many status words this code doesn't know. */
export function liftsFromRows(rows, feed) {
  const named = rows.filter(([name]) => name);
  if (named.length === 0) return null;
  const counts = tally(named, ([, status]) => status);
  if (counts.unknown > named.length * 0.4) return null;
  return { feed, resortName: null, lifts: counts, trails: { open: 0, total: 0 }, acres: null, boardUpdatedAt: null };
}

export function parseMarkupPage(id, html) {
  const page = MARKUP_PAGES[id];
  if (!page) return null;
  try {
    return liftsFromRows(page.rows(parseHtml(html)), 'markup');
  } catch {
    return null;
  }
}

async function fetchPageOrThrow(url) {
  const response = await fetchWithTimeout(url, { headers: { Accept: 'text/html', 'User-Agent': SCRAPER_UA } }, 12000);
  if (!response.ok) throw new Error(`${new URL(url).host} returned ${response.status}`);
  return response.text();
}

async function fetchJsonOrThrow(url) {
  const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json', 'User-Agent': 'POW NOW (+https://snownow.vercel.app)' } }, REQUEST_TIMEOUT_MS);
  if (!response.ok) throw new Error(`${new URL(url).host} returned ${response.status}`);
  return response.json();
}

async function buildResortStatus(feed, id) {
  if (feed === 'markup') {
    const parsed = parseMarkupPage(id, await fetchPageOrThrow(MARKUP_PAGES[id].url));
    return parsed && { ...parsed, sourceTimestamp: new Date().toISOString() };
  }
  if (feed === 'vail' || feed === 'alta' || feed === 'loveland') {
    const html = await fetchPageOrThrow(feed === 'vail' ? VAIL_PAGES[id] : feed === 'alta' ? ALTA_PAGE : LOVELAND_PAGE);
    const parsed = feed === 'vail' ? parseVailPage(html) : feed === 'alta' ? parseAltaPage(html) : parseLovelandPage(html);
    return parsed && { ...parsed, sourceTimestamp: new Date().toISOString() };
  }
  if (feed === 'aspen' || feed === 'boyne') {
    const url =
      feed === 'aspen'
        ? `https://www.aspensnowmass.com/aspensnowmass/liftstatus/feed?mountain=${id}`
        : `https://apim-marketing-001.azure-api.net/FeedService/v1/Feed/Facilities/Areas/Lifts/All?resortName=${id}`;
    const normalized = normalizeLiftList(await fetchJsonOrThrow(url), feed);
    return normalized && { ...normalized, sourceTimestamp: new Date().toISOString() };
  }
  if (feed === 'mtnpowder') {
    const normalized = normalizeMtnPowder(await fetchJsonOrThrow(`https://mtnpowder.com/feed?resortId=${id}`));
    return normalized && { ...normalized, sourceTimestamp: new Date().toISOString() };
  }
  const host = POWDR_HOSTS[id];
  const [lifts, trails] = await Promise.all([
    fetchJsonOrThrow(`https://${host}/api/v1/dor/drupal/lifts`),
    fetchJsonOrThrow(`https://${host}/api/v1/dor/drupal/trails`).catch(() => null),
  ]);
  const normalized = normalizePowdr(lifts, trails);
  return normalized && { ...normalized, sourceTimestamp: new Date().toISOString() };
}

/* ---------------------------------------------------------------- router */

function corsHeadersFor(req) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes('*')) return { 'Access-Control-Allow-Origin': '*' };
  if (typeof origin === 'string' && ALLOWED_ORIGINS.includes(origin)) {
    return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
  }
  return {};
}

function originForbidden(req) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes('*')) return false;
  if (typeof origin !== 'string') return false; // no Origin: not a browser; rate limit applies
  return !ALLOWED_ORIGINS.includes(origin);
}

function sendJson(req, res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...corsHeadersFor(req),
    ...extraHeaders,
  });
  res.end(payload);
}

/** Lets a CDN in front (Vercel's edge) serve repeats of a GET for `seconds` without invoking us. */
const cdnCache = (seconds) => ({
  'Cache-Control': `public, s-maxage=${seconds}, stale-while-revalidate=${Math.round(seconds / 4)}`,
});

/**
 * The raw request body as a string. Serverless runtimes (Vercel's Node
 * functions among them) often consume the stream and hand the parsed body
 * over as `req.body` instead; both shapes are accepted here.
 */
export function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return Promise.resolve(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  }
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) req.destroy(new Error('Request body too large.'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function isPoint(value) {
  return value && typeof value.lat === 'number' && typeof value.lon === 'number';
}

/**
 * The router. Exported so a serverless adapter (see `api/[...path].mjs`)
 * can serve exactly the same endpoints as the standalone process.
 */
export async function handleRequest(req, res) {
  try {
    await handle(req, res);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    if (!res.headersSent) sendJson(req, res, 500, { error: 'Unexpected server error.' });
  }
}

async function handle(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      ...corsHeadersFor(req),
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
    });
    res.end();
    return;
  }

  if (originForbidden(req)) {
    sendJson(req, res, 403, { error: 'This origin is not allowed to use the POW NOW proxy.' });
    return;
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(req, res, 200, {
      ok: true,
      hasApiKey: API_KEY.length > 0,
      hasCotripKey: COTRIP_API_KEY.length > 0,
      sharedCache: Boolean(KV_URL && KV_TOKEN),
      cacheSize: cache.size,
      googleRoutes: await budgetStatus(),
    });
    return;
  }

  if (rateLimited(clientIp(req))) {
    sendJson(req, res, 429, { error: 'Too many requests. Try again in a minute.' });
    return;
  }

  /*
   * Browser-friendly GET version of /api/travel-curve, for manually
   * eyeballing that a real deploy is actually returning live Google Routes
   * data. Defaults to Denver -> Copper Mountain outbound for tomorrow.
   */
  if (req.method === 'GET' && url.pathname === '/api/test-drive') {
    const params = url.searchParams;
    const origin = roundOrigin({
      lat: Number(params.get('originLat') ?? 39.7392),
      lon: Number(params.get('originLon') ?? -104.9903),
    });
    const destination = {
      lat: Number(params.get('destLat') ?? 39.4817),
      lon: Number(params.get('destLon') ?? -106.1614),
    };
    const direction = params.get('direction') === 'return' ? 'return' : 'outbound';
    const date = params.get('date') ?? localParts(Date.now() + 86_400_000, TIME_ZONE).dateKey;

    if (!API_KEY) {
      sendJson(req, res, 503, { error: 'GOOGLE_ROUTES_API_KEY is not configured on this server.' });
      return;
    }
    let curve;
    try {
      curve = await buildTravelCurve(origin, destination, direction, date);
    } catch (error) {
      if (!(error instanceof RoutesUnavailableError)) throw error;
      sendRoutesFailure(req, res, error.failure);
      return;
    }
    sendJson(req, res, 200, { origin, destination, direction, date, ...curve });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/route-preview') {
    if (!API_KEY) {
      sendJson(req, res, 503, { error: 'GOOGLE_ROUTES_API_KEY is not configured on this server. Set it and restart.' });
      return;
    }
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      sendJson(req, res, 400, { error: 'Malformed JSON body.' });
      return;
    }
    const { origin, destination } = body ?? {};
    if (!isPoint(origin) || !isPoint(destination)) {
      sendJson(req, res, 400, { error: 'origin and destination must each be { lat, lon }.' });
      return;
    }
    let preview;
    try {
      preview = await fetchRoutePreview(roundOrigin(origin), destination);
    } catch (error) {
      if (!(error instanceof RoutesUnavailableError)) throw error;
      sendRoutesFailure(req, res, error.failure);
      return;
    }
    sendJson(req, res, 200, preview);
    return;
  }

  /*
   * One city's ranking for a day: one drive out (6:00) and one back (3:00) per
   * mountain, bought from the ranking pool as one batch or not at all. The
   * client labels every score built on it an estimate; a full curve comes from
   * /api/travel-curve when a mountain is opened.
   */
  if (req.method === 'POST' && url.pathname === '/api/ranking-drives') {
    if (!API_KEY) {
      sendJson(req, res, 503, { error: 'GOOGLE_ROUTES_API_KEY is not configured on this server. Set it and restart.' });
      return;
    }
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      sendJson(req, res, 400, { error: 'Malformed JSON body.' });
      return;
    }
    const { origin, date, destinations } = body ?? {};
    if (!isPoint(origin)) {
      sendJson(req, res, 400, { error: 'origin must be { lat, lon }.' });
      return;
    }
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      sendJson(req, res, 400, { error: 'date must be "YYYY-MM-DD".' });
      return;
    }
    if (!Array.isArray(destinations) || destinations.length === 0 || destinations.length > 100 || !destinations.every(isPoint)) {
      sendJson(req, res, 400, { error: 'destinations must be 1 to 100 points, each { lat, lon, timeZone? }.' });
      return;
    }
    let ranking;
    try {
      ranking = await buildRankingDrives(roundOrigin(origin), date, destinations);
    } catch (error) {
      if (!(error instanceof RoutesUnavailableError)) throw error;
      sendRoutesFailure(req, res, error.failure);
      return;
    }
    sendJson(req, res, 200, ranking);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/travel-curve') {
    if (!API_KEY) {
      sendJson(req, res, 503, { error: 'GOOGLE_ROUTES_API_KEY is not configured on this server. Set it and restart.' });
      return;
    }
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      sendJson(req, res, 400, { error: 'Malformed JSON body.' });
      return;
    }
    const { origin, destination, direction, date } = body ?? {};
    const timeZone = resolveTimeZone(body?.timeZone);
    if (!isPoint(origin) || !isPoint(destination)) {
      sendJson(req, res, 400, { error: 'origin and destination must each be { lat, lon }.' });
      return;
    }
    if (direction !== 'outbound' && direction !== 'return') {
      sendJson(req, res, 400, { error: 'direction must be "outbound" or "return".' });
      return;
    }
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      sendJson(req, res, 400, { error: 'date must be "YYYY-MM-DD".' });
      return;
    }

    // Each departure sample is cached on its own (see "the Google budget"), so
    // today's curve reuses every future point and only re-asks "leave now".
    let curve;
    try {
      curve = await buildTravelCurve(roundOrigin(origin), destination, direction, date, timeZone);
    } catch (error) {
      if (!(error instanceof RoutesUnavailableError)) throw error;
      sendRoutesFailure(req, res, error.failure);
      return;
    }
    sendJson(req, res, 200, curve);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/road-conditions') {
    if (!COTRIP_API_KEY) {
      sendJson(req, res, 503, { error: 'COTRIP_API_KEY is not configured on this server; road conditions are unavailable.' });
      return;
    }
    let events;
    try {
      events = await cachedOrCompute('cotrip:events', ROAD_CACHE_TTL_MS, buildRoadEvents);
    } catch (error) {
      sendJson(req, res, 502, { error: error instanceof Error ? error.message : 'CDOT request failed.' });
      return;
    }
    if (!events) {
      sendJson(req, res, 502, { error: 'CDOT returned a response this proxy does not recognize.' });
      return;
    }
    sendJson(req, res, 200, events, cdnCache(Math.round(ROAD_CACHE_TTL_MS / 1000)));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/snotel') {
    const station = url.searchParams.get('station');
    const days = Math.min(14, Math.max(2, Number(url.searchParams.get('days') ?? 8)));
    if (!isTriplet(station)) {
      sendJson(req, res, 400, { error: 'station must be a SNOTEL triplet like "842:CO:SNTL".' });
      return;
    }
    let reading;
    try {
      reading = await cachedOrCompute(`snotel:${station}:${days}`, SNOTEL_CACHE_TTL_MS, () => buildSnotelReading(station, days));
    } catch (error) {
      sendJson(req, res, 502, { error: error instanceof Error ? error.message : 'SNOTEL request failed.' });
      return;
    }
    if (!reading) {
      sendJson(req, res, 502, { error: 'SNOTEL returned no readings this proxy recognizes for that station.' });
      return;
    }
    sendJson(req, res, 200, reading, cdnCache(Math.round(SNOTEL_CACHE_TTL_MS / 1000)));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/resort-status') {
    const feed = url.searchParams.get('feed');
    const id = url.searchParams.get('id') ?? '';
    const allowed =
      (feed === 'mtnpowder' && MTNPOWDER_IDS.has(id)) ||
      (feed === 'powdr' && Object.hasOwn(POWDR_HOSTS, id)) ||
      (feed === 'aspen' && ASPEN_MOUNTAINS.has(id)) ||
      (feed === 'boyne' && BOYNE_RESORTS.has(id)) ||
      (feed === 'vail' && Object.hasOwn(VAIL_PAGES, id)) ||
      (feed === 'alta' && id === 'alta') ||
      (feed === 'loveland' && id === 'loveland') ||
      (feed === 'markup' && Object.hasOwn(MARKUP_PAGES, id));
    if (!allowed) {
      sendJson(req, res, 400, { error: 'Unknown resort feed.' });
      return;
    }
    let status;
    try {
      const scraped = ['vail', 'alta', 'loveland', 'markup'].includes(feed);
      status = await cachedOrCompute(`resort:${feed}:${id}`, scraped ? RESORT_PAGE_CACHE_TTL_MS : RESORT_FEED_CACHE_TTL_MS, () =>
        buildResortStatus(feed, id),
      );
    } catch (error) {
      sendJson(req, res, 502, { error: error instanceof Error ? error.message : 'Resort feed request failed.' });
      return;
    }
    if (!status) {
      sendJson(req, res, 502, { error: 'The resort feed returned a shape this proxy does not recognize.' });
      return;
    }
    sendJson(req, res, 200, status, cdnCache(Math.round((['vail', 'alta', 'loveland', 'markup'].includes(feed) ? RESORT_PAGE_CACHE_TTL_MS : RESORT_FEED_CACHE_TTL_MS) / 1000)));
    return;
  }

  sendJson(req, res, 404, { error: 'Not found.' });
}

export function createPownowServer() {
  return createServer(handleRequest);
}

// Only listen when run directly; the Vercel adapter and the tests import instead.
const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  createPownowServer().listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(
      `POW NOW proxy on :${PORT} — Google Routes key ${API_KEY ? 'present' : 'MISSING (traffic will 503)'}; ` +
        `CDOT key ${COTRIP_API_KEY ? 'present' : 'missing (roads will 503)'}; ` +
        `shared cache ${KV_URL && KV_TOKEN ? 'on' : 'off'}; origins: ${ALLOWED_ORIGINS.join(', ')}`,
    );
  });
}
