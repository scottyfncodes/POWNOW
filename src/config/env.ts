/**
 * The one place that reads `import.meta.env`. Every other module asks this
 * file for a resolved, typed answer instead of reaching into Vite's env
 * object directly — which is what makes "no keys in the bundle" checkable by
 * inspection: secrets can only leak through here, and nothing here reads one.
 *
 * All three variables are plain configuration, safe to ship in a public
 * bundle (a base URL is not a credential). Absence of every one of them is
 * the supported, default state: POW NOW runs in demo mode with zero
 * environment setup, which is what "safe demo mode when keys are absent"
 * requires.
 */
export type DataMode = 'demo' | 'live';

export interface PownowEnvironment {
  dataMode: DataMode;
  /**
   * Base URL of the data proxy (`server/`). `''` with `proxyConfigured: true`
   * means same-origin — the proxy is deployed beside the frontend as
   * serverless functions under `/api`, which is how the Vercel deployment
   * works. A full URL means a separately hosted proxy.
   */
  trafficApiBaseUrl: string;
  /** False when no proxy was configured at all: traffic, roads and snowpack report unavailable. */
  proxyConfigured: boolean;
  /**
   * CDOT/COtrip road conditions. On by default in live mode — the provider
   * fails safe (`unavailable`) on any response it doesn't recognize, so
   * there's no honesty cost to attempting it; set to "false" to disable
   * outright rather than to opt in. See `cotripRoad.ts` for the still-open
   * verification caveat (this sandbox cannot reach the real endpoint).
   */
  enableRoadConditions: boolean;
}

function readEnv(): Record<string, string | boolean | undefined> {
  try {
    // import.meta.env is statically replaced at build time by Vite; this
    // still works correctly under Vitest, which implements the same API.
    return import.meta.env as unknown as Record<string, string | boolean | undefined>;
  } catch {
    return {};
  }
}

/**
 * `VITE_API_BASE_URL` accepts three things: unset (no proxy), a full URL (a
 * separately hosted proxy), or `/` (the proxy is same-origin, under `/api`).
 * The literal `/` is how a build says "same origin" without an empty string
 * being mistaken for "nothing configured".
 */
export function resolveProxyBase(raw: unknown): { base: string; configured: boolean } {
  if (typeof raw !== 'string') return { base: '', configured: false };
  const trimmed = raw.trim();
  if (trimmed === '') return { base: '', configured: false };
  if (trimmed === '/' || trimmed === 'same-origin') return { base: '', configured: true };
  return { base: trimmed.replace(/\/+$/, ''), configured: true };
}

export function resolveEnvironment(): PownowEnvironment {
  const env = readEnv();
  const dataMode = env.VITE_DATA_MODE === 'live' ? 'live' : 'demo';
  const proxy = resolveProxyBase(env.VITE_API_BASE_URL);
  return {
    dataMode,
    trafficApiBaseUrl: proxy.base,
    proxyConfigured: proxy.configured,
    enableRoadConditions: env.VITE_ENABLE_ROAD_CONDITIONS !== 'false',
  };
}
