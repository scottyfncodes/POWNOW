import type { Origin } from '@/domain/mountain';

/**
 * Starting points. POW NOW optimises HOME → MOUNTAIN → SNOW → MOUNTAIN → HOME,
 * so "where you sleep" is an input to the recommendation, not a setting.
 */
export const ORIGINS: Origin[] = [
  {
    id: 'denver',
    name: 'Denver',
    shortName: 'Denver',
    coordinates: { lat: 39.7392, lon: -104.9903 },
  },
  {
    id: 'boulder',
    name: 'Boulder',
    shortName: 'Boulder',
    coordinates: { lat: 40.015, lon: -105.2705 },
  },
  {
    id: 'fort-collins',
    name: 'Fort Collins',
    shortName: 'Fort Collins',
    coordinates: { lat: 40.5853, lon: -105.0844 },
  },
  {
    id: 'colorado-springs',
    name: 'Colorado Springs',
    shortName: 'Colo. Springs',
    coordinates: { lat: 38.8339, lon: -104.8214 },
  },
  {
    id: 'durango',
    name: 'Durango',
    shortName: 'Durango',
    coordinates: { lat: 37.2753, lon: -107.8801 },
  },
  {
    id: 'frisco',
    name: 'Frisco (Summit County)',
    shortName: 'Frisco',
    coordinates: { lat: 39.5744, lon: -106.0973 },
  },
];

export const DEFAULT_ORIGIN_ID = 'denver';

export const findOrigin = (id: string): Origin =>
  ORIGINS.find((origin) => origin.id === id) ?? (ORIGINS[0] as Origin);

/** The stable id every GPS-based origin carries, regardless of the actual coordinate. */
export const GPS_ORIGIN_ID = 'gps';

export const isManualCityOrigin = (originId: string): boolean =>
  ORIGINS.some((origin) => origin.id === originId);

/**
 * The user's exact GPS fix, used directly as the routing origin — never
 * snapped to whichever of the six cities happens to be closest. Every
 * mountain's live route to this point is computed by `engine/routing.ts`
 * from these coordinates and handed to Google Routes as-is.
 */
export const gpsOrigin = (latitude: number, longitude: number): Origin => ({
  id: GPS_ORIGIN_ID,
  name: 'Your current location',
  shortName: 'your location',
  coordinates: { lat: latitude, lon: longitude },
});
