/**
 * The pownow database schema for the Google budget and sample cache, applied
 * by `npm run db:migrate` (scripts/db-migrate.mjs), never by a request.
 *
 * Every statement is safe to run again: tables are created only if missing,
 * and a column is added only after the catalogue says it is absent, so a run
 * against an up-to-date database takes no table lock at all (a bare
 * `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` takes an exclusive lock even when
 * it then skips).
 */
export const SCHEMA_STATEMENTS = [
  'CREATE TABLE IF NOT EXISTS routes_cache (key text PRIMARY KEY, value jsonb NOT NULL, expires_at timestamptz NOT NULL)',
  'CREATE TABLE IF NOT EXISTS routes_budget (day date NOT NULL, pool text NOT NULL, used integer NOT NULL, attempts integer NOT NULL DEFAULT 0, PRIMARY KEY (day, pool))',
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'routes_budget' AND column_name = 'attempts'
     ) THEN
       ALTER TABLE routes_budget ADD COLUMN attempts integer NOT NULL DEFAULT 0;
     END IF;
   END $$`,
];

/** Run the schema with a Neon-style `sql.query`, one statement at a time. */
export async function migrate(sql) {
  for (const statement of SCHEMA_STATEMENTS) await sql.query(statement);
}
