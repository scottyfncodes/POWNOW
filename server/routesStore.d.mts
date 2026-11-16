/** Type surface for `server/routesStore.mjs`, for tests. */
export interface RoutesStore {
  shared: boolean;
  scope?: string;
  getSamples(keys: string[]): Promise<Map<string, unknown>>;
  putSample(key: string, value: unknown, ttlMs: number): Promise<void>;
  reserve(day: string, pool: string, n: number, limits: { spent: number; attempts: number }): Promise<{ ok: boolean; used: number; attempts: number }>;
  settle(day: string, pool: string, counts: { unsent?: number; refund?: number }): Promise<void>;
  used(day: string, pool: string): Promise<{ used: number; attempts: number }>;
  getBreaker(): Promise<{ failure: unknown; until: number } | null>;
  setBreaker(untilMs: number, failure: unknown): Promise<void>;
}
export function createMemoryStore(): RoutesStore;
export function createNeonStore(
  databaseUrl: string,
  options: { sql?: { query(text: string, params?: unknown[]): Promise<Record<string, any>[]> }; scope: string },
): RoutesStore;
