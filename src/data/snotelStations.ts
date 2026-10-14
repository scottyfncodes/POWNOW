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
 * NRCS AWDB API through the deployed proxy (`/api/snotel`) — the original
 * Colorado fifteen on 2026-09-28/29, the rest on 2026-10-14. Not every
 * mountain has one; see the note above the later entries.
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
  monarch: {
    // On Monarch Pass itself, a mile south of the lifts.
    triplet: '701:CO:SNTL',
    expectedName: 'Porphyry Creek',
    coordinates: { lat: 38.48864, lon: -106.33967 },
    elevationFt: 10790,
  },
  telluride: {
    // The nearest pillow is on the pass south of town; no station sits in the box canyon itself.
    triplet: '586:CO:SNTL',
    expectedName: 'Lizard Head Pass',
    coordinates: { lat: 37.79895, lon: -107.92475 },
    elevationFt: 10190,
  },
  'wolf-creek': {
    triplet: '874:CO:SNTL',
    expectedName: 'Wolf Creek Summit',
    coordinates: { lat: 37.47903, lon: -106.80234 },
    elevationFt: 10930,
  },
  // Added with the Utah, New Mexico and California batch (and the rest of
  // Colorado). Each triplet was resolved through the deployed proxy
  // (`/api/snotel`) on 2026-10-14, and only stations within ~12 miles of the
  // mountain were kept. The Aspen four, Sunlight, Echo, Granby Ranch, Brian
  // Head, Angel Fire, Sipapu, Dodge Ridge, China Peak, Badger Pass, Mammoth,
  // June, the Southern California hills and Mt. Shasta have no SNOTEL
  // station close enough to stand witness, so they report unavailable rather
  // than borrow a reading from the other side of a range.
  silverton: { triplet: '713:CO:SNTL', expectedName: 'Red Mountain Pass', coordinates: { lat: 37.89168, lon: -107.71389 }, elevationFt: 11060 },
  'ski-cooper': { triplet: '485:CO:SNTL', expectedName: 'Fremont Pass', coordinates: { lat: 39.38014, lon: -106.19784 }, elevationFt: 11310 },
  powderhorn: { triplet: '622:CO:SNTL', expectedName: 'Mesa Lakes', coordinates: { lat: 39.05738, lon: -108.05756 }, elevationFt: 10160 },
  'howelsen-hill': { triplet: '457:CO:SNTL', expectedName: 'Dry Lake', coordinates: { lat: 40.5337, lon: -106.7814 }, elevationFt: 8240 },
  alta: { triplet: '766:UT:SNTL', expectedName: 'Snowbird', coordinates: { lat: 40.56914, lon: -111.65852 }, elevationFt: 9170 },
  snowbird: { triplet: '766:UT:SNTL', expectedName: 'Snowbird', coordinates: { lat: 40.56914, lon: -111.65852 }, elevationFt: 9170 },
  brighton: { triplet: '366:UT:SNTL', expectedName: 'Brighton', coordinates: { lat: 40.59936, lon: -111.58167 }, elevationFt: 8790 },
  solitude: { triplet: '366:UT:SNTL', expectedName: 'Brighton', coordinates: { lat: 40.59936, lon: -111.58167 }, elevationFt: 8790 },
  'park-city': { triplet: '814:UT:SNTL', expectedName: 'Thaynes Canyon', coordinates: { lat: 40.6235, lon: -111.53322 }, elevationFt: 9260 },
  'deer-valley': { triplet: '814:UT:SNTL', expectedName: 'Thaynes Canyon', coordinates: { lat: 40.6235, lon: -111.53322 }, elevationFt: 9260 },
  snowbasin: { triplet: '332:UT:SNTL', expectedName: 'Ben Lomond Peak', coordinates: { lat: 41.37603, lon: -111.94405 }, elevationFt: 7690 },
  'powder-mountain': { triplet: '332:UT:SNTL', expectedName: 'Ben Lomond Peak', coordinates: { lat: 41.37603, lon: -111.94405 }, elevationFt: 7690 },
  'nordic-valley': { triplet: '332:UT:SNTL', expectedName: 'Ben Lomond Peak', coordinates: { lat: 41.37603, lon: -111.94405 }, elevationFt: 7690 },
  sundance: { triplet: '820:UT:SNTL', expectedName: 'Timpanogos Divide', coordinates: { lat: 40.42817, lon: -111.61633 }, elevationFt: 8180 },
  'beaver-mountain': { triplet: '823:UT:SNTL', expectedName: 'Tony Grove Lake', coordinates: { lat: 41.89833, lon: -111.62957 }, elevationFt: 8450 },
  'cherry-peak': { triplet: '823:UT:SNTL', expectedName: 'Tony Grove Lake', coordinates: { lat: 41.89833, lon: -111.62957 }, elevationFt: 8450 },
  taos: { triplet: '1168:NM:SNTL', expectedName: 'Taos Powderhorn', coordinates: { lat: 36.58195, lon: -105.45617 }, elevationFt: 11020 },
  'red-river': { triplet: '1168:NM:SNTL', expectedName: 'Taos Powderhorn', coordinates: { lat: 36.58195, lon: -105.45617 }, elevationFt: 11020 },
  'ski-santa-fe': { triplet: '922:NM:SNTL', expectedName: 'Santa Fe', coordinates: { lat: 35.77154, lon: -105.78487 }, elevationFt: 11480 },
  pajarito: { triplet: '708:NM:SNTL', expectedName: 'Quemazon', coordinates: { lat: 35.92195, lon: -106.39179 }, elevationFt: 9500 },
  'ski-apache': { triplet: '1034:NM:SNTL', expectedName: 'Sierra Blanca', coordinates: { lat: 33.40682, lon: -105.79467 }, elevationFt: 10250 },
  'palisades-tahoe': { triplet: '784:CA:SNTL', expectedName: 'Palisades Tahoe', coordinates: { lat: 39.18986, lon: -120.26576 }, elevationFt: 8010 },
  northstar: { triplet: '834:CA:SNTL', expectedName: 'Truckee #2', coordinates: { lat: 39.30087, lon: -120.18407 }, elevationFt: 6500 },
  heavenly: { triplet: '518:CA:SNTL', expectedName: 'Heavenly Valley', coordinates: { lat: 38.92431, lon: -119.91641 }, elevationFt: 8540 },
  kirkwood: { triplet: '356:CA:SNTL', expectedName: 'Blue Lakes', coordinates: { lat: 38.60801, lon: -119.92455 }, elevationFt: 8060 },
  'sierra-at-tahoe': { triplet: '463:CA:SNTL', expectedName: 'Echo Peak', coordinates: { lat: 38.849, lon: -120.0795 }, elevationFt: 7650 },
  'sugar-bowl': { triplet: '428:CA:SNTL', expectedName: 'Css Lab', coordinates: { lat: 39.32565, lon: -120.36807 }, elevationFt: 6890 },
  boreal: { triplet: '428:CA:SNTL', expectedName: 'Css Lab', coordinates: { lat: 39.32565, lon: -120.36807 }, elevationFt: 6890 },
  'soda-springs': { triplet: '428:CA:SNTL', expectedName: 'Css Lab', coordinates: { lat: 39.32565, lon: -120.36807 }, elevationFt: 6890 },
  'donner-ski-ranch': { triplet: '428:CA:SNTL', expectedName: 'Css Lab', coordinates: { lat: 39.32565, lon: -120.36807 }, elevationFt: 6890 },
  'tahoe-donner': { triplet: '834:CA:SNTL', expectedName: 'Truckee #2', coordinates: { lat: 39.30087, lon: -120.18407 }, elevationFt: 6500 },
  'bear-valley': { triplet: '356:CA:SNTL', expectedName: 'Blue Lakes', coordinates: { lat: 38.60801, lon: -119.92455 }, elevationFt: 8060 },
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
