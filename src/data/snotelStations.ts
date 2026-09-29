import type { GeoPoint } from '@/domain/mountain';

/**
 * The SNOTEL station that stands witness for each mountain.
 *
 * SNOTEL (the NRCS SNOwpack TELemetry network) is the one source in this
 * project that *measures* snow rather than modeling it: a snow pillow, a
 * depth sensor and a precipitation gauge on a real pole, most of them a few
 * miles from a Colorado ski area at base-to-mid-mountain elevation. A
 * station is not the ski area — it is a nearby point at its own elevation,
 * and every reading the app shows names it, with its distance and elevation,
 * so "Vail Mountain SNOTEL, 10,300 ft" is never mistaken for the base of Vail.
 *
 * `expectedName` is a guard, not decoration. The live provider fetches the
 * station's own metadata and refuses to show a reading whose name doesn't
 * match the one recorded here — so a wrong id fails as UNAVAILABLE with a
 * reason, never as someone else's snow depth wearing this mountain's label.
 *
 * Every id, name, coordinate and elevation below was confirmed against the
 * NRCS AWDB API on 2026-09-28 through the deployed proxy (`/api/snotel`).
 */
export interface SnotelStation {
  /** NRCS station triplet, e.g. "842:CO:SNTL". */
  triplet: string;
  /** The station's name as NRCS publishes it; a live reading must match this. */
  expectedName: string;
  /** Approximate station location, for the distance shown next to a reading. */
  coordinates: GeoPoint;
  /** Published station elevation, feet. */
  elevationFt: number;
}

export const SNOTEL_STATIONS: Record<string, SnotelStation> = {
  vail: {
    triplet: '842:CO:SNTL',
    expectedName: 'Vail Mountain',
    coordinates: { lat: 39.61765, lon: -106.38019 },
    elevationFt: 10290,
  },
  'beaver-creek': {
    // No station on Beaver Creek itself; Vail Mountain is the nearest pillow.
    triplet: '842:CO:SNTL',
    expectedName: 'Vail Mountain',
    coordinates: { lat: 39.61765, lon: -106.38019 },
    elevationFt: 10290,
  },
  breckenridge: {
    triplet: '531:CO:SNTL',
    expectedName: 'Hoosier Pass',
    coordinates: { lat: 39.36092, lon: -106.05999 },
    elevationFt: 11600,
  },
  keystone: {
    triplet: '505:CO:SNTL',
    expectedName: 'Grizzly Peak',
    coordinates: { lat: 39.64646, lon: -105.8694 },
    elevationFt: 11110,
  },
  'arapahoe-basin': {
    triplet: '505:CO:SNTL',
    expectedName: 'Grizzly Peak',
    coordinates: { lat: 39.64646, lon: -105.8694 },
    elevationFt: 11110,
  },
  loveland: {
    triplet: '602:CO:SNTL',
    expectedName: 'Loveland Basin',
    coordinates: { lat: 39.67428, lon: -105.90264 },
    elevationFt: 11410,
  },
  copper: {
    triplet: '415:CO:SNTL',
    expectedName: 'Copper Mountain',
    coordinates: { lat: 39.48917, lon: -106.17154 },
    elevationFt: 10500,
  },
  'winter-park': {
    triplet: '335:CO:SNTL',
    expectedName: 'Berthoud Summit',
    coordinates: { lat: 39.80364, lon: -105.77786 },
    elevationFt: 11300,
  },
  eldora: {
    triplet: '564:CO:SNTL',
    expectedName: 'Lake Eldora',
    coordinates: { lat: 39.93659, lon: -105.59031 },
    elevationFt: 9700,
  },
  steamboat: {
    triplet: '709:CO:SNTL',
    expectedName: 'Rabbit Ears',
    coordinates: { lat: 40.36735, lon: -106.74118 },
    elevationFt: 9390,
  },
  'crested-butte': {
    triplet: '380:CO:SNTL',
    expectedName: 'Butte',
    coordinates: { lat: 38.89435, lon: -106.95327 },
    elevationFt: 10190,
  },
  purgatory: {
    triplet: '387:CO:SNTL',
    expectedName: 'Cascade #2',
    coordinates: { lat: 37.65751, lon: -107.80287 },
    elevationFt: 8990,
  },
  'wolf-creek': {
    triplet: '874:CO:SNTL',
    expectedName: 'Wolf Creek Summit',
    coordinates: { lat: 37.47903, lon: -106.80234 },
    elevationFt: 10930,
  },
};

export const snotelStationFor = (mountainId: string): SnotelStation | null =>
  SNOTEL_STATIONS[mountainId] ?? null;

/** NRCS's public report page for a station — where a person can check the same numbers. */
export const snotelReportUrl = (triplet: string): string => {
  const id = triplet.split(':')[0] ?? triplet;
  return `https://wcc.sc.egov.usda.gov/nwcc/site?sitenum=${id}`;
};

/**
 * Loose name match: NRCS names are things like "Vail Mountain" and callers
 * compare against the same; this tolerates case and punctuation only.
 */
export const stationNameMatches = (expected: string, actual: string | null | undefined): boolean => {
  if (!actual) return false;
  const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return norm(expected) === norm(actual);
};
