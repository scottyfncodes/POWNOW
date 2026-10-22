import { buildRoutes } from '@/data/buildRoutes';
import { TBD_DATE } from '@/domain/mountainProfile';
import { at } from '@/domain/time';
import type { RegionDataset } from './types';

/**
 * The rest of Colorado — the eleven lift-served mountains the original
 * fifteen in `data/mountains.ts` left out: the four Aspen Snowmass mountains,
 * Silverton, Ski Cooper, Sunlight, Powderhorn, Echo Mountain, Granby Ranch
 * and Howelsen Hill.
 *
 * Researched October 2026 via web search, ahead of the 2026-27 season. This
 * sandbox's fetch tool could not reach any resort site (DNS blocked), so
 * nothing here is fetch-verified: every URL is one that appeared in search
 * results, never pattern-guessed from a sibling page, and phones/addresses
 * that search did not surface are `null` rather than recalled. The search
 * budget ran out before phone/address checks for Ski Cooper, Echo, Granby
 * Ranch, Powderhorn and the Aspen mountains could run — those are `null` on
 * purpose, not because they don't exist. A human with a normal browser
 * should spot-check before leaning on any of it.
 *
 * Pass notes (2026-27): the four Aspen Snowmass mountains are Ikon (7 days
 * across all four on the full pass; Base Pass is now 5 days at Snowmass only)
 * and Mountain Collective (retained all destinations for 2026-27). Sunlight,
 * Powderhorn, Echo Mountain, Granby Ranch and Howelsen Hill are on Indy
 * Pass's Colorado list. Ski Cooper is *not* — it left Indy's orbit in the
 * 2023 dispute over its own reciprocal pass and now runs on Powder Alliance /
 * Freedom Pass reciprocity, neither of which this app models, so it reads
 * `independent`. Silverton is independent.
 *
 * Deliberately omitted (checked, not forgotten):
 *  - Hesperus Ski Area (near Durango): closed 2023-24 through 2025-26 with a
 *    failed gearbox on its only chairlift and no snowmaking; no 2026-27
 *    reopening announced.
 *  - Cuchara Mountain Park: Lift 4 reopened January 2026 after 25 years — a
 *    nonprofit, weekends-only, 300 ft / 47-acre beginner-intermediate hill.
 *    Genuinely operating, but not a ski-day decision anyone drives to make;
 *    revisit if it grows.
 *  - Kendall Mountain (Silverton town hill) and Lake City Ski Hill: tiny
 *    single-lift community hills with limited weekly hours.
 */
export const COLORADO: RegionDataset = {
  mountains: [
    {
      id: 'aspen-mountain',
      name: 'Aspen Mountain (Ajax)',
      shortName: 'AJAX',
      region: 'Roaring Fork Valley',
      snowRegion: 'i70-corridor',
      state: 'CO',
      country: 'US',
      coordinates: { lat: 39.1868, lon: -106.818 },
      elevations: { baseFt: 7945, summitFt: 11212, verticalFt: 3267 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(15, 30),
        upperMountainOpenOffset: 10,
      },
      lifts: { total: 9, highSpeed: 3, windExposed: 2 },
      terrain: { trails: 76, acres: 828, aboveTreelineShare: 0.04, lateOpeningShare: 0.3 },
      weatherLocation: {
        point: { lat: 39.172, lon: -106.819 },
        forecastElevationFt: 9600,
        aspect: 'west-facing',
      },
      accessRoutes: buildRoutes('aspen-mountain', { lat: 39.1868, lon: -106.818 }, [
        { originId: 'denver', label: 'I-70 west to Glenwood Springs, CO-82 up valley', corridorId: 'i70-west', miles: 200, freeFlow: 220, stormPenalty: 34, weatherSensitivity: 0.68, primary: true },
        { originId: 'boulder', label: 'CO-93 to I-70 west, CO-82 up valley', corridorId: 'i70-west', miles: 218, freeFlow: 236, stormPenalty: 36, weatherSensitivity: 0.68 },
        { originId: 'fort-collins', label: 'I-25 to I-70 west, CO-82 up valley', corridorId: 'i70-west', miles: 245, freeFlow: 268, stormPenalty: 38, weatherSensitivity: 0.66 },
        { originId: 'colorado-springs', label: 'I-25 to I-70 west, CO-82 up valley', corridorId: 'i70-west', miles: 268, freeFlow: 288, stormPenalty: 38, weatherSensitivity: 0.64 },
        { originId: 'frisco', label: 'I-70 west over Vail Pass, CO-82 up valley', corridorId: 'i70-west', miles: 131, freeFlow: 138, stormPenalty: 28, weatherSensitivity: 0.7 },
        { originId: 'grand-junction', label: 'I-70 east to Glenwood Springs, CO-82 up valley', corridorId: 'co82-roaring-fork', miles: 130, freeFlow: 135, stormPenalty: 20, weatherSensitivity: 0.45 },
      ]),
      passAffiliations: ['ikon', 'mountain-collective'],
      popularity: 0.6,
      character: 'The gondola leaves from downtown, there is not a single green run, and Hero\'s finally gave Ajax new steeps for the first time since 1985.',
    },
    {
      id: 'aspen-highlands',
      name: 'Aspen Highlands',
      shortName: 'HIGHLANDS',
      region: 'Roaring Fork Valley',
      snowRegion: 'i70-corridor',
      state: 'CO',
      country: 'US',
      coordinates: { lat: 39.1822, lon: -106.8556 },
      // Aspen Snowmass's headline figures are lift-served (top of Loge Peak,
      // 11,675 ft). Highland Bowl's bootpack tops out at 12,392 ft — about
      // 4,350 ft of total drop — but that's hiked, not lifted.
      elevations: { baseFt: 8040, summitFt: 11675, verticalFt: 3635 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(15, 30),
        upperMountainOpenOffset: 30,
      },
      lifts: { total: 5, highSpeed: 4, windExposed: 2 },
      terrain: { trails: 118, acres: 1040, aboveTreelineShare: 0.3, lateOpeningShare: 0.4 },
      weatherLocation: {
        point: { lat: 39.158, lon: -106.857 },
        forecastElevationFt: 10200,
        aspect: 'west-facing',
      },
      accessRoutes: buildRoutes('aspen-highlands', { lat: 39.1822, lon: -106.8556 }, [
        { originId: 'denver', label: 'I-70 west to Glenwood Springs, CO-82 up valley', corridorId: 'i70-west', miles: 199, freeFlow: 218, stormPenalty: 34, weatherSensitivity: 0.68, primary: true },
        { originId: 'boulder', label: 'CO-93 to I-70 west, CO-82 up valley', corridorId: 'i70-west', miles: 217, freeFlow: 234, stormPenalty: 36, weatherSensitivity: 0.68 },
        { originId: 'fort-collins', label: 'I-25 to I-70 west, CO-82 up valley', corridorId: 'i70-west', miles: 244, freeFlow: 266, stormPenalty: 38, weatherSensitivity: 0.66 },
        { originId: 'colorado-springs', label: 'I-25 to I-70 west, CO-82 up valley', corridorId: 'i70-west', miles: 267, freeFlow: 286, stormPenalty: 38, weatherSensitivity: 0.64 },
        { originId: 'frisco', label: 'I-70 west over Vail Pass, CO-82 up valley', corridorId: 'i70-west', miles: 130, freeFlow: 136, stormPenalty: 28, weatherSensitivity: 0.7 },
        { originId: 'grand-junction', label: 'I-70 east to Glenwood Springs, CO-82 up valley', corridorId: 'co82-roaring-fork', miles: 129, freeFlow: 133, stormPenalty: 20, weatherSensitivity: 0.45 },
      ]),
      passAffiliations: ['ikon', 'mountain-collective'],
      popularity: 0.5,
      character: 'Highland Bowl is a 45-minute bootpack to 48-degree pitches, and Cloud Nine is dancing on the tables by 2:30.',
    },
    {
      id: 'buttermilk',
      name: 'Buttermilk',
      shortName: 'BUTTERMILK',
      region: 'Roaring Fork Valley',
      snowRegion: 'i70-corridor',
      state: 'CO',
      country: 'US',
      coordinates: { lat: 39.2058, lon: -106.8603 },
      elevations: { baseFt: 7870, summitFt: 9900, verticalFt: 2030 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(15, 30),
        upperMountainOpenOffset: 0,
      },
      lifts: { total: 8, highSpeed: 3, windExposed: 1 },
      terrain: { trails: 44, acres: 470, aboveTreelineShare: 0, lateOpeningShare: 0.15 },
      weatherLocation: {
        point: { lat: 39.192, lon: -106.874 },
        forecastElevationFt: 8900,
        aspect: 'west-facing',
      },
      accessRoutes: buildRoutes('buttermilk', { lat: 39.2058, lon: -106.8603 }, [
        { originId: 'denver', label: 'I-70 west to Glenwood Springs, CO-82 up valley', corridorId: 'i70-west', miles: 197, freeFlow: 214, stormPenalty: 34, weatherSensitivity: 0.68, primary: true },
        { originId: 'boulder', label: 'CO-93 to I-70 west, CO-82 up valley', corridorId: 'i70-west', miles: 215, freeFlow: 230, stormPenalty: 36, weatherSensitivity: 0.68 },
        { originId: 'fort-collins', label: 'I-25 to I-70 west, CO-82 up valley', corridorId: 'i70-west', miles: 242, freeFlow: 262, stormPenalty: 38, weatherSensitivity: 0.66 },
        { originId: 'colorado-springs', label: 'I-25 to I-70 west, CO-82 up valley', corridorId: 'i70-west', miles: 265, freeFlow: 282, stormPenalty: 38, weatherSensitivity: 0.64 },
        { originId: 'frisco', label: 'I-70 west over Vail Pass, CO-82 up valley', corridorId: 'i70-west', miles: 128, freeFlow: 132, stormPenalty: 28, weatherSensitivity: 0.7 },
        { originId: 'grand-junction', label: 'I-70 east to Glenwood Springs, CO-82 up valley', corridorId: 'co82-roaring-fork', miles: 127, freeFlow: 129, stormPenalty: 20, weatherSensitivity: 0.45 },
      ]),
      passAffiliations: ['ikon', 'mountain-collective'],
      popularity: 0.3,
      character: 'The X Games hill the rest of the year is Aspen\'s gentlest, sunniest, emptiest groomers, on the same ticket.',
    },
    {
      id: 'snowmass',
      name: 'Snowmass',
      shortName: 'SNOWMASS',
      region: 'Roaring Fork Valley',
      snowRegion: 'i70-corridor',
      state: 'CO',
      country: 'US',
      coordinates: { lat: 39.2087, lon: -106.9497 },
      elevations: { baseFt: 8104, summitFt: 12510, verticalFt: 4406 },
      operations: {
        weekdayOpen: at(8, 30),
        weekendOpen: at(8, 30),
        lastChair: at(15, 30),
        upperMountainOpenOffset: 30,
      },
      lifts: { total: 20, highSpeed: 10, windExposed: 5 },
      terrain: { trails: 96, acres: 3332, aboveTreelineShare: 0.25, lateOpeningShare: 0.25 },
      weatherLocation: {
        point: { lat: 39.192, lon: -106.966 },
        forecastElevationFt: 10300,
        aspect: 'west-facing',
      },
      accessRoutes: buildRoutes('snowmass', { lat: 39.2087, lon: -106.9497 }, [
        { originId: 'denver', label: 'I-70 west to Glenwood Springs, CO-82 to Brush Creek Rd', corridorId: 'i70-west', miles: 197, freeFlow: 216, stormPenalty: 34, weatherSensitivity: 0.68, primary: true },
        { originId: 'boulder', label: 'CO-93 to I-70 west, CO-82 to Brush Creek Rd', corridorId: 'i70-west', miles: 215, freeFlow: 232, stormPenalty: 36, weatherSensitivity: 0.68 },
        { originId: 'fort-collins', label: 'I-25 to I-70 west, CO-82 to Brush Creek Rd', corridorId: 'i70-west', miles: 242, freeFlow: 264, stormPenalty: 38, weatherSensitivity: 0.66 },
        { originId: 'colorado-springs', label: 'I-25 to I-70 west, CO-82 to Brush Creek Rd', corridorId: 'i70-west', miles: 265, freeFlow: 284, stormPenalty: 38, weatherSensitivity: 0.64 },
        { originId: 'frisco', label: 'I-70 west over Vail Pass, CO-82 to Brush Creek Rd', corridorId: 'i70-west', miles: 128, freeFlow: 134, stormPenalty: 28, weatherSensitivity: 0.7 },
        { originId: 'grand-junction', label: 'I-70 east to Glenwood Springs, CO-82 to Brush Creek Rd', corridorId: 'co82-roaring-fork', miles: 127, freeFlow: 131, stormPenalty: 20, weatherSensitivity: 0.45 },
      ]),
      passAffiliations: ['ikon', 'mountain-collective'],
      popularity: 0.65,
      character: 'Over 4,400 vertical feet and 3,300 acres: the biggest mountain in the valley, and it skis like it, from Elk Camp cruisers to the Cirque headwall.',
    },
    {
      id: 'silverton',
      name: 'Silverton Mountain',
      shortName: 'SILVERTON',
      region: 'San Juans',
      snowRegion: 'san-juans',
      state: 'CO',
      country: 'US',
      coordinates: { lat: 37.8846, lon: -107.6656 },
      // Peak 13,487 ft is the hike-to summit; the single chair tops out at
      // 12,300 ft (1,900 ft lift-served vertical). Recorded with the hike,
      // as Silverton itself headlines it — same convention as Telluride.
      elevations: { baseFt: 10400, summitFt: 13487, verticalFt: 3087 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(15, 0),
        upperMountainOpenOffset: 0,
      },
      lifts: { total: 1, highSpeed: 0, windExposed: 1 },
      terrain: { trails: 69, acres: 1819, aboveTreelineShare: 0.7, lateOpeningShare: 0.6 },
      weatherLocation: {
        point: { lat: 37.888, lon: -107.68 },
        forecastElevationFt: 11500,
        aspect: 'west-facing',
      },
      accessRoutes: buildRoutes('silverton', { lat: 37.8846, lon: -107.6656 }, [
        { originId: 'durango', label: 'US-550 north over Coal Bank & Molas passes, CO-110', corridorId: 'us550-durango', miles: 55, freeFlow: 85, stormPenalty: 35, weatherSensitivity: 0.92, primary: true },
        { originId: 'grand-junction', label: 'US-50 to Montrose, US-550 over Red Mountain Pass', corridorId: 'us550-durango', miles: 128, freeFlow: 170, stormPenalty: 40, weatherSensitivity: 0.92 },
        { originId: 'colorado-springs', label: 'US-50 over Monarch Pass to Montrose, US-550 south', corridorId: 'us50-monarch', miles: 300, freeFlow: 345, stormPenalty: 45, weatherSensitivity: 0.85 },
        { originId: 'denver', label: 'US-285 to US-50 over Monarch Pass, US-550 over Red Mountain Pass', corridorId: 'us50-monarch', miles: 345, freeFlow: 385, stormPenalty: 45, weatherSensitivity: 0.85 },
      ]),
      passAffiliations: ['independent'],
      popularity: 0.15,
      character: 'One old double chair, no groomers, a guide and an avalanche beacon. The steepest lift-served skiing in the country, Thursday to Sunday only.',
    },
    {
      id: 'ski-cooper',
      name: 'Ski Cooper',
      shortName: 'COOPER',
      region: 'Tennessee Pass',
      snowRegion: 'i70-corridor',
      state: 'CO',
      country: 'US',
      coordinates: { lat: 39.361, lon: -106.301 },
      elevations: { baseFt: 10500, summitFt: 11700, verticalFt: 1200 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 0,
      },
      lifts: { total: 5, highSpeed: 0, windExposed: 2 },
      terrain: { trails: 64, acres: 480, aboveTreelineShare: 0.1, lateOpeningShare: 0.15 },
      weatherLocation: {
        point: { lat: 39.364, lon: -106.294 },
        forecastElevationFt: 11100,
        // Tennessee Pass sits on the Continental Divide.
        aspect: 'divide',
      },
      accessRoutes: buildRoutes('ski-cooper', { lat: 39.361, lon: -106.301 }, [
        { originId: 'denver', label: 'I-70 west, CO-91 over Fremont Pass to Leadville, US-24 north', corridorId: 'i70-west', miles: 112, freeFlow: 128, stormPenalty: 28, weatherSensitivity: 0.75, primary: true },
        { originId: 'boulder', label: 'CO-93 to I-70 west, CO-91 over Fremont Pass', corridorId: 'i70-west', miles: 130, freeFlow: 144, stormPenalty: 30, weatherSensitivity: 0.75 },
        { originId: 'fort-collins', label: 'I-25 to I-70 west, CO-91 over Fremont Pass', corridorId: 'i70-west', miles: 157, freeFlow: 175, stormPenalty: 32, weatherSensitivity: 0.73 },
        { originId: 'colorado-springs', label: 'US-24 over Wilkerson Pass to Buena Vista and Leadville', corridorId: 'us24-buena-vista', miles: 139, freeFlow: 165, stormPenalty: 30, weatherSensitivity: 0.75 },
        { originId: 'frisco', label: 'CO-91 over Fremont Pass to Leadville, US-24 north', corridorId: 'us24-buena-vista', miles: 40, freeFlow: 52, stormPenalty: 18, weatherSensitivity: 0.75 },
        { originId: 'grand-junction', label: 'I-70 east to Minturn, US-24 south over Battle Mountain', corridorId: 'i70-west', miles: 169, freeFlow: 178, stormPenalty: 30, weatherSensitivity: 0.7 },
      ]),
      passAffiliations: ['independent'],
      popularity: 0.25,
      character: 'Built by the 10th Mountain Division, run by the county, and the whole hill is low-angle and empty, with snowcat powder on Chicago Ridge next door.',
    },
    {
      id: 'sunlight',
      name: 'Sunlight Mountain',
      shortName: 'SUNLIGHT',
      region: 'Glenwood Springs',
      snowRegion: 'i70-corridor',
      state: 'CO',
      country: 'US',
      coordinates: { lat: 39.3995, lon: -107.3384 },
      elevations: { baseFt: 7885, summitFt: 9895, verticalFt: 2010 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 0,
      },
      lifts: { total: 3, highSpeed: 0, windExposed: 1 },
      terrain: { trails: 75, acres: 730, aboveTreelineShare: 0, lateOpeningShare: 0.3 },
      weatherLocation: {
        point: { lat: 39.385, lon: -107.353 },
        forecastElevationFt: 8900,
        aspect: 'west-facing',
      },
      accessRoutes: buildRoutes('sunlight', { lat: 39.3995, lon: -107.3384 }, [
        { originId: 'denver', label: 'I-70 west to Glenwood Springs, CR-117 south', corridorId: 'i70-west', miles: 170, freeFlow: 182, stormPenalty: 30, weatherSensitivity: 0.66, primary: true },
        { originId: 'boulder', label: 'CO-93 to I-70 west, CR-117 south', corridorId: 'i70-west', miles: 188, freeFlow: 198, stormPenalty: 32, weatherSensitivity: 0.66 },
        { originId: 'fort-collins', label: 'I-25 to I-70 west, CR-117 south', corridorId: 'i70-west', miles: 215, freeFlow: 230, stormPenalty: 34, weatherSensitivity: 0.64 },
        { originId: 'colorado-springs', label: 'I-25 to I-70 west, CR-117 south', corridorId: 'i70-west', miles: 238, freeFlow: 250, stormPenalty: 34, weatherSensitivity: 0.62 },
        { originId: 'frisco', label: 'I-70 west over Vail Pass through Glenwood Canyon', corridorId: 'i70-west', miles: 101, freeFlow: 104, stormPenalty: 24, weatherSensitivity: 0.68 },
        { originId: 'grand-junction', label: 'I-70 east to Glenwood Springs, CR-117 south', corridorId: 'i70-west', miles: 100, freeFlow: 100, stormPenalty: 16, weatherSensitivity: 0.45 },
      ]),
      passAffiliations: ['indy'],
      popularity: 0.25,
      character: 'Old fixed-grip chairs, the Extreme side\'s steep glades, and the hot springs pool fifteen minutes downhill.',
    },
    {
      id: 'powderhorn',
      name: 'Powderhorn',
      shortName: 'POWDERHORN',
      region: 'Grand Mesa',
      snowRegion: 'i70-corridor',
      state: 'CO',
      country: 'US',
      coordinates: { lat: 39.0688, lon: -108.1503 },
      elevations: { baseFt: 8200, summitFt: 9850, verticalFt: 1650 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 0,
      },
      // Assumes the Wild West Express (ex-Snowmass Elk Camp detachable quad)
      // opens as projected in December 2026, replacing the West End double.
      lifts: { total: 5, highSpeed: 2, windExposed: 1 },
      terrain: { trails: 63, acres: 1600, aboveTreelineShare: 0, lateOpeningShare: 0.25 },
      weatherLocation: {
        point: { lat: 39.058, lon: -108.153 },
        forecastElevationFt: 9000,
        aspect: 'west-facing',
      },
      accessRoutes: buildRoutes('powderhorn', { lat: 39.0688, lon: -108.1503 }, [
        { originId: 'grand-junction', label: 'I-70 east to CO-65 through Mesa', corridorId: 'local', miles: 37, freeFlow: 45, stormPenalty: 14, weatherSensitivity: 0.5, primary: true },
        { originId: 'denver', label: 'I-70 west through Glenwood Canyon to CO-65', corridorId: 'i70-west', miles: 245, freeFlow: 245, stormPenalty: 34, weatherSensitivity: 0.64 },
        { originId: 'boulder', label: 'CO-93 to I-70 west, CO-65 south', corridorId: 'i70-west', miles: 263, freeFlow: 262, stormPenalty: 36, weatherSensitivity: 0.64 },
        { originId: 'fort-collins', label: 'I-25 to I-70 west, CO-65 south', corridorId: 'i70-west', miles: 290, freeFlow: 294, stormPenalty: 38, weatherSensitivity: 0.62 },
        { originId: 'colorado-springs', label: 'I-25 to I-70 west, CO-65 south', corridorId: 'i70-west', miles: 313, freeFlow: 314, stormPenalty: 38, weatherSensitivity: 0.6 },
        { originId: 'frisco', label: 'I-70 west through Glenwood Canyon to CO-65', corridorId: 'i70-west', miles: 172, freeFlow: 168, stormPenalty: 28, weatherSensitivity: 0.66 },
      ]),
      passAffiliations: ['indy'],
      popularity: 0.25,
      character: 'Grand Junction\'s mountain on the flank of the world\'s largest flat-top: tree runs and powder days nobody from the Front Range drives to.',
    },
    {
      id: 'echo-mountain',
      name: 'Echo Mountain',
      shortName: 'ECHO',
      region: 'Clear Creek County',
      snowRegion: 'i70-corridor',
      state: 'CO',
      country: 'US',
      coordinates: { lat: 39.6845, lon: -105.5195 },
      elevations: { baseFt: 10050, summitFt: 10650, verticalFt: 600 },
      operations: {
        weekdayOpen: at(11, 0),
        weekendOpen: at(9, 0),
        // Night skiing runs to 9pm on select evenings; 5pm is the ordinary close.
        lastChair: at(16, 45),
        upperMountainOpenOffset: 0,
      },
      lifts: { total: 3, highSpeed: 0, windExposed: 1 },
      terrain: { trails: 7, acres: 60, aboveTreelineShare: 0, lateOpeningShare: 0.3 },
      weatherLocation: {
        point: { lat: 39.6845, lon: -105.5195 },
        forecastElevationFt: 10350,
        aspect: 'east-facing',
      },
      accessRoutes: buildRoutes('echo-mountain', { lat: 39.6845, lon: -105.5195 }, [
        { originId: 'denver', label: 'I-70 west to Idaho Springs, CO-103 south', corridorId: 'i70-west', miles: 46, freeFlow: 60, stormPenalty: 16, weatherSensitivity: 0.55, primary: true },
        { originId: 'boulder', label: 'CO-93 to I-70 west, CO-103 south', corridorId: 'i70-west', miles: 55, freeFlow: 72, stormPenalty: 18, weatherSensitivity: 0.55 },
        { originId: 'fort-collins', label: 'I-25 to I-70 west, CO-103 south', corridorId: 'i70-west', miles: 95, freeFlow: 106, stormPenalty: 20, weatherSensitivity: 0.52 },
        { originId: 'colorado-springs', label: 'I-25 to I-70 west, CO-103 south', corridorId: 'i70-west', miles: 112, freeFlow: 118, stormPenalty: 20, weatherSensitivity: 0.52 },
        { originId: 'frisco', label: 'I-70 east through the Eisenhower Tunnel, CO-103 south', corridorId: 'i70-west', miles: 54, freeFlow: 62, stormPenalty: 16, weatherSensitivity: 0.6 },
      ]),
      passAffiliations: ['indy'],
      popularity: 0.25,
      character: 'Closest lift to Denver and the only one with lights: a one-chair park-and-race hill for an after-work lap, if the thin snowpack lets it open.',
    },
    {
      id: 'granby-ranch',
      name: 'Granby Ranch',
      shortName: 'GRANBY',
      region: 'Grand County',
      snowRegion: 'i70-corridor',
      state: 'CO',
      country: 'US',
      coordinates: { lat: 40.045, lon: -105.9063 },
      elevations: { baseFt: 8202, summitFt: 9202, verticalFt: 1000 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 0,
      },
      lifts: { total: 6, highSpeed: 2, windExposed: 1 },
      terrain: { trails: 43, acres: 406, aboveTreelineShare: 0, lateOpeningShare: 0.15 },
      weatherLocation: {
        point: { lat: 40.038, lon: -105.91 },
        forecastElevationFt: 8700,
        aspect: 'west-facing',
      },
      accessRoutes: buildRoutes('granby-ranch', { lat: 40.045, lon: -105.9063 }, [
        { originId: 'denver', label: 'I-70 to US-40 over Berthoud Pass', corridorId: 'us40-berthoud', miles: 85, freeFlow: 102, stormPenalty: 28, weatherSensitivity: 0.82, primary: true },
        { originId: 'boulder', label: 'CO-93 to I-70, US-40 over Berthoud Pass', corridorId: 'us40-berthoud', miles: 87, freeFlow: 108, stormPenalty: 28, weatherSensitivity: 0.82 },
        { originId: 'fort-collins', label: 'I-25 to I-70, US-40 over Berthoud Pass', corridorId: 'us40-berthoud', miles: 128, freeFlow: 145, stormPenalty: 30, weatherSensitivity: 0.8 },
        { originId: 'colorado-springs', label: 'I-25 to I-70, US-40 over Berthoud Pass', corridorId: 'us40-berthoud', miles: 152, freeFlow: 165, stormPenalty: 30, weatherSensitivity: 0.78 },
        { originId: 'frisco', label: 'CO-9 north to Kremmling, US-40 east', corridorId: 'local', miles: 72, freeFlow: 85, stormPenalty: 18, weatherSensitivity: 0.55 },
      ]),
      passAffiliations: ['indy'],
      popularity: 0.25,
      character: 'Two high-speed quads and no lines, fifteen minutes past Winter Park\'s traffic, but over the same Berthoud Pass to get there.',
    },
    {
      id: 'howelsen-hill',
      name: 'Howelsen Hill',
      shortName: 'HOWELSEN',
      region: 'Yampa Valley',
      snowRegion: 'i70-corridor',
      state: 'CO',
      country: 'US',
      coordinates: { lat: 40.4836, lon: -106.8374 },
      elevations: { baseFt: 6696, summitFt: 7136, verticalFt: 440 },
      operations: {
        // Afternoon-only weekdays is the long-standing pattern; not confirmed
        // for 2026-27 — see the profile note.
        weekdayOpen: at(13, 0),
        weekendOpen: at(10, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 0,
      },
      lifts: { total: 3, highSpeed: 0, windExposed: 0 },
      terrain: { trails: 17, acres: 50, aboveTreelineShare: 0, lateOpeningShare: 0.2 },
      weatherLocation: {
        point: { lat: 40.4815, lon: -106.8385 },
        forecastElevationFt: 6900,
        aspect: 'west-facing',
      },
      accessRoutes: buildRoutes('howelsen-hill', { lat: 40.4836, lon: -106.8374 }, [
        { originId: 'denver', label: 'I-70 to US-40 over Rabbit Ears Pass', corridorId: 'us40-rabbitears', miles: 155, freeFlow: 160, stormPenalty: 30, weatherSensitivity: 0.75, primary: true },
        { originId: 'boulder', label: 'US-36 to US-40 over Rabbit Ears Pass', corridorId: 'us40-rabbitears', miles: 155, freeFlow: 163, stormPenalty: 30, weatherSensitivity: 0.75 },
        { originId: 'frisco', label: 'CO-9 to US-40 over Rabbit Ears Pass', corridorId: 'us40-rabbitears', miles: 88, freeFlow: 95, stormPenalty: 26, weatherSensitivity: 0.72 },
      ]),
      passAffiliations: ['indy'],
      popularity: 0.15,
      character: 'Colorado\'s oldest continuously operating ski area, a walk from downtown Steamboat, where Olympians learned to jump, and Sundays are free.',
    },
  ],

  profiles: {
    'aspen-mountain': {
      officialWebsite: 'https://www.aspensnowmass.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: {
        officialUrl: 'https://www.aspensnowmass.com/four-mountains/aspen-mountain/trail-maps',
        source: 'official',
        imageUrl: null,
        pdfUrl: null,
        season: null,
      },
      ticketUrl: 'https://www.aspensnowmass.com/plan-your-stay/advance-purchase',
      passInfoUrl: 'https://www.aspensnowmass.com/partner-passes/ikon-pass/ikon-pass-faq',
      phone: null,
      address: null,
      openingDate: { date: '2026-11-26', status: 'projected' },
      closingDate: { date: '2027-04-18', status: 'projected' },
      grub: {
        picks: [
          { name: 'Ajax Tavern', note: 'Patio at the bottom of the gondola: truffle fries and ski boots by mid-afternoon.' },
          { name: 'Hooch Craft Cocktail Bar', note: 'Downtown speakeasy-style cocktail bar.' },
          { name: 'Mi Chola', note: 'Downtown Mexican, a local favorite since 2016.' },
        ],
        quickBreakfast: { name: 'Jour de Fête', note: 'Near the gondola: croissants, scones and breakfasts to go.' },
      },
      brews: {
        picks: [{ name: 'Aspen Brewing Company', note: "Aspen's only craft brewery, downtown near the slopes, brewing since 2008." }],
      },
      notes:
        'Opening Nov 26, 2026 and closing Apr 18, 2027 are Aspen Snowmass\'s own Sept 9, 2026 schedule, "as conditions allow." Acres = the long-quoted 675 plus Hero\'s 153 (opened 2023-24). Trail count 76 is the pre-Hero\'s figure (Hero\'s added roughly 19 chutes, 3 glade areas and 4 cut trails, but no official combined count was found). Lift count includes the Hero\'s high-speed quad. Window price ($279 adult peak, 2025-26) is one four-mountain ticket; 2026-27 rates not yet found. Phone/address left null; search budget ran out before they could be confirmed. Not fetch-verified.',
    },
    'aspen-highlands': {
      officialWebsite: 'https://www.aspensnowmass.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: {
        officialUrl: 'https://www.aspensnowmass.com/four-mountains',
        source: 'official',
        imageUrl: null,
        pdfUrl: null,
        season: null,
      },
      ticketUrl: 'https://www.aspensnowmass.com/plan-your-stay/advance-purchase',
      passInfoUrl: 'https://www.aspensnowmass.com/partner-passes/ikon-pass/ikon-pass-faq',
      phone: null,
      address: null,
      openingDate: { date: '2026-12-12', status: 'projected' },
      closingDate: { date: '2027-04-11', status: 'projected' },
      grub: {
        town: 'Aspen, about 2 miles',
        picks: [
          { name: 'Cloud Nine Alpine Bistro', note: 'Former patrol hut at the top of Cloud Nine: fondue, raclette and the champagne-spraying afternoon; reserve weeks ahead.' },
          { name: 'Highlands Alehouse', note: 'Ski-in base pub: pizza, burgers, and beer on tap.' },
          { name: 'Ajax Tavern', note: "Back in town at the gondola: Aspen's default après patio." },
        ],
      },
      brews: {
        picks: [{ name: 'Aspen Brewing Company', note: 'Downtown Aspen, about 10 minutes from the Highlands base.' }],
      },
      notes:
        'Opening Dec 12, 2026 / closing Apr 11, 2027 per Aspen Snowmass\'s Sept 9, 2026 schedule. Elevations are the resort\'s lift-served figures; Highland Bowl\'s hike tops out at 12,392 ft. Trail counts vary 117-144 across sources (118 used); 1,040 acres and 5 lifts are consistent. Trail map links the Four Mountains page; no Highlands-specific trail-map URL turned up in search. Not fetch-verified.',
    },
    buttermilk: {
      officialWebsite: 'https://www.aspensnowmass.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: {
        officialUrl: 'https://www.aspensnowmass.com/four-mountains',
        source: 'official',
        imageUrl: null,
        pdfUrl: null,
        season: null,
      },
      ticketUrl: 'https://www.aspensnowmass.com/plan-your-stay/advance-purchase',
      passInfoUrl: 'https://www.aspensnowmass.com/partner-passes/ikon-pass/ikon-pass-faq',
      phone: null,
      address: null,
      openingDate: { date: '2026-12-12', status: 'projected' },
      closingDate: { date: '2027-04-04', status: 'projected' },
      grub: {
        picks: [
          { name: 'Bumps', note: 'Base-area lunch stop: made-to-order pasta, soups and grill, back on the lift fast.' },
          { name: 'Home Team BBQ', note: 'Inside The Inn at Aspen at the Buttermilk base.' },
        ],
      },
      brews: {
        picks: [{ name: 'Aspen Brewing Company', note: 'Downtown Aspen, about 10 minutes up CO-82.' }],
      },
      notes:
        'Opening Dec 12, 2026 / closing Apr 4, 2027 per Aspen Snowmass\'s Sept 9, 2026 schedule. 2,030 ft, 44 trails, 470 acres and 8 lifts are from the official 2025-26 Aspen Snowmass stats sheet (other sources count only 4-5 main chairs). Parking at the main Buttermilk lot stopped being free in 2025; winter 2026-27 rates not confirmed. Not fetch-verified.',
    },
    snowmass: {
      officialWebsite: 'https://www.aspensnowmass.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: {
        officialUrl: 'https://www.aspensnowmass.com/four-mountains',
        source: 'official',
        imageUrl: null,
        pdfUrl: null,
        season: null,
      },
      ticketUrl: 'https://www.aspensnowmass.com/plan-your-stay/advance-purchase',
      passInfoUrl: 'https://www.aspensnowmass.com/partner-passes/ikon-pass/ikon-pass-faq',
      phone: null,
      address: null,
      openingDate: { date: '2026-11-26', status: 'projected' },
      closingDate: { date: '2027-04-11', status: 'projected' },
      grub: {
        picks: [
          { name: 'Venga Venga', note: "Richard Sandoval's Mexican cantina at the base: fire pits, a DJ and 120-plus tequilas." },
          { name: 'Limelight Lounge', note: 'Base Village hotel lounge: wood-fired pizzas, small and large plates.' },
          { name: 'Elk Camp Restaurant', note: 'Top of the Elk Camp Gondola: rotisserie chicken, pizza, soups.' },
          { name: 'Ullrhof', note: 'Rebuilt mid-mountain restaurant at the base of Big Burn, slated to reopen for 2026-27: burgers and shakes.' },
        ],
      },
      brews: {
        picks: [{ name: 'Aspen Brewing Company', note: 'Downtown Aspen, about 20-25 minutes from Snowmass Village.' }],
      },
      notes:
        'Opening Nov 26, 2026 / closing Apr 11, 2027 per Aspen Snowmass\'s Sept 9, 2026 schedule. Ikon Base Pass for 2026-27 is 5 days at Snowmass only (blackouts); full Ikon covers all four. Acres vary 3,332-3,362 across sources (official site says "3,300+", 96 trails). Lift count (20) and high-speed count are best-available third-party figures; the Elk Camp quad was replaced by a six-pack (and the old quad moved to Powderhorn). Ullrhof reopening is a 2025 plan, not re-confirmed. Not fetch-verified.',
    },
    silverton: {
      officialWebsite: 'https://silvertonmountain.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: {
        officialUrl: 'https://silvertonmountain.com/mountain/stats/',
        source: 'official',
        imageUrl: null,
        pdfUrl: null,
        season: null,
      },
      ticketUrl: 'https://silvertonmountain.com/mountain/pricing/',
      passInfoUrl: null,
      phone: '970-387-5706',
      address: null,
      openingDate: { date: '2026-12-31', status: 'projected' },
      closingDate: { date: '2027-04-11', status: 'projected' },
      grub: {
        town: 'Silverton, 6.5 miles down CO-110',
        picks: [
          { name: 'Brown Bear Café', note: "One of Silverton's few year-round restaurants." },
          { name: 'Grand Imperial Hotel restaurant & saloon', note: 'Historic Greene Street hotel; full bar with microbrews on tap.' },
        ],
      },
      notes:
        'LIMITED OPERATING DAYS: Silverton\'s own pricing page gives the 2026-27 guided season as Dec 31, 2026 – Apr 11, 2027, Thursday–Sunday only ($249/day; $199 early/late Dec 31–Jan 10 and Apr 1–11), and an unguided window of roughly Mar 17 – Apr 11, 2027 (Wed–Sun early, Thu–Sun from Apr 1). It is closed Monday–Wednesday most of the season, which the demo world does not model, so any recommendation for a Mon–Wed is not a real option. Single heli runs $99. Lift-served acres 1,819 (26,819 including hike/heli terrain); trail count 69 is a commonly listed third-party figure; the terrain is ungroomed, unmarked expert lines, so treat it loosely. Vertical/summit include the hike to 13,487 ft (chair tops at 12,300 ft). Brews omitted: Golden Block Brewery\'s winter status was uncertain in research. Not fetch-verified.',
    },
    'ski-cooper': {
      officialWebsite: 'https://www.skicooper.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: {
        officialUrl: 'https://www.skicooper.com',
        source: 'official',
        imageUrl: null,
        pdfUrl: null,
        season: null,
      },
      ticketUrl: null,
      passInfoUrl: null,
      phone: null,
      address: null,
      openingDate: TBD_DATE,
      closingDate: TBD_DATE,
      grub: {
        town: 'Leadville, about 9 miles south',
        picks: [
          { name: 'Tennessee Pass Cookhouse', note: 'Ski- or snowshoe-in four-course backcountry dinner yurt right at Tennessee Pass: pricey, reservations.' },
          { name: 'Silver Dollar Saloon', note: 'Leadville saloon dating to 1879: lunch, dinner and the historic back bar.' },
          { name: 'Treeline Kitchen', note: 'Downtown Leadville restaurant.' },
        ],
      },
      brews: {
        picks: [
          { name: 'Two Mile Brewing', note: 'Leadville brewery with sandwiches and growlers to go.' },
          { name: 'Periodic Brewing', note: 'Downtown Leadville brewery.' },
        ],
      },
      notes:
        'Stats (1,200 ft, 64 trails, 480 acres, 5 lifts: one triple, one double, three surface) from skicooper.com\'s Mountain Stats page via search. Chicago Ridge snowcat terrain (2,400-2,600 acres) is separate and not counted. PASS: not on Indy Pass. Indy forced partners to choose between it and Cooper\'s reciprocal pass in July 2023; Cooper is on Powder Alliance and Freedom Pass reciprocity, neither modelled here, so `independent`. A Dec 9, 2026 opening appears only on an aggregator list ("tentative"), so TBD. Pricing from 2025-26 third-party data ($40-49 weekday, $69-99 weekend). Ticket URL, phone, address not confirmed (search budget exhausted). Not fetch-verified.',
    },
    sunlight: {
      officialWebsite: 'https://sunlightmtn.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: {
        officialUrl: 'https://sunlightmtn.com/the-mountain/trail-map',
        source: 'official',
        imageUrl: null,
        pdfUrl: null,
        season: null,
      },
      ticketUrl: 'https://sunlightmtn.com/tickets',
      passInfoUrl: 'https://indyskipass.com',
      phone: '970-945-7491',
      address: '10901 County Road 117, Glenwood Springs, CO 81601',
      openingDate: TBD_DATE,
      closingDate: TBD_DATE,
      grub: {
        town: 'Glenwood Springs, about 12 miles north',
        picks: [
          { name: 'Pullman', note: 'Chef-owned restaurant in a restored railroad-era building downtown.' },
          { name: "Florinda's", note: '721 Grand Ave: slightly upscale Italian, reasonable prices.' },
          { name: 'Slope & Hatch', note: 'Downtown tacos.' },
        ],
      },
      brews: {
        picks: [
          { name: 'Glenwood Canyon Brewpub', note: 'In the historic Hotel Denver by the river: frequent GABF medalist.' },
          { name: 'Casey Brewing Taproom', note: 'Grand Avenue taproom for one of Colorado\'s best-known sour-beer brewers.' },
        ],
      },
      notes:
        'Elevations, 730+ acres, 75 runs and 3 fixed-grip chairs (two doubles, one triple) from Sunlight\'s own trail-map page. 2025-26 opened Dec 12, 2025; no 2026-27 date published yet. Window price is Coloradotopia\'s 2025-26 same-day peak-holiday figure ($109; $94 regular); OnTheSnow listed $74; sources conflict. Indy Pass member since 2019-20. Not fetch-verified.',
    },
    powderhorn: {
      officialWebsite: 'https://www.powderhorn.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: {
        // Only a 2022-23 PDF was found — links the site rather than a stale map.
        officialUrl: 'https://www.powderhorn.com',
        source: 'official',
        imageUrl: null,
        pdfUrl: null,
        season: null,
      },
      ticketUrl: 'https://www.powderhorn.com/tickets',
      passInfoUrl: 'https://indyskipass.com',
      phone: null,
      address: null,
      openingDate: TBD_DATE,
      closingDate: TBD_DATE,
      grub: {
        town: 'Mesa and Grand Junction',
        picks: [
          { name: 'Sunset Grill & Bar', note: 'Upper level of the base lodge, Grand Mesa views.' },
          { name: 'Wagon Wheel Restaurant', note: 'Mesa local stalwart, about 10 minutes down CO-65.' },
          { name: 'Bin 707', note: 'Grand Junction dinner-and-cocktails pick.' },
        ],
        quickBreakfast: { name: 'Quickdraw Cafe', note: 'Ground floor of the base lodge: breakfast from 8am.' },
      },
      brews: {
        picks: [
          { name: 'Rockslide Brewery', note: "Grand Junction's original brewpub, about 45 minutes away." },
          { name: 'Umbrella Bar', note: 'On-site base bar pouring Palisade Brewing, Ska and other local beer.' },
        ],
        distilleries: [{ name: 'Highlands Distillery', note: 'Grand Junction cocktail bar and distillery.' }],
      },
      notes:
        'Trail map lists 1,600 permitted acres, 1,650 ft, 9,850 ft summit (one review puts the actual skiable footprint near 845 acres). NEW FOR 2026-27: Wild West Express, a refurbished detachable quad (ex-Snowmass Elk Camp, 1995) replacing the 1972 West End double, projected to open December 2026 pending Forest Service approval; lift counts assume it opens. 2026-27 is the 60th season; day ticket pricing was "coming soon" on the official site; pricing uses 2025-26 ($89 weekday / $99 weekend adult). Phone/address not confirmed. Not fetch-verified.',
    },
    'echo-mountain': {
      officialWebsite: 'https://echomtn.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: {
        officialUrl: 'https://echomtn.com',
        source: 'official',
        imageUrl: null,
        pdfUrl: null,
        season: null,
      },
      ticketUrl: null,
      passInfoUrl: 'https://indyskipass.com',
      phone: null,
      address: null,
      openingDate: TBD_DATE,
      closingDate: TBD_DATE,
      grub: {
        town: 'Idaho Springs, about 14 miles down CO-103',
        picks: [
          { name: "Beau Jo's", note: 'Colorado-style mountain pie pizza, the Idaho Springs institution.' },
          { name: 'Two Brothers Deli', note: 'Small, quirky breakfast-wrap and deli stop.' },
        ],
      },
      brews: {
        picks: [
          { name: 'Tommyknocker Brewery & Pub', note: '1401 Miner St, Idaho Springs.' },
          { name: 'Westbound & Down', note: '1617 Miner St, Idaho Springs: brewery since 2015.' },
        ],
      },
      notes:
        'Stats are OnTheSnow\'s (3 lifts: one triple, two surface; 7 trails; 60 acres, 40 lit for night skiing); the oft-quoted 226 acres is the whole property. Hours vary by source (roughly 11am-5pm weekdays, 9am weekends, to 9pm on night-skiing evenings, closed some midweek days); confirm before going. 2025-26 opened briefly then shut lift-served skiing for thin snow in December 2025, with no snowmaking safety net worth trusting. OnTheSnow\'s Dec 12, 2026 opening is an aggregator projection, so TBD. Indy Pass member. Website domain echomtn.com from search text, not a rendered page. Not fetch-verified.',
    },
    'granby-ranch': {
      officialWebsite: 'https://granbyranch.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: {
        officialUrl: 'https://granbyranch.com',
        source: 'official',
        imageUrl: null,
        pdfUrl: null,
        season: null,
      },
      ticketUrl: null,
      passInfoUrl: 'https://indyskipass.com/our-resorts/granby-ranch',
      phone: null,
      address: null,
      openingDate: TBD_DATE,
      closingDate: TBD_DATE,
      grub: {
        picks: [
          { name: 'Bluebird Bistro', note: 'Right at the Granby Ranch base: burgers, brick-fired pizza and pit-smoked BBQ.' },
          { name: 'Brickhouse 40', note: 'Granby: elevated American and Italian; the elk chili is the local favorite.' },
        ],
      },
      brews: {
        picks: [{ name: 'Never Summer Brewing Co.', note: 'Granby taproom since 2016: cream ales to porters, skier happy hour.' }],
      },
      notes:
        '406 acres, 1,000 ft (8,202-9,202) consistent across sources; trails 38-45 (43 used); lifts 5-6 (OnTheSnow: 2 high-speed quads, 1 triple, 1 double, 2 surface, used). 2025-26 opened Nov 26, 2025; no 2026-27 date published. Pricing is an estimate; no current day-ticket figure was found. Phone/address and ticket URL not confirmed (search budget exhausted). Not fetch-verified.',
    },
    'howelsen-hill': {
      officialWebsite: 'https://steamboatsprings.net',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: {
        officialUrl: 'https://steamboatsprings.net',
        source: 'official',
        imageUrl: null,
        pdfUrl: null,
        season: null,
      },
      ticketUrl: 'https://co-steamboatsprings.civicplus.com/298/Lift-Tickets',
      passInfoUrl: 'https://indyskipass.com',
      phone: '970-879-8499',
      address: null,
      openingDate: TBD_DATE,
      closingDate: TBD_DATE,
      grub: {
        picks: [
          { name: 'Aurum Food & Wine', note: 'Downtown on the Yampa, looking straight across at Howelsen.' },
          { name: 'Yampa Valley Kitchen', note: 'Downtown neighborhood spot: breakfast, lunch and dinner.' },
          { name: 'Brass Kitchen & Bar', note: 'Yampa Street: modern American plates and a deep spirits list.' },
        ],
      },
      brews: {
        picks: [{ name: 'Storm Peak Brewing', note: "Steamboat's largest brewery, a few minutes across town." }],
      },
      notes:
        'City-owned (City of Steamboat Springs); the official site is the city\'s; 970-879-8499 is the ticket office. 2025-26 adult ticket $52 (youth/senior $38), and Ski Free Sundays: free lift tickets every Sunday. 440 ft vertical and ~50 acres from search; base elevation, 17 trails and 3 lifts are best-available figures, and operating hours (afternoon-only weekdays, with lights) are the long-standing pattern but were NOT confirmed for 2026-27. The city\'s own pages disagreed on the 2025-26 opening (Nov 29 vs Dec 6). Not fetch-verified.',
    },
  },

  parking: {
    'aspen-mountain': {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'not-required',
      freeOptionAvailable: true,
      notes: [
        'No skier lot at the gondola. Downtown Aspen parking is paid and limited.',
        'Brush Creek Park & Ride (CO-82 at Brush Creek Rd) is free, with free RFTA buses to Rubey Park downtown, a block from the gondola.',
      ],
      infoUrl: 'https://aspen.gov/1679/Brush-Creek-Park-Ride',
    },
    'aspen-highlands': {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'not-required',
      freeOptionAvailable: true,
      notes: [
        'The Highlands Village garage is paid (first half hour free); pay before you ski. Older published rates were $25-35 weekdays, $40-50 weekends. Confirm current rates.',
        'Free alternative: Brush Creek Park & Ride plus free buses to all four mountains.',
      ],
      infoUrl: 'https://www.aspensnowmass.com/visit/getting-around',
    },
    buttermilk: {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'not-required',
      freeOptionAvailable: true,
      notes: [
        'Buttermilk\'s main lot stopped being free in 2025 (Pitkin County-approved paid parking); winter rates were still being set. Check before going.',
        'Brush Creek Park & Ride is free, with free buses to Buttermilk.',
      ],
      infoUrl: 'https://www.aspensnowmass.com/visit/getting-around',
    },
    snowmass: {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'not-required',
      freeOptionAvailable: true,
      notes: [
        'Town Park Station (formerly the Rodeo Lot) is free day parking with shuttles every 10 minutes 7:30am-5:30pm; no overnight parking.',
        'Base Village Parking Garage: first hour free, then about $9/hr to a $63 daily cap (higher at peak periods); free after 4pm.',
      ],
      infoUrl: 'https://www.gosnowmass.com/about-us/maps-travel/parking/',
      contact: '970-923-2543',
    },
    silverton: {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'not-required',
      freeOptionAvailable: true,
      notes: [
        'Small dirt lots at the base, just past the main buildings on CO-110, about 6.5 miles up from town.',
        'The road turns unpaved and snow-covered: 4WD recommended in storms. Ophir Pass Rd (630) is closed in winter.',
      ],
      infoUrl: 'https://silvertonmountain.com/town/directions/',
    },
    'ski-cooper': {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'unknown',
      freeOptionAvailable: null,
      notes: [
        'Base lot is about a third of a mile off US-24 at Tennessee Pass. Overnight parking in the ski area lot can be towed; parking on FS Road 731 is illegal.',
        'Fee status for day skiers was not confirmed in research.',
      ],
      infoUrl: 'https://www.skicooper.com',
    },
    sunlight: {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'unknown',
      freeOptionAvailable: null,
      notes: ['Base-area lot at the top of County Road 117, about 12 miles from Glenwood Springs. The resort runs a winter shuttle line (9am-3pm phone hours); lot fees were not confirmed.'],
      infoUrl: 'https://www.sunlightmtn.com/the-mountain/getting-here',
    },
    powderhorn: {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'unknown',
      freeOptionAvailable: null,
      notes: ['Base-area lots off CO-65 above Mesa. Fees and policy were not confirmed in research. Check the resort site.'],
      infoUrl: 'https://www.powderhorn.com',
    },
    'echo-mountain': {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'unknown',
      freeOptionAvailable: null,
      notes: ['Base lot on CO-103, about 14 miles above Idaho Springs. Fees and policy were not confirmed in research.'],
      infoUrl: 'https://echomtn.com',
    },
    'granby-ranch': {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'unknown',
      freeOptionAvailable: null,
      notes: ['Base-area parking at the Granby Ranch base lodge off US-40 south of Granby. Fees and policy were not confirmed in research.'],
      infoUrl: 'https://granbyranch.com',
    },
    'howelsen-hill': {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'unknown',
      freeOptionAvailable: null,
      notes: ['City-run hill across the Yampa River from downtown Steamboat, walkable from Lincoln Ave. Lot fees were not confirmed in research.'],
      infoUrl: 'https://steamboatsprings.net',
    },
  },

  pricing: {
    // One Aspen Snowmass ticket covers all four mountains.
    'aspen-mountain': { mountainId: 'aspen-mountain', currency: 'USD', windowRate: 279, advanceFloor: 204, dynamicRange: 0.7 },
    'aspen-highlands': { mountainId: 'aspen-highlands', currency: 'USD', windowRate: 279, advanceFloor: 204, dynamicRange: 0.7 },
    buttermilk: { mountainId: 'buttermilk', currency: 'USD', windowRate: 279, advanceFloor: 204, dynamicRange: 0.7 },
    snowmass: { mountainId: 'snowmass', currency: 'USD', windowRate: 279, advanceFloor: 204, dynamicRange: 0.7 },
    // Guided day: $249, $199 early/late season. Not a resort ticket in the usual sense.
    silverton: { mountainId: 'silverton', currency: 'USD', windowRate: 249, advanceFloor: 199, dynamicRange: 0.2 },
    'ski-cooper': { mountainId: 'ski-cooper', currency: 'USD', windowRate: 99, advanceFloor: 45, dynamicRange: 0.4 },
    sunlight: { mountainId: 'sunlight', currency: 'USD', windowRate: 109, advanceFloor: 74, dynamicRange: 0.35 },
    powderhorn: { mountainId: 'powderhorn', currency: 'USD', windowRate: 99, advanceFloor: 79, dynamicRange: 0.3 },
    'echo-mountain': { mountainId: 'echo-mountain', currency: 'USD', windowRate: 83, advanceFloor: 50, dynamicRange: 0.45 },
    'granby-ranch': { mountainId: 'granby-ranch', currency: 'USD', windowRate: 119, advanceFloor: 69, dynamicRange: 0.5 },
    // City hill: one flat rate, and free on Sundays.
    'howelsen-hill': { mountainId: 'howelsen-hill', currency: 'USD', windowRate: 52, advanceFloor: 48, dynamicRange: 0.05 },
  },

  /*
   * Identity — and the condition that punishes it:
   *
   *  Aspen Mountain   steep, sheltered, all-black   · no beginner terrain, long drive
   *  Aspen Highlands  Highland Bowl when it's open  · bowl needs control work and a big base
   *  Buttermilk       sunny, gentle, empty           · least snow, nothing steep
   *  Snowmass         sheer size spreads the crowd   · the big alpine up top goes on wind hold
   *  Silverton        the deepest, steepest snow    · one chair, Thu–Sun, guides, avalanche delays
   *  Ski Cooper       divide-top snow, cheap, empty  · small, flat, slow surface lifts
   *  Sunlight         quiet trees, hot springs after · low base, warm storms
   *  Powderhorn       Grand Mesa powder, no lines    · low and western, rain-line risk
   *  Echo Mountain    closest to Denver, night laps  · tiny, and thin snow closes it
   *  Granby Ranch     fast lifts, no lines           · rain-shadowed, Berthoud Pass
   *  Howelsen Hill    downtown, almost free          · 440 feet and afternoon hours
   */
  demo: {
    // Aspen Mountain: tree-lined steeps hold snow and sit out the wind, but it's all expert and far from Denver.
    'aspen-mountain': { snow: 1.05, wind: 0.6, operations: 1.08, crowds: 0.7, grooming: 0.8, controlDelay: 20 },
    // Aspen Highlands: Highland Bowl is the best terrain in the valley when patrol opens it — which takes time.
    'aspen-highlands': { snow: 1.15, wind: 1.2, operations: 0.94, crowds: 0.55, grooming: 0.7, controlDelay: 45 },
    // Buttermilk: low, sunny, sheltered groomers; first to feel a warm day, last to get deep.
    buttermilk: { snow: 0.8, wind: 0.45, operations: 1.12, crowds: 0.4, grooming: 0.95, controlDelay: 5 },
    // Snowmass: so big the crowd disappears; the Cirque and Hanging Valley up high are the wind-hold weak spot.
    snowmass: { snow: 1.1, wind: 1.15, operations: 0.98, crowds: 0.65, grooming: 0.85, controlDelay: 30 },
    // Silverton: the deepest snow in the state and the steepest lift-served lines — one old chair, guides, long control work.
    silverton: { snow: 1.7, wind: 1.3, operations: 0.7, crowds: 0.25, grooming: 0.0, controlDelay: 60 },
    // Ski Cooper: catches divide-top storms, nobody in line, but small, low-angle and slow.
    'ski-cooper': { snow: 1.15, wind: 1.05, operations: 1.02, crowds: 0.3, grooming: 0.75, controlDelay: 10 },
    // Sunlight: quiet tree skiing, but a low base that turns soft fast in warm storms.
    sunlight: { snow: 0.9, wind: 0.6, operations: 1.0, crowds: 0.3, grooming: 0.7, controlDelay: 10 },
    // Powderhorn: Grand Mesa storms land here first and nobody's in line — but it's low and far west.
    powderhorn: { snow: 1.05, wind: 0.7, operations: 0.98, crowds: 0.28, grooming: 0.75, controlDelay: 10 },
    // Echo Mountain: closest lift to Denver and lit at night — tiny, wind-scoured, and thin snow shuts it.
    'echo-mountain': { snow: 0.6, wind: 1.25, operations: 0.75, crowds: 0.6, grooming: 0.9, controlDelay: 5 },
    // Granby Ranch: two fast lifts and no lines, in Middle Park's rain shadow behind Berthoud Pass.
    'granby-ranch': { snow: 0.75, wind: 0.7, operations: 1.05, crowds: 0.35, grooming: 0.9, controlDelay: 5 },
    // Howelsen Hill: a town hill in Steamboat's snow belt — 440 feet, afternoon hours, almost free.
    'howelsen-hill': { snow: 1.0, wind: 0.5, operations: 0.9, crowds: 0.3, grooming: 0.85, controlDelay: 5 },
  },
};
