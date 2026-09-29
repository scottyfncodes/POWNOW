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
 * How a corridor is matched: by CDOT's highway name (`I-70`, `US 40`...) and,
 * where the event carries mile markers, by the stretch of that highway a ski
 * drive actually uses — a crash in Grand Junction is on I-70 but is not
 * between Denver and Vail. Events with no mile markers match on name alone.
 * The marker windows in `CDOT_ROUTES` are generous on purpose: missing a
 * real closure costs more than flagging one a few miles off the route.
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

/** A CDOT highway name plus the mile-marker stretch a ski drive on this corridor covers. */
interface CdotRoute {
  routeName: string;
  markers?: [number, number];
}

/**
 * Corridor → CDOT highway segments. Mile markers are approximate and wide.
 * A route without markers matches the whole highway.
 */
export const CDOT_ROUTES: Record<string, CdotRoute[]> = {
  'i70-west': [{ routeName: 'I-70', markers: [160, 265] }], // Vail ↔ C-470
  'us40-berthoud': [{ routeName: 'US 40', markers: [220, 262] }], // Winter Park ↔ Empire
  'us40-rabbitears': [{ routeName: 'US 40', markers: [120, 190] }], // Steamboat ↔ Kremmling
  'us6-loveland': [{ routeName: 'US 6', markers: [205, 235] }], // Loveland Pass
  'us285-hoosier': [
    { routeName: 'US 285', markers: [175, 255] }, // Denver ↔ Fairplay
    { routeName: 'CO 9', markers: [55, 100] }, // Fairplay ↔ Breck over Hoosier
  ],
  'us24-buena-vista': [{ routeName: 'US 24', markers: [195, 325] }],
  'us50-monarch': [{ routeName: 'US 50', markers: [185, 240] }],
  'us550-durango': [{ routeName: 'US 550', markers: [10, 65] }],
  'us160-wolfcreek': [{ routeName: 'US 160', markers: [135, 195] }],
  'co119-eldora': [{ routeName: 'CO 119', markers: [10, 50] }],
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

/** "I-70", "I 70", "I70" and "Interstate 70" all name the same road. */
function normalizeRouteName(value: string): string {
  return value
    .toUpperCase()
    .replace(/INTERSTATE/g, 'I')
    .replace(/HIGHWAY|HWY/g, 'US')
    .replace(/STATE HWY|SH|CO-/g, 'CO')
    .replace(/[^A-Z0-9]/g, '');
}

export function eventMatches(event: RoadEvent, route: CdotRoute): boolean {
  if (normalizeRouteName(event.routeName ?? '') !== normalizeRouteName(route.routeName)) return false;
  if (!route.markers) return true;
  const start = typeof event.startMarker === 'number' ? event.startMarker : null;
  const end = typeof event.endMarker === 'number' ? event.endMarker : start;
  if (start === null || end === null) return true; // no markers: match on the highway alone
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  return hi >= route.markers[0] && lo <= route.markers[1];
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

    const type = (event.type ?? '').toLowerCase();
    const isClosureType = /closure|closed/.test(type);
    const saysRoadClosed = FULL_CLOSURE_MESSAGE.test(description) && !LANE_ONLY.test(description);
    if (isClosureType && saysRoadClosed) {
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
  if (typeof event.startMarker === 'number' && typeof event.endMarker === 'number') {
    return `${route}${direction}, MP ${Math.round(event.startMarker)}–${Math.round(event.endMarker)}`;
  }
  if (typeof event.startMarker === 'number') return `${route}${direction}, MP ${Math.round(event.startMarker)}`;
  return `${route}${direction}`;
}
