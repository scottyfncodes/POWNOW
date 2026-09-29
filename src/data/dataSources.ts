/**
 * Where every number in live mode comes from — the credits on the home
 * screen. Kept here, next to the other reference data, so it changes when a
 * provider changes. `live: false` marks researched reference data that is
 * written into the app, not fetched.
 */
export interface DataSourceCredit {
  /** What it supplies, in the rider's words. */
  what: string;
  /** Who publishes it. */
  who: string;
  /** Omitted when the source is many sites, each linked where it's used. */
  url?: string;
  live: boolean;
}

export const DATA_SOURCES: DataSourceCredit[] = [
  { what: 'Weather & snowfall', who: 'Open-Meteo', url: 'https://open-meteo.com', live: true },
  { what: 'Measured snowpack', who: 'USDA NRCS SNOTEL', url: 'https://wcc.sc.egov.usda.gov', live: true },
  { what: 'Weather alerts', who: 'National Weather Service', url: 'https://www.weather.gov', live: true },
  { what: 'Lift status', who: 'Liftie (community, unofficial)', url: 'https://liftie.info', live: true },
  { what: 'Drive times & traffic', who: 'Google Maps Routes', url: 'https://developers.google.com/maps/documentation/routes', live: true },
  { what: 'Road conditions & closures', who: 'CDOT COtrip', url: 'https://www.cotrip.org', live: true },
  { what: 'Map', who: 'Esri & Leaflet', url: 'https://leafletjs.com', live: true },
  // Linked per mountain, on its own page — there's no one site to credit.
  { what: 'Tickets, parking, trail maps & dining', who: "each resort's own site, linked on every mountain", live: false },
];
