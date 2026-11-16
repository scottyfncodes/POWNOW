/**
 * Where Google Routes results and the daily Google budget live.
 *
 * Every Google Routes call is billed and the project runs on a fixed daily
 * ceiling, so two things have to be shared by every serverless instance, not
 * kept per process: the samples already bought (so no one pays twice for the
 * same departure) and the count of calls made today (so the ceiling is one
 * global number). Both live in one small Postgres database (Neon, over its
 * HTTP driver) when DATABASE_URL is set.
 *
 * Without it (local `node server/index.mjs`, tests) the same interface is kept
 * in memory: one process, one budget. The handler refuses to spend on a
 * serverless deployment without the shared store, because a per-instance
 * budget there would not be a ceiling at all.
 *
 * The tables are made by `npm run db:migrate` (server/schema.mjs), never at
 * runtime: a request only reads and writes rows. Missing tables make every
 * budget check fail, and a failed check spends nothing.
 */
import { neon } from '@neondatabase/serverless';

const BREAKER_KEY = '__breaker';

/** One process's store: for local runs and tests. */
export function createMemoryStore() {
  const samples = new Map();
  const budget = new Map();
  const live = (entry) => entry && entry.expiresAt > Date.now();
  return {
    shared: false,
    async getSamples(keys) {
      const found = new Map();
      for (const key of keys) {
        const entry = samples.get(key);
        if (live(entry)) found.set(key, entry.value);
      }
      return found;
    },
    async putSample(key, value, ttlMs) {
      samples.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
    async reserve(day, pool, n, limits) {
      const key = `${day}:${pool}`;
      const now = budget.get(key) ?? { used: 0, attempts: 0 };
      if (now.used + n > limits.spent || now.attempts + n > limits.attempts) return { ok: false, ...now };
      const next = { used: now.used + n, attempts: now.attempts + n };
      budget.set(key, next);
      return { ok: true, ...next };
    },
    async settle(day, pool, { unsent = 0, refund = 0 }) {
      const key = `${day}:${pool}`;
      const now = budget.get(key) ?? { used: 0, attempts: 0 };
      budget.set(key, { used: Math.max(0, now.used - unsent - refund), attempts: Math.max(0, now.attempts - unsent) });
    },
    async used(day, pool) {
      return budget.get(`${day}:${pool}`) ?? { used: 0, attempts: 0 };
    },
    async getBreaker() {
      const entry = samples.get(BREAKER_KEY);
      return live(entry) ? { ...entry.value, until: entry.expiresAt } : null;
    },
    async setBreaker(untilMs, failure) {
      samples.set(BREAKER_KEY, { value: { failure }, expiresAt: untilMs });
    },
  };
}

/**
 * The shared store. Two tables (server/schema.mjs):
 *   routes_cache   key -> one Google sample (or the circuit breaker), with its expiry
 *   routes_budget  (day, pool) -> two counts for that day and pool. The day is
 *                  Pacific, when Google resets quotas; the pools are "ranking"
 *                  and "detail", each with its own ceilings.
 *                    attempts  every call sent to Google. Never given back once
 *                              sent: the hard stop on retries.
 *                    used      calls that may be billed. Given back only for a call
 *                              never sent, or for a response category confirmed
 *                              not to be billed.
 * A reservation takes both at once in one atomic statement, so instances racing
 * for the last few calls cannot overrun either ceiling.
 *
 * Every row belongs to one environment (`scope`: production, preview or
 * development): pools are stored as `<scope>:<pool>` and cache keys as
 * `<scope>|<key>`, so one environment never reads, spends, refunds or expires
 * another's.
 */
export function createNeonStore(databaseUrl, { sql = neon(databaseUrl), scope } = {}) {
  if (!scope) throw new Error('createNeonStore needs a scope (production, preview or development).');
  const poolOf = (pool) => `${scope}:${pool}`;
  const keyOf = (key) => `${scope}|${key}`;
  const breakerKey = keyOf(BREAKER_KEY);

  return {
    shared: true,
    scope,
    async getSamples(keys) {
      const rows = await sql.query('SELECT key, value FROM routes_cache WHERE key = ANY($1) AND expires_at > now()', [keys.map(keyOf)]);
      const prefix = keyOf('');
      return new Map(rows.map((row) => [row.key.slice(prefix.length), row.value]));
    },
    async putSample(key, value, ttlMs) {
      await sql.query(
        `INSERT INTO routes_cache (key, value, expires_at) VALUES ($1, $2, now() + make_interval(secs => $3))
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
        [keyOf(key), JSON.stringify(value), ttlMs / 1000],
      );
      // Expired rows are harmless (every read filters them) but need not pile up. Only this scope's.
      if (Math.random() < 0.02) {
        await sql.query("DELETE FROM routes_cache WHERE starts_with(key, $1) AND expires_at < now() - interval '1 day'", [keyOf('')]);
      }
    },
    async reserve(day, pool, n, limits) {
      // n is never above either limit (the caller checks), so a first insert cannot overrun them either.
      const rows = await sql.query(
        `INSERT INTO routes_budget (day, pool, used, attempts) VALUES ($1, $2, $3, $3)
         ON CONFLICT (day, pool) DO UPDATE
           SET used = routes_budget.used + EXCLUDED.used, attempts = routes_budget.attempts + EXCLUDED.attempts
         WHERE routes_budget.used + EXCLUDED.used <= $4 AND routes_budget.attempts + EXCLUDED.attempts <= $5
         RETURNING used, attempts`,
        [day, poolOf(pool), n, limits.spent, limits.attempts],
      );
      if (rows.length > 0) return { ok: true, used: rows[0].used, attempts: rows[0].attempts };
      return { ok: false, ...(await this.used(day, pool)) };
    },
    async settle(day, pool, { unsent = 0, refund = 0 }) {
      // A call never sent gives back both counts; a refunded call (sent, confirmed not billed) only `used`.
      await sql.query(
        'UPDATE routes_budget SET used = GREATEST(0, used - $3 - $4), attempts = GREATEST(0, attempts - $3) WHERE day = $1 AND pool = $2',
        [day, poolOf(pool), unsent, refund],
      );
    },
    async used(day, pool) {
      const rows = await sql.query('SELECT used, attempts FROM routes_budget WHERE day = $1 AND pool = $2', [day, poolOf(pool)]);
      return { used: rows[0]?.used ?? 0, attempts: rows[0]?.attempts ?? 0 };
    },
    async getBreaker() {
      const rows = await sql.query(
        'SELECT value, expires_at FROM routes_cache WHERE key = $1 AND expires_at > now()',
        [breakerKey],
      );
      return rows[0] ? { ...rows[0].value, until: new Date(rows[0].expires_at).getTime() } : null;
    },
    async setBreaker(untilMs, failure) {
      await sql.query(
        `INSERT INTO routes_cache (key, value, expires_at) VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
        [breakerKey, JSON.stringify({ failure }), new Date(untilMs).toISOString()],
      );
    },
  };
}
