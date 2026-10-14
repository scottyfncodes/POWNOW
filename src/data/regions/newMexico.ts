import { buildRoutes } from '@/data/buildRoutes';
import { TBD_DATE } from '@/domain/mountainProfile';
import { at } from '@/domain/time';
import type { RegionDataset } from './types';

/**
 * New Mexico — every lift-served ski area in the state that is clearly
 * operating for 2026-27: Taos Ski Valley, Ski Santa Fe, Angel Fire, Red
 * River, Sipapu, Pajarito Mountain and Ski Apache.
 *
 * Researched via web search in October 2026, ahead of the 2026-27 season.
 * The sandbox could not fetch resort sites directly (DNS blocked), so
 * nothing here is fetch-verified: every URL is a real, indexed URL from
 * search results, never invented, but a human should spot-check before
 * leaning on it. Stats are the resort's own published figures where a
 * search surfaced them; where sources disagreed, the choice is explained in
 * that mountain's profile `notes`. Drive distances/times are representative
 * clear-road estimates, not routing-API output. The research hit the
 * session's web-search budget before ticket prices for Taos, Sipapu and
 * Pajarito could be confirmed for 2026-27; those rates are best estimates
 * and say so in their notes.
 *
 * Pass affiliations: Taos is Ikon + Mountain Collective (both confirmed for
 * 2026-27). Sipapu and Pajarito are on Mountain Capital Partners' Power
 * Pass, which isn't one of the networks this app models, so they are
 * `independent` here (as Purgatory is). No 2026-27 Indy Pass partnership
 * was found for any New Mexico area; Ski Santa Fe, Angel Fire, Red River
 * and Ski Apache sell only their own passes (Red River also has reciprocal
 * days with Monarch, which isn't modelled either).
 *
 * Deliberate omissions:
 *  - Sandia Peak Ski Area (Albuquerque): left out. It ran a short 2025-26
 *    season after lift repairs, and it's listed on the 2026-27 Power Pass,
 *    but no official 2026-27 operating announcement or opening date turned
 *    up. The only dates found were third-party projections, it's had
 *    seasons with no lifts running, and its chairs are old. It doesn't meet
 *    the "clearly operating" bar yet. If it does open, add it as a
 *    northern-new-mexico mountain from albuquerque.
 *  - Enchanted Forest (Red River) is a Nordic-only area with no lifts.
 */
export const NEW_MEXICO: RegionDataset = {
  mountains: [
    {
      id: 'taos',
      name: 'Taos Ski Valley',
      shortName: 'TAOS',
      region: 'Enchanted Circle',
      snowRegion: 'northern-new-mexico',
      state: 'NM',
      country: 'US',
      coordinates: { lat: 36.596, lon: -105.4545 },
      elevations: { baseFt: 9200, summitFt: 12481, verticalFt: 3281 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 30,
      },
      lifts: { total: 12, highSpeed: 3, windExposed: 4 },
      terrain: { trails: 119, acres: 1294, aboveTreelineShare: 0.25, lateOpeningShare: 0.45 },
      weatherLocation: {
        point: { lat: 36.5795, lon: -105.4575 },
        forecastElevationFt: 10800,
        aspect: 'west-facing',
      },
      accessRoutes: buildRoutes('taos', { lat: 36.596, lon: -105.4545 }, [
        { originId: 'santa-fe', label: 'US-84 / NM-68 to Taos, NM-150 up the valley', corridorId: 'nm-enchanted-circle', miles: 88, freeFlow: 115, stormPenalty: 25, weatherSensitivity: 0.65, primary: true },
        { originId: 'albuquerque', label: 'I-25 to Santa Fe, NM-68 to Taos, NM-150', corridorId: 'nm-enchanted-circle', miles: 152, freeFlow: 168, stormPenalty: 28, weatherSensitivity: 0.62 },
        { originId: 'colorado-springs', label: 'I-25 south, US-160 / CO-159 through the San Luis Valley', corridorId: 'i25-raton', miles: 228, freeFlow: 238, stormPenalty: 34, weatherSensitivity: 0.7 },
        { originId: 'denver', label: 'I-25 south, US-160 / CO-159 through the San Luis Valley', corridorId: 'i25-raton', miles: 298, freeFlow: 302, stormPenalty: 36, weatherSensitivity: 0.7 },
        { originId: 'durango', label: 'US-160 / US-84 to Tierra Amarilla, US-64 over Brazos summit', corridorId: 'us550-durango', miles: 200, freeFlow: 255, stormPenalty: 45, weatherSensitivity: 0.88 },
      ]),
      passAffiliations: ['ikon', 'mountain-collective'],
      popularity: 0.7,
      character: 'Steep, high and proud of it. Hike the ridge, earn the chute, and finish with a stein at the Bavarian.',
    },
    {
      id: 'ski-santa-fe',
      name: 'Ski Santa Fe',
      shortName: 'SANTA FE',
      region: 'Santa Fe',
      snowRegion: 'northern-new-mexico',
      state: 'NM',
      country: 'US',
      coordinates: { lat: 35.796, lon: -105.804 },
      elevations: { baseFt: 10350, summitFt: 12075, verticalFt: 1725 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 15,
      },
      lifts: { total: 6, highSpeed: 1, windExposed: 2 },
      terrain: { trails: 90, acres: 660, aboveTreelineShare: 0.12, lateOpeningShare: 0.3 },
      weatherLocation: {
        point: { lat: 35.7905, lon: -105.7985 },
        forecastElevationFt: 11200,
        aspect: 'west-facing',
      },
      accessRoutes: buildRoutes('ski-santa-fe', { lat: 35.796, lon: -105.804 }, [
        { originId: 'santa-fe', label: 'NM-475 / Hyde Park Road', corridorId: 'nm475-hyde-park', miles: 16, freeFlow: 30, stormPenalty: 15, weatherSensitivity: 0.75, primary: true },
        { originId: 'albuquerque', label: 'I-25 north to Santa Fe, NM-475', corridorId: 'nm475-hyde-park', miles: 75, freeFlow: 95, stormPenalty: 20, weatherSensitivity: 0.68 },
        { originId: 'durango', label: 'US-160 / US-84 via Chama and Española, NM-475', corridorId: 'us550-durango', miles: 231, freeFlow: 265, stormPenalty: 40, weatherSensitivity: 0.78 },
      ]),
      passAffiliations: ['independent'],
      popularity: 0.6,
      character: 'Highest base in New Mexico, half an hour up the road from the Plaza. A city hill with an alpine top.',
    },
    {
      id: 'angel-fire',
      name: 'Angel Fire Resort',
      shortName: 'ANGEL FIRE',
      region: 'Enchanted Circle',
      snowRegion: 'northern-new-mexico',
      state: 'NM',
      country: 'US',
      coordinates: { lat: 36.393, lon: -105.285 },
      elevations: { baseFt: 8554, summitFt: 10677, verticalFt: 2123 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 15,
      },
      lifts: { total: 8, highSpeed: 3, windExposed: 2 },
      terrain: { trails: 96, acres: 627, aboveTreelineShare: 0.03, lateOpeningShare: 0.15 },
      weatherLocation: {
        point: { lat: 36.3875, lon: -105.2985 },
        forecastElevationFt: 9600,
        aspect: 'east-facing',
      },
      accessRoutes: buildRoutes('angel-fire', { lat: 36.393, lon: -105.285 }, [
        { originId: 'santa-fe', label: 'NM-68 to Taos, US-64 over Palo Flechado Pass', corridorId: 'nm-enchanted-circle', miles: 95, freeFlow: 125, stormPenalty: 28, weatherSensitivity: 0.7, primary: true },
        { originId: 'albuquerque', label: 'I-25 to Santa Fe, NM-68 to Taos, US-64 east', corridorId: 'nm-enchanted-circle', miles: 158, freeFlow: 178, stormPenalty: 30, weatherSensitivity: 0.66 },
        { originId: 'colorado-springs', label: 'I-25 south over Raton Pass, US-64 through Cimarron Canyon', corridorId: 'i25-raton', miles: 237, freeFlow: 228, stormPenalty: 32, weatherSensitivity: 0.66 },
        { originId: 'denver', label: 'I-25 south over Raton Pass, US-64 through Cimarron Canyon', corridorId: 'i25-raton', miles: 307, freeFlow: 293, stormPenalty: 34, weatherSensitivity: 0.66 },
      ]),
      passAffiliations: ['independent'],
      popularity: 0.45,
      character: 'The Enchanted Circle\'s family mountain: wide groomers, a lodge at the bottom, and the state\'s first six-pack.',
    },
    {
      id: 'red-river',
      name: 'Red River Ski Area',
      shortName: 'RED RIVER',
      region: 'Enchanted Circle',
      snowRegion: 'northern-new-mexico',
      state: 'NM',
      country: 'US',
      coordinates: { lat: 36.705, lon: -105.411 },
      elevations: { baseFt: 8750, summitFt: 10350, verticalFt: 1600 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 15,
      },
      lifts: { total: 7, highSpeed: 0, windExposed: 2 },
      terrain: { trails: 64, acres: 290, aboveTreelineShare: 0.02, lateOpeningShare: 0.2 },
      weatherLocation: {
        point: { lat: 36.6965, lon: -105.4185 },
        forecastElevationFt: 9600,
        aspect: 'east-facing',
      },
      accessRoutes: buildRoutes('red-river', { lat: 36.705, lon: -105.411 }, [
        { originId: 'santa-fe', label: 'NM-68 to Taos, NM-522 to Questa, NM-38 east', corridorId: 'nm-enchanted-circle', miles: 105, freeFlow: 135, stormPenalty: 26, weatherSensitivity: 0.66, primary: true },
        { originId: 'albuquerque', label: 'I-25 to Santa Fe, NM-68 / NM-522 / NM-38', corridorId: 'nm-enchanted-circle', miles: 168, freeFlow: 188, stormPenalty: 28, weatherSensitivity: 0.63 },
        { originId: 'colorado-springs', label: 'I-25 south, US-160 / CO-159 to Questa, NM-38', corridorId: 'i25-raton', miles: 210, freeFlow: 212, stormPenalty: 32, weatherSensitivity: 0.68 },
        { originId: 'denver', label: 'I-25 south, US-160 / CO-159 to Questa, NM-38', corridorId: 'i25-raton', miles: 280, freeFlow: 277, stormPenalty: 34, weatherSensitivity: 0.68 },
      ]),
      passAffiliations: ['independent'],
      popularity: 0.5,
      character: 'The lifts come down into a Western main street of saloons and Texas plates. You can walk from your condo to the chair.',
    },
    {
      id: 'sipapu',
      name: 'Sipapu',
      shortName: 'SIPAPU',
      region: 'Sangre de Cristos',
      snowRegion: 'northern-new-mexico',
      state: 'NM',
      country: 'US',
      coordinates: { lat: 36.153, lon: -105.544 },
      elevations: { baseFt: 8200, summitFt: 9255, verticalFt: 1055 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 10,
      },
      lifts: { total: 6, highSpeed: 0, windExposed: 1 },
      terrain: { trails: 43, acres: 215, aboveTreelineShare: 0, lateOpeningShare: 0.25 },
      weatherLocation: {
        point: { lat: 36.1475, lon: -105.5475 },
        forecastElevationFt: 8700,
        aspect: 'west-facing',
      },
      accessRoutes: buildRoutes('sipapu', { lat: 36.153, lon: -105.544 }, [
        { originId: 'santa-fe', label: 'US-84 to Española, NM-68 / NM-75 / NM-518', corridorId: 'nm-high-road', miles: 65, freeFlow: 85, stormPenalty: 20, weatherSensitivity: 0.6, primary: true },
        { originId: 'albuquerque', label: 'I-25 to Santa Fe, US-84 / NM-68 / NM-75 / NM-518', corridorId: 'nm-high-road', miles: 125, freeFlow: 145, stormPenalty: 24, weatherSensitivity: 0.58 },
      ]),
      passAffiliations: ['independent'],
      popularity: 0.25,
      character: 'Small, cheap, nearly always the first area in New Mexico to open, and hardly anyone in line.',
    },
    {
      id: 'pajarito',
      name: 'Pajarito Mountain',
      shortName: 'PAJARITO',
      region: 'Jemez Mountains',
      snowRegion: 'northern-new-mexico',
      state: 'NM',
      country: 'US',
      coordinates: { lat: 35.886, lon: -106.392 },
      elevations: { baseFt: 9000, summitFt: 10440, verticalFt: 1440 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 15,
      },
      lifts: { total: 6, highSpeed: 0, windExposed: 2 },
      terrain: { trails: 53, acres: 280, aboveTreelineShare: 0.02, lateOpeningShare: 0.5 },
      weatherLocation: {
        point: { lat: 35.8875, lon: -106.402 },
        forecastElevationFt: 9800,
        aspect: 'east-facing',
      },
      accessRoutes: buildRoutes('pajarito', { lat: 35.886, lon: -106.392 }, [
        { originId: 'santa-fe', label: 'US-84/285 to Pojoaque, NM-502 to Los Alamos, Camp May Road', corridorId: 'nm-jemez', miles: 45, freeFlow: 62, stormPenalty: 18, weatherSensitivity: 0.62, primary: true },
        { originId: 'albuquerque', label: 'I-25 to Santa Fe, US-84/285 / NM-502 to Los Alamos', corridorId: 'nm-jemez', miles: 105, freeFlow: 120, stormPenalty: 22, weatherSensitivity: 0.58 },
      ]),
      passAffiliations: ['independent'],
      popularity: 0.2,
      character: 'The Los Alamos locals\' hill: steep bumps and glades, three days a week, when the snow shows up.',
    },
    {
      id: 'ski-apache',
      name: 'Ski Apache',
      shortName: 'SKI APACHE',
      region: 'Sacramento Mountains',
      snowRegion: 'southern-new-mexico',
      state: 'NM',
      country: 'US',
      coordinates: { lat: 33.397, lon: -105.789 },
      elevations: { baseFt: 9600, summitFt: 11500, verticalFt: 1900 },
      operations: {
        weekdayOpen: at(9, 0),
        weekendOpen: at(9, 0),
        lastChair: at(16, 0),
        upperMountainOpenOffset: 20,
      },
      lifts: { total: 11, highSpeed: 1, windExposed: 4 },
      terrain: { trails: 55, acres: 750, aboveTreelineShare: 0.12, lateOpeningShare: 0.4 },
      weatherLocation: {
        point: { lat: 33.3935, lon: -105.7985 },
        forecastElevationFt: 10500,
        aspect: 'east-facing',
      },
      accessRoutes: buildRoutes('ski-apache', { lat: 33.397, lon: -105.789 }, [
        { originId: 'albuquerque', label: 'I-25 / US-54 to Carrizozo, US-380 / NM-37 / NM-48 / NM-532', corridorId: 'nm-sacramento-mtns', miles: 205, freeFlow: 232, stormPenalty: 30, weatherSensitivity: 0.62, primary: true },
        { originId: 'santa-fe', label: 'US-285 / US-54 to Carrizozo, NM-37 / NM-48 / NM-532', corridorId: 'nm-sacramento-mtns', miles: 245, freeFlow: 280, stormPenalty: 32, weatherSensitivity: 0.6 },
      ]),
      passAffiliations: ['independent'],
      popularity: 0.45,
      character: 'Owned by the Mescalero Apache Tribe, with a gondola to 11,500 feet above the desert. The summit is a wind tunnel on the wrong day.',
    },
  ],

  profiles: {
    taos: {
      officialWebsite: 'https://taosskivalley.com',
      snowReportUrl: 'https://taosskivalley.com/weather-snow-report/',
      webcamUrl: 'https://taosskivalley.com/weather-snow-report/',
      trailMap: {
        officialUrl: 'https://taosskivalley.com/play/winter-activities/ski-snowboard/',
        source: 'official',
        // The ski & snowboard page links the downloadable map. No direct asset URL with a confirmable season turned up.
        imageUrl: null,
        pdfUrl: null,
        season: null,
      },
      ticketUrl: 'https://taosskivalley.com/play/winter-activities/lift-tickets-season-passes/',
      passInfoUrl: 'https://www.ikonpass.com',
      phone: '575-776-2291',
      address: 'P.O. Box 90, Taos Ski Valley, NM 87525',
      openingDate: { date: '2026-11-26', status: 'projected' },
      closingDate: TBD_DATE,
      grub: {
        picks: [
          { name: 'The Bavarian', note: 'Kachina Basin lodge: German beer in steins, goulash and fondue on the terrace. The classic Taos après.' },
          { name: 'Rathskeller at Hotel St. Bernard', note: 'Long-running base-area bar for a drink and snacks after the last run.' },
          { name: 'Blonde Bear Tavern', note: 'Edelweiss Lodge tavern for après and dinner, usually Thursday to Monday.' },
          { name: "Doc Martin's", note: 'New Mexican classics inside the historic Taos Inn, downtown. Worth the 20-mile drive down.' },
        ],
        quickBreakfast: {
          name: "Michael's Kitchen",
          note: 'Taos breakfast institution on Paseo del Pueblo Norte, on the way up the valley. Expect a wait for the huevos rancheros.',
        },
      },
      brews: {
        picks: [
          { name: 'Taos Mesa Brewing Taproom', note: 'In-town taproom with live music. The Mothership out by the airport closed for winter 2024-25, so check before you go.' },
          { name: 'Taos Ale House', note: 'Craft beer and a burger stand in town, about 30 minutes down from the ski valley.' },
          { name: "Eske's Brew Pub", note: 'Small, long-standing brewpub just off the Taos Plaza.' },
        ],
      },
      notes:
        'Opening date per the resort\'s 9/9/2026 press release (the lift-ticket page lists the season start the same way); 2026-27 day-ticket prices were still "TBA", so the pricing figures here are estimates scaled from 2025 walk-up rates (~$130 weekday per OnTheSnow) and the resort\'s "up to 33% off 72h ahead" claim. Stats: 1,294 acres, 119 trails and 12 lifts are from the resort\'s own ski & snowboard page. Other sources say 110-113 trails and 13-14 lifts. Base is given as 9,200 ft (Wikipedia, Visit Taos; Powder Project says 9,206). The 70th-anniversary release says 9,350 ft and 3,131 ft of vertical, and was not used. High-speed count is Lift 1 (2018 detachable quad), Lift 4 (2023 detachable quad) and the Gondolita pulse gondola. The webcam and snow report share one official page. Ikon and Mountain Collective both confirmed for 2026-27, and Mountain Collective requires reservations at Taos. Not fetch-verified.',
    },
    'ski-santa-fe': {
      officialWebsite: 'https://www.skisantafe.com',
      snowReportUrl: 'https://www.skisantafe.com/conditions/snow-report',
      webcamUrl: null,
      trailMap: {
        // No dedicated trail-map page surfaced in search, so this links the site itself, per the research standard.
        officialUrl: 'https://www.skisantafe.com',
        source: 'official',
        imageUrl: null,
        pdfUrl: null,
        season: null,
      },
      ticketUrl: 'https://skisantafe.com/ski-lift-tickets/',
      passInfoUrl: null,
      phone: '505-982-4429',
      address: '1477 NM-475, Santa Fe, NM 87501',
      openingDate: { date: '2026-11-26', status: 'projected' },
      closingDate: TBD_DATE,
      grub: {
        town: 'Santa Fe, 16 miles down NM-475',
        picks: [
          { name: 'The Shed', note: 'Downtown Santa Fe staple for more than 70 years, known for its red chile enchiladas.' },
          { name: 'Tune-Up Cafe', note: 'Low-key, eclectic menu with pupusas, cubanos and burgers. The local pick after a day outside.' },
          { name: "Cafe Pasqual's", note: 'Downtown breakfast-and-beyond favorite; the huevos motuleños are the order.' },
        ],
        quickBreakfast: {
          name: "Tia Sophia's",
          note: 'Family-run downtown New Mexican breakfast spot since 1974, with serious breakfast burritos.',
        },
      },
      brews: {
        picks: [
          { name: 'Santa Fe Brewing Co. Beer Hall at HQ', note: 'New Mexico\'s original brewery (1988), with a beer hall at its south-side headquarters.' },
          { name: 'Second Street Brewery (Railyard)', note: 'Railyard taproom in the Farmers Market building. The original 2nd Street pub has closed.' },
          { name: 'Tumbleroot Brewery & Distillery', note: 'Beer and spirits under one roof, with live music nightly at the Agua Fria taproom.' },
        ],
      },
      notes:
        'Opening date is the resort\'s own "tentatively scheduled" 11/26/2026 from its lift-ticket page. 2026-27 adult full-day rates are $110 weekday and $132 weekend/holiday, from the official ticket page. Base, summit and vertical match the USFS and Wikipedia. The homepage lists 90 trails and 6 lifts, which follows the Super Chief quad\'s retirement (other sources: 73-88 trails, 7 lifts). The Santa Fe Express detachable quad opened 2024-25 and is the one high-speed lift. The address (1477 NM-475) comes from directory listings, not the resort site. The phone number is on the resort\'s accessibility page. No webcam page surfaced. Independent: no Indy/Epic/Ikon partnership found for 2026-27. Not fetch-verified.',
    },
    'angel-fire': {
      officialWebsite: 'https://www.angelfireresort.com',
      snowReportUrl: 'https://www.angelfireresort.com/trail-and-lift-status/',
      webcamUrl: null,
      trailMap: {
        officialUrl: 'https://www.angelfireresort.com/activities/winter-activities/skiing-and-snowboarding/mountain-stats/trail-map/',
        source: 'official',
        imageUrl: null,
        pdfUrl: null,
        season: null,
      },
      ticketUrl: 'https://www.angelfireresort.com/activities/winter-activities/skiing-and-snowboarding/lift-tickets/',
      passInfoUrl: null,
      phone: '800-633-7463',
      address: '10 Miller Lane, Angel Fire, NM 87710',
      openingDate: TBD_DATE,
      closingDate: TBD_DATE,
      grub: {
        picks: [
          { name: 'El Jefe', note: 'Angel Fire\'s overlooked gem: fireplace, good drinks and a strong taco list.' },
          { name: 'Mikuna Grill', note: 'Peruvian-Southwestern fusion. Try the chicken-fried ribeye with green chile gravy.' },
        ],
        quickBreakfast: {
          name: 'Morning Star Restaurant',
          note: 'Casual breakfast and comfort food in the village.',
        },
      },
      brews: {
        picks: [{ name: 'Enchanted Circle Brewing Company', note: 'Angel Fire\'s own brewery, pouring at about 8,500 ft.' }],
      },
      notes:
        'No 2026-27 opening date published (OnTheSnow projects 12/11/2026, and 2025-26 opened 12/12/2025). Stats are from the resort\'s newer mountain-stats page: base 8,554, summit 10,677, 627 skiable acres, 96 trails, and 8 lifts (the Angel Express six-pack, 2 high-speed quads, 1 fixed quad, 2 doubles, 2 carpets). An older page said 8,600 base, 95 trails and 3 doubles. The Angel Express high-speed six-pack replaces Lift 2. Construction and load testing were finished in July 2026, and it\'s expected to run for 2026-27. Night skiing is PAUSED for 2026-27. The phone is the long-standing toll-free line that most listings carry; travel directories also show 844-218-4107 and 575-377-6401. Pricing is based on 2025-26 figures (adult window about $136, online about $95-$120); no 2026-27 rates were found. Independent: no Indy partnership found. Not fetch-verified.',
    },
    'red-river': {
      officialWebsite: 'https://www.redriverskiarea.com',
      snowReportUrl: 'https://www.redriverskiarea.com/winter/winter-mountain/snow-report/',
      webcamUrl: null,
      trailMap: {
        // The snow-report page carries the printable frontside/backside maps; no separate trail-map page surfaced.
        officialUrl: 'https://www.redriverskiarea.com/winter/winter-mountain/snow-report/',
        source: 'official',
        imageUrl: null,
        pdfUrl: null,
        season: null,
      },
      ticketUrl: 'https://www.redriverskiarea.com/winter/tickets/lift-tickets/',
      passInfoUrl: 'https://www.redriverskiarea.com/winter/plan-purchase/season-passes/',
      phone: '575-754-2223',
      address: '400 Pioneer Road, Red River, NM 87558',
      openingDate: TBD_DATE,
      closingDate: TBD_DATE,
      grub: {
        picks: [
          { name: 'Texas Reds Steakhouse', note: 'Long-running Main Street steakhouse with New Mexican and Tex-Mex touches. The agave-wine margarita is the call.' },
          { name: "Bull O' The Woods Saloon", note: 'Operating since 1939, with live music and a full kitchen.' },
          { name: 'Motherlode Saloon', note: 'Historic Main Street saloon and dance hall, the late-night option.' },
        ],
        quickBreakfast: {
          name: "Old Tymer's Cafe",
          note: 'Red River breakfast stop known for its oversized pancakes.',
        },
      },
      brews: {
        picks: [
          { name: 'Red River Brewing Company & Distillery', note: 'Main Street brewery and distillery with fire pits outside and a full food menu, a short walk from the lifts.' },
        ],
      },
      notes:
        'No official 2026-27 opening date found (OnTheSnow projects 11/26/2026). Ticket prices are the official 2026-27 page: online weekday $102, online weekend $118, walk-up $136. Stats: 8,750 base, 10,350 summit and 1,600 vertical are consistent across sources. 290 acres is the resort\'s own figure (others give 209-285). 64 trails is the most-cited count. Lifts are 7, all fixed-grip; the Copper Chair became a fixed triple in 2024-25. Independent: no Indy/Epic/Ikon partnership found. Monarch passholders get 3 free days here (2026-27 partner list), which isn\'t modelled. Not fetch-verified.',
    },
    sipapu: {
      officialWebsite: 'https://www.sipapu.ski',
      snowReportUrl: 'https://www.sipapu.ski/snow-report/',
      webcamUrl: null,
      trailMap: {
        officialUrl: 'https://www.sipapu.ski/trail-map/',
        source: 'official',
        imageUrl: null,
        pdfUrl: null,
        season: null,
      },
      ticketUrl: 'https://www.sipapu.ski/lift-tickets/',
      passInfoUrl: 'https://www.purgatory.ski/power-pass/',
      phone: '575-587-2240',
      address: '5224 NM-518, Vadito, NM 87579',
      openingDate: TBD_DATE,
      closingDate: TBD_DATE,
      grub: {
        picks: [
          { name: 'Riverside Cafe', note: 'On-site: a patio on the Rio Pueblo, a heated lodge and an upstairs bar. Burgers and New Mexican fare.' },
          { name: 'Paradise Grill', note: 'Sipapu\'s other on-site restaurant, with online ordering. Taos is the nearest real town.' },
        ],
      },
      brews: {
        picks: [{ name: 'Taos Mesa Brewing Taproom', note: 'The nearest real brewery, about 40 minutes north over NM-518 in Taos.' }],
      },
      notes:
        'Sipapu has been the first New Mexico area to open for many seasons running (11/21/2025 last year), but no official 2026-27 date was found. OnTheSnow/skiinfo show 11/20/2026 as an estimate, which wasn\'t recorded. Stats from the official trail-map page: 9,255 summit, 1,055 vertical, 215 acres, 43 trails, 6 lifts. The base (8,200) is derived from those. Tickets are sold online only with dynamic pricing, "starting at $9" (2025-26: $19), and the day-of price is the highest. The window/advance figures here are ESTIMATES because the search budget ran out before peak-day rates could be confirmed. It\'s on the Power Pass (unlimited on the Power, Select and Core tiers for 2026-27), which isn\'t a modelled network, so it\'s independent here. The pass link is the Power Pass page on purgatory.ski, MCP\'s own domain. Address is the resort\'s highway address. Mailing listings say Vadito, others say Taos. Not fetch-verified.',
    },
    pajarito: {
      officialWebsite: 'https://www.pajarito.ski',
      snowReportUrl: 'https://www.pajarito.ski/weather-conditions-webcams/lifts-and-trails/',
      webcamUrl: null,
      trailMap: {
        officialUrl: 'https://www.pajarito.ski/trail-maps/',
        source: 'official',
        // The only winter map PDF on the page is labelled 2024. Too stale to present as current.
        imageUrl: null,
        pdfUrl: null,
        season: null,
      },
      ticketUrl: 'https://www.pajarito.ski/lift-tickets/',
      passInfoUrl: 'https://www.pajarito.ski/season-passes/',
      phone: '505-662-5725',
      address: '397 Camp May Road, Los Alamos, NM 87544',
      openingDate: TBD_DATE,
      closingDate: TBD_DATE,
      grub: {
        town: 'Los Alamos, about 15 minutes down Camp May Road',
        picks: [
          { name: 'Blue Window Bistro', note: 'Los Alamos favorite on Central Ave with an eclectic American menu.' },
          { name: 'Pig + Fig Café', note: 'Chef-owned café in White Rock. Listings disagree on the address, so confirm before you go.' },
        ],
      },
      brews: {
        picks: [{ name: 'Bathtub Row Brewing Co-op', note: 'Cooperative brewery on Central Park Square in Los Alamos, usually with food trucks out front.' }],
      },
      notes:
        'LIMITED OPERATING DAYS: Pajarito opens only Friday to Sunday plus federal and Christmas holidays (OnTheSnow), and is famously snow-dependent. Some seasons barely open. A new water pipeline is meant to bring reliable snowmaking and earlier openings, but that isn\'t confirmed in operation. No 2026-27 dates or ticket prices were posted ("check back for 2026/2027 tickets"); third parties project 12/26/2026 to 3/7/2027, which wasn\'t recorded. Pricing is an ESTIMATE in line with the Los Alamos County-owned hill\'s historic rates. Official stats: 9,000 base, 10,440 summit, 280 skiable acres, 53 trails (the 2024 map says 44), 6 lifts (3 doubles, a triple, a quad, a conveyor). The listed vertical is 1,440 (summit minus base; other sources say 1,400). It\'s on the Power Pass (unlimited on Power, Select and Core), so it\'s independent here. No parking policy was found in research (see parking entry). Not fetch-verified.',
    },
    'ski-apache': {
      officialWebsite: 'https://skiapache.com',
      snowReportUrl: 'https://skiapache.com/mountain-info/trail-status/',
      webcamUrl: null,
      trailMap: {
        // The mountain-info page carries the official trail map links; no direct current asset URL surfaced.
        officialUrl: 'https://skiapache.com/mountain-info/',
        source: 'official',
        imageUrl: null,
        pdfUrl: null,
        season: null,
      },
      ticketUrl: 'https://skiapache.com/winter-lift-tickets/',
      passInfoUrl: null,
      phone: '575-464-3600',
      address: '1286 Ski Run Road, Alto, NM 88312',
      openingDate: TBD_DATE,
      closingDate: TBD_DATE,
      grub: {
        town: 'Ruidoso, about 18 miles down Ski Run Road',
        picks: [
          { name: 'Cattle Baron', note: 'Ruidoso steak-and-seafood house on Sudderth Drive, the default post-ski dinner.' },
          { name: 'Village Buttery', note: 'Fodor\'s-favorite Sudderth Drive lunch spot. Lunch only, 10:30 to 2:30.' },
        ],
        quickBreakfast: {
          name: 'Lincoln County Grill',
          note: 'Casual Sudderth Drive diner doing eggs-and-biscuits breakfasts.',
        },
      },
      brews: {
        picks: [
          { name: 'Downshift Brewing (The Hidden Tap)', note: 'Midtown Ruidoso brewpub with ales, lagers and gourmet pizza.' },
          { name: 'Brewski Beer Garden', note: 'Downshift\'s outdoor fire-pit beer garden at the bottom of Ski Run Road in Alto. The closest pint to the mountain.' },
          { name: 'Lost Hiker Brewing', note: 'Midtown Ruidoso taproom, with the brewery in Ruidoso Downs.' },
        ],
      },
      notes:
        'Owned and run by the Mescalero Apache Tribe since the 1960s. No official 2026-27 opening date (2025-26 opened 11/29). The official site lists hours as THURSDAY TO MONDAY, with seasonal schedules varying, so it isn\'t a seven-day operation. 2026-27 adult full-day tickets from the official page: $165 online (non-holiday), $175 in person, $195 holiday, free parking included. That makes it the priciest ticket in the state. Stats: 9,600 base and 1,900 vertical are consistent. The summit is 11,500 at the top of the gondola (the resort says 11,400 for the top of the lifted terrain). 750 acres, 55 trails, 11 lifts per the resort (other sources say 8-10). The 8-passenger gondola is the one high-speed lift. Independent: no Indy/Epic/Ikon partnership found. Not fetch-verified.',
    },
  },

  parking: {
    taos: {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'not-required',
      freeOptionAvailable: true,
      notes: [
        'Free parking with attendants directing cars to a lot. A free lot shuttle runs through the lots all day and drops off a short walk from Lift 1 and the ticket office.',
        'Paid parking closer to the Village base area is sold at an attendant booth.',
        'Village of Taos Ski Valley runs winter (Nov-Apr) shuttles from its Armadillo, Bear, Gila Monster, Eagle and Deer lots.',
      ],
      infoUrl: 'https://www.taosskivalley.com/parking',
    },
    'ski-santa-fe': {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'not-required',
      freeOptionAvailable: true,
      notes: [
        'Free parking in the main base-area lot.',
        'Overflow parking opens on busy weekends and holidays. Check road conditions on NM-475 at nmroads.com before driving up.',
      ],
      infoUrl: 'https://www.skisantafe.com/getting-here/parking',
    },
    'angel-fire': {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'not-required',
      freeOptionAvailable: true,
      notes: [
        'Free parking in the Green, Blue and Black lots, with free winter shuttles to the base area.',
        'The shuttle ran 8am to 4:30pm on regular days in 2025-26. Night-skiing hours won\'t apply in 2026-27, since night skiing is paused.',
      ],
      infoUrl: 'https://www.angelfireresort.com/shuttles/',
    },
    'red-river': {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'not-required',
      freeOptionAvailable: true,
      notes: [
        'Ski-area lots are free, as is all public parking in the Town of Red River.',
        'The base is in town, so many guests walk to the lifts from their lodging.',
      ],
      infoUrl: 'https://www.redriverskiarea.com/explore/plan-your-escape/faqs/',
    },
    sipapu: {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'not-required',
      freeOptionAvailable: true,
      notes: ['Free slopeside lot. Park, then head to the Ticket Office (tickets are sold online only).'],
      infoUrl: 'https://www.sipapu.ski/first-time-guide/',
    },
    pajarito: {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'unknown',
      freeOptionAvailable: null,
      notes: [
        'No published parking policy was found. The ski area\'s base lodge lot sits at the end of Camp May Road above Los Alamos.',
        'Open Friday to Sunday plus holidays only, so check the operating-hours page before driving up.',
      ],
      infoUrl: 'https://www.pajarito.ski/hours-of-operation/',
    },
    'ski-apache': {
      status: 'unknown',
      occupied: null,
      capacity: null,
      reservationRequired: 'not-required',
      freeOptionAvailable: true,
      notes: [
        'Lift tickets include free parking (official ticket page).',
        'Ski Run Road (NM-532) climbs steeply from Alto. The resort publishes driving guidance for the road.',
      ],
      infoUrl: 'https://skiapache.com/travel/driving-to-ski-apache/',
    },
  },

  pricing: {
    // Taos: the state's destination mountain, real dynamic pricing (up to 33% off 72h ahead). 2026-27 rates were TBA, so this is an estimate.
    taos: { mountainId: 'taos', currency: 'USD', windowRate: 159, advanceFloor: 99, dynamicRange: 0.7 },
    // Ski Santa Fe: published fixed weekday/weekend rates. Barely flexes.
    'ski-santa-fe': { mountainId: 'ski-santa-fe', currency: 'USD', windowRate: 132, advanceFloor: 110, dynamicRange: 0.3 },
    'angel-fire': { mountainId: 'angel-fire', currency: 'USD', windowRate: 136, advanceFloor: 95, dynamicRange: 0.5 },
    'red-river': { mountainId: 'red-river', currency: 'USD', windowRate: 136, advanceFloor: 102, dynamicRange: 0.35 },
    // Sipapu: online-only dynamic pricing from $9 on quiet days; peak-day figures are estimates.
    sipapu: { mountainId: 'sipapu', currency: 'USD', windowRate: 89, advanceFloor: 45, dynamicRange: 0.6 },
    // Pajarito: county-owned hill, no 2026-27 prices posted yet; estimate.
    pajarito: { mountainId: 'pajarito', currency: 'USD', windowRate: 99, advanceFloor: 79, dynamicRange: 0.3 },
    // Ski Apache: official 2026-27 rates ($165 online, $175 in person, $195 holiday). Little flex.
    'ski-apache': { mountainId: 'ski-apache', currency: 'USD', windowRate: 195, advanceFloor: 165, dynamicRange: 0.25 },
  },

  demo: {
    // Taos: the biggest, steepest terrain in the state and good snow, but hike-to terrain and long control work after a storm.
    taos: { snow: 1.15, wind: 1.15, operations: 0.95, crowds: 0.6, grooming: 0.65, controlDelay: 40 },
    // Ski Santa Fe: the highest base in NM keeps snow cold, but the 30-minute city commute packs it on weekends.
    'ski-santa-fe': { snow: 1.0, wind: 1.0, operations: 1.05, crowds: 0.88, grooming: 0.85, controlDelay: 20 },
    // Angel Fire: dependable lifts and corduroy everywhere, but it sits in the drier lee of the Taos range.
    'angel-fire': { snow: 0.85, wind: 0.7, operations: 1.1, crowds: 0.6, grooming: 0.92, controlDelay: 10 },
    // Red River: sheltered, walk-to-the-lift and easy, but low, small, and full of Texans on holiday weeks.
    'red-river': { snow: 0.8, wind: 0.6, operations: 1.08, crowds: 0.78, grooming: 0.88, controlDelay: 8 },
    // Sipapu: low and small, so the snow is thin, but tucked in the trees with no wind and nobody in line.
    sipapu: { snow: 0.7, wind: 0.45, operations: 1.12, crowds: 0.3, grooming: 0.85, controlDelay: 5 },
    // Pajarito: empty and steep when it's open, but open three days a week and only when the snow comes.
    pajarito: { snow: 0.75, wind: 0.85, operations: 0.6, crowds: 0.25, grooming: 0.6, controlDelay: 10 },
    // Ski Apache: high and well-groomed for the desert south, but its storms come rarely and the summit is a wind tunnel.
    'ski-apache': { snow: 0.65, wind: 1.35, operations: 0.8, crowds: 0.7, grooming: 0.8, controlDelay: 15 },
  },
};
