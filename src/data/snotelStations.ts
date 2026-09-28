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
 * `expectedName` is a guard, not decoration. The station ids below were
 * chosen from the published NRCS station list without a network path to
 * confirm them (the same constraint every live adapter in this project has
 * worked under). The live provider fetches the station's own metadata and
 * refuses to show a reading whose name doesn't match the one recorded here —
 * so a wrong id fails as UNAVAILABLE with a reason, never as someone else's
 * snow depth wearing this mountain's label.
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
    coordinates: { lat: 39.6183, lon: -106.3811 },
    elevationFt: 10300,
  },
  'beaver-creek': {
    // No station on Beaver Creek itself; Vail Mountain is the nearest pillow.
    triplet: '842:CO:SNTL',
    expectedName: 'Vail Mountain',
    coordinates: { lat: 39.6183, lon: -106.3811 },
    elevationFt: 10300,
  },
  breckenridge: {
    triplet: '531:CO:SNTL',
    expectedName: 'Hoosier Pass',
    coordinates: { lat: 39.3606, lon: -106.0606 },
    elevationFt: 11400,
  },
  keystone: {
    triplet: '505:CO:SNTL',
    expectedName: 'Grizzly Peak',
    coordinates: { lat: 39.6461, lon: -105.8697 },
    elevationFt: 11100,
  },
  'arapahoe-basin': {
    triplet: '505:CO:SNTL',
    expectedName: 'Grizzly Peak',
    coordinates: { lat: 39.6461, lon: -105.8697 },
    elevationFt: 11100,
  },
  loveland: {
    triplet: '602:CO:SNTL',
    expectedName: 'Loveland Basin',
    coordinates: { lat: 39.6742, lon: -105.9006 },
    elevationFt: 11400,
  },
  copper: {
    triplet: '415:CO:SNTL',
    expectedName: 'Copper Mountain',
    coordinates: { lat: 39.4894, lon: -106.1706 },
    elevationFt: 10550,
  },
  'winter-park': {
    triplet: '335:CO:SNTL',
    expectedName: 'Berthoud Summit',
    coordinates: { lat: 39.8039, lon: -105.7778 },
    elevationFt: 11300,
  },
  eldora: {
    triplet: '564:CO:SNTL',
    expectedName: 'Lake Eldora',
    coordinates: { lat: 39.9394, lon: -105.5828 },
    elevationFt: 9700,
  },
  steamboat: {
    triplet: '709:CO:SNTL',
    expectedName: 'Rabbit Ears',
    coordinates: { lat: 40.3706, lon: -106.7414 },
    elevationFt: 9400,
  },
  'crested-butte': {
    triplet: '380:CO:SNTL',
    expectedName: 'Butte',
    coordinates: { lat: 38.8944, lon: -106.9528 },
    elevationFt: 10160,
  },
  purgatory: {
    triplet: '387:CO:SNTL',
    expectedName: 'Cascade #2',
    coordinates: { lat: 37.6583, lon: -107.8042 },
    elevationFt: 8920,
  },
  'wolf-creek': {
    triplet: '874:CO:SNTL',
    expectedName: 'Wolf Creek Summit',
    coordinates: { lat: 37.4794, lon: -106.8011 },
    elevationFt: 11000,
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
