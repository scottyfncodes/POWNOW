/** Type surface for `server/routesStore.mjs`, for tests. */
export interface RoutesStore {
  shared: boolean;
  getSamples(keys: string[]): Promise<Map<string, unknown>>;
  putSample(key: string, value: unknown, ttlMs: number): Promise<void>;
  reserve(day: string, n: number, limit: number): Promise<{ ok: boolean; used: number }>;
  release(day: string, n: number): Promise<void>;
  used(day: string): Promise<number>;
  getBreaker(): Promise<{ failure: unknown; until: number } | null>;
  setBreaker(untilMs: number, failure: unknown): Promise<void>;
}
export function createMemoryStore(): RoutesStore;
export function createNeonStore(
  databaseUrl: string,
  options?: { sql?: { query(text: string, params?: unknown[]): Promise<Record<string, any>[]> } },
): RoutesStore;
