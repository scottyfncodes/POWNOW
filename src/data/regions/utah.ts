import type { RegionDataset } from './types';
import { buildRoutes } from '@/data/buildRoutes';
import { TBD_DATE } from '@/domain/mountainProfile';
import { at } from '@/domain/time';

/**
 * Utah — every lift-served ski area in the state: the four Cottonwood
 * Canyons resorts, the two Park City mountains, the three Ogden Valley
 * mountains, Sundance, the two southern-Utah plateau resorts, and the two
 * Cache Valley locals' hills.
 *
 * Researched via web search in October 2026, ahead of the 2026-27 season.
 * This sandbox's outbound fetch was blocked (DNS failures on every news and
 * resort page tried), so nothing here is fetch-verified: every figure and URL
 * comes from indexed search results (resort pages, Ski Utah, KPCW, TownLift,
 * Park Record, Deseret News / KUTV summaries), and the per-mountain `notes`
 * say where a figure was best-available rather than official. The shared
 * search budget ran out before every stat could be cross-checked, so a few
 * well-known lift/terrain numbers are from prior knowledge and flagged as
 * such in `notes`.
 *
 * Notable facts for 2026-27 that shape this file:
 * - Eagle Point is left out for 2026-27: it will not operate (Cottonwood Fire
 *   damaged four of five lifts and destroyed Canyonside Lodge; flooding washed
 *   out the main access road — resort release 8/3/2026). A closed mountain
 *   in the dataset could be recommended to a Las Vegas rider; add it back
 *   when it reopens (the owner hopes for 2027-28).
 * - Powder Mountain accepts no multi-resort passes (its own season-pass page
 *   says so; it left Indy after 2023-24), so it is 'independent'.
 * - Nordic Valley, Brian Head (Power Pass, Mountain Capital Partners) and
 *   Sundance (Power Pass partner days) are on no pass network this app
 *   models, so they are 'independent'.
 * - Alta and Deer Valley are skiers-only; snowboarders cannot ride either.
 *
 * Deliberately omitted: Woodward Park City — a lift-served terrain-park and
 * action-sports facility, not a ski mountain in the sense the rest of this
 * dataset means. Nordic-only and cat/heli operations are out of scope too.
 */

const SKI_UTAH_PARKING = 'https://www.skiutah.com/resources/ski-resort-parking';

export const UTAH: RegionDataset = {
  mountains: [
    {
      id: 'alta',
      name: 'Alta',
      shortName: 'ALTA',
      region: 'Little Cottonwood Canyon',
      snowRegion: 'wasatch',
      state: 'UT',
      country: 'US',
      coordinates: { lat: 40.5884, lon: -111.6386 },
      elevations: { baseFt: 8530, summitFt: 11068, verticalFt: 2538 },
      operations: {
        weekdayOpen: at(9, 15),
        weekendOpen: at(9, 15),
        lastChair: at(16, 30),
        upperMountainOpenOffset: 45,
      },
      lifts: { total: 9, highSpeed: 4, windExposed: 2 },
      terrain: { trails: 119, acres: 2614, aboveTreelineShare: 0.4, lateOpeningShare: 0.3 },
      weatherLocation: {
        point: { lat: 40.5795, lon: -111.6325 },
        forecastElevationFt: 9700,
        aspect: 'west-facing',
      },
      accessRoutes: buildRoutes('alta', { lat: 40.5884, lon: -111.6386 }, [
        { originId: 'salt-lake-city', label: 'I-215 to SR-210 up Little Cottonwood', corridorId: 'ut210-little-cottonwood', miles: 31, freeFlow: 47, stormPenalty: 75, weatherSensitivity: 0.92, primary: true },
        { originId: 'ogden', label: 'I-15 south to SR-210', corridorId: 'ut210-little-cottonwood', miles: 66, freeFlow: 78, stormPenalty: 80, weatherSensitivity: 0.92 },
      ]),
      passAffiliations: ['ikon', 'mountain-collective'],
      popularity: 0.8,
      character: 'Skiers only, deepest snow in the Wasatch, if the canyon road is open, which on the best days it isn’t.',
    },
    {
      id: 'snowbird',
      name: 'Snowbird',
      shortName: 'SNOWBIRD',
      region: 'Little Cottonwood Canyon',
      snowRegion: 'wasatch',
      state: 'UT',
      country: 'US',
      coordinates: { lat: 40.581, lon: -111.6556 },
      elevations: { baseFt: 7760, summitFt: 11000, verticalFt: 3240 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 45,
      },
      lifts: { total: 14, highSpeed: 6, windExposed: 4 },
      terrain: { trails: 169, acres: 2500, aboveTreelineShare: 0.38, lateOpeningShare: 0.32 },
      weatherLocation: {
        point: { lat: 40.5675, lon: -111.6575 },
        forecastElevationFt: 9400,
        aspect: 'west-facing',
      },
      accessRoutes: buildRoutes('snowbird', { lat: 40.581, lon: -111.6556 }, [
        { originId: 'salt-lake-city', label: 'I-215 to SR-210 up Little Cottonwood', corridorId: 'ut210-little-cottonwood', miles: 29, freeFlow: 44, stormPenalty: 70, weatherSensitivity: 0.9, primary: true },
        { originId: 'ogden', label: 'I-15 south to SR-210', corridorId: 'ut210-little-cottonwood', miles: 64, freeFlow: 75, stormPenalty: 75, weatherSensitivity: 0.9 },
      ]),
      passAffiliations: ['ikon', 'mountain-collective'],
      popularity: 0.85,
      character: 'The tram, 3,000 feet of steep, and Mineral Basin out back. Interlodge is the price of the snow.',
    },
    {
      id: 'brighton',
      name: 'Brighton',
      shortName: 'BRIGHTON',
      region: 'Big Cottonwood Canyon',
      snowRegion: 'wasatch',
      state: 'UT',
      country: 'US',
      coordinates: { lat: 40.598, lon: -111.5832 },
      elevations: { baseFt: 8755, summitFt: 10500, verticalFt: 1745 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 15,
      },
      lifts: { total: 7, highSpeed: 4, windExposed: 2 },
      terrain: { trails: 66, acres: 1050, aboveTreelineShare: 0.15, lateOpeningShare: 0.15 },
      weatherLocation: {
        point: { lat: 40.5935, lon: -111.5815 },
        forecastElevationFt: 9600,
        aspect: 'divide',
      },
      accessRoutes: buildRoutes('brighton', { lat: 40.598, lon: -111.5832 }, [
        { originId: 'salt-lake-city', label: 'I-215 to SR-190 up Big Cottonwood', corridorId: 'ut190-big-cottonwood', miles: 30, freeFlow: 50, stormPenalty: 45, weatherSensitivity: 0.75, primary: true },
        { originId: 'ogden', label: 'I-15 south to SR-190', corridorId: 'ut190-big-cottonwood', miles: 65, freeFlow: 80, stormPenalty: 50, weatherSensitivity: 0.75 },
      ]),
      passAffiliations: ['ikon'],
      popularity: 0.7,
      character: 'Top of Big Cottonwood, a snowboard-first locals’ hill with tree stashes and night skiing.',
    },
    {
      id: 'solitude',
      name: 'Solitude',
      shortName: 'SOLITUDE',
      region: 'Big Cottonwood Canyon',
      snowRegion: 'wasatch',
      state: 'UT',
      country: 'US',
      coordinates: { lat: 40.6199, lon: -111.5919 },
      elevations: { baseFt: 7988, summitFt: 10488, verticalFt: 2500 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 30,
      },
      lifts: { total: 8, highSpeed: 3, windExposed: 2 },
      terrain: { trails: 88, acres: 1200, aboveTreelineShare: 0.2, lateOpeningShare: 0.25 },
      weatherLocation: {
        point: { lat: 40.6085, lon: -111.5955 },
        forecastElevationFt: 9200,
        aspect: 'west-facing',
      },
      accessRoutes: buildRoutes('solitude', { lat: 40.6199, lon: -111.5919 }, [
        { originId: 'salt-lake-city', label: 'I-215 to SR-190 up Big Cottonwood', corridorId: 'ut190-big-cottonwood', miles: 28, freeFlow: 45, stormPenalty: 40, weatherSensitivity: 0.72, primary: true },
        { originId: 'ogden', label: 'I-15 south to SR-190', corridorId: 'ut190-big-cottonwood', miles: 63, freeFlow: 75, stormPenalty: 45, weatherSensitivity: 0.72 },
      ]),
      passAffiliations: ['ikon'],
      popularity: 0.6,
      character: 'Honeycomb Canyon and Cottonwood snow without the Cottonwood crowds. The name is mostly earned.',
    },
    {
      id: 'park-city',
      name: 'Park City Mountain',
      shortName: 'PARK CITY',
      region: 'Park City',
      snowRegion: 'wasatch',
      state: 'UT',
      country: 'US',
      coordinates: { lat: 40.6514, lon: -111.508 },
      elevations: { baseFt: 6800, summitFt: 10026, verticalFt: 3226 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 20,
      },
      lifts: { total: 41, highSpeed: 20, windExposed: 6 },
      terrain: { trails: 341, acres: 7300, aboveTreelineShare: 0.12, lateOpeningShare: 0.25 },
      weatherLocation: {
        point: { lat: 40.6385, lon: -111.5375 },
        forecastElevationFt: 8500,
        aspect: 'east-facing',
      },
      accessRoutes: buildRoutes('park-city', { lat: 40.6514, lon: -111.508 }, [
        { originId: 'salt-lake-city', label: 'I-80 east up Parleys to SR-224', corridorId: 'i80-parleys', miles: 32, freeFlow: 38, stormPenalty: 25, weatherSensitivity: 0.5, primary: true },
        { originId: 'ogden', label: 'I-84 to I-80 west via Echo', corridorId: 'i80-parleys', miles: 62, freeFlow: 63, stormPenalty: 25, weatherSensitivity: 0.45 },
      ]),
      passAffiliations: ['epic'],
      popularity: 0.95,
      character: 'The biggest lift network in the country, two villages, and a town on Main Street. Busy because it’s easy.',
    },
    {
      id: 'deer-valley',
      name: 'Deer Valley',
      shortName: 'DEER VALLEY',
      region: 'Park City',
      snowRegion: 'wasatch',
      state: 'UT',
      country: 'US',
      coordinates: { lat: 40.6374, lon: -111.4783 },
      elevations: { baseFt: 6570, summitFt: 9570, verticalFt: 3000 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 15,
      },
      lifts: { total: 32, highSpeed: 20, windExposed: 3 },
      terrain: { trails: 209, acres: 4500, aboveTreelineShare: 0.05, lateOpeningShare: 0.2 },
      weatherLocation: {
        point: { lat: 40.6235, lon: -111.4955 },
        forecastElevationFt: 8100,
        aspect: 'east-facing',
      },
      accessRoutes: buildRoutes('deer-valley', { lat: 40.6374, lon: -111.4783 }, [
        { originId: 'salt-lake-city', label: 'I-80 east up Parleys to US-40', corridorId: 'i80-parleys', miles: 36, freeFlow: 42, stormPenalty: 25, weatherSensitivity: 0.5, primary: true },
        { originId: 'ogden', label: 'I-84 to I-80 west via Echo', corridorId: 'i80-parleys', miles: 64, freeFlow: 66, stormPenalty: 25, weatherSensitivity: 0.45 },
      ]),
      passAffiliations: ['ikon'],
      popularity: 0.75,
      character: 'Skiers only, corduroy and white-tablecloth service, now sprawling east toward the Jordanelle.',
    },
    {
      id: 'snowbasin',
      name: 'Snowbasin',
      shortName: 'SNOWBASIN',
      region: 'Ogden Valley',
      snowRegion: 'wasatch',
      state: 'UT',
      country: 'US',
      coordinates: { lat: 41.216, lon: -111.8569 },
      elevations: { baseFt: 6450, summitFt: 9350, verticalFt: 2900 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 30,
      },
      lifts: { total: 12, highSpeed: 8, windExposed: 3 },
      terrain: { trails: 110, acres: 3000, aboveTreelineShare: 0.2, lateOpeningShare: 0.25 },
      weatherLocation: {
        point: { lat: 41.205, lon: -111.865 },
        forecastElevationFt: 7900,
        aspect: 'east-facing',
      },
      accessRoutes: buildRoutes('snowbasin', { lat: 41.216, lon: -111.8569 }, [
        { originId: 'ogden', label: 'SR-39 up Ogden Canyon to SR-226', corridorId: 'ut-ogden-valley', miles: 19, freeFlow: 32, stormPenalty: 18, weatherSensitivity: 0.45, primary: true },
        { originId: 'salt-lake-city', label: 'I-15 / I-84 to Trappers Loop (SR-167)', corridorId: 'ut-ogden-valley', miles: 50, freeFlow: 55, stormPenalty: 20, weatherSensitivity: 0.45 },
      ]),
      passAffiliations: ['ikon', 'mountain-collective'],
      popularity: 0.55,
      character: 'Olympic downhill steeps, palatial lodges and gondolas, and somehow still no line.',
    },
    {
      id: 'powder-mountain',
      name: 'Powder Mountain',
      shortName: 'POWDER MTN',
      region: 'Ogden Valley',
      snowRegion: 'wasatch',
      state: 'UT',
      country: 'US',
      coordinates: { lat: 41.379, lon: -111.781 },
      elevations: { baseFt: 6900, summitFt: 9422, verticalFt: 2522 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 15,
      },
      lifts: { total: 9, highSpeed: 3, windExposed: 3 },
      terrain: { trails: 167, acres: 3500, aboveTreelineShare: 0.3, lateOpeningShare: 0.3 },
      weatherLocation: {
        point: { lat: 41.372, lon: -111.77 },
        forecastElevationFt: 8300,
        aspect: 'divide',
      },
      accessRoutes: buildRoutes('powder-mountain', { lat: 41.379, lon: -111.781 }, [
        { originId: 'ogden', label: 'SR-39 to Eden, then Powder Mountain Road (SR-158)', corridorId: 'ut-ogden-valley', miles: 20, freeFlow: 42, stormPenalty: 28, weatherSensitivity: 0.65, primary: true },
        { originId: 'salt-lake-city', label: 'I-15 / I-84 to Trappers Loop, then SR-158', corridorId: 'ut-ogden-valley', miles: 56, freeFlow: 72, stormPenalty: 30, weatherSensitivity: 0.65 },
      ]),
      passAffiliations: ['independent'],
      popularity: 0.45,
      character: 'An upside-down mountain of rolling powder fields, no mega passes taken, and a road that tests your tires.',
    },
    {
      id: 'nordic-valley',
      name: 'Nordic Valley',
      shortName: 'NORDIC',
      region: 'Ogden Valley',
      snowRegion: 'wasatch',
      state: 'UT',
      country: 'US',
      coordinates: { lat: 41.3103, lon: -111.8647 },
      elevations: { baseFt: 5400, summitFt: 7060, verticalFt: 1660 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 0,
      },
      lifts: { total: 5, highSpeed: 0, windExposed: 1 },
      terrain: { trails: 40, acres: 450, aboveTreelineShare: 0.05, lateOpeningShare: 0.35 },
      weatherLocation: {
        point: { lat: 41.315, lon: -111.87 },
        forecastElevationFt: 6200,
        aspect: 'east-facing',
      },
      accessRoutes: buildRoutes('nordic-valley', { lat: 41.3103, lon: -111.8647 }, [
        { originId: 'ogden', label: 'North Ogden Divide or SR-39 to Eden', corridorId: 'ut-ogden-valley', miles: 15, freeFlow: 27, stormPenalty: 15, weatherSensitivity: 0.5, primary: true },
        { originId: 'salt-lake-city', label: 'I-15 north to Ogden, then SR-39', corridorId: 'ut-ogden-valley', miles: 52, freeFlow: 58, stormPenalty: 18, weatherSensitivity: 0.45 },
      ]),
      passAffiliations: ['independent'],
      popularity: 0.25,
      character: 'Low, cheap and lit at night: the Ogden family hill, at its best right after a storm.',
    },
    {
      id: 'sundance',
      name: 'Sundance Mountain Resort',
      shortName: 'SUNDANCE',
      region: 'Provo Canyon',
      snowRegion: 'wasatch',
      state: 'UT',
      country: 'US',
      coordinates: { lat: 40.3925, lon: -111.588 },
      elevations: { baseFt: 6100, summitFt: 8250, verticalFt: 2150 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 30),
        upperMountainOpenOffset: 15,
      },
      lifts: { total: 7, highSpeed: 2, windExposed: 1 },
      terrain: { trails: 75, acres: 605, aboveTreelineShare: 0.05, lateOpeningShare: 0.3 },
      weatherLocation: {
        point: { lat: 40.397, lon: -111.596 },
        forecastElevationFt: 7200,
        aspect: 'west-facing',
      },
      accessRoutes: buildRoutes('sundance', { lat: 40.3925, lon: -111.588 }, [
        { originId: 'salt-lake-city', label: 'I-15 south to US-189 up Provo Canyon, then SR-92', corridorId: 'us189-provo-canyon', miles: 52, freeFlow: 58, stormPenalty: 22, weatherSensitivity: 0.5, primary: true },
        { originId: 'ogden', label: 'I-15 south to US-189 up Provo Canyon', corridorId: 'us189-provo-canyon', miles: 88, freeFlow: 92, stormPenalty: 25, weatherSensitivity: 0.5 },
      ]),
      passAffiliations: ['independent'],
      popularity: 0.35,
      character: 'Under Timpanogos’ east face, quiet and a little rustic, and growing a back side with a new express lift.',
    },
    {
      id: 'brian-head',
      name: 'Brian Head',
      shortName: 'BRIAN HEAD',
      region: 'Southern Utah',
      snowRegion: 'southern-utah',
      state: 'UT',
      country: 'US',
      coordinates: { lat: 37.7021, lon: -112.8499 },
      elevations: { baseFt: 9600, summitFt: 10920, verticalFt: 1320 },
      operations: {
        weekdayOpen: at(9, 30),
        weekendOpen: at(9, 30),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 0,
      },
      lifts: { total: 8, highSpeed: 4, windExposed: 3 },
      terrain: { trails: 71, acres: 650, aboveTreelineShare: 0.25, lateOpeningShare: 0.15 },
      weatherLocation: {
        point: { lat: 37.695, lon: -112.843 },
        forecastElevationFt: 10200,
        aspect: 'divide',
      },
      accessRoutes: buildRoutes('brian-head', { lat: 37.7021, lon: -112.8499 }, [
        { originId: 'las-vegas', label: 'I-15 north to Parowan, then SR-143', corridorId: 'i15-southern-utah', miles: 200, freeFlow: 180, stormPenalty: 30, weatherSensitivity: 0.55, primary: true },
        { originId: 'salt-lake-city', label: 'I-15 south to Parowan, then SR-143', corridorId: 'i15-southern-utah', miles: 245, freeFlow: 215, stormPenalty: 35, weatherSensitivity: 0.55 },
      ]),
      passAffiliations: ['independent'],
      popularity: 0.4,
      character: 'Utah’s highest base, Las Vegas’s nearest real snow, and usually the first lifts in the state to spin.',
    },
    {
      id: 'beaver-mountain',
      name: 'Beaver Mountain',
      shortName: 'THE BEAV',
      region: 'Cache Valley',
      snowRegion: 'wasatch',
      state: 'UT',
      country: 'US',
      coordinates: { lat: 41.9682, lon: -111.5426 },
      elevations: { baseFt: 7200, summitFt: 8800, verticalFt: 1600 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 0,
      },
      lifts: { total: 6, highSpeed: 0, windExposed: 1 },
      terrain: { trails: 48, acres: 828, aboveTreelineShare: 0.05, lateOpeningShare: 0.2 },
      weatherLocation: {
        point: { lat: 41.97, lon: -111.55 },
        forecastElevationFt: 8000,
        aspect: 'east-facing',
      },
      accessRoutes: buildRoutes('beaver-mountain', { lat: 41.9682, lon: -111.5426 }, [
        { originId: 'ogden', label: 'US-89/91 to Logan, then US-89 up Logan Canyon', corridorId: 'us89-logan-canyon', miles: 73, freeFlow: 90, stormPenalty: 30, weatherSensitivity: 0.6, primary: true },
        { originId: 'salt-lake-city', label: 'I-15 north to Logan, then US-89 up Logan Canyon', corridorId: 'us89-logan-canyon', miles: 110, freeFlow: 125, stormPenalty: 32, weatherSensitivity: 0.6 },
      ]),
      passAffiliations: ['indy'],
      popularity: 0.2,
      character: 'Family-run since 1939, fixed-grip chairs, cheap tickets and Bear River Range powder at the top of Logan Canyon.',
    },
    {
      id: 'cherry-peak',
      name: 'Cherry Peak',
      shortName: 'CHERRY PEAK',
      region: 'Cache Valley',
      snowRegion: 'wasatch',
      state: 'UT',
      country: 'US',
      coordinates: { lat: 41.9271, lon: -111.7559 },
      elevations: { baseFt: 5775, summitFt: 7040, verticalFt: 1265 },
      operations: {
        weekdayOpen: at(10, 0),
        weekendOpen: at(10, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 0,
      },
      lifts: { total: 4, highSpeed: 0, windExposed: 1 },
      terrain: { trails: 29, acres: 220, aboveTreelineShare: 0.05, lateOpeningShare: 0.35 },
      weatherLocation: {
        point: { lat: 41.93, lon: -111.748 },
        forecastElevationFt: 6400,
        aspect: 'west-facing',
      },
      accessRoutes: buildRoutes('cherry-peak', { lat: 41.9271, lon: -111.7559 }, [
        { originId: 'ogden', label: 'US-89/91 to Logan, then north to Richmond', corridorId: 'us89-logan-canyon', miles: 57, freeFlow: 68, stormPenalty: 15, weatherSensitivity: 0.35, primary: true },
        { originId: 'salt-lake-city', label: 'I-15 north to Logan, then north to Richmond', corridorId: 'us89-logan-canyon', miles: 95, freeFlow: 102, stormPenalty: 18, weatherSensitivity: 0.35 },
      ]),
      passAffiliations: ['indy'],
      popularity: 0.15,
      character: 'Utah’s newest ski area: small, low, and lit late into the night above Cache Valley.',
    },
  ],

  profiles: {
    alta: {
      officialWebsite: 'https://www.alta.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: { officialUrl: 'https://www.alta.com', source: 'official', imageUrl: null, pdfUrl: null, season: null },
      ticketUrl: null,
      passInfoUrl: 'https://www.ikonpass.com',
      phone: '801-359-1078',
      address: 'Highway 210, Alta, UT 84092',
      openingDate: { date: '2026-11-20', status: 'projected' },
      closingDate: TBD_DATE,
      grub: {
        picks: [
          { name: 'Sitzmark Club', note: 'The upstairs bar at the Alta Lodge: the canonical Alta après window seat.' },
          { name: "Goldminer's Daughter Saloon", note: 'Boots-on bar at the Wildcat base, right off the lifts.' },
          { name: 'Collins Grill', note: 'Sit-down lunch upstairs in the mid-mountain Watson Shelter.' },
          { name: "Alf's Restaurant", note: 'Mid-mountain day lodge between Sunnyside and Collins.' },
        ],
      },
      brews: {
        picks: [
          { name: 'Hog Wallow Pub', note: 'Cottonwood Heights après bar since 1947 with live music, about 20 minutes down canyon.' },
          { name: 'Bohemian Brewery', note: 'Czech-style lager brewpub in Midvale, roughly 25 minutes from the canyon mouth.' },
        ],
      },
      notes:
        'Skiers only: Alta does not allow snowboarding. Opening date Nov. 20 is Alta’s own "89th winter, conditions permitting" target as reported by KUTV/Ski Utah (Oct 2026). Passes: Ikon (7 days shared with Snowbird per Ski Utah’s 2026-27 guide) and Mountain Collective (2 days). Elevations use Alta’s commonly published 11,068 ft top (Mt. Baldy, hike-to); lift-served top is ~10,550 ft. Lift counts and trail count are best-available from prior knowledge, not re-verified this pass (search budget). No distinct snow-report or trail-map page URL surfaced in search, so those point at the site. Phone/address from prior knowledge. Not fetch-verified.',
    },
    snowbird: {
      officialWebsite: 'https://www.snowbird.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: { officialUrl: 'https://snowbird.com/maps', source: 'official', imageUrl: null, pdfUrl: null, season: null },
      ticketUrl: null,
      passInfoUrl: 'https://www.ikonpass.com',
      phone: '801-933-2222',
      address: '9385 S Snowbird Center Dr, Sandy, UT 84092',
      openingDate: { date: '2026-11-27', status: 'projected' },
      closingDate: TBD_DATE,
      grub: {
        picks: [
          { name: 'The Aerie', note: 'Top-floor restaurant and lounge in the Cliff Lodge with the canyon view.' },
          { name: 'Tram Club', note: 'Snowbird Center bar under the tram dock: the default après stop.' },
          { name: 'Lone Star Taqueria', note: 'Cottonwood Heights fish-taco shack at the bottom of the canyons, a Wasatch ritual.' },
        ],
        quickBreakfast: { name: 'Forklift', note: 'Breakfast counter-and-table spot in Snowbird Center, steps from the tram.' },
      },
      brews: {
        picks: [
          { name: 'Hog Wallow Pub', note: 'Live-music après bar at the mouth of Big Cottonwood, about 20 minutes away.' },
          { name: 'Bohemian Brewery', note: 'Czech-style lager brewpub in Midvale, roughly 25 minutes from the resort.' },
        ],
      },
      notes:
        'Opening date Nov. 27 per KUTV/Deseret News Oct 2026 summaries of Ski Utah’s list; the Deseret excerpt was ambiguous between Snowbird and Solitude, so treat as softer than usual. 2026-27 is adding a new Chickadee quad (learning area). Passes: Ikon (7 days shared with Alta) and Mountain Collective (2 days). Stats (3,240 ft vertical, ~2,500 acres, 169 runs) and lift counts are best-available from prior knowledge. Phone/address from prior knowledge. Not fetch-verified.',
    },
    brighton: {
      officialWebsite: 'https://www.brightonresort.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: { officialUrl: 'https://www.brightonresort.com', source: 'official', imageUrl: null, pdfUrl: null, season: null },
      ticketUrl: null,
      passInfoUrl: 'https://www.ikonpass.com',
      phone: '801-532-4731',
      address: '8302 S Brighton Loop Rd, Brighton, UT 84121',
      openingDate: TBD_DATE,
      closingDate: TBD_DATE,
      grub: {
        picks: [
          { name: "Molly Green's", note: 'A-frame bar at the base: burgers, beer and the Brighton crowd.' },
          { name: 'Milly Chalet', note: 'Base lodge cafe at the bottom of the Milly Express side.' },
          { name: 'Silver Fork Lodge', note: 'Historic canyon lodge restaurant a few miles down SR-190, known for breakfast.' },
        ],
      },
      brews: {
        picks: [
          { name: 'Hog Wallow Pub', note: 'Cottonwood Heights après bar at the canyon mouth, about 30 minutes down.' },
          { name: 'Porcupine Pub & Grille', note: 'Big beer list at the mouth of Big Cottonwood Canyon.' },
        ],
      },
      notes:
        'No 2026-27 opening date announced as of mid-October (Ikon and KUTV list TBA). Ikon: 7 days. Visit Utah lists 66 runs, 1,050+ acres and 1,875 ft of vert; the 8,755/10,500 ft elevations here give 1,745 ft; sources disagree. Lift counts from prior knowledge. Phone/address from prior knowledge. Not fetch-verified.',
    },
    solitude: {
      officialWebsite: 'https://www.solitudemountain.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: { officialUrl: 'https://www.solitudemountain.com', source: 'official', imageUrl: null, pdfUrl: null, season: null },
      ticketUrl: null,
      passInfoUrl: 'https://www.ikonpass.com',
      phone: '801-534-1400',
      address: '12000 Big Cottonwood Canyon Rd, Solitude, UT 84121',
      openingDate: { date: '2026-11-20', status: 'projected' },
      closingDate: TBD_DATE,
      grub: {
        picks: [
          { name: "St. Bernard's", note: 'European-alpine dinner room in the Inn at Solitude.' },
          { name: 'The Yurt', note: 'Snowshoe-in, five-course dinner in a yurt in the trees: reservations required.' },
          { name: 'Thirsty Squirrel', note: 'Village après bar at the base.' },
          { name: 'Silver Fork Lodge', note: 'Historic lodge restaurant just down canyon, a breakfast favorite.' },
        ],
      },
      brews: {
        picks: [
          { name: 'Hog Wallow Pub', note: 'Live-music après bar at the canyon mouth, about 25 minutes down.' },
          { name: 'Porcupine Pub & Grille', note: 'Big beer list at the mouth of Big Cottonwood Canyon.' },
        ],
      },
      notes:
        'Opening Nov. 20 is Solitude’s own target per Ikon/Ski Utah lists (OnTheSnow’s Nov. 26 conflicts). Ikon: unlimited. Stats/lift counts best-available from prior knowledge. Phone/address from prior knowledge. Not fetch-verified.',
    },
    'park-city': {
      officialWebsite: 'https://www.parkcitymountain.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: { officialUrl: 'https://www.parkcitymountain.com', source: 'official', imageUrl: null, pdfUrl: null, season: null },
      ticketUrl: null,
      passInfoUrl: 'https://www.epicpass.com',
      phone: '435-649-8111',
      address: '1345 Lowell Ave, Park City, UT 84060',
      openingDate: { date: '2026-11-20', status: 'projected' },
      closingDate: TBD_DATE,
      grub: {
        picks: [
          { name: 'The Corner Store Pub & Grill', note: 'Slopeside pub at the Mountain Village base: the town’s classic après deck.' },
          { name: 'No Name Saloon', note: 'Main Street bar famous for bison burgers.' },
          { name: 'Riverhorse on Main', note: 'Main Street fine dining, a Park City institution.' },
        ],
        quickBreakfast: { name: 'Five5eeds', note: 'Aussie-style breakfast cafe in Prospector, a few minutes from the lifts.' },
      },
      brews: {
        picks: [
          { name: 'Top of Main Brew Pub', note: 'The Main Street brewpub that was Wasatch Brew Pub until 2023.' },
          { name: 'Offset Bier Co.', note: 'Hop-forward and lager-minded local brewery; was planning a move to Quinn’s Junction.' },
          { name: 'Park City Brewing', note: 'Taproom with beers named for local history.' },
        ],
        distilleries: [
          { name: 'High West Saloon', note: 'Ski-in distillery saloon on Park Ave, off the Quittin’ Time run.' },
        ],
      },
      notes:
        'Opening Nov. 20 per Vail Resorts’ 2026-27 announcement (subject to conditions). 2026-27 parking: paid garages, $29 surface lots before noon/free after, carpools free (KPCW/TownLift). Lift/trail counts best-available (OnTheSnow lists 349 runs, 7,300 acres). Trail map links the site; the official trail-map page URL did not surface in search. Offset Bier’s location may have changed. Not fetch-verified.',
    },
    'deer-valley': {
      officialWebsite: 'https://www.deervalley.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: { officialUrl: 'https://www.deervalley.com', source: 'official', imageUrl: null, pdfUrl: null, season: null },
      ticketUrl: null,
      passInfoUrl: 'https://www.deervalley.com/media-room/031126-deer-valley-season-pass',
      phone: '435-649-1000',
      address: '2250 Deer Valley Dr S, Park City, UT 84060',
      openingDate: { date: '2026-12-05', status: 'projected' },
      closingDate: TBD_DATE,
      grub: {
        picks: [
          { name: 'Fireside Dining', note: 'Empire Canyon Lodge fondue and raclette by the fire.' },
          { name: 'The Mariposa', note: 'Silver Lake Lodge’s white-tablecloth dinner room.' },
          { name: 'Royal Street Café', note: 'Mid-mountain lunch and après at Silver Lake.' },
          { name: 'Glitretind', note: 'Stein Eriksen Lodge’s signature restaurant.' },
        ],
      },
      brews: {
        picks: [
          { name: 'Top of Main Brew Pub', note: 'Main Street brewpub (formerly Wasatch Brew Pub), a few minutes from Snow Park.' },
          { name: 'Offset Bier Co.', note: 'Local Park City brewery with a hop-forward and lager lineup.' },
        ],
        distilleries: [{ name: 'High West Saloon', note: 'Park City distillery saloon, about 10 minutes from Snow Park.' }],
      },
      notes:
        'Skiers only: Deer Valley does not allow snowboarding. Opening Dec. 5 per KPCW/TownLift (Sept 2026). EAST VILLAGE: for 2026-27 the Hail Peak Express opens ~200 new acres and seven runs, bringing the resort to 209 runs, 32 lifts and ~4,500 acres; East Village lodges and the permanent skier-services building are not due until 2027-28. Snow Park base renovation continues. Ikon: 7 days with reservations. High-speed lift count is an estimate. Not fetch-verified.',
    },
    snowbasin: {
      officialWebsite: 'https://www.snowbasin.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: { officialUrl: 'https://www.snowbasin.com', source: 'official', imageUrl: null, pdfUrl: null, season: null },
      ticketUrl: null,
      passInfoUrl: 'https://www.ikonpass.com',
      phone: '801-620-1000',
      address: '3925 Snowbasin Rd, Huntsville, UT 84317',
      openingDate: TBD_DATE,
      closingDate: TBD_DATE,
      grub: {
        picks: [
          { name: 'Cinnabar', note: 'Gastropub bar inside Earl’s Lodge at the base: Snowbasin’s après spot.' },
          { name: 'Needles Lodge', note: 'Mid-mountain lodge at the top of the Needles Gondola.' },
          { name: 'Shooting Star Saloon', note: 'Huntsville bar billed as Utah’s oldest, on the drive home past Pineview.' },
          { name: 'Eats of Eden', note: 'Casual Eden pizza and elk-chili spot in Ogden Valley.' },
        ],
      },
      brews: {
        picks: [
          { name: 'Roosters Brewing Co.', note: 'Brewpub on Ogden’s historic 25th Street, about 30 minutes away.' },
          { name: 'Talisman Brewing', note: 'Ogden craft brewery and taproom.' },
        ],
        distilleries: [{ name: "Ogden's Own Distillery", note: 'Ogden-based distillery, about 30 minutes away.' }],
      },
      notes:
        'No 2026-27 opening date found. Passes: Ikon (7 days) and Mountain Collective (2 days). Stats (2,900 ft vertical, 3,000 acres, ~110 runs, 12 lifts incl. gondolas and Allen Peak tram) best-available from prior knowledge. Snowbasin has no evening dining; Earl’s Lodge closes early. Phone/address from prior knowledge. Not fetch-verified.',
    },
    'powder-mountain': {
      officialWebsite: 'https://powdermountain.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: { officialUrl: 'https://powdermountain.com', source: 'official', imageUrl: null, pdfUrl: null, season: null },
      ticketUrl: null,
      passInfoUrl: 'https://powdermountain.com/season-passes',
      phone: '801-745-3772',
      address: '6965 E Powder Mountain Rd, Eden, UT 84310',
      openingDate: { date: '2026-12-11', status: 'projected' },
      closingDate: TBD_DATE,
      grub: {
        picks: [
          { name: 'Hidden Lake Lodge', note: 'Mid-mountain lodge, the on-hill lunch stop.' },
          { name: 'Eats of Eden', note: 'Casual Eden pizza and elk-chili spot at the bottom of the mountain road.' },
          { name: "Carlos & Harley's Fresh-Mex Cantina", note: 'Eden Tex-Mex with a full bar and margaritas.' },
          { name: 'Bower Lodge', note: 'Eden’s upscale room, open for après Wednesday–Sunday from 3pm.' },
        ],
      },
      brews: {
        picks: [
          { name: 'Roosters Brewing Co.', note: 'Brewpub on Ogden’s 25th Street, about 45 minutes down.' },
          { name: 'Talisman Brewing', note: 'Ogden craft brewery and taproom.' },
        ],
      },
      notes:
        'PASS: Powder Mountain accepts no multi-resort passes; its own season-pass page says Indy was no longer accepted after 2023-24; no Ikon/Mountain Collective deal found. Opening Dec. 11 per resort announcement. 2026-27: new DMI fixed-grip triple (~900 lift-served acres of expert terrain, opening when conditions allow), Sundown replaced with a high-speed quad, Doodle beginner lift; final season for Sunrise. ACREAGE is the softest number here: older listings say 2,800 lift-served acres (OnTheSnow) or 5,000 total; the resort claims 6,000+ public lift-served once the expansion is complete. 3,500 is a middle estimate for this season. Lift count/high-speed count approximate. Not fetch-verified.',
    },
    'nordic-valley': {
      officialWebsite: 'https://www.nordicvalley.ski',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: { officialUrl: 'https://www.nordicvalley.ski', source: 'official', imageUrl: null, pdfUrl: null, season: null },
      ticketUrl: null,
      passInfoUrl: 'https://www.nordicvalley.ski/nordic-valley-2026-2027-power-pass-perks/',
      phone: null,
      address: '3567 Nordic Valley Way, Eden, UT 84310',
      openingDate: TBD_DATE,
      closingDate: TBD_DATE,
      grub: {
        picks: [
          { name: 'Eats of Eden', note: 'Casual Eden pizza and elk-chili spot, about 10 minutes away.' },
          { name: 'Shooting Star Saloon', note: 'Huntsville bar billed as Utah’s oldest, across the valley.' },
        ],
      },
      brews: {
        picks: [{ name: 'Roosters Brewing Co.', note: 'Brewpub on Ogden’s 25th Street, about 25 minutes over the pass.' }],
      },
      notes:
        'Pass: Power Pass (Mountain Capital Partners), with no Epic/Ikon/Mountain Collective/Indy affiliation found, so "independent" here. New skier-services building slated for 2026-27. Stats vary widely between sources: 450–500 acres, ~40 runs, 1,700 ft vertical (older listings say 960–1,000 ft and 140–300 acres); summit cited as 7,060–7,600 ft. Lift mix per Visit Ogden: one six-pack, one triple, two doubles, one surface; whether the six-pack is detachable could not be confirmed, so highSpeed is 0. Phone conflicts between sources (801-745-3511 vs 385-298-0155), left null. Night skiing offered. Not fetch-verified.',
    },
    sundance: {
      officialWebsite: 'https://www.sundanceresort.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: { officialUrl: 'https://www.sundanceresort.com', source: 'official', imageUrl: null, pdfUrl: null, season: null },
      ticketUrl: 'https://www.sundanceresort.com/tickets-passes',
      passInfoUrl: null,
      phone: null,
      address: null,
      openingDate: TBD_DATE,
      closingDate: TBD_DATE,
      grub: {
        picks: [
          { name: 'Tree Room', note: 'Sundance’s signature dinner room, built around a living tree.' },
          { name: 'Foundry Grill', note: 'Wood-oven American at the base; the weekend brunch is the draw.' },
        ],
        quickBreakfast: { name: 'Sundance Deli', note: 'Grab-and-go counter in the village by the lifts.' },
      },
      brews: {
        picks: [{ name: 'Owl Bar', note: 'Village bar built around a restored 1890s Wyoming bar Butch Cassidy drank at.' }],
      },
      notes:
        'No multi-resort pass found (Ski Utah’s Ikon, Indy and Mountain Collective lists omit it); Power Pass holders get partner days, so "independent". 2026-27: new Electric Horseman detachable quad (~1,850 ft per lap) and the Storyteller ridge run bring the total to ~605 acres; added-acre figures vary (68–105). OnTheSnow projects a Dec. 4 opening but that is third-party, so TBD here. Trail count and lift total approximate. Phone/address not confirmed from an official source this pass. Not fetch-verified.',
    },
    'brian-head': {
      officialWebsite: 'https://www.brianhead.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: { officialUrl: 'https://www.brianhead.com', source: 'official', imageUrl: null, pdfUrl: null, season: null },
      ticketUrl: null,
      passInfoUrl: null,
      phone: null,
      address: null,
      openingDate: { date: '2026-11-06', status: 'projected' },
      closingDate: TBD_DATE,
      grub: {
        picks: [
          { name: 'Lift Bar & Patio', note: 'Full bar, burgers and big screens on the Brian Head Lodge’s second floor near Navajo Express.' },
          { name: 'Last Chair Grill & Brews', note: 'Draft beer and live entertainment: the busiest après room in town.' },
        ],
      },
      brews: {
        picks: [{ name: 'Policy Kings Brewery', note: 'Cedar City taproom, about 45 minutes down the mountain.' }],
      },
      notes:
        'Opening Nov. 6 (the earliest in Utah) per Deseret News/Ski Utah Oct 2026; phased start around Navajo and Giant Steps. Pass: Power Pass (Mountain Capital Partners), with no Epic/Ikon/Indy found → "independent". Summit elevation is inconsistent across sources (10,920–11,307 ft); the lift-served 1,320 ft vertical is used. Lift count 8 (OnTheSnow: 4 high-speed quads, 2 triples, 2 surface). SR-143 between Panguitch Lake and Brian Head frequently closes in winter; approach from Parowan. Resort phone/street address not confirmed (Brian Head Lodge lists 435-677-9000). Not fetch-verified.',
    },
    'beaver-mountain': {
      officialWebsite: 'https://www.skithebeav.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: { officialUrl: 'https://www.skithebeav.com', source: 'official', imageUrl: null, pdfUrl: null, season: null },
      ticketUrl: null,
      passInfoUrl: 'https://www.indyskipass.com',
      phone: '435-753-0921',
      address: '40000 E Highway 89, Garden City, UT 84028',
      openingDate: TBD_DATE,
      closingDate: TBD_DATE,
      grub: {
        town: 'Logan / Garden City',
        picks: [
          { name: "Herm's Inn", note: 'Breakfast institution at the mouth of Logan Canyon, on the way up.' },
          { name: "LaBeau's", note: 'Garden City drive-in for Bear Lake raspberry shakes, 15 minutes over the summit.' },
        ],
      },
      brews: {
        picks: [
          { name: 'Prodigy Brewing', note: 'Cache Valley’s first brewpub, downtown Logan, about 45 minutes back down the canyon.' },
          { name: 'Home Range Brewing', note: 'Main Street Logan taproom with bring-your-own food.' },
        ],
      },
      notes:
        'Indy Pass partner for 2026-27. With Eagle Point closed, Utah’s only full Indy partner this winter (POWDER). Family-owned since 1939. Stats vary: 828 acres (Ski Utah) vs 880 (OnTheSnow); 1,600–1,700 ft vertical; 4 chairs (3 triples, 1 double) plus 2 surface. Phone is from an older Frommer’s listing and may be dated; address per Engen Museum. Not fetch-verified.',
    },
    'cherry-peak': {
      officialWebsite: 'https://www.skicherrypeak.com',
      snowReportUrl: null,
      webcamUrl: null,
      trailMap: { officialUrl: 'https://www.skicherrypeak.com', source: 'official', imageUrl: null, pdfUrl: null, season: null },
      ticketUrl: null,
      passInfoUrl: 'https://www.indyskipass.com',
      phone: null,
      address: '3200 E 11000 N, Richmond, UT 84333',
      openingDate: TBD_DATE,
      closingDate: TBD_DATE,
      brews: {
        picks: [
          { name: 'Prodigy Brewing', note: 'Cache Valley’s first brewpub, downtown Logan, about 25 minutes south.' },
          { name: 'Home Range Brewing', note: 'Main Street Logan taproom.' },
        ],
      },
      notes:
        'Indy: listed as an "Allied Resort" in OnTheSnow’s 2026-27 Indy guide, which is a looser tier than a full partner, so treat the Indy tag as indicative. Opening TBD (Deseret Oct 2026). Resort was listed for sale ($22.5M, July 2026) with operations continuing. Stats from that listing: 220+ acres, 29 runs, three triple chairs plus a conveyor, 1,265 ft vertical. Night skiing Mon–Sat to 9pm (Visit Utah); weekday day-session start time is approximate. OFFICIAL URL CAVEAT: skicherrypeak.com is the resort’s known domain but did not surface in this pass’s search results (search budget ran out); spot-check it. No grub picks: Richmond has little, and Logan picks weren’t verified. Not fetch-verified.',
    },
  },

  parking: {
    alta: {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'partial',
      freeOptionAvailable: true,
      notes: [
        '2025-26: parking reservations required Fri–Sun and holidays, 8am–1pm (Dec. 12 – Apr. 5, plus closing day); weekdays need no reservation. Booked at altaparking.com, released Sundays at 3pm.',
        'Paid early-morning reservations ($25) allow parking from 6am in the South Flagstaff lot. Fines for parking without a reservation are reported at $150–$250.',
      ],
      infoUrl: 'https://www.alta.com/parking-and-road',
    },
    snowbird: {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'partial',
      freeOptionAvailable: true,
      notes: [
        '2026-27: most parking stays free, first-come first-served; passholders get a free rolling reservation in the Upper Gad Valley lot (one active at a time).',
        'Paid reservations in Lower Gad Valley, the Pond Lot and Chickadee Lot; the 2026-27 Preferred Parking Pass is sold out. SR-210 roadside parking depends on conditions (~7am Mountain Report).',
      ],
      infoUrl: 'https://www.snowbird.com/parking',
    },
    brighton: {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'partial',
      freeOptionAvailable: null,
      notes: [
        'Per the resort’s parking page (24/25 rules): reservations required for vehicles arriving before noon on weekends and holidays; the lot is closed midnight–7am daily for grooming.',
        'UDOT reports a $25/day paid reservation with a $10 rate for 4+ occupants; UTA ski bus is free for Brighton season passholders. Check the current season’s rules.',
      ],
      infoUrl: 'https://brightonresort.com/parking',
    },
    solitude: {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'partial',
      freeOptionAvailable: true,
      notes: [
        '2025-26: free parking Monday–Thursday (non-holiday). Fri–Sun and holidays, reservations required for arrivals before 11am ($35 for 1–3 occupants); 11am–1pm daily rate without reservation if space allows.',
        'Carpools of 4+ park free; Solitude and Ikon passholders ride the UTA ski bus free.',
      ],
      infoUrl: 'https://www.solitudemountain.com/transportation',
    },
    'park-city': {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'partial',
      freeOptionAvailable: true,
      notes: [
        '2026-27 plan: season garage passes ($825) for the Canyons Village and Mountain Village garages; surface-lot day parking $29 before noon and free after noon in both villages.',
        'Carpools park free all day. 2025-26 used paid reservations at Mountain Village (First Time, Main, select Silver King lots); confirm whether reservations carry over.',
      ],
      infoUrl: 'https://www.parkcitymountain.com/explore-the-resort/about-the-resort/getting-here.aspx',
    },
    'deer-valley': {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'not-required',
      freeOptionAvailable: true,
      notes: [
        '2025-26: Snow Park and Deer Valley East Village parking free to everyone (East Village ~1,200 day-skier spaces); Snow Park lots are roughly halved by base construction, and Lot 2 is 3+ occupants on weekends/holidays.',
        'Jordanelle Gondola lot is paid except for passholders (who must register) and 3+ carpools. Overflow at Richardson Flat Park & Ride with a free bus every 15 minutes.',
      ],
      infoUrl: 'https://www.deervalley.com/explore-the-mountain/guest-services',
    },
    snowbasin: {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'not-required',
      freeOptionAvailable: true,
      notes: [
        'Free parking, no reservations (2025-26, per Ski Utah and KSL).',
        'Earl’s A lot is held for carpools of 3+; in 2024-25 Earl’s lots A–E were 3+ only on weekends until 11am; check whether that still applies.',
      ],
      infoUrl: SKI_UTAH_PARKING,
    },
    'powder-mountain': {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'not-required',
      freeOptionAvailable: true,
      notes: [
        'Paid parking introduced in 2024-25: $12 per vehicle before 1pm on weekends and holidays, paid by app, first-come first-served (no reservations).',
        'Carpools of 3+ exempt (sources differ on whether that is daily or weekends only). 2025-26/2026-27 rules not confirmed.',
      ],
      infoUrl: 'https://powdermountain.com',
    },
    'nordic-valley': {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'unknown',
      freeOptionAvailable: null,
      notes: ['No published parking policy surfaced in research; base-area lot at the resort. Check Ski Utah’s parking guide or the resort before a holiday.'],
      infoUrl: SKI_UTAH_PARKING,
    },
    sundance: {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'unknown',
      freeOptionAvailable: null,
      notes: ['No current Sundance parking policy surfaced in research; base lots off SR-92 by the village. Check Ski Utah’s parking guide or the resort.'],
      infoUrl: SKI_UTAH_PARKING,
    },
    'brian-head': {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'unknown',
      freeOptionAvailable: null,
      notes: [
        'Base lots at Navajo and Giant Steps; no current parking policy surfaced in research.',
        'SR-143 between Panguitch Lake and Brian Head often closes in winter. Come up from Parowan; check UDOT.',
      ],
      infoUrl: 'https://www.brianhead.com/getting-here/',
    },
    'beaver-mountain': {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'unknown',
      freeOptionAvailable: null,
      notes: ['Single base-area lot off US-89 at the top of Logan Canyon; no published reservation system found. Check Ski Utah’s parking guide.'],
      infoUrl: SKI_UTAH_PARKING,
    },
    'cherry-peak': {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'not-required',
      freeOptionAvailable: true,
      notes: ['Free, first-come first-served gravel lot at the base lodge (Visit Utah / Ski Utah). No public transit to the resort.'],
      infoUrl: 'https://www.visitutah.com/Places-To-Go/Utah-Ski-Resorts/Cherry-Peak',
    },
  },

  pricing: {
    alta: { mountainId: 'alta', currency: 'USD', windowRate: 199, advanceFloor: 149, dynamicRange: 0.55 },
    snowbird: { mountainId: 'snowbird', currency: 'USD', windowRate: 239, advanceFloor: 139, dynamicRange: 0.8 },
    brighton: { mountainId: 'brighton', currency: 'USD', windowRate: 169, advanceFloor: 109, dynamicRange: 0.6 },
    solitude: { mountainId: 'solitude', currency: 'USD', windowRate: 199, advanceFloor: 119, dynamicRange: 0.75 },
    'park-city': { mountainId: 'park-city', currency: 'USD', windowRate: 299, advanceFloor: 179, dynamicRange: 0.95 },
    'deer-valley': { mountainId: 'deer-valley', currency: 'USD', windowRate: 339, advanceFloor: 219, dynamicRange: 0.9 },
    snowbasin: { mountainId: 'snowbasin', currency: 'USD', windowRate: 199, advanceFloor: 129, dynamicRange: 0.7 },
    // Powder sells its own tickets, caps sales, and doesn't play the mega-pass game.
    'powder-mountain': { mountainId: 'powder-mountain', currency: 'USD', windowRate: 149, advanceFloor: 109, dynamicRange: 0.45 },
    'nordic-valley': { mountainId: 'nordic-valley', currency: 'USD', windowRate: 89, advanceFloor: 65, dynamicRange: 0.3 },
    sundance: { mountainId: 'sundance', currency: 'USD', windowRate: 159, advanceFloor: 99, dynamicRange: 0.5 },
    'brian-head': { mountainId: 'brian-head', currency: 'USD', windowRate: 119, advanceFloor: 79, dynamicRange: 0.5 },
    // The Beav and Cherry Peak are flat-priced family hills — almost no flex at all.
    'beaver-mountain': { mountainId: 'beaver-mountain', currency: 'USD', windowRate: 75, advanceFloor: 69, dynamicRange: 0.1 },
    'cherry-peak': { mountainId: 'cherry-peak', currency: 'USD', windowRate: 69, advanceFloor: 59, dynamicRange: 0.15 },
  },

  demo: {
    // Alta: the deepest snow in the state, big control delays, and a canyon road that closes on the best days.
    alta: { snow: 1.7, wind: 1.05, operations: 0.85, crowds: 0.95, grooming: 0.55, controlDelay: 60 },
    // Snowbird: nearly Alta's snow with more steep, more exposure up top, and interlodge on the big cycles.
    snowbird: { snow: 1.6, wind: 1.25, operations: 0.85, crowds: 1.0, grooming: 0.6, controlDelay: 60 },
    // Brighton: high base, deep snow, trees for storm days — weekend parking is its choke point.
    brighton: { snow: 1.45, wind: 0.8, operations: 1.0, crowds: 1.05, grooming: 0.75, controlDelay: 30 },
    // Solitude: Cottonwood snow with the thinnest Cottonwood crowds; Honeycomb waits on control work.
    solitude: { snow: 1.45, wind: 0.9, operations: 1.0, crowds: 0.7, grooming: 0.72, controlDelay: 35 },
    // Park City: lee-side snow but a vast, dependable lift network and Utah's biggest crowds.
    'park-city': { snow: 0.85, wind: 0.85, operations: 1.12, crowds: 1.25, grooming: 0.9, controlDelay: 15 },
    // Deer Valley: the best grooming anywhere, light snow for the Wasatch, capped ticket sales keep lines sane.
    'deer-valley': { snow: 0.8, wind: 0.65, operations: 1.15, crowds: 0.8, grooming: 0.98, controlDelay: 10 },
    // Snowbasin: solid snow, superb lifts, empty slopes — the upper bowls are wind- and control-limited.
    snowbasin: { snow: 1.15, wind: 1.15, operations: 1.08, crowds: 0.5, grooming: 0.8, controlDelay: 30 },
    // Powder Mountain: snow that stays untracked for days, old slow lifts, and an exposed summit road.
    'powder-mountain': { snow: 1.3, wind: 1.2, operations: 0.9, crowds: 0.4, grooming: 0.5, controlDelay: 20 },
    // Nordic Valley: low and fast-melting, but cheap, close to Ogden and almost never crowded.
    'nordic-valley': { snow: 0.75, wind: 0.6, operations: 1.0, crowds: 0.45, grooming: 0.82, controlDelay: 5 },
    // Sundance: modest snow at a low base, sheltered and quiet — the new express helps the back side.
    sundance: { snow: 0.85, wind: 0.55, operations: 1.02, crowds: 0.5, grooming: 0.8, controlDelay: 10 },
    // Brian Head: high and early, on its own southern storm track, windy on the plateau, flooded by Vegas weekends.
    'brian-head': { snow: 1.1, wind: 1.3, operations: 0.95, crowds: 0.85, grooming: 0.82, controlDelay: 15 },
    // Beaver Mountain: deep Bear River Range snow on fixed-grip chairs, uncrowded, groomed by a small crew.
    'beaver-mountain': { snow: 1.25, wind: 0.75, operations: 0.95, crowds: 0.35, grooming: 0.6, controlDelay: 10 },
    // Cherry Peak: low and marginal for snow, but lit at night with hardly anyone in line.
    'cherry-peak': { snow: 0.7, wind: 0.7, operations: 0.95, crowds: 0.3, grooming: 0.75, controlDelay: 5 },
  },
};
