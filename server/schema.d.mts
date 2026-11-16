/** Type surface for `server/schema.mjs`, for tests. */
export const SCHEMA_STATEMENTS: string[];
export function migrate(sql: { query(text: string, params?: unknown[]): Promise<unknown> }): Promise<void>;
