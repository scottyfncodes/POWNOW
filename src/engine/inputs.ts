import { corridorFor } from '@/data/corridors';
import type { WeatherAlert } from '@/domain/alerts';
import type { CrowdCurve, MountainWeather, OperationsReport, TravelCurve } from '@/domain/conditions';
import type { DateKey } from '@/domain/dates';
import { daysBetween } from '@/domain/dates';
import { type AccessRoute, type Mountain, type Origin } from '@/domain/mountain';
import type { TicketPrice } from '@/domain/pricing';
import { type Availability, unavailable } from '@/domain/provenance';
import { isImpassable, type RoadStatus } from '@/domain/road';
import type { SnowpackObservation } from '@/domain/snowpack';
import type { MinuteOfDay } from '@/domain/time';
import type { ProviderContext, ProviderRegistry } from '@/providers/types';
import { resolveAccessRoutes } from './routing';
import { bestCurve } from './travel';

/**
 * Everything the engine needs about one mountain on one day, with each piece
 * independently allowed to be missing. A dead lift-status feed lowers our
 * confidence; it does not take the whole recommendation down.
 */
export interface DayInputs {
  mountain: Mountain;
  origin: Origin;
  date: DateKey;
  horizonDays: number;
  isToday: boolean;
  weather: Availability<MountainWeather>;
  /** Measured snowpack at the nearest station — a separate witness from the weather model. */
  snowpack: Availability<SnowpackObservation>;
  operations: Availability<OperationsReport>;
  crowds: Availability<CrowdCurve>;
  ticket: Availability<TicketPrice>;
  /** Official alerts (NWS in the US). Supplements the forecast; scoring never reads this. */
  alerts: Availability<WeatherAlert[]>;
  outbound: Availability<TravelCurve>;
  inbound: Availability<TravelCurve>;
  /** Every route considered, so the UI can talk about alternatives. */
  outboundOptions: TravelCurve[];
  inboundOptions: TravelCurve[];
  routes: AccessRoute[];
  /**
   * Routes that were reachable in every other sense but got dropped because
   * an authoritative road-condition source reported that corridor closed.
   * Kept around only so the caveat can name the road, not the mountain.
   */
  closedCorridors: string[];
  /**
   * Road status for the primary route's corridor, kept only so the "data
   * sources" disclosure can show a Roads row — scoring and the optimiser
   * never read this directly; `closedCorridors` above is what actually
   * removes a route from consideration.
   */
  primaryRoadStatus: Availability<RoadStatus> | null;
  usingDemoData: boolean;
}

export function makeContext(date: DateKey, today: DateKey, now: MinuteOfDay): ProviderContext {
  return { date, today, now, horizonDays: Math.max(0, daysBetween(today, date)) };
}

/** Provider calls are wrapped so a thrown error becomes an honest empty state. */
async function attempt<T>(
  providerId: string,
  run: () => Promise<Availability<T>>,
): Promise<Availability<T>> {
  try {
    return await run();
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Provider request failed.';
    return unavailable<T>(providerId, reason);
  }
}

export async function loadDayInputs(
  registry: ProviderRegistry,
  mountain: Mountain,
  origin: Origin,
  context: ProviderContext,
): Promise<DayInputs> {
  const routes = resolveAccessRoutes(mountain, origin);
  const corridorIds = [...new Set(routes.map((route) => route.corridorId))];

  const [weather, snowpack, operations, crowds, ticket, alerts, roadStatusResults, outboundResults, inboundResults] =
    await Promise.all([
      attempt(registry.weather.id, () => registry.weather.getMountainWeather(mountain, context)),
      attempt(registry.snowpack.id, () => registry.snowpack.getSnowpack(mountain, context)),
      attempt(registry.mountain.id, () => registry.mountain.getOperations(mountain, context)),
      attempt(registry.mountain.id, () => registry.mountain.getCrowdForecast(mountain, context)),
      attempt(registry.pricing.id, () => registry.pricing.getTicketPrice(mountain, context)),
      attempt(registry.alerts.id, () => registry.alerts.getAlerts(mountain, context)),
      Promise.all(
        corridorIds.map(
          async (corridorId) =>
            [corridorId, await attempt(registry.roads.id, () => registry.roads.getCorridorStatus(corridorId, context))] as const,
        ),
      ),
      Promise.all(
        routes.map((route) =>
          attempt(registry.traffic.id, () => registry.traffic.getTravelCurve(route, 'outbound', context)),
        ),
      ),
      Promise.all(
        routes.map((route) =>
          attempt(registry.traffic.id, () => registry.traffic.getTravelCurve(route, 'return', context)),
        ),
      ),
    ]);

  const roadStatusByCorridor = new Map<string, Availability<RoadStatus>>(roadStatusResults);

  /*
   * A closure is authoritative: it removes the route from consideration
   * entirely, the same way a route the traffic provider never returned would
   * be removed. This is deliberately not a scoring penalty — the instructions
   * are explicit that a full closure makes a corridor *unavailable*, and the
   * optimiser has no notion of "drive here anyway, badly". Where a road
   * status call itself failed, we do not assume closed *or* clear — the
   * route stays in play exactly as it would if only the traffic provider had
   * been asked, which is the existing, already-correct degrade path.
   */
  const isRouteClosed = (route: AccessRoute): boolean => {
    const status = roadStatusByCorridor.get(route.corridorId);
    return status?.status === 'ok' && isImpassable(status.data);
  };

  const closedCorridors = [
    ...new Set(routes.filter(isRouteClosed).map((route) => corridorFor(route.corridorId).name)),
  ];

  const dropClosed = <T extends { routeId: string }>(
    items: T[],
    matchRoute: (item: T) => AccessRoute | undefined,
  ): T[] => items.filter((item) => !isRouteClosed(matchRoute(item) as AccessRoute));

  const routeById = new Map(routes.map((route) => [route.id, route]));
  const findRoute = (routeId: string) => routeById.get(routeId);

  const outboundOptions = dropClosed(
    outboundResults.flatMap((r) => (r.status === 'ok' ? [r.data] : [])),
    (curve) => findRoute(curve.routeId),
  );
  const inboundOptions = dropClosed(
    inboundResults.flatMap((r) => (r.status === 'ok' ? [r.data] : [])),
    (curve) => findRoute(curve.routeId),
  );

  const pickBest = (
    options: TravelCurve[],
    results: Availability<TravelCurve>[],
  ): Availability<TravelCurve> => {
    const chosen = bestCurve(options);
    if (chosen) {
      const match = results.find((r) => r.status === 'ok' && r.data.routeId === chosen.routeId);
      if (match && match.status === 'ok') return match;
    }
    if (routes.length > 0 && routes.every(isRouteClosed)) {
      return unavailable<TravelCurve>(
        registry.roads.id,
        `${closedCorridors.join(', ') || 'The road'} closed — no route to this mountain today.`,
      );
    }
    const firstFailure = results.find((r) => r.status === 'unavailable');
    return (
      firstFailure ??
      unavailable<TravelCurve>(registry.traffic.id, 'No drivable route from this starting point.')
    );
  };

  const primaryRoute = routes.find((route) => route.isPrimary) ?? routes[0];
  const primaryRoadStatus = primaryRoute
    ? (roadStatusByCorridor.get(primaryRoute.corridorId) ?? null)
    : null;

  return {
    mountain,
    origin,
    date: context.date,
    horizonDays: context.horizonDays,
    isToday: context.horizonDays === 0,
    weather,
    snowpack,
    operations,
    crowds,
    ticket,
    alerts,
    outbound: pickBest(outboundOptions, outboundResults),
    inbound: pickBest(inboundOptions, inboundResults),
    outboundOptions,
    inboundOptions,
    routes,
    closedCorridors,
    primaryRoadStatus,
    usingDemoData: registry.usingDemoData,
  };
}
