import type { ProviderRegistry } from '@/providers/types';
import { CotripRoadProvider } from './cotripRoad';
import { LiveTrafficProvider } from './googleRoutesTraffic';
import { LiveMountainProvider } from './mountainStatus';
import { NwsAlertsProvider } from './nwsAlerts';
import { OpenMeteoWeatherProvider } from './openMeteoWeather';
import { LiveParkingProvider } from './parking';
import { LivePricingProvider } from './pricing';
import { SnotelSnowpackProvider } from './snotelSnowpack';
import {
  UnavailablePlacesProvider,
  UnavailableRoadConditionProvider,
  UnavailableSnowpackProvider,
  UnavailableTrafficProvider,
} from './unavailable';

export {
  CotripRoadProvider,
  LiveMountainProvider,
  LiveParkingProvider,
  LivePricingProvider,
  LiveTrafficProvider,
  NwsAlertsProvider,
  OpenMeteoWeatherProvider,
  SnotelSnowpackProvider,
};

export interface LiveRegistryOptions {
  /**
   * Base URL of the data proxy (see `server/index.mjs`). It carries traffic
   * (Google Routes), road conditions (CDOT) and measured snowpack (SNOTEL) —
   * everything a browser can't fetch itself. `''` means same-origin (the
   * proxy is deployed under `/api` beside the frontend); `undefined` means
   * no proxy, and all three report `unavailable`.
   */
  trafficApiBaseUrl?: string;
  /** CDOT/COtrip road conditions — on by default, see `config/env.ts`. */
  enableRoadConditions?: boolean;
}

/**
 * The live bundle — the production data gate.
 *
 * Nothing this module reaches ever imports `providers/demo`. Every slot is
 * either a genuine live call or an `Unavailable*Provider` from
 * `./unavailable.ts` that reports `unavailable` honestly — there is no
 * config-time *or* request-time path from this registry to a demo value.
 * `places` has no live implementation and was never in scope for one; it
 * reports `unavailable` the same as an unconfigured slot, not demo data.
 *
 * | Slot | Live when | Otherwise |
 * |---|---|---|
 * | weather, alerts | always | (no fallback — these have no config knob) |
 * | traffic | `trafficApiBaseUrl` set | `unavailable` |
 * | roads | proxy set and `enableRoadConditions` (default true) | `unavailable` |
 * | snowpack | `trafficApiBaseUrl` set (SNOTEL via the proxy) | `unavailable` |
 * | mountain (operations) | Liftie covers the resort | `unavailable` |
 * | mountain (crowds) | never — retired, see `mountainStatus.ts` | `unavailable` |
 * | pricing | never — no verifiable source, see `pricing.ts` | `unavailable` |
 * | parking | always, for a researched mountain — see `parking.ts` | `unavailable` for an unresearched mountain |
 * | places | never — no live implementation | `unavailable` |
 *
 * `createProviderRegistry` (`providers/index.ts`) is the only caller; its
 * own test (`providers/index.test.ts`) asserts that a live-mode registry
 * never returns a `Demo*Provider` instance in any slot.
 */
export function createLiveRegistry(options: LiveRegistryOptions = {}): ProviderRegistry {
  const apiBaseUrl = options.trafficApiBaseUrl;
  // `''` is same-origin (the Vercel layout); only `undefined` means no proxy.
  const hasProxy = apiBaseUrl !== undefined;
  const roadConditionsEnabled = options.enableRoadConditions ?? true;

  return {
    weather: new OpenMeteoWeatherProvider(),
    traffic: hasProxy ? new LiveTrafficProvider({ apiBaseUrl: apiBaseUrl! }) : new UnavailableTrafficProvider(),
    mountain: new LiveMountainProvider(),
    pricing: new LivePricingProvider(),
    places: new UnavailablePlacesProvider(),
    alerts: new NwsAlertsProvider(),
    roads:
      hasProxy && roadConditionsEnabled
        ? new CotripRoadProvider({ apiBaseUrl: apiBaseUrl! })
        : new UnavailableRoadConditionProvider(),
    snowpack: hasProxy ? new SnotelSnowpackProvider({ apiBaseUrl: apiBaseUrl! }) : new UnavailableSnowpackProvider(),
    parking: new LiveParkingProvider(),
    // No slot in this registry is ever a demo implementation — a config-time
    // gap reports `unavailable`, not demo data. See the module docblock.
    usingDemoData: false,
    label: hasProxy ? 'Live data' : 'Live data (traffic, roads and snowpack unavailable — no proxy configured)',
  };
}
