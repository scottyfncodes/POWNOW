import { describe, expect, it } from 'vitest';
import { samplePoints } from '../../../server/index.mjs';
import { CDOT_ROUTES, eventMatches, isFullClosure, markersOf, normalizeRouteName, summarize, type RoadEvent } from './cotripRoad';

/**
 * Real events, captured from the live CDOT feed through the deployed proxy on
 * 2026-09-28 (Mountain time). The mocked tests in cotripRoad.test.ts pin the
 * contract; these pin the feed as CDOT actually writes it — which differed
 * from the documentation-shaped mocks in three ways that each made the
 * provider report a wrong answer.
 */
const idahoSpringsFire: RoadEvent = {
  kind: 'incident',
  routeName: 'I-70E',
  type: 'Vehicle Fire',
  description: 'At I-70 Business (Idaho Springs) at Mile Point 241.5. The right lane is closed due to a vehicle fire.',
  direction: 'east',
  startMarker: null,
  endMarker: null,
  laneImpacts: [
    { direction: 'east', laneCount: 3, laneClosures: '1000', closedLaneTypes: ['right lane'] },
    { direction: 'west', laneCount: 2, laneClosures: '0', closedLaneTypes: [] },
  ],
};

const avonMaintenance: RoadEvent = {
  kind: 'incident',
  routeName: 'I-70E',
  type: 'Maintenance Operations',
  description:
    'Between Exit 167: Avon and Exit 171: Minturn (near Avon) from Mile Point 168 to Mile Point 170. The left lane is closed due to road maintenance operations.',
  direction: 'east',
  startMarker: 168,
  endMarker: 170,
  laneImpacts: [
    { direction: 'east', laneCount: 2, laneClosures: 'c000', closedLaneTypes: ['left lane', 'left shoulder'] },
    { direction: 'west', laneCount: 2, laneClosures: '0', closedLaneTypes: [] },
  ],
};

const glenwoodTunnelRepair: RoadEvent = {
  kind: 'incident',
  routeName: 'I-70W',
  type: 'Maintenance Operations',
  description:
    'Between Exit 129: Bair Ranch (5 miles west of the Dotsero area) and Exit 125: Hanging Lake (5 miles east of the No Name area) from Mile Point 127 to Mile Point 125. The left lane is closed due to road maintenance operations.',
  direction: 'west',
  startMarker: 127,
  endMarker: 125,
};

/** CDOT typed it a crash; every lane is shut in both directions. */
const laJuntaCrash: RoadEvent = {
  kind: 'incident',
  routeName: 'CO-10E',
  type: '1 Vehicle Crash',
  description: 'At CO 71 (8 miles west of the La Junta area) at Mile Point 63. Road closed expect delays due to a crash.',
  direction: 'east',
  laneImpacts: [
    { direction: 'east', laneCount: 1, laneClosures: '4000', closedLaneTypes: ['through lanes'] },
    { direction: 'west', laneCount: 1, laneClosures: '4000', closedLaneTypes: ['through lanes'] },
  ],
};

/** One direction's through lanes "closed" — but it is alternating one-lane traffic, not a closure. */
const puebloAlternating: RoadEvent = {
  kind: 'incident',
  routeName: 'CO-96E',
  type: '1 Vehicle Crash',
  description:
    'Between Rex Road and Red Creek Springs Road (11 miles west of the Pueblo area) at Mile Point 40. Crash expect delays. There is alternating traffic. Slower speeds are advised.',
  direction: 'east',
  laneImpacts: [
    { direction: 'east', laneCount: 1, laneClosures: 'c001', closedLaneTypes: ['through lanes', 'right shoulder', 'left shoulder'] },
    { direction: 'west', laneCount: 1, laneClosures: '0', closedLaneTypes: [] },
  ],
};

/** "Road closed", and every southbound lane is shut: a real one-direction closure. */
const berkleyCrash: RoadEvent = {
  kind: 'incident',
  routeName: 'US-287N',
  type: '2 Vehicle Crash',
  description: 'At 65th Place (Berkley) at Mile Point 288. Road closed expect delays due to a crash.',
  direction: 'north',
  laneImpacts: [
    { direction: 'north', laneCount: 3, laneClosures: '0', closedLaneTypes: [] },
    { direction: 'south', laneCount: 3, laneClosures: '7000', closedLaneTypes: ['left lane', 'center lane', 'right lane'] },
  ],
};

const i70 = CDOT_ROUTES['i70-west']![0]!;

describe('CDOT, as the live feed actually writes it', () => {
  it('reads "I-70E", "CO-96E" and "US-287N" as I-70, CO 96 and US 287 — the suffix is a direction', () => {
    expect(normalizeRouteName('I-70E')).toBe(normalizeRouteName('I-70'));
    expect(normalizeRouteName('I-70W')).toBe(normalizeRouteName('Interstate 70'));
    expect(normalizeRouteName('CO-96E')).toBe(normalizeRouteName('CO 96'));
    expect(normalizeRouteName('US-287N')).toBe(normalizeRouteName('US 287'));
    expect(normalizeRouteName('State Highway 9')).toBe(normalizeRouteName('CO 9'));
    // A business or spur route is a different road, not a direction.
    expect(normalizeRouteName('US 36B')).not.toBe(normalizeRouteName('US 36'));
    expect(normalizeRouteName('US 24A')).not.toBe(normalizeRouteName('US 24'));
  });

  it('takes the mile marker from the message when CDOT leaves the marker fields empty', () => {
    expect(markersOf(idahoSpringsFire)).toEqual([241.5, 241.5]);
    expect(markersOf({ ...avonMaintenance, startMarker: null, endMarker: null })).toEqual([168, 170]);
    expect(markersOf({ kind: 'condition', routeName: 'I-70', description: '3 - dry' })).toBeNull();
  });

  it('puts the Idaho Springs and Avon incidents on the ski corridor, and Glenwood Canyon off it', () => {
    expect(eventMatches(idahoSpringsFire, i70)).toBe(true);
    expect(eventMatches(avonMaintenance, i70)).toBe(true);
    expect(eventMatches(glenwoodTunnelRepair, i70)).toBe(false);
  });

  it('places marker-less road-condition segments by their geometry', () => {
    const summitSegment: RoadEvent = { kind: 'condition', routeName: 'I-70', description: '8 - snow packed', points: [[39.63, -106.07], [39.55, -106.15]] };
    const grandJunctionSegment: RoadEvent = { kind: 'condition', routeName: 'I-70', description: '8 - snow packed', points: [[39.08, -108.5], [39.1, -108.3]] };
    expect(eventMatches(summitSegment, i70)).toBe(true);
    expect(eventMatches(grandJunctionSegment, i70)).toBe(false);
    // Snow in Grand Junction does not make the Denver–Vail drive snow-packed.
    expect(summarize([summitSegment].filter((e) => eventMatches(e, i70))).condition).toBe('snow-packed');
    expect(summarize([grandJunctionSegment].filter((e) => eventMatches(e, i70))).condition).toBe('clear');
  });

  it('never calls a lane closure a road closure', () => {
    expect(isFullClosure(idahoSpringsFire)).toBe(false);
    expect(isFullClosure(avonMaintenance)).toBe(false);
    expect(summarize([idahoSpringsFire, avonMaintenance]).closures).toEqual([]);
  });

  it('calls a crash that shuts every lane both ways a closure, whatever CDOT typed it as', () => {
    expect(isFullClosure(laJuntaCrash)).toBe(true);
    const result = summarize([laJuntaCrash]);
    expect(result.condition).toBe('closed');
    expect(result.closures[0]?.location).toBe('CO-10E east, MP 63');
  });

  it('tells alternating one-lane traffic apart from a real one-direction closure', () => {
    expect(isFullClosure(puebloAlternating)).toBe(false);
    expect(isFullClosure(berkleyCrash)).toBe(true);
  });
});

describe('samplePoints — the proxy places an event on the map', () => {
  it('flips GeoJSON [lon, lat] to [lat, lon] and keeps a handful of evenly spaced points', () => {
    const line = { type: 'LineString', coordinates: Array.from({ length: 21 }, (_, i) => [-106 - i * 0.01, 39.5 + i * 0.01]) };
    const points = samplePoints(line);
    expect(points).toHaveLength(5);
    expect(points[0]).toEqual([39.5, -106]);
    expect(points[4]).toEqual([39.7, -106.2]);
  });

  it('reads points and multi-lines, and returns nothing for a missing geometry', () => {
    expect(samplePoints({ type: 'Point', coordinates: [-105.5, 39.7] })).toEqual([[39.7, -105.5]]);
    expect(samplePoints({ type: 'MultiLineString', coordinates: [[[-105, 39], [-105.1, 39.1]], [[-105.2, 39.2]]] })).toHaveLength(3);
    expect(samplePoints(undefined)).toEqual([]);
    expect(samplePoints({ coordinates: [[999, 999]] })).toEqual([]);
  });
});
