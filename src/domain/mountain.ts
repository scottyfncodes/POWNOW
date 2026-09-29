import type { MinuteOfDay } from './time';

export interface GeoPoint {
  lat: number;
  lon: number;
}

/**
 * Pass networks are *data*, not architecture. Epic is simply the first dataset
 * loaded; nothing in the engine or UI branches on a specific pass.
 */
export type PassAffiliation = 'epic' | 'ikon' | 'mountain-collective' | 'indy' | 'independent';

/** The passes a rider can say they hold. `independent` is a mountain fact, not a pass anyone owns. */
export const HOLDABLE_PASSES: readonly PassAffiliation[] = ['epic', 'ikon', 'mountain-collective', 'indy'];

export const PASS_LABELS: Record<PassAffiliation, string> = {
  epic: 'Epic Pass',
  ikon: 'Ikon Pass',
  'mountain-collective': 'Mountain Collective',
  indy: 'Indy Pass',
  independent: 'Independent',
};

/** The first of the rider's passes that this mountain honors, or null. */
export const passCovering = (mountain: Pick<Mountain, 'passAffiliations'>, passes: readonly PassAffiliation[]): PassAffiliation | null =>
  passes.find((pass) => mountain.passAffiliations.includes(pass)) ?? null;

export interface Elevations {
  baseFt: number;
  summitFt: number;
  verticalFt: number;
}

export interface OperatingSchedule {
  /** First chair on a normal weekday / weekend day. */
  weekdayOpen: MinuteOfDay;
  weekendOpen: MinuteOfDay;
  lastChair: MinuteOfDay;
  /** Some mountains routinely open upper terrain later than the base area. */
  upperMountainOpenOffset: number;
}

export interface LiftInventory {
  total: number;
  highSpeed: number;
  /** Lifts that are wind-sensitive; drives hold risk in the ops model. */
  windExposed: number;
}

export interface TerrainProfile {
  trails: number;
  acres: number;
  /** 0..1 share of terrain above treeline — more exposed to wind, better on storm days. */
  aboveTreelineShare: number;
  /** 0..1 share of terrain that needs a deep base before it opens. */
  lateOpeningShare: number;
}

export interface WeatherLocation {
  point: GeoPoint;
  /** Elevation the forecast is anchored to (mid-mountain). */
  forecastElevationFt: number;
  /** Which side of the divide — used by demo storm modelling. */
  aspect: 'west-facing' | 'east-facing' | 'south-facing' | 'divide';
}

/** A drivable corridor shared by several mountains (e.g. I-70 west of Denver). */
export interface TrafficCorridor {
  id: string;
  name: string;
  /** Short label used in copy, e.g. "I-70". */
  shorthand: string;
}

export interface AccessRoute {
  id: string;
  /** Origin this route is measured from. */
  originId: string;
  label: string;
  corridorId: string;
  /**
   * The two endpoints a real routing API needs. Denormalized onto the route
   * (rather than looked up from Origin/Mountain at call time) so a
   * `TrafficProvider` can build a request from `route` alone, exactly as it
   * does today for the demo model — a live provider is a drop-in, not a
   * reason to widen the interface every consumer already depends on.
   */
  originPoint: GeoPoint;
  destinationPoint: GeoPoint;
  distanceMiles: number;
  /** Free-flow drive time with no traffic and clear roads. */
  freeFlowMinutes: number;
  /** Extra minutes when roads are snow-packed, before congestion. */
  stormPenaltyMinutes: number;
  /** Higher = more likely to need chains / close in a storm. 0..1 */
  weatherSensitivity: number;
  isPrimary: boolean;
}

export interface Mountain {
  id: string;
  name: string;
  /** What we call it in copy: "BRECK", "VAIL". */
  shortName: string;
  /** Display region, e.g. "San Juans". */
  region: string;
  /**
   * Which weather region the mountain sits in. Storms do not arrive everywhere
   * at once: the I-70 corridor and the San Juans run on different tracks, and
   * modelling that is what lets a dry Front Range weekend still have a good
   * answer somewhere.
   */
  snowRegion: string;
  state: string;
  country: string;
  coordinates: GeoPoint;
  elevations: Elevations;
  operations: OperatingSchedule;
  lifts: LiftInventory;
  terrain: TerrainProfile;
  weatherLocation: WeatherLocation;
  accessRoutes: AccessRoute[];
  passAffiliations: PassAffiliation[];
  /** Baseline crowding pull, 0..1. Front-range favourites crowd faster. */
  popularity: number;
  /** One line of character used in explanations. */
  character: string;
}

/** Where the skier starts the day. */
export interface Origin {
  id: string;
  name: string;
  shortName: string;
  coordinates: GeoPoint;
}

export const routesFrom = (mountain: Mountain, originId: string): AccessRoute[] =>
  mountain.accessRoutes.filter((route) => route.originId === originId);

export const primaryRoute = (mountain: Mountain, originId: string): AccessRoute | undefined => {
  const routes = routesFrom(mountain, originId);
  return routes.find((route) => route.isPrimary) ?? routes[0];
};

export const openTimeFor = (mountain: Mountain, weekend: boolean): MinuteOfDay =>
  weekend ? mountain.operations.weekendOpen : mountain.operations.weekdayOpen;
