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
    async reserve(day, n, limit) {
      const used = budget.get(day) ?? 0;
      if (used + n > limit) return { ok: false, used };
      budget.set(day, used + n);
      return { ok: true, used: used + n };
    },
    async release(day, n) {
      budget.set(day, Math.max(0, (budget.get(day) ?? 0) - n));
    },
    async used(day) {
      return budget.get(day) ?? 0;
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
 * The shared store. Two tables, created on first use:
 *   routes_cache   key -> one Google sample (or the circuit breaker), with its expiry
 *   routes_budget  day (Pacific, when Google resets quotas) -> calls made that day
 * The budget is reserved with one atomic UPDATE, so instances racing for the
 * last few calls cannot overrun the ceiling.
 */
export function createNeonStore(databaseUrl, { sql = neon(databaseUrl) } = {}) {
  let ready = null;
  const schema = () =>
    (ready ??= (async () => {
      await sql.query(
        'CREATE TABLE IF NOT EXISTS routes_cache (key text PRIMARY KEY, value jsonb NOT NULL, expires_at timestamptz NOT NULL)',
      );
      await sql.query('CREATE TABLE IF NOT EXISTS routes_budget (day date PRIMARY KEY, used integer NOT NULL)');
    })().catch((error) => {
      ready = null;
      throw error;
    }));

  return {
    shared: true,
    async getSamples(keys) {
      await schema();
      const rows = await sql.query('SELECT key, value FROM routes_cache WHERE key = ANY($1) AND expires_at > now()', [keys]);
      return new Map(rows.map((row) => [row.key, row.value]));
    },
    async putSample(key, value, ttlMs) {
      await schema();
      await sql.query(
        `INSERT INTO routes_cache (key, value, expires_at) VALUES ($1, $2, now() + make_interval(secs => $3))
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
        [key, JSON.stringify(value), ttlMs / 1000],
      );
      // Expired rows are harmless (every read filters them) but need not pile up.
      if (Math.random() < 0.02) await sql.query("DELETE FROM routes_cache WHERE expires_at < now() - interval '1 day'");
    },
    async reserve(day, n, limit) {
      await schema();
      const rows = await sql.query(
        `INSERT INTO routes_budget (day, used) VALUES ($1, $2)
         ON CONFLICT (day) DO UPDATE SET used = routes_budget.used + EXCLUDED.used
         WHERE routes_budget.used + EXCLUDED.used <= $3
         RETURNING used`,
        [day, n, limit],
      );
      if (rows.length > 0) return { ok: true, used: rows[0].used };
      return { ok: false, used: await this.used(day) };
    },
    async release(day, n) {
      await schema();
      await sql.query('UPDATE routes_budget SET used = GREATEST(0, used - $2) WHERE day = $1', [day, n]);
    },
    async used(day) {
      await schema();
      const rows = await sql.query('SELECT used FROM routes_budget WHERE day = $1', [day]);
      return rows[0]?.used ?? 0;
    },
    async getBreaker() {
      await schema();
      const rows = await sql.query(
        'SELECT value, expires_at FROM routes_cache WHERE key = $1 AND expires_at > now()',
        [BREAKER_KEY],
      );
      return rows[0] ? { ...rows[0].value, until: new Date(rows[0].expires_at).getTime() } : null;
    },
    async setBreaker(untilMs, failure) {
      await schema();
      await sql.query(
        `INSERT INTO routes_cache (key, value, expires_at) VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
        [BREAKER_KEY, JSON.stringify({ failure }), new Date(untilMs).toISOString()],
      );
    },
  };
}
