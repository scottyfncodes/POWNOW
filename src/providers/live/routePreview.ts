import type { GeoPoint } from '@/domain/mountain';
import { ProviderTimeoutError } from '@/lib/http';
import { decodePolyline } from '@/lib/polyline';
import { cachedJson } from './fetchCache';

/**
 * How long one preview is reused client-side. Shorter than the proxy's own
 * traffic window: this only has to cover a rider tapping between a few
 * mountains and back, so re-selecting one never costs a second request.
 */
const PREVIEW_TTL_MS = 5 * 60 * 1000;

/**
 * A single "right now" reading from the traffic proxy's `/api/route-preview`
 * endpoint — one Google Routes call, not a whole day's departure curve. Used
 * by the mountain map, which only ever needs one point-in-time duration and
 * distance for whichever mountain the user tapped, never a full curve.
 *
 * Deliberately separate from `LiveTrafficProvider` (which the optimiser's
 * whole-day pipeline uses): reusing that would cost up to 9 extra Google
 * calls per map tap for samples the map throws away.
 */
export interface RoutePreview {
  durationMinutes: number;
  distanceMiles: number | null;
  /**
   * The real driven road geometry, decoded from Google's polyline — `null`
   * when the proxy didn't return one, in which case the map draws a clearly
   * marked approximate line rather than a straight line pretending to be a road.
   */
  routePoints: GeoPoint[] | null;
}

export async function fetchRoutePreview(
  origin: GeoPoint,
  destination: GeoPoint,
  apiBaseUrl: string,
): Promise<RoutePreview> {
  const { value: payload } = await cachedJson<{
    durationMinutes?: number;
    distanceMiles?: number | null;
    polyline?: string | null;
  }>(`${apiBaseUrl}/api/route-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination }),
    timeoutMs: 10000,
    ttlMs: PREVIEW_TTL_MS,
  });
  if (typeof payload.durationMinutes !== 'number') {
    throw new Error('Route preview service returned no duration.');
  }
  return {
    durationMinutes: payload.durationMinutes,
    distanceMiles: typeof payload.distanceMiles === 'number' ? payload.distanceMiles : null,
    routePoints: typeof payload.polyline === 'string' && payload.polyline.length > 0 ? decodePolyline(payload.polyline) : null,
  };
}

/** A friendly, honest read on *why* it failed — never the raw status text. */
export function describeRoutePreviewFailure(error: unknown): { message: string; likelySlowWake: boolean } {
  if (error instanceof ProviderTimeoutError) {
    return {
      message: "The route service took too long to answer — it can nap when it's quiet and take a moment to wake up.",
      likelySlowWake: true,
    };
  }
  return { message: "Couldn't reach the route service.", likelySlowWake: false };
}
