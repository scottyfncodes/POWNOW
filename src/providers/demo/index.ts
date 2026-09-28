import type { ProviderRegistry } from '@/providers/types';
import { DemoAlertsProvider } from './alerts';
import { DemoMountainProvider, type DemoMountainOptions } from './mountain';
import { DemoPlacesProvider } from './places';
import { DemoPricingProvider, type DemoPricingOptions } from './pricing';
import { DemoRoadConditionProvider } from './road';
import { DemoSnowpackProvider } from './snowpack';
import { DemoTrafficProvider, type DemoTrafficOptions } from './traffic';
import { DemoWeatherProvider, type DemoWeatherOptions } from './weather';

export * from './scenario';
export {
  DemoAlertsProvider,
  DemoMountainProvider,
  DemoPlacesProvider,
  DemoPricingProvider,
  DemoRoadConditionProvider,
  DemoSnowpackProvider,
  DemoTrafficProvider,
  DemoWeatherProvider,
};

export interface DemoRegistryOptions {
  weather?: DemoWeatherOptions;
  traffic?: DemoTrafficOptions;
  mountain?: DemoMountainOptions;
  pricing?: DemoPricingOptions;
}

/**
 * The demo bundle. Swapping in a live provider is a one-line change here —
 * nothing above this layer knows which implementation it is talking to.
 */
export function createDemoRegistry(options: DemoRegistryOptions = {}): ProviderRegistry {
  return {
    weather: new DemoWeatherProvider(options.weather),
    traffic: new DemoTrafficProvider(options.traffic),
    mountain: new DemoMountainProvider(options.mountain),
    pricing: new DemoPricingProvider(options.pricing),
    places: new DemoPlacesProvider(),
    alerts: new DemoAlertsProvider(),
    roads: new DemoRoadConditionProvider(),
    snowpack: new DemoSnowpackProvider(),
    usingDemoData: true,
    label: 'Demo data',
  };
}
