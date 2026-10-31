import type { SnowHistory } from '@/domain/conditions';
import type { Mountain } from '@/domain/mountain';
import { type Availability, unavailable } from '@/domain/provenance';
import type { ProviderContext, ProviderRegistry } from '@/providers/types';

export type SnowOutlooks = Record<string, Availability<SnowHistory>>;

/**
 * Every mountain's five-day snowfall, for the views that compare mountains at
 * a glance. Uses the weather provider's batch call when it has one (live
 * Open-Meteo: a few requests for the whole dataset) and otherwise asks for
 * each mountain's weather, which the demo provider answers locally.
 */
export async function loadSnowOutlooks(
  registry: ProviderRegistry,
  mountains: Mountain[],
  context: ProviderContext,
): Promise<SnowOutlooks> {
  const weather = registry.weather;
  if (weather.getSnowOutlooks) return weather.getSnowOutlooks(mountains, context);
  const entries = await Promise.all(
    mountains.map(async (mountain): Promise<[string, Availability<SnowHistory>]> => {
      const result = await weather.getMountainWeather(mountain, context);
      if (result.status !== 'ok') return [mountain.id, result];
      const history = result.data.snowHistory;
      return [mountain.id, history ? { status: 'ok', data: history, provenance: result.provenance } : unavailable(weather.id, 'No snowfall forecast for this mountain.')];
    }),
  );
  return Object.fromEntries(entries);
}

/** Next five days' total, or null when the forecast isn't available. Used to sort by snow. */
export const forecastTotal = (outlooks: SnowOutlooks | null, mountainId: string): number | null => {
  const entry = outlooks?.[mountainId];
  return entry?.status === 'ok' ? entry.data.futureTotalIn : null;
};
