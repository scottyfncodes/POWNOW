import type { RoadCondition, TravelCurve, TravelIncident, TravelSample } from '@/domain/conditions';
import type { AccessRoute } from '@/domain/mountain';
import {
  type Availability,
  confidenceForHorizon,
  ok,
  observationForHorizon,
  unavailable,
} from '@/domain/provenance';
import { at, clamp, clamp01, minuteRange } from '@/domain/time';
import { type ControlPoint, sampleCurve } from '@/lib/curve';
import { CORRIDOR_REGION, CORRIDOR_SEVERITY, corridorFor } from '@/data/corridors';
import { createRng, hashSeed } from '@/lib/random';
import type { ProviderContext, TrafficProvider } from '@/providers/types';
import { regionalPattern } from './scenario';

/**
 * Departure-time-dependent travel is the thing POW NOW knows that a maps app
 * won't tell you until you're already late. The shapes below are the two
 * curves every Front Range skier has learned the hard way:
 *
 *  - westbound stacks up fast between 6:30 and 8:00 and clears by mid-morning
 *  - eastbound is a wall from about 2:45 until 6:00, then it just... lets go
 */
const OUTBOUND_SHAPE: ControlPoint[] = [
  { minute: at(3, 0), value: 0.01 },
  { minute: at(4, 30), value: 0.03 },
  { minute: at(5, 0), value: 0.06 },
  { minute: at(5, 30), value: 0.12 },
  { minute: at(6, 0), value: 0.26 },
  { minute: at(6, 30), value: 0.5 },
  { minute: at(7, 0), value: 0.76 },
  { minute: at(7, 30), value: 0.9 },
  { minute: at(8, 0), value: 0.84 },
  { minute: at(8, 45), value: 0.6 },
  { minute: at(9, 30), value: 0.38 },
  { minute: at(10, 30), value: 0.2 },
  { minute: at(12, 0), value: 0.1 },
];

const RETURN_SHAPE: ControlPoint[] = [
  { minute: at(10, 0), value: 0.06 },
  { minute: at(12, 0), value: 0.12 },
  { minute: at(13, 0), value: 0.22 },
  { minute: at(14, 0), value: 0.4 },
  { minute: at(14, 45), value: 0.68 },
  { minute: at(15, 15), value: 0.88 },
  { minute: at(15, 45), value: 0.99 },
  { minute: at(16, 30), value: 1.0 },
  { minute: at(17, 15), value: 0.86 },
  { minute: at(18, 0), value: 0.6 },
  { minute: at(18, 45), value: 0.34 },
  { minute: at(19, 30), value: 0.16 },
  { minute: at(21, 0), value: 0.07 },
];

const OUTBOUND_WINDOW = { start: at(3, 30), end: at(12, 0) };
const RETURN_WINDOW = { start: at(10, 30), end: at(21, 0) };
const STEP = 6;

export interface DemoTrafficOptions {
  failFor?: (route: AccessRoute) => boolean;
}

export class DemoTrafficProvider implements TrafficProvider {
  readonly id = 'demo-traffic';

  constructor(private readonly options: DemoTrafficOptions = {}) {}

  async getTravelCurve(
    route: AccessRoute,
    direction: 'outbound' | 'return',
    context: ProviderContext,
  ): Promise<Availability<TravelCurve>> {
    if (this.options.failFor?.(route)) {
      return unavailable(this.id, 'No route data returned for this corridor.');
    }

    const pattern = regionalPattern(
      context.date,
      context.horizonDays,
      CORRIDOR_REGION[route.corridorId] ?? 'i70-corridor',
    );
    const severity = CORRIDOR_SEVERITY[route.corridorId] ?? 0.5;
    const corridor = corridorFor(route.corridorId);
    const rng = createRng(hashSeed('demo-traffic', context.date, route.id, direction));

    const roadCondition = roadConditionFor(pattern.stormIntensity, route.weatherSensitivity, pattern.baseTempF);
    const roadDelayFactor = ROAD_DELAY[roadCondition];
    const stormMinutes = route.stormPenaltyMinutes * roadDelayFactor * route.weatherSensitivity;

    const incidents = generateIncidents(route, direction, pattern.stormIntensity, pattern.demandFactor, rng);
    const shape = direction === 'outbound' ? OUTBOUND_SHAPE : RETURN_SHAPE;
    const window = direction === 'outbound' ? OUTBOUND_WINDOW : RETURN_WINDOW;

    const samples: TravelSample[] = minuteRange(window.start, window.end, STEP).map((departure) => {
      /*
       * Two different numbers, on purpose. `shape` is where this departure
       * sits on the day's congestion curve, and it drives the delay so that
       * the valleys stay visible whatever the demand. `congestion` is what a
       * traffic feed would actually report — how jammed it is right now —
       * which is shape scaled by how many people are on the road. A Tuesday
       * at the top of the curve is genuinely not a Saturday at the top of it.
       */
      const shapeAt = clamp01(sampleCurve(shape, departure));
      const incidentDelay = incidents.reduce(
        (total, incident) => total + incidentDelayAt(incident, departure),
        0,
      );
      const duration =
        (route.freeFlowMinutes + stormMinutes) *
          (1 + shapeAt * severity * pattern.demandFactor) +
        incidentDelay;
      return {
        departure,
        durationMinutes: Math.round(duration),
        congestion: Math.round(clamp01(shapeAt * pattern.demandFactor) * 100) / 100,
      };
    });

    return ok(
      {
        routeId: route.id,
        routeLabel: route.label,
        corridorShorthand: corridor.shorthand,
        distanceMiles: route.distanceMiles,
        direction,
        samples,
        roadCondition,
        incidents,
      } satisfies TravelCurve,
      {
        source: 'demo',
        observation: observationForHorizon(context.horizonDays),
        confidence: confidenceForHorizon(context.horizonDays),
        provider: this.id,
        horizonDays: context.horizonDays,
      },
    );
  }
}

const ROAD_DELAY: Record<RoadCondition, number> = {
  clear: 0,
  wet: 0.35,
  'snow-packed': 1,
  'chains-required': 1.7,
  closed: 3,
};

export function roadConditionFor(
  stormIntensity: number,
  weatherSensitivity: number,
  temperatureF: number,
): RoadCondition {
  const exposure = stormIntensity * weatherSensitivity;
  if (exposure > 0.72) return 'chains-required';
  if (exposure > 0.42) return 'snow-packed';
  if (exposure > 0.16) return temperatureF > 30 ? 'wet' : 'snow-packed';
  return 'clear';
}

function generateIncidents(
  route: AccessRoute,
  direction: 'outbound' | 'return',
  stormIntensity: number,
  demandFactor: number,
  rng: ReturnType<typeof createRng>,
): TravelIncident[] {
  const risk = clamp(0.1 + stormIntensity * 0.45 + (demandFactor - 0.6) * 0.2, 0, 0.75);
  if (!rng.chance(risk)) return [];
  const minute =
    direction === 'outbound'
      ? Math.round(rng.range(at(5, 30), at(9, 30)))
      : Math.round(rng.range(at(13, 0), at(18, 0)));
  const kind = rng.pick([
    'Spun-out vehicle blocking the right lane',
    'Crash on the pass, one lane getting by',
    'Traction law in effect, slow rolling',
    'Jackknifed semi near the tunnel',
  ]);
  return [
    {
      minute,
      description: `${route.label}: ${kind.toLowerCase()}.`,
      delayMinutes: Math.round(rng.range(9, 38) * (1 + stormIntensity)),
    },
  ];
}

/** Incidents decay: leave well before or well after and you miss it entirely. */
function incidentDelayAt(incident: TravelIncident, departure: number): number {
  const spread = 75;
  const distance = Math.abs(departure - incident.minute);
  if (distance > spread) return 0;
  return incident.delayMinutes * (1 - distance / spread);
}
