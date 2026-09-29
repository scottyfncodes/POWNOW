#!/usr/bin/env node
/**
 * SNOWNOW data proxy.
 *
 * The one server-side thing this project needs. It exists for three reasons,
 * all of them "a browser can't":
 *
 *   1. Hold secrets. Google Routes (traffic) and CDOT (road conditions) both
 *      need an API key, and a key in a static bundle belongs to whoever opens
 *      devtools. The keys live here and never appear in any response.
 *   2. Reach hosts that don't serve CORS. The NRCS SNOTEL API (measured
 *      snowpack) and CDOT's feed are server-to-server APIs.
 *   3. Share a cache. Every (corridor, direction, date) travel curve is built
 *      once and served to every visitor for the next 15 minutes; the same
 *      statewide road feed answers every corridor question for 5 minutes.
 *
 * Deliberately dependency-free (no Express): a plain `node:http` router is
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

const PORT = Number(process.env.PORT ?? 8787);
const API_KEY = process.env.GOOGLE_ROUTES_API_KEY ?? '';
const COTRIP_API_KEY = process.env.COTRIP_API_KEY ?? '';
const CACHE_TTL_MS = Number(process.env.TRAFFIC_CACHE_TTL_SECONDS ?? 900) * 1000;
const ROAD_CACHE_TTL_MS = Number(process.env.ROAD_CACHE_TTL_SECONDS ?? 300) * 1000;
const SNOTEL_CACHE_TTL_MS = Number(process.env.SNOTEL_CACHE_TTL_SECONDS ?? 1800) * 1000;
const TIME_ZONE = process.env.SNOWNOW_TIME_ZONE ?? 'America/Denver';

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
const KV_PREFIX = process.env.KV_PREFIX ?? 'snownow:';

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
 * One Google Routes call for one departure time. `departureIso` may be null,
 * which Google reads as "now". Returns null on any failure — callers skip the point.
 */
async function fetchOneSample(origin, destination, departureIso) {
  try {
    const response = await fetchWithTimeout(
      ROUTES_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
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
    if (!response.ok) return null;
    const data = await response.json();
    const route = data.routes?.[0];
    if (!route?.duration) return null;
    // Google returns duration as e.g. "1234s".
    const seconds = Number(String(route.duration).replace('s', ''));
    if (!Number.isFinite(seconds)) return null;
    const distanceMeters = Number(route.distanceMeters);
    return {
      durationMinutes: Math.round(seconds / 60),
      distanceMiles: Number.isFinite(distanceMeters) ? distanceMeters / 1609.344 : null,
    };
  } catch {
    return null;
  }
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

async function buildTravelCurve(origin, destination, direction, date) {
  const grid = direction === 'outbound' ? OUTBOUND_MINUTES : RETURN_MINUTES;
  const plan = planDepartureMinutes(grid, date, Date.now(), TIME_ZONE);
  const samplesRaw = await Promise.all(
    plan.map(async ({ minute, departureIso }) => {
      const sample = await fetchOneSample(origin, destination, departureIso);
      return { minute, sample };
    }),
  );

  const resolved = samplesRaw.filter((d) => d.sample !== null);
  if (resolved.length === 0) return null;

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
 * duration/distance for whichever mountain the user actually tapped.
 */
async function fetchRoutePreview(origin, destination) {
  const sample = await fetchOneSample(origin, destination, null);
  if (!sample) return null;
  return {
    durationMinutes: sample.durationMinutes,
    distanceMiles: sample.distanceMiles === null ? null : Math.round(sample.distanceMiles * 10) / 10,
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
    sendJson(req, res, 403, { error: 'This origin is not allowed to use the SNOWNOW proxy.' });
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
    const origin = {
      lat: Number(params.get('originLat') ?? 39.7392),
      lon: Number(params.get('originLon') ?? -104.9903),
    };
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
    const curve = await buildTravelCurve(origin, destination, direction, date);
    if (!curve) {
      sendJson(req, res, 502, { error: 'No route data returned by Google Routes for any sampled departure time.' });
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
    const cacheKey = ['preview', origin.lat.toFixed(3), origin.lon.toFixed(3), destination.lat.toFixed(3), destination.lon.toFixed(3)].join(':');
    const preview = await cachedOrCompute(cacheKey, CACHE_TTL_MS, () => fetchRoutePreview(origin, destination));
    if (!preview) {
      sendJson(req, res, 502, { error: 'No route returned by Google Routes.' });
      return;
    }
    sendJson(req, res, 200, preview);
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

    // Today's curve is anchored to "now", so its cache key includes the
    // quarter-hour: a curve built at 6:03 shouldn't be served at 9:40 as if
    // 6:03 were still an option.
    const local = localParts(Date.now(), TIME_ZONE);
    const slot = date === local.dateKey ? `:${Math.floor(local.minuteOfDay / 15)}` : '';
    const cacheKey = [origin.lat.toFixed(3), origin.lon.toFixed(3), destination.lat.toFixed(3), destination.lon.toFixed(3), direction, date].join(':') + slot;

    const curve = await cachedOrCompute(cacheKey, CACHE_TTL_MS, () => buildTravelCurve(origin, destination, direction, date));
    if (!curve) {
      sendJson(req, res, 502, { error: 'No route data returned by Google Routes for any sampled departure time.' });
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

  sendJson(req, res, 404, { error: 'Not found.' });
}

export function createSnownowServer() {
  return createServer(handleRequest);
}

// Only listen when run directly; the Vercel adapter and the tests import instead.
const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  createSnownowServer().listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(
      `SNOWNOW proxy on :${PORT} — Google Routes key ${API_KEY ? 'present' : 'MISSING (traffic will 503)'}; ` +
        `CDOT key ${COTRIP_API_KEY ? 'present' : 'missing (roads will 503)'}; ` +
        `shared cache ${KV_URL && KV_TOKEN ? 'on' : 'off'}; origins: ${ALLOWED_ORIGINS.join(', ')}`,
    );
  });
}
