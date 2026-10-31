/**
 * Where to look for each resort's live operational/pricing data, and where a
 * human can go check it themselves.
 *
 * This is a registry, not code: adding or fixing a resort's source is a data
 * change here, not a new branch in a provider. Every URL is a stable, public
 * page/endpoint a person could open in a browser — nothing here is a scraped
 * selector or an internal API key.
 *
 * Liftie ids follow Liftie's own resort list (github.com/pirxpilot/liftie,
 * `lib/resorts/<id>/`), which uses compact lowercase ids without hyphens —
 * `breck`, not `breckenridge`; `abasin`, not `arapahoe-basin`. An earlier
 * version of this file guessed hyphenated slugs from the mountain ids and
 * every one of them would have 404'd. These were corrected from the Liftie
 * repository's directory listing; the provider still fails safe to
 * `unavailable` if an id turns out not to exist, and never shows a count
 * from the wrong resort because Liftie echoes the resort `name` back and
 * `liftieOperations.ts` records it.
 */
export interface ResortSource {
  /** The resort's own lift-status / mountain-conditions page. */
  officialOpsUrl?: string;
  /** The resort's own ticket-purchase page. */
  officialPurchaseUrl?: string;
  /** Liftie resort id — a third-party aggregator, never the resort itself. */
  liftieSlug?: string;
  /**
   * The resort's own structured lift/trail feed, read through the proxy
   * (`/api/resort-status`). Tried before Liftie. Only feeds that were checked
   * against the live endpoint are listed; see `providers/live/officialResortFeed.ts`.
   */
  officialFeed?: OfficialFeed;
}

/** `mtnpowder`: Alterra's conditions platform, keyed by its numeric resort id. `powdr`: POWDR's day-of-report API, keyed by resort. */
export type OfficialFeed = { kind: 'mtnpowder'; id: string } | { kind: 'powdr'; id: 'copper' | 'eldora' | 'snowbird' };

export const RESORT_SOURCES: Record<string, ResortSource> = {
  vail: {
    officialOpsUrl: 'https://www.vail.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
    officialPurchaseUrl: 'https://www.vail.com/plan-your-trip/lift-tickets.aspx',
    liftieSlug: 'vail',
  },
  'beaver-creek': {
    officialOpsUrl: 'https://www.beavercreek.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
    officialPurchaseUrl: 'https://www.beavercreek.com/plan-your-trip/lift-tickets.aspx',
    liftieSlug: 'beavercreek',
  },
  breckenridge: {
    officialOpsUrl: 'https://www.breckenridge.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
    officialPurchaseUrl: 'https://www.breckenridge.com/plan-your-trip/lift-tickets.aspx',
    liftieSlug: 'breck',
  },
  keystone: {
    officialOpsUrl: 'https://www.keystoneresort.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
    officialPurchaseUrl: 'https://www.keystoneresort.com/plan-your-trip/lift-tickets.aspx',
    liftieSlug: 'keystone',
  },
  'crested-butte': {
    officialOpsUrl: 'https://www.skicb.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
    officialPurchaseUrl: 'https://www.skicb.com/plan-your-trip/lift-tickets.aspx',
    liftieSlug: 'crested-butte',
  },
  'winter-park': {
    officialOpsUrl: 'https://www.winterparkresort.com/the-mountain/mountain-report',
    officialPurchaseUrl: 'https://www.winterparkresort.com/tickets-and-passes',
    liftieSlug: 'winter-park',
    officialFeed: { kind: 'mtnpowder', id: '5' },
  },
  copper: {
    officialOpsUrl: 'https://www.coppercolorado.com/mountain-report',
    officialPurchaseUrl: 'https://www.coppercolorado.com/lift-tickets',
    liftieSlug: 'copper',
    officialFeed: { kind: 'powdr', id: 'copper' },
  },
  purgatory: {
    // Official domain is purgatory.ski (purgatoryresort.com was an earlier
    // unverified guess). The ops page is the resort's conditions/webcams page
    // and the purchase URL is its store's one-day ticket calendar.
    officialOpsUrl: 'https://www.purgatory.ski/mountain/weather-conditions-webcams/',
    officialPurchaseUrl: 'https://store.purgatory.ski/Calendar.aspx?Department=TICKET%3AWIN&Category=VARIABLE&Item=1DAY&Link=Lift+Tickets',
  },
  'wolf-creek': {
    officialOpsUrl: 'https://wolfcreekski.com/mountain-report/',
    officialPurchaseUrl: 'https://wolfcreekski.com/lift-tickets/',
  },
  'arapahoe-basin': {
    officialOpsUrl: 'https://www.arapahoebasin.com/mountain/conditions-and-weather/',
    officialPurchaseUrl: 'https://www.arapahoebasin.com/tickets/',
    liftieSlug: 'abasin',
    officialFeed: { kind: 'mtnpowder', id: '93' },
  },
  loveland: {
    officialOpsUrl: 'https://www.skiloveland.com/conditions/',
    officialPurchaseUrl: 'https://www.skiloveland.com/lift-tickets/',
    liftieSlug: 'loveland',
  },
  eldora: {
    officialOpsUrl: 'https://www.eldora.com/the-mountain/mountain-report/',
    officialPurchaseUrl: 'https://www.eldora.com/tickets-passes/lift-tickets/',
    liftieSlug: 'eldora',
    officialFeed: { kind: 'powdr', id: 'eldora' },
  },
  steamboat: {
    officialOpsUrl: 'https://www.steamboat.com/the-mountain/mountain-report',
    officialPurchaseUrl: 'https://www.steamboat.com/lift-tickets',
    liftieSlug: 'steamboat',
    officialFeed: { kind: 'mtnpowder', id: '6' },
  },
  monarch: {
    officialOpsUrl: 'https://skimonarch.com/conditions/',
    officialPurchaseUrl: 'https://skimonarch.com/tickets/',
    liftieSlug: 'monarch',
  },
  telluride: {
    officialOpsUrl: 'https://tellurideskiresort.com/lifts/',
    officialPurchaseUrl: 'https://shop.tellurideskiresort.com/s/passes-and-tickets/winter-lift-tickets/',
    liftieSlug: 'telluride',
  },
};

/**
 * The Utah, New Mexico and California batches carry no ops/purchase links of
 * their own here; they get the same two live sources where one exists.
 * Liftie ids are from Liftie's resort directory (github.com/pirxpilot/liftie,
 * `lib/resorts/`, read 2026-10-31). MtnPowder ids were read off the live
 * feed, each one's `Name` matching the mountain.
 */
const REGION_SOURCES: Record<string, ResortSource> = {
  'aspen-mountain': { liftieSlug: 'aspen-mountain' },
  'aspen-highlands': { liftieSlug: 'aspen-highlands' },
  buttermilk: { liftieSlug: 'buttermilk' },
  snowmass: { liftieSlug: 'snowmass' },
  alta: { liftieSlug: 'alta' },
  snowbird: { liftieSlug: 'snowbird', officialFeed: { kind: 'powdr', id: 'snowbird' } },
  brighton: { liftieSlug: 'brighton' },
  solitude: { liftieSlug: 'solitude', officialFeed: { kind: 'mtnpowder', id: '65' } },
  'park-city': { liftieSlug: 'parkcity' },
  'deer-valley': { liftieSlug: 'deer-valley', officialFeed: { kind: 'mtnpowder', id: '49' } },
  snowbasin: { liftieSlug: 'snowbasin' },
  'brian-head': { liftieSlug: 'brianhead' },
  taos: { liftieSlug: 'taos' },
  'angel-fire': { liftieSlug: 'angel-fire' },
  'palisades-tahoe': { liftieSlug: 'palisades', officialFeed: { kind: 'mtnpowder', id: '61' } },
  northstar: { liftieSlug: 'northstar' },
  heavenly: { liftieSlug: 'heavenly' },
  kirkwood: { liftieSlug: 'kirkwood' },
  'sierra-at-tahoe': { liftieSlug: 'sierra' },
  'sugar-bowl': { liftieSlug: 'sugarbowl' },
  boreal: { liftieSlug: 'boreal' },
  'donner-ski-ranch': { liftieSlug: 'donner-ski-ranch' },
  'tahoe-donner': { liftieSlug: 'tahoe-donner' },
  'china-peak': { liftieSlug: 'chinapeak' },
  mammoth: { liftieSlug: 'mammoth-lakes', officialFeed: { kind: 'mtnpowder', id: '60' } },
  'june-mountain': { liftieSlug: 'june-mountain', officialFeed: { kind: 'mtnpowder', id: '59' } },
  'bear-mountain': { officialFeed: { kind: 'mtnpowder', id: '57' } },
  'snow-summit': { officialFeed: { kind: 'mtnpowder', id: '58' } },
  'snow-valley': { liftieSlug: 'snow-valley' },
  'mountain-high': { liftieSlug: 'mthigh' },
};

export const resortSourceFor = (mountainId: string): ResortSource =>
  RESORT_SOURCES[mountainId] ?? REGION_SOURCES[mountainId] ?? {};
