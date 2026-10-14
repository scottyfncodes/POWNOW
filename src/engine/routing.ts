import { isManualCityOrigin } from '@/data/origins';
import { type AccessRoute, type Mountain, type Origin, routesFrom } from '@/domain/mountain';
import { haversineMiles } from '@/lib/geo';

/**
 * The location/origin abstraction: turns *any* origin — one of the six
 * hand-authored manual cities, or a live GPS fix — into the same
 * `AccessRoute[]` shape every downstream consumer (`engine/inputs.ts`,
 * `engine/plan.ts`, both traffic providers) already knows how to route.
 * Neither caller needs to know which kind of origin it received.
 *
 * Manual cities keep their exact, unmodified pre-authored routes (including
 * a mountain having *no* route from a given city — Purgatory has none from
 * Denver, deliberately). Any other origin — above all a GPS coordinate — has
 * no pre-authored data, so one direct route is synthesized from its actual
 * coordinates straight to the mountain. This is the one place a GPS fix
 * could be snapped to a city instead of routed from directly; it isn't.
 */
export function resolveAccessRoutes(mountain: Mountain, origin: Origin): AccessRoute[] {
  if (isManualCityOrigin(origin.id)) return routesFrom(mountain, origin.id);
  return [buildLiveRoute(mountain, origin)];
}

/**
 * How far, as the crow flies, a GPS rider's candidate mountains can be. A
 * route can be synthesized to *any* mountain, but the dataset now spans four
 * states, and a rider standing in Denver should not have every California
 * resort planned (and, live, routed through Google) to be told the drive is
 * long. 300 miles keeps everything a Colorado day trip has ever meant —
 * Denver to Telluride or Taos — and leaves Salt Lake and the Sierra out.
 */
export const GPS_REACH_MILES = 300;
/** A GPS fix nowhere near any mountain still gets an answer: the nearest few. */
const GPS_FALLBACK_COUNT = 5;

/**
 * The mountains that compete for a day from this origin. A manual city
 * competes exactly the mountains it has hand-authored routes to; a GPS fix
 * competes every mountain within `GPS_REACH_MILES`, or — standing in Kansas
 * — the nearest handful, rather than nothing.
 */
export function mountainsInReach(mountains: Mountain[], origin: Origin): Mountain[] {
  if (isManualCityOrigin(origin.id)) {
    return mountains.filter((mountain) => routesFrom(mountain, origin.id).length > 0);
  }
  const byDistance = mountains
    .map((mountain) => ({ mountain, miles: haversineMiles(origin.coordinates, mountain.coordinates) }))
    .sort((a, b) => a.miles - b.miles);
  const near = byDistance.filter((entry) => entry.miles <= GPS_REACH_MILES);
  return (near.length > 0 ? near : byDistance.slice(0, GPS_FALLBACK_COUNT)).map((entry) => entry.mountain);
}

const AVERAGE_ROAD_SPEED_MPH = 45;
/** Straight-line distance underestimates real road distance; mountain roads wind more than this, but it's a starting figure only. */
const STRAIGHT_LINE_TO_ROAD_FACTOR = 1.2;
const DEFAULT_WEATHER_SENSITIVITY = 0.65;

/**
 * `freeFlowMinutes` / `stormPenaltyMinutes` / `weatherSensitivity` below feed
 * only the demo traffic provider's synthetic curve
 * (`providers/demo/traffic.ts`), which is always labelled DEMO DATA in the
 * UI. The live provider (`providers/live/googleRoutesTraffic.ts`) ignores
 * every one of them — it sends `originPoint`/`destinationPoint` straight to
 * Google Routes and reports back the real duration, traffic, and distance.
 */
function buildLiveRoute(mountain: Mountain, origin: Origin): AccessRoute {
  const distanceMiles = haversineMiles(origin.coordinates, mountain.coordinates) * STRAIGHT_LINE_TO_ROAD_FACTOR;
  const primary = mountain.accessRoutes.find((route) => route.isPrimary) ?? mountain.accessRoutes[0];

  return {
    id: `${mountain.id}:${origin.id}:live`,
    originId: origin.id,
    label: `Live route from ${origin.shortName}`,
    corridorId: primary?.corridorId ?? 'local',
    originPoint: origin.coordinates,
    destinationPoint: mountain.coordinates,
    distanceMiles,
    freeFlowMinutes: Math.round((distanceMiles / AVERAGE_ROAD_SPEED_MPH) * 60),
    stormPenaltyMinutes: Math.round(distanceMiles * 0.15),
    weatherSensitivity: primary?.weatherSensitivity ?? DEFAULT_WEATHER_SENSITIVITY,
    isPrimary: true,
  };
}
