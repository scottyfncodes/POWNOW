import { TtlCache, memoizeAsync, type MemoizedResult } from '@/lib/cache';
import { fetchJson, type FetchJsonOptions } from '@/lib/http';

/**
 * One shared, in-memory, TTL-bounded fetch layer for every live provider.
 *
 * A NOW screen from Denver plans eight or more mountains at once, and LATER
 * plans several days of each. Without this, every plan re-fetched the same
 * forecast, the same statewide road feed and the same lift board once per
 * mountain per render. With it, identical requests inside the TTL share one
 * response — and concurrent identical requests share one in-flight promise,
 * so a burst of thirteen mountains asking for the same corridor produces one
 * network call, not thirteen.
 *
 * `fetchedAt` on the result is the moment the *network* answered, not the
 * moment the cache was read, so a provider that stamps `Provenance.fetchedAt`
 * from it stays honest about the age of the value it is showing.
 */
const cache = new TtlCache<unknown>(5 * 60 * 1000);
const memoized = memoizeAsync(cache);
/** One memoizer per TTL, so concurrent callers with the same TTL share one in-flight map. */
const scopedMemoizers = new Map<number, ReturnType<typeof memoizeAsync<unknown>>>();

export interface CachedJsonOptions extends FetchJsonOptions {
  /** How long an answer may be reused. Default 5 minutes. */
  ttlMs?: number;
  /** Extra key material when the URL alone doesn't identify the request (e.g. a POST body). */
  cacheKey?: string;
}

export async function cachedJson<T>(url: string, options: CachedJsonOptions = {}): Promise<MemoizedResult<T>> {
  const { ttlMs, cacheKey, ...init } = options;
  const key = cacheKey ?? `${init.method ?? 'GET'} ${url} ${typeof init.body === 'string' ? init.body : ''}`;
  if (ttlMs === undefined) {
    return (await memoized(key, () => fetchJson<T>(url, init))) as MemoizedResult<T>;
  }
  // memoizeAsync fixes the TTL at construction; a per-call TTL gets its own
  // memoizer bound to the same underlying store — reused, so that in-flight
  // de-duplication works across callers asking with the same TTL.
  let scoped = scopedMemoizers.get(ttlMs);
  if (!scoped) {
    scoped = memoizeAsync(cache, ttlMs);
    scopedMemoizers.set(ttlMs, scoped);
  }
  return (await scoped(key, () => fetchJson<T>(url, init))) as MemoizedResult<T>;
}

/** Tests stub `fetch` per case; they call this so one case's answer never leaks into the next. */
export function clearProviderCaches(): void {
  cache.clear();
}
