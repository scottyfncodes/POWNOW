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
  feed: 'mtnpowder' | 'powdr';
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
