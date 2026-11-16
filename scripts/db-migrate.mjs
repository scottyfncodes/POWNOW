/**
 * Apply server/schema.mjs to one environment's database.
 *
 *   POWNOW_DATABASE_URL=... npm run db:migrate
 *
 * Run it by hand, once per database, before deploying code that needs a new
 * table or column. It is idempotent: an up-to-date database is left untouched.
 * Requests never change the schema.
 */
import { neon } from '@neondatabase/serverless';
import { migrate } from '../server/schema.mjs';

const url = process.env.POWNOW_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('Set POWNOW_DATABASE_URL (or DATABASE_URL) to the database to migrate.');
  process.exit(1);
}
await migrate(neon(url));
console.log(`Schema is current on ${new URL(url).hostname}.`);
