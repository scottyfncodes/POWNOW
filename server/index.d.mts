/** Type surface for the pure helpers `server/index.mjs` exports for tests. */
export interface PlannedDeparture {
  minute: number;
  /** RFC3339 UTC instant, or null for "now" (Google reads a missing departureTime as now). */
  departureIso: string | null;
}
export function localToUtcIso(dateKey: string, minuteOfDay: number, timeZone: string): string;
export function planDepartureMinutes(
  gridMinutes: number[],
  dateKey: string,
  nowMs: number,
  timeZone: string,
): PlannedDeparture[];
/** Why Google Routes gave no usable route, reduced to Google's own enumerated codes. */
export interface RoutesFailure {
  kind: string;
  upstreamStatus: number | null;
  googleStatus: string | null;
  reason: string | null;
  /** Google's free text: for the server log only, never sent to a client. */
  message: string | null;
}
export function classifyRoutesFailure(upstreamStatus: number, body: unknown): RoutesFailure;
export function publicRoutesFailure(failure: RoutesFailure): {
  error: string;
  upstream: { service: 'google-routes'; kind: string; status: number | null; googleStatus: string | null; reason: string | null };
};
export function redactForLog(text: unknown, secrets?: string[]): string | null;
export function routesFailureStatus(failure: RoutesFailure): 502 | 503;
export function parseNonbillableKinds(raw: unknown): Set<string>;
export function sampleTtlMs(departureIso: string | null, nowMs?: number): number;
export function roundOrigin(point: { lat: number; lon: number }): { lat: number; lon: number };
export function nextQuotaResetMs(nowMs?: number): number;
export function breakerUntilMs(kind: string, nowMs?: number): number;
export function dominantFailure(failures: RoutesFailure[]): RoutesFailure;
export class RoutesUnavailableError extends Error {
  failure: RoutesFailure;
  constructor(failure: RoutesFailure);
}
/** A client-requested zone if it's one the dataset uses, else the server's default. */
export function resolveTimeZone(requested: unknown): string;
export function createPownowServer(): import('node:http').Server;
export function handleRequest(
  req: import('node:http').IncomingMessage & { body?: unknown },
  res: import('node:http').ServerResponse,
): Promise<void>;
export function readBody(req: import('node:http').IncomingMessage & { body?: unknown }): Promise<string>;
/** A few [lat, lon] points sampled from a GeoJSON geometry. */
export function samplePoints(geometry: unknown, max?: number): [number, number][];
/** A resort board normalized to counts — see the official resort feeds section of server/index.mjs. */
export interface ResortStatusPayload {
  feed: 'mtnpowder' | 'powdr' | 'aspen' | 'boyne' | 'vail' | 'alta' | 'loveland' | 'markup';
  resortName: string | null;
  lifts: { open: number; hold: number; scheduled: number; closed: number; unknown: number };
  trails: { open: number; total: number };
  acres: { open: number; total: number } | null;
  boardUpdatedAt: number | null;
}
export function liftWord(value: unknown): 'open' | 'hold' | 'scheduled' | 'closed' | 'unknown';
export function normalizeMtnPowder(payload: unknown): ResortStatusPayload | null;
export function normalizePowdr(lifts: unknown, trails: unknown): ResortStatusPayload | null;
export const MTNPOWDER_IDS: Set<string>;
export const POWDR_HOSTS: Record<string, string>;
export function normalizeLiftList(payload: unknown, feed: 'aspen' | 'boyne'): ResortStatusPayload | null;
export const ASPEN_MOUNTAINS: Set<string>;
export const BOYNE_RESORTS: Set<string>;
export function embeddedJson(html: string, pattern: RegExp): any;
export function parseVailPage(html: string): ResortStatusPayload | null;
export function parseAltaPage(html: string): ResortStatusPayload | null;
export function parseLovelandPage(html: string): ResortStatusPayload | null;
export const VAIL_PAGES: Record<string, string>;
export function parseMarkupPage(id: string, html: string): ResortStatusPayload | null;
export const MARKUP_PAGES: Record<string, { url: string }>;
