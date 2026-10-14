import { findOrigin } from '@/data/origins';
import type { AccessRoute, GeoPoint } from '@/domain/mountain';

/** One hand-authored drive from a starting city — the data a mountain entry writes. */
export interface RouteSpec {
  originId: string;
  label: string;
  corridorId: string;
  miles: number;
  freeFlow: number;
  stormPenalty: number;
  weatherSensitivity: number;
  primary?: boolean;
}

export const buildRoutes = (
  mountainId: string,
  destinationPoint: GeoPoint,
  specs: RouteSpec[],
): AccessRoute[] =>
  specs.map((spec, index) => ({
    id: `${mountainId}:${spec.originId}:${index}`,
    originId: spec.originId,
    label: spec.label,
    corridorId: spec.corridorId,
    originPoint: findOrigin(spec.originId).coordinates,
    destinationPoint,
    distanceMiles: spec.miles,
    freeFlowMinutes: spec.freeFlow,
    stormPenaltyMinutes: spec.stormPenalty,
    weatherSensitivity: spec.weatherSensitivity,
    isPrimary: spec.primary ?? index === 0,
  }));
