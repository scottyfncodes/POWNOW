import type { PownowEnvironment } from '@/config/env';
import { resolveEnvironment } from '@/config/env';
import { createDemoRegistry } from './demo';
import { createLiveRegistry } from './live';
import type { ProviderRegistry } from './types';

/**
 * The single line `App.tsx` calls. Everything above this file works against
 * `ProviderRegistry` and has no idea whether that came from demo data, a real
 * forecast, or some mix — that boundary is the whole architecture.
 *
 * The default, with no environment configured at all, is demo mode. Live mode
 * has to be asked for explicitly (`VITE_DATA_MODE=live` at build time — Vite
 * bakes `import.meta.env` in at build, so switching modes means a rebuild,
 * not a runtime toggle); this is what makes demo mode "safe" in the sense the
 * real-data gate asks for: there is no way to end up live by accident.
 */
export function createProviderRegistry(env: PownowEnvironment = resolveEnvironment()): ProviderRegistry {
  if (env.dataMode === 'demo') return createDemoRegistry();
  return createLiveRegistry({
    // `''` is a real value here (same-origin proxy); only "not configured" is undefined.
    trafficApiBaseUrl: env.proxyConfigured ? env.trafficApiBaseUrl : undefined,
    enableRoadConditions: env.enableRoadConditions,
  });
}

export { createDemoRegistry, createLiveRegistry };
export type { ProviderRegistry };
