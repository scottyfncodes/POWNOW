import { CORRIDOR_REGION, corridorFor } from '@/data/corridors';
import type { RoadCondition } from '@/domain/conditions';
import type { RoadClosure, RoadStatus } from '@/domain/road';
import { type Availability, ok, unavailable } from '@/domain/provenance';
import type { ProviderContext, RoadConditionProvider } from '@/providers/types';
import { cachedJson } from './fetchCache';

/**
 * CDOT / COtrip road status, via the proxy.
 *
 * CDOT publishes its real-time data at `data.cotrip.org/api/v1/*` behind a
 * free registered API key. Two collections matter to a ski day:
 * `roadConditions` (surface state and chain/traction law by highway
 * segment) and `incidents` (closures and crashes). Neither serves CORS and
 * both need the key, so `server/index.mjs` fetches them, normalizes the two
 * GeoJSON collections into one flat list of road events, caches the result
 * for five minutes across every visitor, and this provider filters that list
 * to the corridor it was asked about. (An earlier version of this file
 * called a host named `manage-api.cotrip.org` from the browser, with no key,
 * and would have reported every corridor as unavailable.)
 *
 * How a corridor is matched: by CDOT's highway name (`I-70`, `US 40`...),
 * then by *where* on that highway the event is — a crash in Grand Junction is
 * on I-70 but is not between Denver and Vail. Where is decided by, in order:
 * mile markers (CDOT's own fields, or the "Mile Point 241.5" CDOT writes into
 * an incident's message when the fields are empty); else the event's
 * geometry against the corridor's bounding box (road-condition segments
 * carry no markers at all, only a line on the map); else the name alone.
 * The windows in `CDOT_ROUTES` are generous on purpose: missing a real
 * closure costs more than flagging one a few miles off the route.
 *
 * All of this was checked against the live feed, not only against mocks:
 * CDOT names incidents with a direction suffix ("I-70E", "US-287N"), types a
 * crash that shuts the road as a crash rather than a closure, and flags one
 * direction's through lanes closed for alternating one-lane traffic. The
 * tests in `cotripRoad.test.ts` use real events captured from the feed.
 *
 * What it will and won't claim:
 *  - `closed` only for an incident CDOT itself types as a closure whose
 *    message says the road (not a lane) is closed, or a surface condition
 *    that literally reads "closed". A closure removes the route from
 *    consideration (`engine/inputs.ts`), so this is the one call that must
 *    not be made loosely.
 *  - `chains-required` when a segment's impacts name a chain or traction
 *    law. `snow-packed` / `wet` from the surface description. `clear` only
 *    when the feed was understood and nothing on the corridor said otherwise.
 *  - Road status is a *right now* fact. For a planned future date it reports
 *    unavailable rather than pretending today's closure will still be there
 *    Saturday — or that it won't.
 *  - A proxy response this code doesn't recognize is `unavailable`, never
 *    `clear`. A recognized response with no events on the corridor is `clear`
 *    at *medium* confidence: the feed spoke, but "nothing reported" is weaker
 *    evidence than "reported clear".
 */
export interface RoadEvent {
  kind: 'condition' | 'incident';
  routeName: string;
  description?: string;
  /** roadConditions only: e.g. ["Chain Law Code 17"]. */
  impacts?: string[];
  /** incidents only: CDOT's own event type, e.g. "Road Closure". */
  type?: string;
  direction?: string | null;
  startMarker?: number | null;
  endMarker?: number | null;
  lastUpdated?: string | null;
  startTime?: string | null;
  /** incidents only: CDOT's per-direction lane picture. */
  laneImpacts?: LaneImpact[];
  /** A few [lat, lon] points sampled from the event's geometry, when the proxy had one. */
  points?: [number, number][];
}

export interface LaneImpact {
  direction?: string;
  laneCount?: number;
  laneClosures?: string;
  /** e.g. ["right lane"], ["left lane", "center lane", "right lane"], ["through lanes", "left shoulder"]. */
  closedLaneTypes?: string[];
}

export interface RoadEventsResponse {
  events?: RoadEvent[];
  feeds?: { roadConditions?: boolean; incidents?: boolean };
  sourceTimestamp?: string;
}

export interface CotripRoadOptions {
  /** The proxy's base URL. Required: the browser can't reach CDOT directly. */
  apiBaseUrl: string;
}

/** [south, west, north, east] in degrees. */
type Bounds = [number, number, number, number];

/** A CDOT highway name plus the stretch of it a ski drive on this corridor covers. */
interface CdotRoute {
  routeName: string;
  /** Mile-marker window, for events that carry markers. */
  markers?: [number, number];
  /** The same stretch as a lat/lon box, for events that carry only geometry. */
  bounds?: Bounds;
}

/**
 * Corridor → CDOT highway segments. Mile markers and boxes are approximate
 * and wide. A route with neither matches the whole highway.
 */
export const CDOT_ROUTES: Record<string, CdotRoute[]> = {
  // Vail ↔ C-470: Edwards to the foothills, Vail Pass, Eisenhower Tunnel, Idaho Springs.
  'i70-west': [{ routeName: 'I-70', markers: [160, 265], bounds: [39.4, -106.65, 39.85, -105.1] }],
  // Empire ↔ Berthoud Pass ↔ Winter Park ↔ Granby.
  'us40-berthoud': [{ routeName: 'US 40', markers: [220, 262], bounds: [39.7, -106.0, 40.15, -105.6] }],
  // Kremmling ↔ Rabbit Ears Pass ↔ Steamboat.
  'us40-rabbitears': [{ routeName: 'US 40', markers: [120, 190], bounds: [40.0, -106.95, 40.55, -106.3] }],
  // Loveland Pass, Keystone side to the Loveland valley.
  'us6-loveland': [{ routeName: 'US 6', markers: [205, 235], bounds: [39.55, -106.0, 39.72, -105.8] }],
  'us285-hoosier': [
    // Denver ↔ Kenosha Pass ↔ Fairplay.
    { routeName: 'US 285', markers: [175, 255], bounds: [39.15, -106.05, 39.7, -105.0] },
    // Fairplay ↔ Hoosier Pass ↔ Breckenridge.
    { routeName: 'CO 9', markers: [55, 100], bounds: [39.15, -106.15, 39.55, -105.95] },
  ],
  // Colorado Springs ↔ Wilkerson Pass ↔ Buena Vista ↔ Leadville.
  'us24-buena-vista': [{ routeName: 'US 24', markers: [195, 325], bounds: [38.75, -106.4, 39.35, -104.8] }],
  // Cañon City ↔ Poncha Springs ↔ Monarch Pass ↔ Gunnison.
  'us50-monarch': [{ routeName: 'US 50', markers: [185, 240], bounds: [38.35, -107.0, 38.65, -105.0] }],
  // Durango ↔ Purgatory ↔ Coal Bank and Molas passes.
  'us550-durango': [{ routeName: 'US 550', markers: [10, 65], bounds: [37.2, -108.0, 37.9, -107.55] }],
  // Pagosa Springs ↔ Wolf Creek Pass ↔ South Fork.
  'us160-wolfcreek': [{ routeName: 'US 160', markers: [135, 195], bounds: [37.2, -107.15, 37.75, -106.5] }],
  // Boulder Canyon to Nederland.
  'co119-eldora': [{ routeName: 'CO 119', markers: [10, 50], bounds: [39.9, -105.6, 40.08, -105.2] }],
};

export class CotripRoadProvider implements RoadConditionProvider {
  readonly id = 'cotrip';

  constructor(private readonly options: CotripRoadOptions) {}

  async getCorridorStatus(corridorId: string, context: ProviderContext): Promise<Availability<RoadStatus>> {
    if ((CORRIDOR_REGION[corridorId] ?? '').length === 0) {
      return unavailable(this.id, `No known region for corridor "${corridorId}".`);
    }
    const routes = CDOT_ROUTES[corridorId];
    if (!routes || routes.length === 0) {
      return unavailable(this.id, `No CDOT route mapping for corridor "${corridorId}".`);
    }
    if (context.horizonDays > 0) {
      return unavailable(this.id, 'Road status is a right-now fact; CDOT does not report future days.');
    }

    let payload: RoadEventsResponse;
    let fetchedAt: number;
    try {
      const result = await cachedJson<RoadEventsResponse>(`${this.options.apiBaseUrl}/api/road-conditions`, {
        timeoutMs: 10000,
        ttlMs: 5 * 60 * 1000,
      });
      payload = result.value;
      fetchedAt = result.fetchedAt;
    } catch (error) {
      return unavailable(this.id, error instanceof Error ? error.message : 'CDOT request failed.');
    }

    if (!Array.isArray(payload.events)) {
      return unavailable(this.id, 'The road-conditions proxy returned a shape this provider does not recognize.');
    }

    const relevant = payload.events.filter((event) => routes.some((route) => eventMatches(event, route)));
    const status = summarize(relevant);
    const corridor = corridorFor(corridorId);
    const sourceTimestamp = payload.sourceTimestamp ?? new Date(fetchedAt).toISOString();

    return ok(
      {
        corridorId,
        condition: status.condition,
        closures: status.closures,
        tractionLawInEffect: status.tractionLaw,
        sourceTimestamp,
        source: `CDOT / COtrip (${corridor.name})`,
      },
      {
        source: 'live',
        observation: 'observed',
        confidence: relevant.length > 0 ? 'high' : 'medium',
        provider: this.id,
        horizonDays: context.horizonDays,
        fetchedAt: new Date(fetchedAt).toISOString(),
        validUntil: new Date(fetchedAt + 10 * 60 * 1000).toISOString(),
      },
    );
  }
}

/**
 * "I-70", "I 70", "I70", "Interstate 70" and CDOT's spellings "I-70E" and
 * "US 24A" all name the same road. A trailing letter after the number is
 * either a direction (incidents: "I-70E") or CDOT's segment designation
 * (conditions: the US 24 mainline over Tennessee Pass and Wilkerson Pass is
 * "US 24A" in the live feed). Neither makes it a different highway, and
 * *where* an event is — markers or geometry, below — decides whether it is
 * on the drive.
 */
export function normalizeRouteName(value: string): string {
  return value
    .toUpperCase()
    .replace(/\bINTERSTATE\b/g, 'I')
    .replace(/\bSTATE (HIGHWAY|HWY)\b|\bSH\b/g, 'CO')
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^([A-Z]+\d+)[A-Z]$/, '$1');
}

const MILE_POINT_RANGE = /from mile point (\d+(?:\.\d+)?) to mile point (\d+(?:\.\d+)?)/i;
const MILE_POINT_AT = /\bmile point (\d+(?:\.\d+)?)/i;

/** An event's mile markers: CDOT's fields when set, else the "Mile Point" CDOT writes into the message. */
export function markersOf(event: RoadEvent): [number, number] | null {
  const start = typeof event.startMarker === 'number' ? event.startMarker : null;
  const end = typeof event.endMarker === 'number' ? event.endMarker : start;
  if (start !== null && end !== null) return [start, end];
  const text = event.description ?? '';
  const range = MILE_POINT_RANGE.exec(text);
  if (range) return [Number(range[1]), Number(range[2])];
  const at = MILE_POINT_AT.exec(text);
  if (at) return [Number(at[1]), Number(at[1])];
  return null;
}

const inBounds = ([lat, lon]: [number, number], [south, west, north, east]: Bounds): boolean =>
  lat >= south && lat <= north && lon >= west && lon <= east;

export function eventMatches(event: RoadEvent, route: CdotRoute): boolean {
  if (normalizeRouteName(event.routeName ?? '') !== normalizeRouteName(route.routeName)) return false;
  const markers = markersOf(event);
  if (markers && route.markers) {
    const lo = Math.min(markers[0], markers[1]);
    const hi = Math.max(markers[0], markers[1]);
    return hi >= route.markers[0] && lo <= route.markers[1];
  }
  const points = Array.isArray(event.points) ? event.points : [];
  if (points.length > 0 && route.bounds) {
    const bounds = route.bounds;
    return points.some((point) => Array.isArray(point) && point.length === 2 && inBounds(point, bounds));
  }
  return true; // nothing locates it: match on the highway alone
}

const SURFACE_RANK: Record<RoadCondition, number> = {
  clear: 0,
  wet: 1,
  'snow-packed': 2,
  'chains-required': 3,
  closed: 4,
};

function surfaceFromDescription(description: string): RoadCondition | null {
  const text = description.toLowerCase();
  if (/closed/.test(text)) return 'closed';
  if (/snow|ice|icy|slush|slick/.test(text)) return 'snow-packed';
  if (/wet|moist/.test(text)) return 'wet';
  if (/dry|clear|normal|good/.test(text)) return 'clear';
  return null;
}

const FULL_CLOSURE_MESSAGE = /\b(road|highway|i-?\d+|us ?\d+|co ?\d+)\b[^.]*\bclosed\b|\bclosed (in )?both directions\b|\bfull(y)? clos/i;
const LANE_ONLY = /\b(left|right|center|one|single|\d) lanes?\b[^.]*\bclosed\b|\blane closure\b|\bshoulder\b/i;
const CHAIN_LAW = /chain law|traction law|code 1[5-8]\b|chains? required|passenger vehicle traction/i;
const ROAD_CLOSED_TEXT = /\broad closed\b|\bclosed in both directions\b/i;
const ALTERNATING = /alternating traffic|one lane (alternating|traffic)|flagger/i;

/** Every travel lane in this direction is shut — "through lanes", or each named lane up to the lane count. */
function directionFullyClosed(impact: LaneImpact): boolean {
  const closed = (impact.closedLaneTypes ?? []).map((type) => type.toLowerCase());
  if (closed.includes('through lanes')) return true;
  const lanes = closed.filter((type) => /\blane\b/.test(type) && !/shoulder/.test(type)).length;
  return typeof impact.laneCount === 'number' && impact.laneCount > 0 && lanes >= impact.laneCount;
}

/**
 * Is this incident a closure of the road, not of a lane? CDOT's lane picture
 * is the best evidence, and it needs reading with care: one direction's
 * through lanes shut is also how alternating one-lane traffic is reported.
 *  - every direction fully shut: closed, whatever CDOT typed it as;
 *  - one direction fully shut and the message says the road is closed (and
 *    doesn't describe alternating traffic): closed, in that direction;
 *  - no lane picture at all: the old rule — CDOT typed it a closure and the
 *    message says the road, not a lane, is closed.
 */
export function isFullClosure(event: RoadEvent): boolean {
  const description = event.description ?? '';
  const impacts = (event.laneImpacts ?? []).filter((impact) => (impact.laneCount ?? 0) > 0 || (impact.closedLaneTypes ?? []).length > 0);
  if (impacts.length > 0) {
    const shut = impacts.filter(directionFullyClosed);
    if (shut.length === 0) return false;
    if (shut.length === impacts.length) return true;
    return ROAD_CLOSED_TEXT.test(description) && !ALTERNATING.test(description);
  }
  const type = (event.type ?? '').toLowerCase();
  return /closure|closed/.test(type) && FULL_CLOSURE_MESSAGE.test(description) && !LANE_ONLY.test(description);
}

export function summarize(events: RoadEvent[]): {
  condition: RoadCondition;
  closures: RoadClosure[];
  tractionLaw: boolean;
} {
  let worst: RoadCondition = 'clear';
  let tractionLaw = false;
  const closures: RoadClosure[] = [];

  const worsen = (condition: RoadCondition) => {
    if (SURFACE_RANK[condition] > SURFACE_RANK[worst]) worst = condition;
  };

  for (const event of events) {
    const description = event.description ?? '';
    if (event.kind === 'condition') {
      const surface = surfaceFromDescription(description);
      if (surface) worsen(surface);
      const impacts = (event.impacts ?? []).join(' ');
      if (CHAIN_LAW.test(impacts) || CHAIN_LAW.test(description)) {
        tractionLaw = true;
        worsen('chains-required');
      }
      if (surface === 'closed') {
        closures.push({
          description: description || 'Road reported closed.',
          location: markerLabel(event),
          startedAt: event.lastUpdated ?? new Date().toISOString(),
        });
      }
      continue;
    }

    if (isFullClosure(event)) {
      worsen('closed');
      closures.push({
        description: description || 'Road closure reported by CDOT.',
        location: markerLabel(event),
        startedAt: event.startTime ?? event.lastUpdated ?? new Date().toISOString(),
      });
    } else if (CHAIN_LAW.test(description)) {
      tractionLaw = true;
      worsen('chains-required');
    }
  }

  return { condition: worst, closures, tractionLaw };
}

function markerLabel(event: RoadEvent): string {
  const route = event.routeName ?? 'Road';
  const direction = event.direction ? ` ${event.direction}` : '';
  const markers = markersOf(event);
  if (!markers) return `${route}${direction}`;
  const [start, end] = markers;
  return start === end ? `${route}${direction}, MP ${start}` : `${route}${direction}, MP ${start}–${end}`;
}
