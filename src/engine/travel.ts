import type { TravelCurve, TravelSample } from '@/domain/conditions';
import type { MinuteOfDay, Minutes } from '@/domain/time';

export interface TravelEstimate {
  durationMinutes: Minutes;
  congestion: number;
  /** True when the requested time sat outside the sampled window. */
  extrapolated: boolean;
}

/**
 * Travel curves arrive as discrete samples; the optimisers ask for arbitrary
 * minutes. Linear interpolation between samples is the honest reading — we do
 * not invent structure between two measured points.
 */
export function travelAt(curve: TravelCurve, departure: MinuteOfDay): TravelEstimate {
  const samples = curve.samples;
  if (samples.length === 0) {
    return { durationMinutes: 0, congestion: 0, extrapolated: true };
  }
  const first = samples[0] as TravelSample;
  const last = samples[samples.length - 1] as TravelSample;
  if (departure <= first.departure) {
    return { durationMinutes: first.durationMinutes, congestion: first.congestion, extrapolated: departure < first.departure };
  }
  if (departure >= last.departure) {
    return { durationMinutes: last.durationMinutes, congestion: last.congestion, extrapolated: departure > last.departure };
  }
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1] as TravelSample;
    const b = samples[i] as TravelSample;
    if (departure <= b.departure) {
      const span = b.departure - a.departure;
      const t = span <= 0 ? 1 : (departure - a.departure) / span;
      return {
        durationMinutes: a.durationMinutes + (b.durationMinutes - a.durationMinutes) * t,
        congestion: a.congestion + (b.congestion - a.congestion) * t,
        extrapolated: false,
      };
    }
  }
  return { durationMinutes: last.durationMinutes, congestion: last.congestion, extrapolated: false };
}

export const fastestSample = (curve: TravelCurve): TravelSample | null =>
  curve.samples.reduce<TravelSample | null>(
    (best, sample) => (best === null || sample.durationMinutes < best.durationMinutes ? sample : best),
    null,
  );

export const slowestSample = (curve: TravelCurve): TravelSample | null =>
  curve.samples.reduce<TravelSample | null>(
    (worst, sample) => (worst === null || sample.durationMinutes > worst.durationMinutes ? sample : worst),
    null,
  );

/** Pick the route whose best-case travel is quickest; the optimiser refines timing. */
export function bestCurve(curves: TravelCurve[]): TravelCurve | null {
  let best: TravelCurve | null = null;
  let bestValue = Infinity;
  for (const curve of curves) {
    const fastest = fastestSample(curve);
    if (fastest && fastest.durationMinutes < bestValue) {
      bestValue = fastest.durationMinutes;
      best = curve;
    }
  }
  return best;
}

export const trafficLightFor = (congestion: number): 'green' | 'yellow' | 'red' =>
  congestion < 0.3 ? 'green' : congestion < 0.62 ? 'yellow' : 'red';

export const ROAD_LABEL: Record<string, string> = {
  clear: 'Clear and dry',
  wet: 'Wet',
  'snow-packed': 'Snow-packed in spots',
  'chains-required': 'Traction law: chains or 4WD',
  closed: 'Closed',
};
