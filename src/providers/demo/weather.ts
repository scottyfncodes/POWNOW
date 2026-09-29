import type { DailySnowfall, ElevationConditions, HourlyWeather, MountainWeather, SnowHistory } from '@/domain/conditions';
import { addDays } from '@/domain/dates';
import type { Mountain } from '@/domain/mountain';
import {
  type Availability,
  confidenceForHorizon,
  ok,
  observationForHorizon,
  unavailable,
} from '@/domain/provenance';
import { at, clamp, clamp01, HOUR, type MinuteOfDay } from '@/domain/time';
import { bell } from '@/lib/curve';
import type { ProviderContext, WeatherProvider } from '@/providers/types';
import { exposedWind, mountainRng, orographicFactor, patternFor, profileFor } from './scenario';

const FIRST_HOUR = at(4);
const LAST_HOUR = at(20);

export interface DemoWeatherOptions {
  /** Force this provider to report unavailable, to exercise the error state. */
  failFor?: (mountain: Mountain) => boolean;
}

/**
 * Forecasts get blurrier with lead time. Rather than pretend to precision we
 * do not have, long-horizon demo forecasts are pulled toward a climatological
 * mean — the same thing a real projected view should do.
 */
function climatologyBlend(horizonDays: number): number {
  if (horizonDays <= 2) return 0;
  return clamp((horizonDays - 2) / 12, 0, 0.7);
}

export class DemoWeatherProvider implements WeatherProvider {
  readonly id = 'demo-weather';

  constructor(private readonly options: DemoWeatherOptions = {}) {}

  async getMountainWeather(
    mountain: Mountain,
    context: ProviderContext,
  ): Promise<Availability<MountainWeather>> {
    if (this.options.failFor?.(mountain)) {
      return unavailable(this.id, 'No forecast returned for this location.');
    }

    const pattern = patternFor(mountain, context.date, context.horizonDays);
    const profile = profileFor(mountain.id);
    const oro = orographicFactor(mountain, pattern);
    const rng = mountainRng(mountain, context.date, 'weather');
    const blend = climatologyBlend(context.horizonDays);

    const snowMultiplier = profile.snow * oro;
    const overnightIn = mix(pattern.overnightIn * snowMultiplier, 2.4 * snowMultiplier, blend);
    const daytimeRate = mix(pattern.daytimeRateInPerHour * snowMultiplier, 0.18 * snowMultiplier, blend);
    const windMph = exposedWind(pattern.windBaseMph, profile.wind) * mix(1, 0.95, blend);

    const hourly: HourlyWeather[] = [];
    for (let minute = FIRST_HOUR; minute <= LAST_HOUR; minute += HOUR) {
      hourly.push(
        hourFor(minute, {
          daytimeRate,
          taper: pattern.stormTaperMinute,
          baseTempF: mix(pattern.baseTempF, 20, blend) + (10400 - mountain.weatherLocation.forecastElevationFt) / 320,
          diurnalRangeF: pattern.diurnalRangeF,
          windBaseMph: windMph,
          sunBase: pattern.sunBase,
          density: pattern.density,
          jitter: rng.range(-0.12, 0.12),
        }),
      );
    }

    const provenance = {
      source: 'demo' as const,
      observation: observationForHorizon(context.horizonDays),
      confidence: confidenceForHorizon(context.horizonDays),
      provider: this.id,
      horizonDays: context.horizonDays,
    };

    const fetchedAt = new Date(0).toISOString();
    const baseWindMph = Math.round(windMph);
    const peakWindMph = Math.round(exposedWind(pattern.windBaseMph, profile.wind) * 1.35);
    const base: ElevationConditions = {
      temperatureF: Math.round(mix(pattern.baseTempF, 20, blend)),
      windMph: baseWindMph,
      windGustMph: Math.round(baseWindMph * 1.5),
      timestamp: fetchedAt,
      source: this.id,
    };
    const peak: ElevationConditions = {
      temperatureF: Math.round(mix(pattern.baseTempF, 20, blend) - 9),
      windMph: peakWindMph,
      windGustMph: Math.round(peakWindMph * 1.5),
      timestamp: fetchedAt,
      source: this.id,
    };

    return ok(
      {
        overnightSnowIn: round1(overnightIn),
        recentSnow72hIn: round1(mix(pattern.recentSnow72hIn * snowMultiplier, 9 * snowMultiplier, blend)),
        daysSinceStorm: pattern.daysSinceStorm,
        hourly,
        summary: pattern.summary,
        base,
        peak,
        snowHistory: buildSnowHistory(context, pattern.daysSinceStorm, snowMultiplier, rng),
        // The demo "model" depth: a plausible mid-season pack scaled by the
        // mountain's snow character. Labeled demo like everything else here.
        modelSnowDepthIn: Math.round(42 * profile.snow * oro),
      },
      provenance,
    );
  }
}

/** Synthetic 5-day-back / 5-day-forward snowfall, matching the same storm pattern used for the hourly model. */
function buildSnowHistory(
  context: ProviderContext,
  daysSinceStorm: number,
  snowMultiplier: number,
  rng: ReturnType<typeof mountainRng>,
): SnowHistory {
  const past: DailySnowfall[] = [];
  let pastTotalIn = 0;
  for (let i = 5; i >= 1; i -= 1) {
    const date = addDays(context.today, -i);
    const isStormDay = i === Math.max(1, Math.round(daysSinceStorm));
    const snowfallIn = isStormDay ? round1(6 * snowMultiplier * rng.range(0.7, 1.3)) : round1(rng.range(0, 0.6));
    pastTotalIn += snowfallIn;
    past.push({ date, snowfallIn, kind: 'observed' });
  }

  const future: DailySnowfall[] = [];
  let futureTotalIn = 0;
  for (let i = 1; i <= 5; i += 1) {
    const date = addDays(context.today, i);
    const snowfallIn = round1(Math.max(0, rng.range(-0.3, 2.2) * snowMultiplier));
    futureTotalIn += snowfallIn;
    future.push({ date, snowfallIn, kind: 'forecast' });
  }

  return { past, pastTotalIn: round1(pastTotalIn), future, futureTotalIn: round1(futureTotalIn) };
}

interface HourInputs {
  daytimeRate: number;
  taper: MinuteOfDay;
  baseTempF: number;
  diurnalRangeF: number;
  windBaseMph: number;
  sunBase: number;
  density: number;
  jitter: number;
}

function hourFor(minute: MinuteOfDay, input: HourInputs): HourlyWeather {
  // Snowfall tails off toward the taper time rather than stopping abruptly.
  const stormShare = minute >= input.taper ? 0 : clamp01((input.taper - minute) / 240);
  const snowfallIn = Math.max(0, input.daytimeRate * stormShare * (1 + input.jitter));

  // Coldest around dawn, warmest mid-afternoon.
  const warmth = bell(minute, at(14, 30), 260);
  const temperatureF = input.baseTempF + input.diurnalRangeF * warmth;

  // Wind builds through the day as the pressure gradient tightens.
  const windRamp = 0.75 + 0.5 * clamp01((minute - at(7)) / (at(16) - at(7)));
  const windMph = Math.max(0, input.windBaseMph * windRamp * (1 + input.jitter * 0.5));

  const snowing = snowfallIn > 0.05;
  const sunFactor = clamp01(input.sunBase * (snowing ? 0.25 : 1) * (0.35 + 0.9 * warmth));
  const visibility = clamp01(snowing ? 0.9 - snowfallIn * 0.45 : 0.94 + input.jitter * 0.1);

  return {
    minute,
    snowfallIn: round2(snowfallIn),
    temperatureF: Math.round(temperatureF),
    windMph: Math.round(windMph),
    windGustMph: Math.round(windMph * 1.55),
    sunFactor: round2(sunFactor),
    visibility: round2(clamp(visibility, 0.1, 1)),
    density: round2(input.density),
  };
}

const mix = (near: number, far: number, blend: number): number => near * (1 - blend) + far * blend;
const round1 = (value: number): number => Math.round(value * 10) / 10;
const round2 = (value: number): number => Math.round(value * 100) / 100;
