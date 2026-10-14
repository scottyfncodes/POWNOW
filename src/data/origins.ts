import type { Origin } from '@/domain/mountain';

/**
 * Starting points. POW NOW optimises HOME → MOUNTAIN → SNOW → MOUNTAIN → HOME,
 * so "where you sleep" is an input to the recommendation, not a setting.
 *
 * Grouped by the state whose mountains each city mostly feeds. Reno sits in
 * Nevada but is the Tahoe gateway, so it's filed with California, where its
 * mountains are; Las Vegas is filed with Utah for the same reason (Brian Head
 * and Eagle Point are its nearest real snow).
 */
export const ORIGINS: Origin[] = [
  { id: 'denver', name: 'Denver', shortName: 'Denver', state: 'CO', coordinates: { lat: 39.7392, lon: -104.9903 } },
  { id: 'boulder', name: 'Boulder', shortName: 'Boulder', state: 'CO', coordinates: { lat: 40.015, lon: -105.2705 } },
  { id: 'fort-collins', name: 'Fort Collins', shortName: 'Fort Collins', state: 'CO', coordinates: { lat: 40.5853, lon: -105.0844 } },
  { id: 'colorado-springs', name: 'Colorado Springs', shortName: 'Colo. Springs', state: 'CO', coordinates: { lat: 38.8339, lon: -104.8214 } },
  { id: 'durango', name: 'Durango', shortName: 'Durango', state: 'CO', coordinates: { lat: 37.2753, lon: -107.8801 } },
  { id: 'frisco', name: 'Frisco (Summit County)', shortName: 'Frisco', state: 'CO', coordinates: { lat: 39.5744, lon: -106.0973 } },
  { id: 'grand-junction', name: 'Grand Junction', shortName: 'Grand Jct.', state: 'CO', coordinates: { lat: 39.0639, lon: -108.5506 } },
  { id: 'salt-lake-city', name: 'Salt Lake City', shortName: 'SLC', state: 'UT', coordinates: { lat: 40.7608, lon: -111.891 } },
  { id: 'ogden', name: 'Ogden', shortName: 'Ogden', state: 'UT', coordinates: { lat: 41.223, lon: -111.9738 } },
  { id: 'las-vegas', name: 'Las Vegas', shortName: 'Las Vegas', state: 'UT', coordinates: { lat: 36.1699, lon: -115.1398 } },
  { id: 'albuquerque', name: 'Albuquerque', shortName: 'Albuquerque', state: 'NM', coordinates: { lat: 35.0844, lon: -106.6504 } },
  { id: 'santa-fe', name: 'Santa Fe', shortName: 'Santa Fe', state: 'NM', coordinates: { lat: 35.687, lon: -105.9378 } },
  { id: 'san-francisco', name: 'San Francisco Bay Area', shortName: 'Bay Area', state: 'CA', coordinates: { lat: 37.7749, lon: -122.4194 } },
  { id: 'sacramento', name: 'Sacramento', shortName: 'Sacramento', state: 'CA', coordinates: { lat: 38.5816, lon: -121.4944 } },
  { id: 'reno', name: 'Reno', shortName: 'Reno', state: 'CA', coordinates: { lat: 39.5296, lon: -119.8138 } },
  { id: 'fresno', name: 'Fresno', shortName: 'Fresno', state: 'CA', coordinates: { lat: 36.7378, lon: -119.7871 } },
  { id: 'los-angeles', name: 'Los Angeles', shortName: 'LA', state: 'CA', coordinates: { lat: 34.0522, lon: -118.2437 } },
  { id: 'san-diego', name: 'San Diego', shortName: 'San Diego', state: 'CA', coordinates: { lat: 32.7157, lon: -117.1611 } },
];

export const DEFAULT_ORIGIN_ID = 'denver';

/** The order and names the starting-city list groups its cities under. */
export const ORIGIN_STATE_LABELS: Record<string, string> = {
  CO: 'Colorado',
  UT: 'Utah',
  NM: 'New Mexico',
  CA: 'California',
};

export const findOrigin = (id: string): Origin =>
  ORIGINS.find((origin) => origin.id === id) ?? (ORIGINS[0] as Origin);

/** The stable id every GPS-based origin carries, regardless of the actual coordinate. */
export const GPS_ORIGIN_ID = 'gps';

export const isManualCityOrigin = (originId: string): boolean =>
  ORIGINS.some((origin) => origin.id === originId);

/**
 * The user's exact GPS fix, used directly as the routing origin — never
 * snapped to whichever of the manual cities happens to be closest. Every
 * mountain's live route to this point is computed by `engine/routing.ts`
 * from these coordinates and handed to Google Routes as-is.
 */
export const gpsOrigin = (latitude: number, longitude: number): Origin => ({
  id: GPS_ORIGIN_ID,
  name: 'Your current location',
  shortName: 'your location',
  coordinates: { lat: latitude, lon: longitude },
});
