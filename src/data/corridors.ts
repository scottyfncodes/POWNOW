import type { TrafficCorridor } from '@/domain/mountain';

/**
 * Corridors are shared between mountains: everything west of Denver funnels
 * through the same tunnel, which is exactly why departure timing matters —
 * and the same is true of Little Cottonwood out of Salt Lake, Donner Summit
 * out of the Bay Area, and the Rim of the World out of Los Angeles.
 */
export const CORRIDORS: Record<string, TrafficCorridor> = {
  'i70-west': { id: 'i70-west', name: 'I-70 west / Eisenhower Tunnel', shorthand: 'I-70' },
  'us285-hoosier': { id: 'us285-hoosier', name: 'US-285 / Hoosier Pass', shorthand: 'US-285' },
  'us6-loveland': { id: 'us6-loveland', name: 'US-6 / Loveland Pass', shorthand: 'US-6' },
  'us40-berthoud': { id: 'us40-berthoud', name: 'US-40 / Berthoud Pass', shorthand: 'US-40' },
  'us24-buena-vista': { id: 'us24-buena-vista', name: 'US-24 / Buena Vista', shorthand: 'US-24' },
  'us50-monarch': { id: 'us50-monarch', name: 'US-50 / Monarch Pass', shorthand: 'US-50' },
  'us550-durango': { id: 'us550-durango', name: 'US-550 / San Juan Skyway', shorthand: 'US-550' },
  'us160-wolfcreek': { id: 'us160-wolfcreek', name: 'US-160 / Wolf Creek Pass', shorthand: 'US-160' },
  'co119-eldora': { id: 'co119-eldora', name: 'CO-119 / Boulder Canyon', shorthand: 'CO-119' },
  'us40-rabbitears': { id: 'us40-rabbitears', name: 'US-40 / Rabbit Ears Pass', shorthand: 'US-40' },
  'co82-roaring-fork': { id: 'co82-roaring-fork', name: 'CO-82 / Roaring Fork Valley', shorthand: 'CO-82' },
  'i25-raton': { id: 'i25-raton', name: 'I-25 south / Raton Pass', shorthand: 'I-25' },
  // Utah
  'ut210-little-cottonwood': { id: 'ut210-little-cottonwood', name: 'SR-210 / Little Cottonwood Canyon', shorthand: 'SR-210' },
  'ut190-big-cottonwood': { id: 'ut190-big-cottonwood', name: 'SR-190 / Big Cottonwood Canyon', shorthand: 'SR-190' },
  'i80-parleys': { id: 'i80-parleys', name: "I-80 / Parleys Canyon", shorthand: 'I-80' },
  'ut-ogden-valley': { id: 'ut-ogden-valley', name: 'Ogden Canyon / Trappers Loop (SR-39, SR-167)', shorthand: 'SR-39' },
  'us189-provo-canyon': { id: 'us189-provo-canyon', name: 'US-189 / Provo Canyon', shorthand: 'US-189' },
  'us89-logan-canyon': { id: 'us89-logan-canyon', name: 'US-89 / Logan Canyon', shorthand: 'US-89' },
  'i15-southern-utah': { id: 'i15-southern-utah', name: 'I-15 south / southern Utah plateaus', shorthand: 'I-15' },
  // New Mexico
  'nm-enchanted-circle': { id: 'nm-enchanted-circle', name: 'Enchanted Circle (US-64 / NM-38 / NM-150)', shorthand: 'US-64' },
  'nm475-hyde-park': { id: 'nm475-hyde-park', name: 'NM-475 / Hyde Park Road', shorthand: 'NM-475' },
  'nm-jemez': { id: 'nm-jemez', name: 'NM-502 / NM-501 to Los Alamos', shorthand: 'NM-502' },
  'nm-high-road': { id: 'nm-high-road', name: 'NM-518 / NM-68 (Taos–Mora)', shorthand: 'NM-518' },
  'nm-sacramento-mtns': { id: 'nm-sacramento-mtns', name: 'US-70 / NM-48 / NM-532 to Ruidoso', shorthand: 'NM-532' },
  // California (Reno counts — it's the Tahoe gateway)
  'i80-donner': { id: 'i80-donner', name: 'I-80 / Donner Summit', shorthand: 'I-80' },
  'us50-echo': { id: 'us50-echo', name: 'US-50 / Echo Summit', shorthand: 'US-50' },
  'ca88-carson': { id: 'ca88-carson', name: 'CA-88 / Carson Pass', shorthand: 'CA-88' },
  'tahoe-basin': { id: 'tahoe-basin', name: 'Tahoe basin roads (SR-89 / SR-267 / SR-28 / NV-207)', shorthand: 'SR-89' },
  'us395-eastern-sierra': { id: 'us395-eastern-sierra', name: 'US-395 / Eastern Sierra', shorthand: 'US-395' },
  'ca4-ebbetts': { id: 'ca4-ebbetts', name: 'CA-4 / Ebbetts Pass Highway', shorthand: 'CA-4' },
  'ca108-sonora': { id: 'ca108-sonora', name: 'CA-108 / Sonora Pass Highway', shorthand: 'CA-108' },
  'ca168-huntington': { id: 'ca168-huntington', name: 'CA-168 to Huntington Lake', shorthand: 'CA-168' },
  'ca41-yosemite': { id: 'ca41-yosemite', name: 'CA-41 / Glacier Point Road (Yosemite)', shorthand: 'CA-41' },
  'big-bear': { id: 'big-bear', name: 'Rim of the World (SR-18 / SR-330 / SR-38) to Big Bear', shorthand: 'SR-18' },
  'ca2-wrightwood': { id: 'ca2-wrightwood', name: 'SR-138 / SR-2 to Wrightwood', shorthand: 'SR-2' },
  'mt-baldy-road': { id: 'mt-baldy-road', name: 'Mount Baldy Road', shorthand: 'Baldy Rd' },
  'i5-shasta': { id: 'i5-shasta', name: 'I-5 north / Mount Shasta', shorthand: 'I-5' },
  local: { id: 'local', name: 'Local roads', shorthand: 'Local' },
};

/**
 * How badly a corridor amplifies congestion. I-70 is the extreme case: a
 * single tunnel with no realistic alternative for 40,000 skiers.
 */
export const CORRIDOR_SEVERITY: Record<string, number> = {
  'i70-west': 0.85,
  'us285-hoosier': 0.3,
  'us6-loveland': 0.4,
  'us40-berthoud': 0.5,
  'us24-buena-vista': 0.2,
  'us50-monarch': 0.16,
  'us550-durango': 0.12,
  // Empty road, serious pass. The risk here is weather, not volume.
  'us160-wolfcreek': 0.1,
  'co119-eldora': 0.25,
  'us40-rabbitears': 0.35,
  'co82-roaring-fork': 0.3,
  'i25-raton': 0.12,
  // Little Cottonwood: one road, avalanche closures, interlodge — the I-70 of Utah.
  'ut210-little-cottonwood': 0.8,
  'ut190-big-cottonwood': 0.6,
  'i80-parleys': 0.45,
  'ut-ogden-valley': 0.3,
  'us189-provo-canyon': 0.25,
  'us89-logan-canyon': 0.12,
  'i15-southern-utah': 0.12,
  'nm-enchanted-circle': 0.14,
  'nm475-hyde-park': 0.2,
  'nm-jemez': 0.1,
  'nm-high-road': 0.1,
  'nm-sacramento-mtns': 0.14,
  // Donner Summit on a storm Friday is California's version of the tunnel.
  'i80-donner': 0.75,
  'us50-echo': 0.55,
  'ca88-carson': 0.25,
  'tahoe-basin': 0.5,
  'us395-eastern-sierra': 0.2,
  'ca4-ebbetts': 0.15,
  'ca108-sonora': 0.18,
  'ca168-huntington': 0.14,
  'ca41-yosemite': 0.16,
  // A few two-lane switchback roads for all of Southern California.
  'big-bear': 0.6,
  'ca2-wrightwood': 0.45,
  'mt-baldy-road': 0.4,
  'i5-shasta': 0.12,
  local: 0.14,
};

/**
 * Which weather region a corridor runs through, so road conditions follow the
 * storm that is actually falling on that road.
 */
export const CORRIDOR_REGION: Record<string, string> = {
  'i70-west': 'i70-corridor',
  'us285-hoosier': 'i70-corridor',
  'us6-loveland': 'i70-corridor',
  'us40-berthoud': 'i70-corridor',
  'us24-buena-vista': 'i70-corridor',
  'us50-monarch': 'san-juans',
  'us550-durango': 'san-juans',
  'us160-wolfcreek': 'san-juans',
  'co119-eldora': 'i70-corridor',
  'us40-rabbitears': 'i70-corridor',
  'co82-roaring-fork': 'i70-corridor',
  'i25-raton': 'northern-new-mexico',
  'ut210-little-cottonwood': 'wasatch',
  'ut190-big-cottonwood': 'wasatch',
  'i80-parleys': 'wasatch',
  'ut-ogden-valley': 'wasatch',
  'us189-provo-canyon': 'wasatch',
  'us89-logan-canyon': 'wasatch',
  'i15-southern-utah': 'southern-utah',
  'nm-enchanted-circle': 'northern-new-mexico',
  'nm475-hyde-park': 'northern-new-mexico',
  'nm-jemez': 'northern-new-mexico',
  'nm-high-road': 'northern-new-mexico',
  'nm-sacramento-mtns': 'southern-new-mexico',
  'i80-donner': 'sierra-tahoe',
  'us50-echo': 'sierra-tahoe',
  'ca88-carson': 'sierra-tahoe',
  'tahoe-basin': 'sierra-tahoe',
  'us395-eastern-sierra': 'eastern-sierra',
  'ca4-ebbetts': 'central-sierra',
  'ca108-sonora': 'central-sierra',
  'ca168-huntington': 'central-sierra',
  'ca41-yosemite': 'central-sierra',
  'big-bear': 'southern-california',
  'ca2-wrightwood': 'southern-california',
  'mt-baldy-road': 'southern-california',
  'i5-shasta': 'mount-shasta',
  local: 'i70-corridor',
};

export const corridorFor = (id: string): TrafficCorridor =>
  CORRIDORS[id] ?? (CORRIDORS['local'] as TrafficCorridor);
