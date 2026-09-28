import type {
  DailySnowfall,
  ElevationConditions,
  HourlyWeather,
  MountainWeather,
  SnowHistory,
} from '@/domain/conditions';
import { addDays, type DateKey } from '@/domain/dates';
import type { Mountain } from '@/domain/mountain';
import {
  type Availability,
  confidenceForHorizon,
  observationForHorizon,
  ok,
  unavailable,
} from '@/domain/provenance';
import { at, clamp01, HOUR, minuteRange, type MinuteOfDay } from '@/domain/time';
import { bell } from '@/lib/curve';
import { estimateSnowDensity } from '@/lib/snow';
import type { ProviderContext, WeatherProvider } from '@/providers/types';
import { cachedJson } from './fetchCache';

const FIRST_HOUR = at(4);
const LAST_HOUR = at(20);

/** Open-Meteo's free forecast tier. No API key: it is genuinely public. */
const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

/** Open-Meteo will not forecast further out than this. Beyond it, we say so. */
const MAX_FORECAST_DAYS = 16;

/**
 * Days of already-elapsed weather to pull back. Seven, not five: the 5-day
 * snow history needs five, and "days since the last storm" is only an honest
 * number as far back as we actually looked — a week is far enough that a
 * bone-dry answer means something.
 */
const PAST_DAYS = 7;

/** Minimum forward window so "next 5 days" is always covered, even for a same-day NOW request. */
const MIN_FORWARD_DAYS = 7;

/**
 * A calendar day with at least this much snow counts as "a storm" for
 * `daysSinceStorm`. An inch and a half is the point where a skier notices
 * the surface changed; the surface model (`engine/snowClock.ts`) applies a
 * staleness penalty that grows with days since this, and grooming offsets
 * it — so the threshold has to be one that actually refreshes a run.
 */
const STORM_DAY_IN = 1.5;

/** A forecast is good for this long before the badge should say STALE. */
const FRESHNESS_MINUTES = { today: 30, future: 120 } as const;

const HOURLY_FIELDS = [
  'temperature_2m',
  'precipitation',
  'snowfall',
  'snow_depth',
  'precipitation_probability',
  'windspeed_10m',
  'windgusts_10m',
  'winddirection_10m',
  'cloudcover',
  'visibility',
  'freezinglevel_height',
] as const;

/** The elevation points only need what varies meaningfully with elevation. */
const ELEVATION_FIELDS = ['temperature_2m', 'windspeed_10m', 'windgusts_10m'] as const;

const DAILY_FIELDS = ['snowfall_sum'] as const;

/** The subset of the Open-Meteo response this provider actually reads. */
interface OpenMeteoResponse {
  hourly?: {
    time?: string[];
    temperature_2m?: (number | null)[];
    precipitation?: (number | null)[];
    snowfall?: (number | null)[];
    snow_depth?: (number | null)[];
    precipitation_probability?: (number | null)[];
    windspeed_10m?: (number | null)[];
    windgusts_10m?: (number | null)[];
    winddirection_10m?: (number | null)[];
    cloudcover?: (number | null)[];
    visibility?: (number | null)[];
    freezinglevel_height?: (number | null)[];
  };
  daily?: {
    time?: string[];
    snowfall_sum?: (number | null)[];
  };
}

export interface OpenMeteoWeatherOptions {
  /** Override for tests; production code never needs this. */
  baseUrl?: string;
  /** How long a fetched forecast should be trusted, in minutes. */
  freshnessMinutes?: number;
}

/**
 * Production weather via Open-Meteo.
 *
 * Open-Meteo needs no API key and serves CORS, so this calls the API directly
 * from the browser — there is no secret to protect and no server boundary to
 * build for this one. Three requests per mountain, fired together: the main
 * mid-mountain forecast (hourly + the daily snowfall aggregate) and two
 * elevation-corrected points for base and summit temperature/wind.
 *
 * What the `elevation` parameter does and doesn't do, stated plainly because
 * an earlier version of this file got it wrong: Open-Meteo lapse-rate-corrects
 * **temperature** to the requested elevation. Wind, snowfall and snow depth
 * are the grid cell's values whatever elevation you ask for. So base and
 * summit *temperatures* here are genuinely different readings; summit wind
 * is the same cell's wind (still useful, since it is the wind at the model's
 * ridge-scale terrain, but not a separate measurement); and snow depth is
 * reported **once**, as `modelSnowDepthIn`, labeled as a model estimate. A
 * measured depth comes from the SNOTEL snowpack provider instead.
 *
 * All timestamps are handled as the mountain's local wall-clock strings
 * (`timezone=auto` returns them that way) and compared as strings. Nothing
 * here goes through `new Date(...)` on a zone-less string, which would parse
 * in the *browser's* zone and shift a Denver forecast by however far away
 * the person reading it happens to be.
 */
export class OpenMeteoWeatherProvider implements WeatherProvider {
  readonly id = 'open-meteo';

  constructor(private readonly options: OpenMeteoWeatherOptions = {}) {}

  async getMountainWeather(
    mountain: Mountain,
    context: ProviderContext,
  ): Promise<Availability<MountainWeather>> {
    if (context.horizonDays > MAX_FORECAST_DAYS) {
      return unavailable(
        this.id,
        `Open-Meteo only forecasts ${MAX_FORECAST_DAYS} days out; this date is ${context.horizonDays} days away.`,
      );
    }

    const ttlMs = (context.horizonDays === 0 ? 10 : 30) * 60 * 1000;
    const mainUrl = this.buildUrl(mountain, context);

    // All three requests go out together; the two elevation points are
    // allowed to fail on their own without taking the forecast down.
    const [mainResult, base, peak] = await Promise.all([
      cachedJson<OpenMeteoResponse>(mainUrl, { timeoutMs: 8000, ttlMs }).then(
        (result) => ({ ok: true as const, result }),
        (error: unknown) => ({ ok: false as const, error }),
      ),
      this.fetchElevationPoint(mountain, context, mountain.elevations.baseFt, ttlMs),
      this.fetchElevationPoint(mountain, context, mountain.elevations.summitFt, ttlMs),
    ]);

    if (!mainResult.ok) return unavailable(this.id, describeError(mainResult.error));

    const payload = mainResult.result.value;
    const fetchedAt = new Date(mainResult.result.fetchedAt);
    const hourly = payload.hourly;
    if (
      !hourly?.time ||
      !hourly.temperature_2m ||
      !hourly.snowfall ||
      !hourly.windspeed_10m ||
      !hourly.windgusts_10m
    ) {
      return unavailable(this.id, 'Open-Meteo returned an incomplete hourly forecast.');
    }

    const times = hourly.time;
    const snowfallIn = (index: number): number => ((hourly.snowfall?.[index] ?? 0) as number) / 2.54;

    // ---- Snow accounting, all in local-time string space -----------------
    const targetDate = context.date;
    const dayBefore = addDays(targetDate, -1);
    const dawn = `${targetDate}T06:00`;

    // "Now" for the 72h trailing window: the actual clock for today, midday
    // for a planned future date (the middle of that ski day).
    const referenceMinute = context.horizonDays === 0 ? roundDownToHour(context.now) : at(12);
    const referenceIso = localIsoFor(targetDate, referenceMinute);
    const trailingStartIso = localIsoFor(addDays(targetDate, -3), referenceMinute);

    let overnightSnowIn = 0;
    let recentSnow72hIn = 0;
    const dailyTotals = new Map<DateKey, number>();

    for (let i = 0; i < times.length; i += 1) {
      const iso = times[i];
      if (!iso) continue;
      const inches = snowfallIn(i);
      const date = iso.slice(0, 10);

      if (iso > trailingStartIso && iso <= referenceIso) recentSnow72hIn += inches;

      // Overnight = 6pm the day before through 6am of the target date.
      if ((date === dayBefore && hourOf(iso) >= 18) || (date === targetDate && iso < dawn)) {
        overnightSnowIn += inches;
      }

      // Per-calendar-day totals for everything before the target's dawn.
      if (iso < dawn) dailyTotals.set(date, (dailyTotals.get(date) ?? 0) + inches);
    }

    const daysSinceStorm = computeDaysSinceStorm(targetDate, overnightSnowIn, dailyTotals);

    // ---- The target day's hours -----------------------------------------
    const targetHours: HourlyWeather[] = [];
    for (const minute of minuteRange(FIRST_HOUR, LAST_HOUR, HOUR)) {
      const index = times.indexOf(localIsoFor(targetDate, minute));
      if (index === -1) continue;

      const tempF = celsiusToF(hourly.temperature_2m[index] ?? 0);
      const windMph = kmhToMph(hourly.windspeed_10m[index] ?? 0);
      const gustMph = kmhToMph(hourly.windgusts_10m[index] ?? windMph * 1.5);
      const cloudPct = hourly.cloudcover?.[index] ?? 50;
      const visibilityM = hourly.visibility?.[index] ?? 16000;

      const daylight = bell(minute, at(12, 30), 260);
      const sunFactor = clamp01((1 - cloudPct / 100) * (0.3 + 0.9 * daylight));

      const freezingLevelM = hourly.freezinglevel_height?.[index];

      targetHours.push({
        minute,
        snowfallIn: round2(snowfallIn(index)),
        temperatureF: Math.round(tempF),
        windMph: Math.round(windMph),
        windGustMph: Math.round(gustMph),
        sunFactor: round2(sunFactor),
        visibility: round2(clamp01(visibilityM / 16000)),
        density: round2(estimateSnowDensity(tempF)),
        precipitationProbability: hourly.precipitation_probability?.[index] ?? undefined,
        cloudCoverPct: hourly.cloudcover?.[index] ?? undefined,
        windDirectionDeg: hourly.winddirection_10m?.[index] ?? undefined,
        freezingLevelFt:
          freezingLevelM === undefined || freezingLevelM === null
            ? undefined
            : Math.round(freezingLevelM * 3.28084),
      });
    }

    if (targetHours.length === 0) {
      return unavailable(this.id, 'Open-Meteo did not return hours for the requested date.');
    }

    // The model's snow depth at the forecast point, read once at the anchor hour.
    let anchorIndex = times.indexOf(referenceIso);
    if (anchorIndex === -1) anchorIndex = times.findIndex((iso) => iso.startsWith(targetDate));
    const depthM = anchorIndex === -1 ? null : (hourly.snow_depth?.[anchorIndex] ?? null);
    const modelSnowDepthIn = depthM === null || depthM === undefined ? null : round1(depthM * 39.3701);

    const freshnessMinutes =
      this.options.freshnessMinutes ??
      (context.horizonDays === 0 ? FRESHNESS_MINUTES.today : FRESHNESS_MINUTES.future);
    const validUntil = new Date(fetchedAt.getTime() + freshnessMinutes * 60 * 1000);

    return ok(
      {
        overnightSnowIn: round1(overnightSnowIn),
        recentSnow72hIn: round1(recentSnow72hIn),
        daysSinceStorm,
        hourly: targetHours,
        summary: summarize(targetHours, daysSinceStorm),
        base,
        peak,
        snowHistory: buildSnowHistory(payload.daily, context.today),
        modelSnowDepthIn,
      },
      {
        source: 'live',
        observation: observationForHorizon(context.horizonDays),
        confidence: confidenceForHorizon(context.horizonDays),
        provider: this.id,
        horizonDays: context.horizonDays,
        fetchedAt: fetchedAt.toISOString(),
        validUntil: validUntil.toISOString(),
      },
    );
  }

  private buildUrl(mountain: Mountain, context: ProviderContext): string {
    const base = this.options.baseUrl ?? BASE_URL;
    const { lat, lon } = mountain.weatherLocation.point;
    const elevationM = Math.round(mountain.weatherLocation.forecastElevationFt / 3.28084);
    const forecastDays = Math.min(MAX_FORECAST_DAYS, Math.max(MIN_FORWARD_DAYS, context.horizonDays + 2));

    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      elevation: String(elevationM),
      hourly: HOURLY_FIELDS.join(','),
      daily: DAILY_FIELDS.join(','),
      forecast_days: String(forecastDays),
      past_days: String(PAST_DAYS),
      timezone: 'auto',
      temperature_unit: 'celsius',
      windspeed_unit: 'kmh',
      precipitation_unit: 'mm',
    });

    return `${base}?${params.toString()}`;
  }

  /**
   * A minimal, single-elevation request for one point on the mountain: the
   * same coordinates, a different `elevation`, so Open-Meteo's own
   * lapse-rate correction gives the temperature at that height. Returns
   * `null` on any failure — never a copy of the other elevation's reading.
   */
  private async fetchElevationPoint(
    mountain: Mountain,
    context: ProviderContext,
    elevationFt: number,
    ttlMs: number,
  ): Promise<ElevationConditions | null> {
    try {
      const baseUrl = this.options.baseUrl ?? BASE_URL;
      const { lat, lon } = mountain.coordinates;
      const elevationM = Math.round(elevationFt / 3.28084);
      const forecastDays = Math.min(MAX_FORECAST_DAYS, Math.max(2, context.horizonDays + 2));

      const params = new URLSearchParams({
        latitude: lat.toFixed(4),
        longitude: lon.toFixed(4),
        elevation: String(elevationM),
        hourly: ELEVATION_FIELDS.join(','),
        forecast_days: String(forecastDays),
        timezone: 'auto',
        temperature_unit: 'celsius',
        windspeed_unit: 'kmh',
      });

      const { value: payload, fetchedAt } = await cachedJson<OpenMeteoResponse>(
        `${baseUrl}?${params.toString()}`,
        { timeoutMs: 8000, ttlMs },
      );
      const hourly = payload.hourly;
      if (!hourly?.time || !hourly.temperature_2m || !hourly.windspeed_10m) return null;

      const anchorMinute = context.horizonDays === 0 ? roundDownToHour(context.now) : at(12);
      let index = hourly.time.indexOf(localIsoFor(context.date, anchorMinute));
      if (index === -1) index = hourly.time.findIndex((iso) => iso.startsWith(context.date));
      if (index === -1) return null;

      const windMph = kmhToMph(hourly.windspeed_10m[index] ?? 0);
      const gustMph = kmhToMph(hourly.windgusts_10m?.[index] ?? windMph * 1.5);

      return {
        temperatureF: Math.round(celsiusToF(hourly.temperature_2m[index] ?? 0)),
        windMph: Math.round(windMph),
        windGustMph: Math.round(gustMph),
        timestamp: new Date(fetchedAt).toISOString(),
        source: this.id,
      };
    } catch {
      return null;
    }
  }
}

/**
 * Days since the last calendar day that delivered a real refresh of snow,
 * walking back from the target date. `0` when the target's own overnight
 * brought an inch or more. When no such day exists anywhere in the window we
 * looked at, the answer is the size of that window — "at least this long",
 * which is the most the data can honestly say — never a fabricated "forever".
 */
export function computeDaysSinceStorm(
  targetDate: DateKey,
  overnightSnowIn: number,
  dailyTotals: Map<DateKey, number>,
): number {
  if (overnightSnowIn >= 1) return 0;
  let daysExamined = 0;
  for (let d = 1; d <= PAST_DAYS + MAX_FORECAST_DAYS; d += 1) {
    const total = dailyTotals.get(addDays(targetDate, -d));
    if (total === undefined) break;
    daysExamined = d;
    if (total >= STORM_DAY_IN) return d;
  }
  return Math.max(1, daysExamined);
}

/**
 * Five-day-back / five-day-forward snowfall from Open-Meteo's own daily
 * aggregate — not summed by hand from the hourly series, so it matches
 * whatever day-boundary convention the provider itself uses. Anchored to
 * `today`, not to whichever date is being planned: it describes the
 * mountain's snow cycle, independent of which day the user is looking at.
 */
function buildSnowHistory(daily: OpenMeteoResponse['daily'], today: DateKey): SnowHistory | null {
  if (!daily?.time || !daily.snowfall_sum) return null;
  const todayIndex = daily.time.indexOf(today);
  if (todayIndex === -1) return null;

  const dayAt = (offset: number, kind: DailySnowfall['kind']): DailySnowfall | null => {
    const index = todayIndex + offset;
    const date = daily.time?.[index];
    const cm = daily.snowfall_sum?.[index];
    if (date === undefined || cm === undefined || cm === null) return null;
    return { date, snowfallIn: round1(cm / 2.54), kind };
  };

  const past = [-5, -4, -3, -2, -1]
    .map((offset) => dayAt(offset, 'observed'))
    .filter((day): day is DailySnowfall => day !== null);
  const future = [1, 2, 3, 4, 5]
    .map((offset) => dayAt(offset, 'forecast'))
    .filter((day): day is DailySnowfall => day !== null);

  if (past.length === 0 && future.length === 0) return null;

  return {
    past,
    pastTotalIn: round1(past.reduce((sum, day) => sum + day.snowfallIn, 0)),
    future,
    futureTotalIn: round1(future.reduce((sum, day) => sum + day.snowfallIn, 0)),
  };
}

function roundDownToHour(minute: MinuteOfDay): MinuteOfDay {
  return Math.floor(minute / HOUR) * HOUR;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Open-Meteo request failed.';
}

const celsiusToF = (c: number): number => c * 1.8 + 32;
const kmhToMph = (kmh: number): number => kmh * 0.621371;
const round1 = (value: number): number => Math.round(value * 10) / 10;
const round2 = (value: number): number => Math.round(value * 100) / 100;

/** "2026-01-17T09:00" — matches Open-Meteo's `timezone=auto` local timestamps. */
function localIsoFor(date: string, minute: MinuteOfDay): string {
  const hour = Math.floor(minute / HOUR);
  const min = minute % HOUR;
  return `${date}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function hourOf(iso: string): number {
  const match = /T(\d{2}):/.exec(iso);
  return match ? Number(match[1]) : 0;
}

function summarize(hourly: HourlyWeather[], daysSinceStorm: number): string {
  const totalSnow = hourly.reduce((sum, hour) => sum + hour.snowfallIn, 0);
  const peakGust = Math.max(...hourly.map((hour) => hour.windGustMph));
  const windNote = peakGust > 40 ? ' Strong wind through the day.' : '';
  if (totalSnow > 3) return `Active snow expected — around ${totalSnow.toFixed(1)}" through the day.${windNote}`;
  if (totalSnow > 0.3) return `Light snow expected.${windNote}`;
  if (daysSinceStorm <= 2) return `Between systems, mostly firm and fast.${windNote}`;
  return `Dry pattern. Groomers are the play.${windNote}`;
}
