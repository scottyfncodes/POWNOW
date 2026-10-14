import type { GeoPoint } from '@/domain/mountain';

const EARTH_RADIUS_MILES = 3958.8;
const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance between two points, in miles. Good enough for "which city is closest" — not for routing. */
export function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The closest of a list of points to `from`, by straight-line distance. */
export function nearest<T extends { coordinates: GeoPoint }>(from: GeoPoint, candidates: readonly T[]): T {
  if (candidates.length === 0) throw new Error('nearest() needs at least one candidate.');
  return candidates.reduce((closest, candidate) =>
    haversineMiles(from, candidate.coordinates) < haversineMiles(from, closest.coordinates) ? candidate : closest,
  );
}

/**
 * The IANA zone a ski day at this point runs on. Every mountain in the
 * dataset is in either Mountain time (Colorado, Utah, New Mexico) or Pacific
 * time (California, and Reno/Tahoe's Nevada side), and the Utah–Nevada line
 * at 114.05°W is the one boundary between them that matters here — Arizona
 * and Idaho, where it wouldn't hold, have no mountains in the dataset.
 */
export const PACIFIC_TIME_WEST_OF_LON = -114.05;

export function timeZoneForPoint(point: GeoPoint): 'America/Denver' | 'America/Los_Angeles' {
  return point.lon < PACIFIC_TIME_WEST_OF_LON ? 'America/Los_Angeles' : 'America/Denver';
}
