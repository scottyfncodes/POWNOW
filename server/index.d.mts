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
export function createSnownowServer(): import('node:http').Server;
export function handleRequest(
  req: import('node:http').IncomingMessage & { body?: unknown },
  res: import('node:http').ServerResponse,
): Promise<void>;
export function readBody(req: import('node:http').IncomingMessage & { body?: unknown }): Promise<string>;
