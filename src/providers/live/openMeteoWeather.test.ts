import { afterEach, describe, expect, it, vi } from 'vitest';
import { at, HOUR, minuteRange } from '@/domain/time';
import { makeContext } from '@/engine/inputs';
import { testMountain } from '@/test/fixtures';
import { OpenMeteoWeatherProvider } from './openMeteoWeather';

const TODAY = '2026-01-17';
const mountain = testMountain();

/** A structurally realistic Open-Meteo hourly response, hand-built to match the documented shape. */
function buildResponse(options: {
  date: string;
  overnightSnowCm?: number;
  daySnowCm?: number;
  tempC?: number;
  windKmh?: number;
} = { date: TODAY }) {
  const { date, overnightSnowCm = 0, daySnowCm = 0, tempC = -5, windKmh = 15 } = options;
  const prevDay = new Date(`${date}T00:00:00Z`);
  prevDay.setUTCDate(prevDay.getUTCDate() - 1);
  const prevDayKey = prevDay.toISOString().slice(0, 10);

  const time: string[] = [];
  const temperature_2m: number[] = [];
  const snowfall: number[] = [];
  const windspeed_10m: number[] = [];
  const windgusts_10m: number[] = [];
  const winddirection_10m: number[] = [];
  const cloudcover: number[] = [];
  const visibility: number[] = [];
  const precipitation_probability: number[] = [];
  const freezinglevel_height: number[] = [];

  // Two days of hours: the day before (evening snow = "overnight") and the target date.
  for (const [dayKey, isTarget] of [[prevDayKey, false], [date, true]] as const) {
    for (let h = 0; h < 24; h += 1) {
      time.push(`${dayKey}T${String(h).padStart(2, '0')}:00`);
      // 12 total "overnight" hours (6pm-midnight the day before + midnight-6am
      // the target date) share the overnight total evenly.
      const isOvernightHour = (!isTarget && h >= 18) || (isTarget && h < 6);
      snowfall.push(isOvernightHour ? overnightSnowCm / 12 : isTarget && h >= 6 && h < 12 ? daySnowCm / 6 : 0);
      temperature_2m.push(tempC);
      windspeed_10m.push(windKmh);
      windgusts_10m.push(windKmh * 1.4);
      winddirection_10m.push(270);
      cloudcover.push(60);
      visibility.push(12000);
      precipitation_probability.push(40);
      freezinglevel_height.push(1800);
    }
  }

  return {
    hourly: {
      time,
      temperature_2m,
      snowfall,
      windspeed_10m,
      windgusts_10m,
      winddirection_10m,
      cloudcover,
      visibility,
      precipitation_probability,
      freezinglevel_height,
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OpenMeteoWeatherProvider — normalization', () => {
  it('maps a realistic response into the normalized MountainWeather shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(buildResponse({ date: TODAY, overnightSnowCm: 20 })), { status: 200 })),
    );
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.overnightSnowIn).toBeCloseTo(20 / 2.54, 1);
    expect(result.data.hourly.length).toBeGreaterThan(10);
    expect(result.data.hourly[0]).toMatchObject({
      minute: at(4),
    });
    // Extra fields the engine doesn't read are still passed through honestly.
    expect(result.data.hourly[0]?.cloudCoverPct).toBe(60);
    expect(result.data.hourly[0]?.windDirectionDeg).toBe(270);
  });

  it('stamps live provenance with fetchedAt/validUntil, never demo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(buildResponse()), { status: 200 })));
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.provenance.source).toBe('live');
    expect(result.provenance.provider).toBe('open-meteo');
    expect(result.provenance.fetchedAt).toBeTruthy();
    expect(result.provenance.validUntil).toBeTruthy();
    expect(new Date(result.provenance.validUntil!).getTime()).toBeGreaterThan(
      new Date(result.provenance.fetchedAt!).getTime(),
    );
    // Open-Meteo is called directly, first-party — never carries the
    // third-party caveat that only a source like Liftie should set.
    expect(result.provenance.attribution).toBeUndefined();
  });

  it('converts units correctly: cm→in snow, km/h→mph wind, °C→°F temp', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(buildResponse({ date: TODAY, tempC: 0, windKmh: 32.1869 })), {
            status: 200,
          }),
      ),
    );
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const hour = result.data.hourly.find((h) => h.minute === at(12));
    expect(hour?.temperatureF).toBe(32); // 0°C = 32°F
    expect(hour?.windMph).toBe(20); // 32.1869 km/h ≈ 20 mph
  });
});

describe('OpenMeteoWeatherProvider — failure handling', () => {
  it('returns unavailable on a non-2xx response, never a fabricated forecast', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('rate limited', { status: 429 })));
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable on malformed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{broken', { status: 200 })));
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable when required hourly fields are missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ hourly: { time: ['2026-01-17T04:00'] } }), { status: 200 })),
    );
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') expect(result.reason).toBeTruthy();
  });

  it('returns unavailable on a network/timeout failure rather than throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('unavailable');
  });

  it('refuses to forecast beyond what Open-Meteo actually covers', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(buildResponse()), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new OpenMeteoWeatherProvider();
    const farFuture = '2026-03-01'; // > 16 days from TODAY
    const result = await provider.getMountainWeather(mountain, makeContext(farFuture, TODAY, at(5)));
    expect(result.status).toBe('unavailable');
    // And it should not have even made the request — there is nothing honest to ask for.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns unavailable when the target date has no matching hours in the response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(buildResponse({ date: '2020-01-01' })), { status: 200 })),
    );
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('unavailable');
  });
});

describe('OpenMeteoWeatherProvider — request shape', () => {
  it('requests an elevation-adjusted forecast at the mountain coordinates', async () => {
    const fetchSpy = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(buildResponse()), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new OpenMeteoWeatherProvider();
    await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));

    const requestedUrl = new URL(fetchSpy.mock.calls[0]![0]);
    expect(requestedUrl.hostname).toBe('api.open-meteo.com');
    expect(requestedUrl.searchParams.get('latitude')).toBe(mountain.weatherLocation.point.lat.toFixed(4));
    expect(Number(requestedUrl.searchParams.get('elevation'))).toBeGreaterThan(2500); // ~10,500ft in meters
    expect(requestedUrl.searchParams.get('hourly')).toContain('snowfall');
  });
});

// Sanity: the fixture builder itself produces coherent minute coverage.
describe('fixture sanity', () => {
  it('covers the full 4am-8pm window the provider samples', () => {
    const minutes = minuteRange(at(4), at(20), HOUR);
    expect(minutes.length).toBe(17);
  });
});

/** Elevation (m) the provider requests for each of testMountain()'s named points. */
const BASE_ELEVATION_M = Math.round(mountain.elevations.baseFt / 3.28084);
const PEAK_ELEVATION_M = Math.round(mountain.elevations.summitFt / 3.28084);

function isMainRequest(url: URL): boolean {
  return (url.searchParams.get('hourly') ?? '').includes('freezinglevel_height');
}

/** A minimal single-elevation response, as the base/peak requests expect. */
function buildElevationResponse(options: { tempC?: number } = {}) {
  const time: string[] = [];
  const temperature_2m: number[] = [];
  const windspeed_10m: number[] = [];
  const windgusts_10m: number[] = [];
  for (let h = 0; h < 24; h += 1) {
    time.push(`${TODAY}T${String(h).padStart(2, '0')}:00`);
    temperature_2m.push(options.tempC ?? -4);
    windspeed_10m.push(12);
    windgusts_10m.push(20);
  }
  return { hourly: { time, temperature_2m, windspeed_10m, windgusts_10m } };
}

/** The main response, extended with an 11-day daily snowfall aggregate centered on `TODAY`. */
function buildResponseWithDaily(dailySnowfallCm: number[]) {
  const main = buildResponse({ date: TODAY });
  const time: string[] = [];
  for (let offset = -5; offset <= 5; offset += 1) {
    const d = new Date(`${TODAY}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + offset);
    time.push(d.toISOString().slice(0, 10));
  }
  return { ...main, daily: { time, snowfall_sum: dailySnowfallCm } };
}

/** A multi-day hourly series with a chosen amount of snow on chosen calendar days (cm per day, spread over the day). */
function buildMultiDayResponse(snowByDate: Record<string, number>, options: { snowDepthM?: number | null } = {}) {
  const dates = Object.keys(snowByDate).sort();
  const time: string[] = [];
  const snowfall: number[] = [];
  const flat = (value: number) => Array.from({ length: dates.length * 24 }, () => value);
  for (const date of dates) {
    for (let h = 0; h < 24; h += 1) {
      time.push(`${date}T${String(h).padStart(2, '0')}:00`);
      // Day snow falls 10:00–14:00 so none of it lands in the overnight window.
      snowfall.push(h >= 10 && h < 14 ? (snowByDate[date] ?? 0) / 4 : 0);
    }
  }
  return {
    hourly: {
      time,
      snowfall,
      temperature_2m: flat(-5),
      windspeed_10m: flat(15),
      windgusts_10m: flat(20),
      cloudcover: flat(60),
      visibility: flat(12000),
      snow_depth: options.snowDepthM === undefined ? flat(0.9) : flat(options.snowDepthM as number),
    },
  };
}

function stubMainAnd(main: unknown, elevation: unknown = buildElevationResponse()) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (rawUrl: string) => {
      const url = new URL(rawUrl);
      return new Response(JSON.stringify(isMainRequest(url) ? main : elevation), { status: 200 });
    }),
  );
}

describe('OpenMeteoWeatherProvider — base and peak conditions', () => {
  it('resolves base and peak temperature/wind from independent, elevation-specific requests', async () => {
    const fetchMock = vi.fn(async (rawUrl: string) => {
      const url = new URL(rawUrl);
      if (isMainRequest(url)) {
        return new Response(JSON.stringify(buildResponse({ date: TODAY })), { status: 200 });
      }
      const elevation = Number(url.searchParams.get('elevation'));
      const tempC = elevation === BASE_ELEVATION_M ? -2 : elevation === PEAK_ELEVATION_M ? -11 : 0;
      return new Response(JSON.stringify(buildElevationResponse({ tempC })), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await new OpenMeteoWeatherProvider().getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.base?.temperatureF).toBe(28);
    expect(result.data.peak?.temperatureF).toBe(12);
    expect(result.data.base!.source).toBe('open-meteo');
    // Depth is a single grid-cell model value, so it is never attributed to an elevation.
    expect('snowDepthIn' in result.data.base!).toBe(false);
  });

  it('reports the model snow depth once, at the forecast point, and null when the model omits it', async () => {
    stubMainAnd(buildMultiDayResponse({ '2026-01-16': 0, [TODAY]: 0 }, { snowDepthM: 1.2 }));
    const withDepth = await new OpenMeteoWeatherProvider().getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(withDepth.status === 'ok' && withDepth.data.modelSnowDepthIn).toBeCloseTo(47.2, 0);

    const { clearProviderCaches } = await import('./fetchCache');
    clearProviderCaches();
    stubMainAnd(buildMultiDayResponse({ '2026-01-16': 0, [TODAY]: 0 }, { snowDepthM: null }));
    const without = await new OpenMeteoWeatherProvider().getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(without.status === 'ok' && without.data.modelSnowDepthIn).toBeNull();
  });

  it('leaves peak unavailable — never copied from base — when only the summit request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (rawUrl: string) => {
        const url = new URL(rawUrl);
        if (isMainRequest(url)) {
          return new Response(JSON.stringify(buildResponse({ date: TODAY })), { status: 200 });
        }
        if (Number(url.searchParams.get('elevation')) === PEAK_ELEVATION_M) {
          return new Response('rate limited', { status: 429 });
        }
        return new Response(JSON.stringify(buildElevationResponse()), { status: 200 });
      }),
    );
    const result = await new OpenMeteoWeatherProvider().getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.base).not.toBeNull();
    expect(result.data.peak).toBeNull();
  });
});

describe('OpenMeteoWeatherProvider — days since the last storm', () => {
  const run = async (snowByDate: Record<string, number>, date = TODAY) => {
    stubMainAnd(buildMultiDayResponse(snowByDate));
    const result = await new OpenMeteoWeatherProvider().getMountainWeather(mountain, makeContext(date, TODAY, at(5)));
    expect(result.status).toBe('ok');
    return result.status === 'ok' ? result.data : null;
  };

  it('counts the actual gap: a 5cm day three days ago is 3, not 0 and not "forever"', async () => {
    const data = await run({ '2026-01-11': 0, '2026-01-12': 0, '2026-01-13': 0, '2026-01-14': 5, '2026-01-15': 0, '2026-01-16': 0, [TODAY]: 0 });
    expect(data?.daysSinceStorm).toBe(3);
  });

  it('is 1 when yesterday delivered a storm and 0 when last night did', async () => {
    expect((await run({ '2026-01-15': 0, '2026-01-16': 6, [TODAY]: 0 }))?.daysSinceStorm).toBe(1);
    const { clearProviderCaches } = await import('./fetchCache');
    clearProviderCaches();
    // Overnight: the fixture puts day snow 10–14h; put snow in the 0–6h window of TODAY by hand.
    const response = buildMultiDayResponse({ '2026-01-16': 0, [TODAY]: 0 });
    response.hourly.snowfall = response.hourly.time.map((iso) => (iso.startsWith(`${TODAY}T0`) ? 1.5 : 0));
    stubMainAnd(response);
    const overnight = await new OpenMeteoWeatherProvider().getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(overnight.status === 'ok' && overnight.data.daysSinceStorm).toBe(0);
  });

  it('ignores a dusting: 0.5cm does not reset the clock', async () => {
    const data = await run({ '2026-01-13': 5, '2026-01-14': 0, '2026-01-15': 0.5, '2026-01-16': 0, [TODAY]: 0 });
    expect(data?.daysSinceStorm).toBe(4);
  });

  it('reports the size of the window it looked at when nothing in it qualified — an honest floor, not "forever"', async () => {
    const data = await run({ '2026-01-11': 0, '2026-01-12': 0, '2026-01-13': 0, '2026-01-14': 0, '2026-01-15': 0, '2026-01-16': 0, [TODAY]: 0 });
    expect(data?.daysSinceStorm).toBe(6);
  });

  it('for a planned future date, counts forecast snow between now and then', async () => {
    const data = await run({ '2026-01-16': 0, [TODAY]: 0, '2026-01-18': 7, '2026-01-19': 0, '2026-01-20': 0 }, '2026-01-20');
    expect(data?.daysSinceStorm).toBe(2);
  });
});

describe('OpenMeteoWeatherProvider — caching', () => {
  it('serves a second identical request from the cache, with the original fetch time', async () => {
    const fetchSpy = vi.fn(async (rawUrl: string) => {
      const url = new URL(rawUrl);
      return new Response(JSON.stringify(isMainRequest(url) ? buildResponse({ date: TODAY }) : buildElevationResponse()), {
        status: 200,
      });
    });
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new OpenMeteoWeatherProvider();
    const first = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    const callsAfterFirst = fetchSpy.mock.calls.length;
    const second = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);
    expect(second.status === 'ok' && first.status === 'ok' && second.provenance.fetchedAt).toBe(
      first.status === 'ok' ? first.provenance.fetchedAt : undefined,
    );
  });
});

describe('OpenMeteoWeatherProvider — 5-day snow history', () => {
  it('splits the daily aggregate into 5 real days back and 5 projected days forward, anchored to today', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (rawUrl: string) => {
        const url = new URL(rawUrl);
        if (isMainRequest(url)) {
          // 11 days: day -5..-1 observed, today, day +1..+5 forecast (cm).
          const cm = [2, 0, 0, 5, 1, 0, 3, 0, 0, 8, 1];
          return new Response(JSON.stringify(buildResponseWithDaily(cm)), { status: 200 });
        }
        return new Response(JSON.stringify(buildElevationResponse()), { status: 200 });
      }),
    );
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    const history = result.data.snowHistory;
    expect(history).not.toBeNull();
    if (!history) return;
    expect(history.past.length).toBe(5);
    expect(history.future.length).toBe(5);
    expect(history.past.every((day) => day.kind === 'observed')).toBe(true);
    expect(history.future.every((day) => day.kind === 'forecast')).toBe(true);
    // Each day is converted and rounded to a tenth before summing, so the
    // total always matches what the five daily figures actually add up to.
    expect(history.pastTotalIn).toBeCloseTo(3.2, 1);
    expect(history.futureTotalIn).toBeCloseTo(4.7, 1);
  });

  it('returns null rather than a fabricated history when the daily aggregate is absent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(buildResponse({ date: TODAY })), { status: 200 })));
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.snowHistory).toBeNull();
  });
});
