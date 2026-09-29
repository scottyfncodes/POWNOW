import type { MountainProfile } from '@/domain/mountainProfile';
import { TBD_DATE } from '@/domain/mountainProfile';

/**
 * Researched from each resort's own public pages/press materials via web
 * search (see per-entry `notes`). This sandbox's outbound web access is
 * restricted the same way the CDOT/Liftie/Open-Meteo integrations are (see
 * providers/live/*), so none of these URLs could be fetch-verified to
 * actually resolve — they are real, indexed URLs from search results, never
 * invented, but a human with normal browser access should do a spot check
 * before leaning on this data for anything beyond display. Fields the
 * research could not confirm from an official (or, failing that, a clearly
 * reputable secondary) source are `null` rather than guessed.
 *
 * Opening/closing dates were researched in early September 2026, before the
 * 2026-27 season — most resorts had only a "target" date at that point, if
 * anything at all. Update this file as resorts confirm dates through the
 * season; nothing here should be treated as self-updating.
 *
 * `grub` and `brews` (see `domain/mountainProfile.ts#GrubInfo`/`BrewsInfo`)
 * are the same kind of research, not a live feed or a review score: real,
 * named restaurants, breweries, and — where one genuinely exists nearby —
 * distilleries, compiled from web search in September 2026, one line on what
 * each is actually known for. Restaurants and breweries close, move, and
 * rebrand more often than parking policy does, so treat every name here as a
 * starting point to confirm, not a guarantee it's still open. For resorts
 * with little or no real base-area dining of their own (Wolf Creek, Monarch,
 * Loveland, Eldora), `grub.town` names the actual town people drive to
 * afterward instead of pretending the mountain itself has a scene. Arapahoe
 * Basin and Purgatory each have one genuine on-site option (6th Alley;
 * Purgy's/The Nugget) plus a real nearby town for anything more —
 * Purgatory's `grub.town` still names Durango, since that's where most
 * people actually end up for dinner; Arapahoe Basin's picks name
 * Dillon/Silverthorne inline instead, since 6th Alley is a full restaurant
 * in its own right, not just a lodge cafeteria. Breweries are almost never
 * on-site regardless of the resort — Keystone's Steep Brewing (River Run
 * Village) is the sole exception found — so `brews` picks skip the `town`
 * field and just say the distance inline instead. Each `picks` list targets
 * 3-5 real entries — genuinely fewer where a town's scene doesn't support
 * more (Wolf Creek/Pagosa Springs' breweries, Eldora/Nederland's, Steamboat's
 * beyond Storm Peak — Butcherknife and Mahogany Ridge turned up conflicting
 * open/closed signals during research and were left out rather than guessed
 * into the list), never padded with a weak or irrelevant pick just to hit 5.
 */
export const MOUNTAIN_PROFILES: Record<string, MountainProfile> = {
  vail: {
    officialWebsite: 'https://www.vail.com',
    snowReportUrl: 'https://www.vail.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx',
    webcamUrl: 'https://www.vail.com/the-mountain/mountain-conditions/mountain-cams.aspx',
    trailMap: {
      officialUrl: 'https://www.vail.com/the-mountain/about-the-mountain/trail-map.aspx',
      source: 'official',
      // The only direct PDF search turned up (fy20/2019) is six seasons
      // stale — too old to present as "the" trail map even with a caveat,
      // so no imageUrl/pdfUrl/season here: honestly link to the official
      // page, which the resort itself keeps current, rather than embed a
      // years-old layout.
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://www.vail.com/plan-your-trip/lift-tickets.aspx',
    passInfoUrl: 'https://www.epicpass.com',
    phone: '970-754-8245',
    address: 'P.O. Box 7, Vail, CO 81658',
    openingDate: { date: '2026-11-13', status: 'projected' },
    closingDate: TBD_DATE,
    grub: {
      picks: [
        { name: 'Sweet Basil', note: 'Vail Village institution — elevated seasonal American with a deep wine list.' },
        { name: "Garfinkel's", note: "Sports-bar deck at the base of Lionshead — the classic après-ski stop." },
        { name: 'The Red Lion', note: "Vail's loudest, longest-running après bar; the deck fills with ski boots by 3pm." },
        { name: 'Matsuhisa', note: "Nobu's Japanese-Peruvian restaurant inside The Sebastian." },
      ],
      quickBreakfast: {
        name: "Loaded Joe's Coffeehouse",
        note: 'Breakfast sandwiches on croissant, tortilla, or bagel from 6:30am in winter — steps from Gondola One.',
      },
    },
    brews: {
      picks: [
        { name: 'Vail Brewing Co.', note: 'Vail Village taproom — lagers, ales, and stouts a short walk from the lifts.' },
        { name: '7 Hermits Brews, Wine & Cocktails', note: "Vail Village taproom-and-wine-bar hybrid, a locals' pick." },
        { name: 'Eagle River Brewing Company', note: 'Veteran-owned brewpub in Gypsum with a wood-fired pizza station, about 30-35 minutes down the valley.' },
      ],
      distilleries: [{ name: '10th Mountain Whiskey & Spirit Co.', note: "Vail Village tasting room, upstairs from Loaded Joe's." }],
    },
    notes:
      'Opening date is Vail Resorts’ own published 2026-27 "target" (8/18/2026 press release), not yet confirmed. FLAG FOR NEXT SEASON: The Red Lion\'s owner has confirmed he won\'t renew the lease — it\'s expected to operate through 2026-27 as-is, then close for redevelopment starting spring 2027, so it\'s accurate for this season but should be reconsidered before the following one. Not fetch-verified — see module note.',
  },
  'beaver-creek': {
    officialWebsite: 'https://www.beavercreek.com',
    snowReportUrl: 'https://www.beavercreek.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
    webcamUrl: null,
    trailMap: {
      officialUrl: 'https://www.beavercreek.com/the-mountain/about-the-mountain/trail-map.aspx',
      source: 'official',
      // Only a 2022-23 PDF was confirmable (three seasons stale) — see vail's note above for the same reasoning.
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://www.beavercreek.com/plan-your-trip/lift-tickets.aspx',
    passInfoUrl: 'https://www.epicpass.com',
    phone: '970-754-4636',
    address: '26 Avondale Lane, Avon, CO 81620',
    openingDate: { date: '2026-11-25', status: 'projected' },
    closingDate: TBD_DATE,
    grub: {
      picks: [
        { name: 'Coyote Café', note: 'A Village staple since 1983 — Tex-Mex and American classics, the default après stop.' },
        { name: 'Broken Arrow Café', note: 'Laid-back base scene at Arrowhead — burgers, cocktails, live music on weekends.' },
        { name: "Beano's Cabin", note: 'Snowcat-access dinner at the base of Larkspur Bowl — five courses, reservations required.' },
        { name: 'Splendido at the Chateau', note: "Beaver Creek's white-tablecloth farm-to-table room, dinner nightly." },
        { name: 'Grouse Mountain Grill', note: 'Pines Lodge institution, nearly 30 years AAA Four Diamond — the pretzel-crusted pork chop is the signature.' },
      ],
      quickBreakfast: {
        name: 'Avon Bakery & Deli',
        note: 'Famous egg sandwiches and fresh-baked goods, a short drive from the base in Avon.',
      },
    },
    brews: {
      picks: [
        { name: 'Vail Brewing Co. (Eagle-Vail)', note: "The closer of Vail Brewing's two taprooms, about 10 minutes from the base." },
        { name: '7 Hermits Brews, Wine & Cocktails', note: 'Vail Village taproom, about 20 minutes away.' },
        { name: 'Eagle River Brewing Company', note: 'Gypsum brewpub with a wood-fired pizza station, about 25 minutes down the valley.' },
      ],
    },
    notes:
      'Opening date per Vail Resorts’ 8/18/2026 press release. Webcam URL could not be confirmed from a distinct source and is left null rather than guessed from Vail’s page template. Trail map links the official page only — the one direct PDF found is six seasons stale. CORRECTED: the parking note previously implied the village garages (Ford Hall, Villa Montane) had a separate free-hours policy from Ford Hall/Villa Montane themselves — they are the same structures. Replaced with the resort\'s actual tiered rate policy. Not fetch-verified.',
  },
  breckenridge: {
    officialWebsite: 'https://www.breckenridge.com',
    snowReportUrl: 'https://www.breckenridge.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx',
    webcamUrl: 'https://www.breckenridge.com/the-mountain/mountain-conditions/mountain-cams.aspx',
    trailMap: {
      officialUrl: 'https://www.breckenridge.com/the-mountain/about-the-mountain/trail-map.aspx',
      source: 'official',
      // Newest confirmable PDF was 2023-24 (two seasons stale) — see vail's note above.
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://www.breckenridge.com/plan-your-trip/lift-tickets.aspx',
    passInfoUrl: 'https://www.epicpass.com',
    phone: '970-453-5000',
    address: '1599 Summit County Rd, Ste 3, Breckenridge, CO 80424',
    openingDate: { date: '2026-11-06', status: 'projected' },
    closingDate: TBD_DATE,
    grub: {
      picks: [
        { name: 'T-Bar', note: 'On-mountain deck that has become one of the highest-energy après spots in the country.' },
        { name: "Robbie's Tavern", note: 'At the Grand Colorado on Peak 8 — DJ, food, and a locals-favorite après crowd.' },
        { name: "Downstairs at Eric's", note: 'Family-friendly pub — 30 beers on tap, wings, pizza, comfort food.' },
        { name: 'Rootstalk', note: 'Main Street tasting-menu room from a 2024 James Beard Award-winning chef.' },
        { name: 'Whiskey Star Smokehouse', note: 'Texas-style BBQ with two bars, 80 craft beers, and 101 whiskeys on the wall.' },
      ],
      quickBreakfast: {
        name: 'The Crown',
        note: 'Main Street cafe — in-house cold brew and giant bagel sandwiches, built for a quick stop.',
      },
    },
    brews: {
      picks: [
        { name: 'Breckenridge Brewery', note: "The town's own brewery, a straightforward post-ski beer stop." },
        { name: 'Broken Compass Brewing', note: 'Airport Road brewery running 10+ years — the Coconut Porter is the one to try.' },
        { name: 'Highside Brewing', note: 'BBQ-and-beer taproom near the gondola.' },
      ],
      distilleries: [{ name: 'Breckenridge Distillery', note: 'Award-winning bourbon with a full tour and tasting program — reservations recommended.' }],
    },
    notes:
      'Opening date per Vail Resorts’ 8/18/2026 press release. Not fetch-verified.',
  },
  keystone: {
    officialWebsite: 'https://www.keystoneresort.com',
    snowReportUrl: 'https://www.keystoneresort.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx',
    webcamUrl: 'https://www.keystoneresort.com/the-mountain/mountain-conditions/mountain-cams.aspx',
    trailMap: {
      officialUrl: 'https://www.keystoneresort.com/the-mountain/about-the-mountain/trail-map.aspx',
      source: 'official',
      pdfUrl:
        'https://www.keystoneresort.com/-/aemasset/sitecore/keystone/maps/winter-2025-2026/20251028_KY_winter-trail_map_001.pdf',
      imageUrl: null,
      season: '2025-26',
    },
    ticketUrl: 'https://www.keystoneresort.com/plan-your-trip/lift-tickets.aspx',
    passInfoUrl: 'https://www.epicpass.com',
    phone: '855-603-0049',
    address: '22101 US Hwy 6, Keystone, CO 80435',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    grub: {
      picks: [
        { name: "9280' Sake House", note: 'River Run base, huge deck — ramen and rice bowls, a top après pick.' },
        { name: 'Kickapoo Tavern', note: 'River Run Village — nachos, loaded burgers, wings, laid-back vibe.' },
        { name: 'Montezuma Roadhouse', note: 'River Run Village sit-down dinner, quieter than the base bars.' },
        { name: 'Bighorn Bistro & Bar', note: 'Keystone Lodge & Spa dining room — steaks, prime rib, and Keystone Lake views.' },
        { name: 'Pizza 101', note: 'Sundance Plaza take-out spot for brick-oven pizza — a River Run après-day staple.' },
      ],
      quickBreakfast: {
        name: 'New Moon Cafe',
        note: 'Steps from the gondola in River Run Village — breakfast, coffee, and a fast counter.',
      },
    },
    brews: {
      picks: [
        { name: 'Steep Brewing & Coffee Co.', note: 'On-site brewery and taproom in River Run Village, steps from the gondola.' },
        { name: 'Broken Compass Brewing', note: 'Breckenridge brewery, about 20 minutes away — the Coconut Porter is the one to try.' },
        { name: 'Angry James Brewery', note: "Silverthorne taproom, about 20 minutes away — 'Angry Hour' specials, live trivia." },
      ],
    },
    notes:
      'Vail Resorts’ 8/18/2026 release says Keystone is targeting "as soon as possible in October 2026" with no specific date, so no date is recorded despite the target being real. Not fetch-verified.',
  },
  'crested-butte': {
    officialWebsite: 'https://www.skicb.com',
    snowReportUrl: 'https://www.skicb.com/the-mountain/mountain-conditions/lift-and-terrain-status.aspx',
    webcamUrl: 'https://www.skicb.com/the-mountain/mountain-conditions/mountain-cams.aspx',
    trailMap: {
      officialUrl: 'https://www.skicb.com/the-mountain/about-the-mountain/trail-maps.aspx',
      source: 'official',
      pdfUrl:
        'https://www.skicb.com/-/aemasset/sitecore/crested-butte/maps/winter-2025-2026/20251103_CB_winter-trail_map_001.pdf',
      imageUrl: null,
      season: '2025-26',
    },
    ticketUrl: 'https://www.skicb.com/plan-your-trip/lift-tickets.aspx',
    passInfoUrl: 'https://www.epicpass.com',
    phone: '970-251-7022',
    address: '12 Snowmass Rd, Crested Butte, CO 81225',
    openingDate: { date: '2026-11-25', status: 'projected' },
    closingDate: TBD_DATE,
    grub: {
      picks: [
        { name: "Uley's Cabin", note: 'On-mountain Colorado-inspired lunch, plus an ice bar for cocktails.' },
        { name: 'Butte 66 Bar & Grille', note: 'Base-area BBQ and a lively après deck.' },
        { name: 'Bonez Tequila Bar & Grill', note: 'Elk Ave tequila bar with a big agave selection and Mexican fare.' },
        { name: 'A Bar Above', note: 'Cozy, low-lit base-area spot for cocktails, quick bites, and live music.' },
      ],
      quickBreakfast: {
        name: 'Gas Cafe One Stop',
        note: "Coffee and a breakfast burrito in under two minutes — the town's fastest option.",
      },
    },
    brews: {
      picks: [
        { name: 'The Eldo Brewery', note: 'Downtown on Elk Ave — the real on-site brewery, brewing ten beers in-house since 1996.' },
        { name: 'Bruhaus', note: 'Downtown on Elk Ave — a German-style beer hall with dozens of rotating craft taps rather than a brewery of its own.' },
        { name: 'Irwin Brewing Co. Public House', note: 'Elk Ave taproom and live-music venue, sister spot to the mountain-based Irwin Brewing.' },
      ],
    },
    notes:
      'Opening date per Vail Resorts’ 8/18/2026 press release (one secondary source suggested Nov 23 instead — the press release date is treated as authoritative). Not fetch-verified.',
  },
  'winter-park': {
    officialWebsite: 'https://www.winterparkresort.com',
    snowReportUrl: 'https://www.winterparkresort.com/the-mountain/mountain-report',
    webcamUrl: 'https://www.winterparkresort.com/the-mountain/mountain-cams',
    trailMap: {
      officialUrl: 'https://www.winterparkresort.com/the-mountain/mountain-information/maps',
      source: 'official',
      pdfUrl: 'https://www.winterparkresort.com/-/media/winter-park/winter-2526/maps/25-26_wp_winter-trail-map-web.pdf',
      imageUrl: null,
      season: '2025-26',
    },
    ticketUrl: 'https://www.winterparkresort.com/tickets-and-passes',
    passInfoUrl: 'https://www.ikonpass.com',
    phone: '970-726-5514',
    address: '85 Parsenn Rd, Winter Park, CO 80482',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    grub: {
      picks: [
        { name: 'Lime', note: 'In the resort village — tacos, burritos, margaritas, a lively après crowd.' },
        { name: "Deno's Mountain Bistro", note: 'Upscale American/Mediterranean — steaks, ribs, seafood.' },
        { name: "Fisher's Bar", note: 'Down the road in Fraser — down-home cooking and live music, in the space Crooked Creek Saloon occupied before a 2025 remodel and rename.' },
        { name: 'Tabernash Tavern', note: 'Fine-dining wine bar five minutes from the resort — a repeat "Best Restaurant in Grand County" winner.' },
        { name: "Randi's Grill & Pub", note: 'Downtown Irish pub with hearty comfort food and a social après bar.' },
      ],
      quickBreakfast: {
        name: "Wake N' Bacon",
        note: 'Main Street to-go menu — a breakfast burrito on the way to the slopes.',
      },
    },
    brews: {
      picks: [
        { name: 'Big Trout Brewing Company', note: 'Downtown Winter Park brewpub — award-winning IPAs, stouts, and lagers.' },
        { name: 'Hideaway Park Brewery', note: 'Main Street Winter Park, pouring small-batch beers since 2014.' },
        { name: 'Vicious Cycle Brewing Company', note: 'Fraser bike-path taproom with food trucks and a dog-friendly patio.' },
      ],
      distilleries: [{ name: 'Fraser Valley Distilling Co.', note: 'Family-owned distillery and restaurant in downtown Fraser.' }],
    },
    notes:
      'Resort’s own materials describe 2026-27 opening as "as soon as possible" with no fixed date — recorded as TBD rather than turning that into an invented date. CORRECTED: Crooked Creek Saloon in Fraser changed hands and was rebranded to Fisher\'s Bar (same address/phone, new owners) — updated to the current name. Not fetch-verified.',
  },
  purgatory: {
    // CORRECTED: the official Purgatory Ski Resort (Durango, CO) source is
    // purgatory.ski — confirmed by the site owner. A prior session had kept
    // purgatoryresort.com as an unconfirmed placeholder; that domain is not
    // this resort's current site and has been replaced everywhere.
    officialWebsite: 'https://www.purgatory.ski',
    snowReportUrl: 'https://www.purgatory.ski/mountain/weather-conditions-webcams/snow-weather/',
    webcamUrl: 'https://www.purgatory.ski/mountain/mountain-webcams/',
    trailMap: {
      // No dedicated "trail map" landing page was confirmed distinct from
      // this — the PDF itself was found directly, so the mountain's general
      // conditions page is the closest real "official source" page to send
      // a human to alongside the direct PDF.
      officialUrl: 'https://www.purgatory.ski/mountain/weather-conditions-webcams/',
      source: 'official',
      pdfUrl: 'https://www.purgatory.ski/wp-content/uploads/sites/2/2025/12/Purgatory_Winter25-26_TrailMap_Website.pdf',
      imageUrl: null,
      season: '2025-26',
    },
    ticketUrl: 'https://www.purgatory.ski/mountain/lift-tickets/',
    passInfoUrl: 'https://www.thepowerpass.ski/purgatory-passes',
    phone: '970-247-9000',
    address: '1 Skier Place, Durango, CO 81301',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    grub: {
      town: 'Durango, about 25 miles south',
      picks: [
        { name: "Purgy's Slopeside", note: 'Base village restaurant and bar — the sit-down option right at the bottom of the lifts.' },
        { name: 'The Powderhouse', note: 'On-mountain cafeteria-and-deck-grill near the base of Lift 1/Lift 2 — soups, hot dogs, sandwiches.' },
        { name: "Dante's", note: "On the mountain's backside, reached via Lift 8 (or the Lift 5 midway unload) — noodle bar, fresh-Mex, grill, and espresso, with San Juan views." },
        { name: 'Paradise Pizza', note: 'Village Center — pizza and ice cream.' },
        { name: 'Village Market & Deli', note: 'Village Center — breakfast burritos, deli sandwiches, soups, and snacks.' },
        { name: 'The Nugget', note: 'An old miner\'s cabin half a mile south of the resort — a genuine après institution.' },
        { name: "The Sow's Ear", note: 'Durango steakhouse, known for its pepper-crusted filet.' },
      ],
      quickBreakfast: {
        name: '81301 Coffee House and Roasters',
        note: 'Durango coffee shop built for a fast breakfast before the drive up to the mountain.',
      },
    },
    brews: {
      picks: [
        { name: 'Ska Brewing Company', note: "Durango's best brewery for 15+ years running — full taproom and outdoor patio, about 25 miles south." },
        { name: 'Steamworks Brewing Company', note: 'Durango brewery since 1996, multiple GABF and World Beer Cup medals for its Steam Engine Lager.' },
        { name: 'Carver Brewing Co.', note: "Durango's original brewpub, on Main Avenue since 1988." },
      ],
      distilleries: [{ name: 'Durango Craft Spirits', note: "Durango's first grain-to-glass distillery since Prohibition — vodka, moonshine, bourbon." }],
    },
    notes:
      "CONFIRMED (human, previously flagged for review here): purgatory.ski is the resort's real, current domain — not a guess, verified by the site owner. officialWebsite, snowReportUrl, webcamUrl, ticketUrl, passInfoUrl (Power Pass, the resort's own program — thepowerpass.ski), phone, and the parking infoUrl are all updated to it, each landing on a real page confirmed via search. Address corrected to drop a stray '#' (matches the resort's own listing: '1 Skier Place'). Trail map: a 2025-26 season PDF (dated December 2025 on purgatory.ski) is linked directly; check for the current season’s map once posted. No 2026-27 opening date recorded — a Nov 27, 2026 figure appears on ski-news aggregators but reads like the same kind of algorithmic season-over-season projection flagged elsewhere in this file, not a resort announcement. Parking note updated: the Main Village Lot is now carpool-only (4+) during peak operations per the resort's own transportation page — a real, current policy detail this entry was missing. CORRECTED (firsthand report, cross-checked against Durango Herald/The Journal): removed Ore House (caught fire and has been closed for an extended rebuild since) and Switchback (permanently closed March 2026, replaced on-site by The Wilds Tavern under the same owners). Added the on-mountain/village options that were missing entirely — The Powderhouse (Lift 1/2), Dante's (Lift 8, or the Lift 5 midway unload), Paradise Pizza and Village Market & Deli (both Village Center) — so the mountain itself isn't made to look like it only has Purgy's.",
  },
  copper: {
    officialWebsite: 'https://www.coppercolorado.com',
    snowReportUrl: 'https://www.coppercolorado.com/the-mountain/conditions-weather/snow-report/',
    webcamUrl: 'https://www.coppercolorado.com/the-mountain/webcams/',
    trailMap: {
      officialUrl: 'https://www.coppercolorado.com/the-mountain/trail-area-maps/winter-trail-map/',
      source: 'official',
      // The page itself was confirmed; no directly-linkable current-season image/PDF asset was.
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://www.coppercolorado.com/lift-tickets/',
    passInfoUrl: 'https://www.coppercolorado.com/tickets-passes/season-passes/ikon-pass/',
    phone: '866-841-2481',
    address: null,
    openingDate: { date: '2026-11-06', status: 'projected' },
    closingDate: TBD_DATE,
    grub: {
      picks: [
        { name: "JJ's Tavern", note: 'Upscale tavern in Center Village — steaks in a casual setting.' },
        { name: "Downhill Duke's", note: 'Opens at 11am, front-row view of the American Eagle lift — the popular après pick.' },
        { name: 'CB Grille', note: "Copper's most upscale option — small plates, steaks, seafood." },
        { name: 'Kemosabe at Silverheels', note: '35+-year Frisco fixture blending a log-cabin steakhouse with an American-fusion sushi bar.' },
        { name: 'Tavern West', note: 'Frisco Main Street tavern with a year-round Mt. Royal-view deck and rotating craft beers.' },
      ],
      quickBreakfast: {
        name: 'Camp Hale Coffee',
        note: 'Baked goods, breakfast sandwiches, and quick bites right on the mountain.',
      },
    },
    brews: {
      picks: [
        { name: 'Outer Range Brewing', note: "A short drive in Frisco — Copper's default après-ski brewery, set in a yurt." },
        { name: 'Highside Brewing', note: 'Pub-fare-and-BBQ taproom right on Frisco Main Street.' },
        { name: 'Angry James Brewery', note: 'Silverthorne taproom, about 15 minutes away.' },
      ],
      distilleries: [{ name: 'Pullman Distillery', note: 'Frisco Main Street, housed in a restored 1800s railcar.' }],
    },
    notes:
      'UPDATED: opening date was on file as TBD at initial research; Copper announced Nov 6, 2026 as its 2026-27 opening day on Sept 8, 2026 — recorded as projected, same convention as every other resort\'s own announced target in this file. No officially confirmed street address surfaced (left null rather than guessed at the commonly-cited Copper Mountain, CO 80443). Not fetch-verified.',
  },
  'wolf-creek': {
    officialWebsite: 'https://wolfcreekski.com',
    snowReportUrl: 'https://wolfcreekski.com/mountain-report/',
    webcamUrl: 'https://wolfcreekski.com/webcams/',
    trailMap: {
      officialUrl: 'https://wolfcreekski.com/area-maps/',
      source: 'official',
      // Only a 2016-vintage hi-res PDF was confirmable — too old to present as current.
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://wolfcreekski.com/lift-tickets/',
    passInfoUrl: null,
    phone: '970-264-5639',
    address: 'PO Box 2800, Pagosa Springs, CO 81147',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    grub: {
      town: 'Pagosa Springs, about 25 miles west',
      picks: [
        { name: "Kip's", note: 'Baja-style tacos and wild-game burgers — a popular post-ski stop downtown.' },
        { name: 'Alley House Grille', note: 'Downtown fine dining in a restored 1912 cottage — steak, lamb, elk, seafood.' },
        { name: 'Meander Eatery', note: 'Pagosa Springs restaurant named to the New York Times\' 2024 list of 50 best restaurants in the US.' },
      ],
      quickBreakfast: {
        name: 'Root House',
        note: 'Pagosa Springs drive-thru coffee and breakfast that quickly became a local favorite.',
      },
    },
    brews: {
      picks: [
        { name: 'Riff Raff Brewing Co.', note: 'On the San Juan River in Pagosa Springs — house brewery with a real food menu.' },
        { name: 'The Break Room Brewing Company', note: "Pagosa Springs' other working craft brewery, live music on weekends." },
      ],
      distilleries: [{ name: 'Woodshed Distilling', note: 'Small-batch spirits, right in Pagosa Springs.' }],
    },
    notes:
      'Independent and famously snow-dependent — some seasons open in October on natural snowfall alone, but nothing published for 2026-27 yet. Address is the mailing address; the ski area itself has no separate street address. No confirmed pass-program URL (own independent pass, same page as tickets). Not fetch-verified.',
  },
  'arapahoe-basin': {
    officialWebsite: 'https://www.arapahoebasin.com',
    snowReportUrl: 'https://www.arapahoebasin.com/mountain/conditions-and-weather/',
    webcamUrl: 'https://www.arapahoebasin.com/mountain-cams/',
    trailMap: {
      officialUrl: 'https://www.arapahoebasin.com/trail-maps/',
      source: 'official',
      // Page confirmed (covers Frontside + The Beavers); no directly-linkable current-season asset confirmed.
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://www.arapahoebasin.com/tickets/',
    passInfoUrl: 'https://www.ikonpass.com/en/destinations/arapahoe-basin',
    phone: '888-272-7246',
    address: '28194 Highway 6, Dillon, CO 80435',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    grub: {
      picks: [
        { name: '6th Alley Bar & Grill', note: "The one restaurant right at the base — big deck, Colorado craft beer, the famed Bacon Bloody Mary." },
        { name: 'Timberline Craft Kitchen & Cocktails', note: 'In Silverthorne — Colorado-sourced, globally-inspired menu.' },
        { name: 'Bistro North', note: 'Silverthorne/Dillon chef-driven modern American, craft cocktails, a popular Sunday brunch.' },
        { name: 'Kúcu Tequila Bistro', note: 'Silverthorne Southwestern bistro and tequila bar with 200+ tequilas, mezcals, and sotols.' },
      ],
      quickBreakfast: {
        name: 'Sunshine Café',
        note: "Silverthorne's best breakfast for 30+ years — omelets, griddle cakes, and burritos, on the way in from Hwy 6.",
      },
    },
    brews: {
      picks: [
        { name: 'Dillon Dam Brewery', note: 'About 15 minutes down US-6 in Dillon — the go-to for a real dinner and a beer.' },
        { name: 'Angry James Brewery', note: 'Silverthorne taproom, about 15 minutes away.' },
        { name: 'Highside Brewing', note: 'Frisco taproom, about 20-25 minutes away.' },
      ],
      distilleries: [{ name: 'Pullman Distillery', note: 'Frisco Main Street, housed in a restored 1800s railcar, about 20 minutes away.' }],
    },
    notes:
      'A-Basin’s own materials describe 2026-27 opening as explicitly TBD, pending sufficient snow. Trail map links the official page only. UPDATED: parking reservation window shifted to Jan 2–May 2, 2027 (was Jan 17–May 3) — A-Basin adjusted its reservation program for the season that also brought unlimited access to the full Ikon Pass; also clarified the Admin Lot\'s $40 fee applies every day, not just weekend reservation days. Sunshine Café corrected to Silverthorne (every current listing places it there, not Dillon). Not fetch-verified.',
  },
  loveland: {
    officialWebsite: 'https://www.skiloveland.com',
    snowReportUrl: 'https://www.skiloveland.com/conditions/',
    webcamUrl: 'https://skiloveland.com/webcams/',
    trailMap: {
      officialUrl: 'https://skiloveland.com/plan-your-trip/trail-maps/',
      source: 'official',
      // Only a long-standing (2015-dated) PDF was confirmable — too old to present as current.
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://www.skiloveland.com/lift-tickets/',
    passInfoUrl: 'https://skiloveland.com/season-passes/',
    phone: '800-736-3754',
    address: 'PO Box 899, Georgetown, CO 80444',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    grub: {
      town: 'Georgetown or Silverthorne/Dillon',
      picks: [
        { name: 'Timberline Craft Kitchen & Cocktails', note: 'In Silverthorne, over the tunnel — Colorado-sourced, globally-inspired menu.' },
        { name: 'Sauce on the Blue', note: 'Silverthorne — Italian-focused, lunch and dinner.' },
        { name: "Cooper's on the Creek", note: "Georgetown comfort food with creative small plates, right on the historic town's main drag." },
        { name: "Scooter's Smokehouse BBQ", note: 'Georgetown favorite for Texas-style dry-rub smoked meats and sides.' },
      ],
      quickBreakfast: {
        name: 'The Happy Cooker',
        note: 'Georgetown institution, right off I-70 on the way up to the pass.',
      },
    },
    brews: {
      picks: [
        { name: 'Dillon Dam Brewery', note: "Dillon's own brewpub, a reliable stop either direction." },
        { name: 'Cabin Creek Brewing', note: 'Lakeside Georgetown brewpub on Georgetown Lake — the closest brewery to the east-side approach.' },
        { name: 'Angry James Brewery', note: 'Silverthorne taproom, over the tunnel.' },
      ],
    },
    notes:
      'Resort materials describe targeting "mid-October to early November 2026" with snowmaking starting late September — vague, so recorded as TBD rather than an invented specific date. Independent (Powder Alliance reciprocity, not Epic/Ikon). Not fetch-verified.',
  },
  eldora: {
    officialWebsite: 'https://www.eldora.com',
    snowReportUrl: 'https://www.eldora.com/the-mountain/mountain-report/',
    webcamUrl: 'https://www.eldora.com/the-mountain/webcams/',
    trailMap: {
      officialUrl: 'https://www.eldora.com/the-mountain/maps/alpine-trail-map/',
      source: 'official',
      // Page confirmed; no directly-linkable current-season image/PDF asset confirmed.
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://www.eldora.com/tickets-passes/lift-tickets/',
    passInfoUrl: 'https://www.eldora.com/ikon-pass/',
    phone: '303-440-8700',
    address: '2861 Eldora Ski Road #140, Nederland, CO 80466',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    grub: {
      town: 'Nederland, right at the base of the access road',
      picks: [
        { name: 'Crosscut Pizzeria and Taphouse', note: 'Colorado-milled, three-day-fermented pizza dough.' },
        { name: 'Kathmandu Restaurant', note: 'Indian and Nepalese buffet.' },
        { name: 'Salto Coffee Works', note: 'Nederland coffee-and-wine bar with a real food menu.' },
      ],
      quickBreakfast: {
        name: 'New Moon Bakery and Cafe',
        note: 'Nederland bakery known for homemade mini donuts and fast service.',
      },
    },
    brews: {
      picks: [
        { name: 'Very Nice Brewing Company', note: 'Nederland taproom, dog-friendly with live music — reopened at 26 S Hwy 119 after a 2025 fire destroyed its original space.' },
        { name: 'Busey Brews Smokehouse & Brewery', note: 'Nederland brewery and smokehouse, 22 taps of house-brewed beer.' },
      ],
    },
    notes:
      'No official 2026-27 opening date found (a Nov 27, 2026 figure appears only on a third-party aggregator’s algorithmic projection, not an Eldora announcement, so not recorded). CORRECTED: this entry previously listed "Mountain Sun Pub & Brewery" as a Nederland brewery — Mountain Sun has no Nederland location, only Boulder (1535 Pearl St) and its Southern Sun sibling, so that was a factual error. Replaced with Very Nice Brewing Company, the real Nederland taproom. UPDATED: removed Backcountry Pizza — it permanently closed in Aug 2025 (labor/housing cost pressures, per the owner). Added Busey Brews Smokehouse & Brewery, a second real Nederland brewery. Very Nice Brewing\'s original taproom was itself destroyed in an Oct 2025 fire that hit the same shopping center Backcountry Pizza was in — it has since reopened at a new address (26 S Hwy 119, Suite 7), still on Hwy 119 as originally described. Not fetch-verified.',
  },
  steamboat: {
    officialWebsite: 'https://www.steamboat.com',
    snowReportUrl: 'https://www.steamboat.com/the-mountain/mountain-report',
    webcamUrl: 'https://www.steamboat.com/the-mountain/live-cams',
    trailMap: {
      officialUrl: 'https://www.steamboat.com/the-mountain/trail-map',
      source: 'official',
      // Page confirmed (includes an interactive grooming/trail map); no directly-linkable static current-season asset confirmed.
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://www.steamboat.com/lift-tickets',
    passInfoUrl: 'https://www.steamboat.com/plan-your-trip/lift-tickets-ski-pass/ikon-pass',
    phone: '800-922-2722',
    address: '2305 Mt. Werner Circle, Steamboat Springs, CO 80487',
    openingDate: { date: '2026-11-20', status: 'projected' },
    closingDate: TBD_DATE,
    grub: {
      picks: [
        { name: 'Truffle Pig', note: 'Right in the base area — food-forward menu with a dedicated 2–4pm après menu.' },
        { name: 'Slopeside Grill', note: 'Directly on the slope at the base of Mt. Werner — a classic après stop.' },
        { name: 'Aurum', note: 'Downtown on the Yampa River — strong happy hour, live music.' },
      ],
      quickBreakfast: {
        name: 'The Paramount',
        note: 'Slope-access base-area spot in Torian Plum Plaza — a fast breakfast before the lift.',
      },
    },
    brews: {
      picks: [{ name: 'Storm Peak Brewing', note: "Steamboat's largest brewery — its Bus Stop taproom sits right near the ski resort." }],
      distilleries: [{ name: 'Mythology Distillery', note: 'Elk River Rd — whiskey, gin, and vodka with a tasting room and restaurant.' }],
    },
    notes:
      'Nov 20, 2026 target is reported consistently by ski-trade outlets but could not be traced to a direct Alterra/Steamboat press release — a reputable secondary source, not a confirmed primary one, so treat with a little extra caution despite "projected" status. UPDATED: Steamboat introduced paid weekend/peak-period parking at both Meadows and Upper Knoll for 2026-27 (previously Meadows read as free apart from the Mon-Thu note, and Knoll was a flat $20-22) — parking note rewritten to the new tiered pricing. The Butcherknife Brewing / Mahogany Ridge ambiguity from earlier research is resolved: Butcherknife closed for good in 2020 (Mythology Distillery now occupies its former building) and Mahogany Ridge is separately confirmed closed — both correctly excluded from brews picks. Not fetch-verified.',
  },
  monarch: {
    officialWebsite: 'https://skimonarch.com',
    snowReportUrl: 'https://skimonarch.com/conditions/',
    webcamUrl: 'https://skimonarch.com/conditions/cams/',
    trailMap: {
      // Only a stale, year-stamped 2021-22 PDF was found — the official site is
      // linked rather than an out-of-date map presented as current.
      officialUrl: 'https://skimonarch.com',
      source: 'official',
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://skimonarch.com/tickets/',
    passInfoUrl: 'https://skimonarch.com/season-passes/',
    phone: '719-530-5000',
    address: '23715 W US Highway 50, Salida, CO 81201',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    grub: {
      town: 'Salida, about 20 miles east',
      picks: [
        { name: 'The Hunger Trailer', note: 'Order-at-the-window stop in Poncha Springs, right on the way up to Monarch.' },
        { name: 'Currents Steak & Seafood', note: "Salida's steakhouse-with-a-view, the largest wine list in town." },
      ],
      quickBreakfast: {
        name: "Mo' Burrito",
        note: "Salida's fastest grab-and-go breakfast burrito.",
      },
    },
    brews: {
      picks: [
        { name: 'Soulcraft Brewing', note: "Downtown Salida's brewery, food truck on site." },
        { name: "Amica's Pizza & Microbrewery", note: 'Long-running, employee-owned downtown pizza-and-tap-house institution.' },
        { name: 'Elevation Beer Company', note: "Salida-area craft brewery whose beer is poured all over town." },
      ],
      distilleries: [{ name: "Wood's High Mountain Distillery", note: 'Downtown Salida — handcrafted spirits from local ingredients since 2012.' }],
    },
    notes:
      'A figure of Dec 4, 2026 for 2026-27 opening appears only on third-party aggregators (in the same "projected openings" style flagged elsewhere in this file as unreliable), not a Monarch press release or its own site, so recorded as TBD rather than repeated as if confirmed. The only trail-map URL found is a stale, year-stamped 2021-22 PDF — the trail map links the official site rather than an out-of-date map. Independent — not on Epic or Ikon — but Monarch passholders get reciprocal days at Powder Alliance-style partner resorts (skimonarch.com/season-pass-partner-resorts-26-27/), so "no major pass affiliation" would undersell it. UPDATED: removed Quincys Steak & Spirits (its Salida location is closed, per current listings; other Quincy\'s locations elsewhere are unrelated and still open). The Hunger Trailer corrected from Maysville to Poncha Springs, where it actually operates (now under "The Hunger Trailer at Poncha Lodge"), still on Hwy 50 en route to the mountain. Grub is down to 2 picks after that removal — genuinely fewer for now rather than padding with an unverified name; Salida likely has more worth adding on a future pass. Added a real webcam URL (skimonarch.com/conditions/cams/, listed under the resort\'s own Conditions section) — found via search indexing rather than a direct render, since skimonarch.com blocks this environment\'s fetch tool, so still worth a quick manual click-through to confirm. Not fetch-verified.',
  },
  telluride: {
    officialWebsite: 'https://tellurideskiresort.com',
    snowReportUrl: 'https://tellurideskiresort.com/snow-report-scrape/',
    webcamUrl: 'https://tellurideskiresort.com/webcams/',
    trailMap: {
      // Only a prior-season (2024-25) PDF could be confirmed — the official
      // site is linked rather than an out-of-date map presented as current.
      officialUrl: 'https://tellurideskiresort.com',
      source: 'official',
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://shop.tellurideskiresort.com/s/passes-and-tickets/winter-lift-tickets/',
    passInfoUrl: 'https://www.epicpass.com',
    phone: '970-728-6900',
    address: '565 Mountain Village Blvd, Telluride, CO 81435',
    openingDate: { date: '2026-11-26', status: 'projected' },
    closingDate: { date: '2027-04-04', status: 'projected' },
    grub: {
      picks: [
        { name: 'Alpino Vino', note: 'On-mountain at 11,966 feet — the highest fine-dining restaurant in North America.' },
        { name: 'Gorrono Ranch', note: '"The Beach" — mid-mountain burgers, chili, and margaritas in Adirondack chairs.' },
        { name: '221 South Oak', note: 'Intimate, chef-owned New American fine dining in a converted historic home near the gondola.' },
      ],
      quickBreakfast: {
        name: 'Baked in Telluride',
        note: 'Cookies, doughnuts, bagels, and fresh croissants downtown — built for a fast handheld breakfast.',
      },
    },
    brews: {
      picks: [
        { name: 'Smuggler Union Restaurant & Brewery', note: 'Downtown, right next to the gondola — the on-site brewery.' },
        { name: 'Stronghouse Brew Pub', note: 'Downtown brewery-restaurant in a historic 1892 stone building — a USA Today Top 5 Brewpub pick.' },
      ],
      distilleries: [
        { name: 'Telluride Distilling Company', note: 'Vodka, gin, whiskey, and its famous Chairlift Warmer schnapps, distilled at 8,750 feet.' },
      ],
    },
    notes:
      'CORRECTED: this entry previously said Telluride "joined the Epic Pass for 2026-27" — that was wrong. Telluride and Vail Resorts jointly announced Telluride joining Epic Pass on Jan 29, 2018, effective the 2018-19 season (the same year it left Mountain Collective), with the partnership extended via a separate press release in Oct 2022. The Epic Pass affiliation itself is still correct today, just not a 2026-27 change — there was no evidence for that date, it was a fabricated detail that slipped into an earlier pass. Opening (Nov 26, 2026) and closing (Apr 4, 2027) dates can now be sourced directly to Telluride Ski & Golf\'s own FAQ page ("Telluride\'s targeted opening day is November 26, 2026... with a closing day of April 4, 2027"), not just secondary ski-trade coverage — still explicitly "targeted" by the resort itself, so "projected" status stays accurate. Trail map: only a prior-season (2024-25) PDF could be confirmed, so it links the official site rather than an out-of-date map. Removed Cosmopolitan (Hotel Columbia) from Grub — it closed after 29 years around April 2025, and Hotel Columbia itself is closed for renovation until late 2027, so there\'s no restaurant there to list for this season. Smugglers Brewery and Pub renamed to its current name, Smuggler Union Restaurant & Brewery (same address, same on-site brewery). Not fetch-verified — see module note.',
  },
};

export const mountainProfileFor = (mountainId: string): MountainProfile | null =>
  MOUNTAIN_PROFILES[mountainId] ?? null;
