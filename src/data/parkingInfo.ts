import type { ParkingInfo } from '@/domain/parking';

/**
 * Each resort's own published parking structure — researched via web search
 * against the resort's own site or, where the resort itself doesn't publish
 * a dedicated parking page, a clearly-credited town/transportation-authority
 * page (e.g. Breckenridge's parking is run by the Town of Breckenridge, not
 * the resort). Researched September 2026, for the 2025-26 season's published
 * rules unless a 2026-27 change was already announced (noted per entry) —
 * treat as a strong starting point, not self-updating; a human should
 * spot-check before relying on it for a specific date.
 *
 * `status` is always `'unknown'` here: none of these sources expose live
 * per-lot occupancy publicly. See `domain/parking.ts` and
 * `providers/live/parking.ts` for why that is honest rather than a gap to
 * paper over.
 */
export const PARKING_INFO: Record<string, ParkingInfo> = {
  vail: {
    status: 'unknown',
    occupied: null,
    capacity: null,
    reservationRequired: 'not-required',
    freeOptionAvailable: true,
    notes: [
      'Paid parking (Town of Vail day-pass system) at the Vail Village and Lionshead structures and the Ford, Soccer and Red Sandstone lots.',
      '"Free After 3" rate applies at the Village/Lionshead structures after 3pm.',
    ],
    infoUrl: 'https://www.vail.gov/government/departments/transportation-services/parking-information',
  },
  'beaver-creek': {
    status: 'unknown',
    occupied: null,
    capacity: null,
    reservationRequired: 'not-required',
    freeOptionAvailable: true,
    notes: [
      'Elk and Bear Lots at the base are free after 1pm; paid before 1pm. A free shuttle connects them to the Village.',
      'Ford Hall and Villa Montane are paid parking structures in the Village.',
    ],
    infoUrl: 'https://www.beavercreek.com/travel-guide/where-to-park-at-beaver-creek.aspx',
  },
  breckenridge: {
    status: 'unknown',
    occupied: null,
    capacity: null,
    reservationRequired: 'partial',
    freeOptionAvailable: true,
    notes: [
      "As of the 2025-26 season, reservations for the paid in-town lots (F Lot, Stables Lot) are highly recommended and may be required via Reserve 'N Ski — space is limited.",
      'The Free Skier Shuttle Lot on McCain Drive is free daily, 6am–11pm, with no reservation.',
    ],
    infoUrl: 'https://www.breckpark.com/skier-parking',
  },
  keystone: {
    status: 'unknown',
    occupied: null,
    capacity: null,
    reservationRequired: 'not-required',
    freeOptionAvailable: true,
    notes: [
      'Free daytime skier parking at River Run, Mountain House East and Lakeside Village.',
      'Mountain House West is paid, managed by Park Keystone.',
    ],
    infoUrl: 'https://www.keystoneresort.com/travel-guide/where-to-park-at-keystone.aspx',
  },
  'crested-butte': {
    status: 'unknown',
    occupied: null,
    capacity: null,
    reservationRequired: 'not-required',
    freeOptionAvailable: true,
    notes: [
      'Two free lots (Snowmass Road; Treasury/Gothic) with free Mountain Express/RTA bus service to the mountain.',
      'Paid options include a season parking permit and heated day parking at Mountaineer Square.',
    ],
    infoUrl: 'https://www.parkcrestedbutte.com/crestedbuttemountainresort',
  },
  'winter-park': {
    status: 'unknown',
    occupied: null,
    capacity: null,
    reservationRequired: 'not-required',
    freeOptionAvailable: true,
    notes: [
      'Over 3,200 free parking spots; no reservation required for general parking.',
      'The Vintage Lot is paid ($15 weekdays / $40 weekends & holidays as of the 2025-26 season); an optional paid Reserve Pass offers covered parking near the gondola.',
    ],
    infoUrl: 'https://www.winterparkresort.com/plan-your-trip/getting-here/resort-parking',
  },
  purgatory: {
    status: 'unknown',
    occupied: null,
    capacity: null,
    reservationRequired: 'not-required',
    freeOptionAvailable: true,
    notes: [
      'Free parking in the Main Village Lot and Overflow Lot.',
      'Free shuttle runs from the overflow lots to the base area, 8am–5pm daily during mountain operations.',
      'The official Purgatory Resort app reports same-day parking-lot status — this page cannot see that feed.',
    ],
    infoUrl: 'https://www.purgatory.ski/transportation-and-shuttle-services/',
    contact: '(970) 426-7282 (Transportation)',
  },
  copper: {
    status: 'unknown',
    occupied: null,
    capacity: null,
    reservationRequired: 'not-required',
    freeOptionAvailable: true,
    notes: [
      'The Alpine Lot is free with no reservation if you arrive before 2pm.',
      'Additional overnight vehicles are paid ($20/night); an unlimited season parking pass is also sold.',
    ],
    infoUrl: 'https://www.coppercolorado.com/the-mountain/getting-to-around-copper/parking/',
  },
  'wolf-creek': {
    status: 'unknown',
    occupied: null,
    capacity: null,
    reservationRequired: 'not-required',
    freeOptionAvailable: true,
    notes: [
      'Free parking across the Upper, Lower, Alberta and Tranquility lots — no reservations.',
      'Free shuttle runs from the lower/overflow lots to the base area.',
    ],
    infoUrl: 'https://wolfcreekski.com/parking-at-wolf-creek-ski-area-co/',
  },
  'arapahoe-basin': {
    status: 'unknown',
    occupied: null,
    capacity: null,
    reservationRequired: 'partial',
    freeOptionAvailable: true,
    notes: [
      "For the 2025-26 season, a reservation is no longer required for general parking — but the Beach and Admin lots still require a paid reservation ($20–$40).",
      'Free carpool parking (4+ occupants) is offered in the Easy Riser, High Noon, Last Chance and Upper Last Chance lots; all parking is free after 1pm on weekends.',
    ],
    infoUrl: 'https://www.parkabasin.com/parkingbasics',
  },
  loveland: {
    status: 'unknown',
    occupied: null,
    capacity: null,
    reservationRequired: 'not-required',
    freeOptionAvailable: true,
    notes: ['Free parking at the base of the mountain — no reservation system.'],
    infoUrl: 'https://www.skiloveland.com/plan-your-trip/faq/',
  },
  eldora: {
    status: 'unknown',
    occupied: null,
    capacity: null,
    reservationRequired: 'not-required',
    freeOptionAvailable: true,
    notes: [
      'Single-occupancy vehicles pay a parking fee (around $10) on weekends, holidays, and big-snow weekdays; free on quiet non-holiday weekdays.',
      'Always free for vehicles carrying two or more people.',
    ],
    infoUrl: 'https://www.eldora.com/the-mountain/questions/policies-terms/',
  },
  monarch: {
    status: 'unknown',
    occupied: null,
    capacity: null,
    reservationRequired: 'not-required',
    freeOptionAvailable: true,
    notes: [
      'All parking at Monarch is free and first-come — the lots sit right at the base off US-50, no shuttle, no reservation system.',
      'The main lots fill on powder weekends; overflow parks along the access road and walks in.',
    ],
    infoUrl: 'https://skimonarch.com',
  },
  telluride: {
    status: 'unknown',
    occupied: null,
    capacity: null,
    reservationRequired: 'not-required',
    freeOptionAvailable: true,
    notes: [
      'Mountain Village: the Gondola Parking Garage beside the gondola is paid day parking; the free gondola links Mountain Village and the town of Telluride.',
      'Town of Telluride: paid on-street and lot parking downtown; the Carhenge lot is the free day-skier option, a short walk to the Oak Street gondola station.',
    ],
    infoUrl: 'https://tellurideskiresort.com',
  },
  steamboat: {
    status: 'unknown',
    occupied: null,
    capacity: null,
    reservationRequired: 'partial',
    freeOptionAvailable: true,
    notes: [
      'Starting the 2026-27 season, the Meadows Lot is paid on Fridays/weekends/peak periods, free Monday–Thursday.',
      'The Upper Knoll Lot is paid every day; carpools of 3+ can park free but must reserve a spot in advance.',
      'Both lots are free after 1pm.',
    ],
    infoUrl: 'https://www.steamboat.com/plan-your-trip/getting-here-and-around',
  },
};

export const parkingInfoFor = (mountainId: string): ParkingInfo | null => PARKING_INFO[mountainId] ?? null;
