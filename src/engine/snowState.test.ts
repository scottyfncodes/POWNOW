import { describe, expect, it } from 'vitest';
import { testCrowds, testInputs, testOperations, testWeather } from '@/test/fixtures';
import { buildSnowClock } from './snowClock';
import { classifySnowState } from './snowState';

/**
 * The bug this guards against: POW NOW must never say "prime snow" (or any
 * variant of "strong conditions") when the underlying evidence doesn't
 * support it. `snowClock.prime` alone is not that evidence — it always names
 * the day's best *relative* window, even on a day with nothing on the
 * ground. `classifySnowState` is the one function allowed to make an
 * absolute claim.
 */
describe('classifySnowState', () => {
  it('is unavailable when the weather feed is down, regardless of anything else', () => {
    const inputs = testInputs({ weather: 'unavailable' });
    const clock = buildSnowClock(inputs);
    expect(classifySnowState(inputs, clock)).toBe('unavailable');
  });

  it('calls it prime only when the day genuinely clears the quality bar', () => {
    const inputs = testInputs({
      weather: testWeather({ overnightSnowIn: 14, temperatureF: 15, windMph: 6 }),
      operations: testOperations({ terrainOpenShare: 0.95, windHoldRisk: 0.02 }),
      crowds: testCrowds(0.15),
    });
    const clock = buildSnowClock(inputs);
    expect(clock.prime).not.toBeNull();
    expect(classifySnowState(inputs, clock)).toBe('prime');
  });

  it('never calls a bone-dry, windy, crowded day prime — even though the clock still names a best window', () => {
    const inputs = testInputs({
      weather: testWeather({ overnightSnowIn: 0, temperatureF: 42, windMph: 30 }),
      crowds: testCrowds(0.85),
    });
    const clock = buildSnowClock(inputs);
    // The relative window still exists (used for "when to leave" timing) …
    expect(clock.prime).not.toBeNull();
    // … but the honest snow-state read must not claim it's prime.
    expect(classifySnowState(inputs, clock)).not.toBe('prime');
  });

  it('reads as building when snow is forecast but nothing meaningful is on the ground yet', () => {
    const weather = {
      ...testWeather({ overnightSnowIn: 0, temperatureF: 30, future5TotalIn: 9 }),
      recentSnow72hIn: 0,
    };
    const inputs = testInputs({ weather });
    const clock = buildSnowClock(inputs);
    expect(classifySnowState(inputs, clock)).toBe('building');
  });

  it('treats a meaningful amount actively falling today as current, not merely forecast', () => {
    const weather = {
      ...testWeather({ overnightSnowIn: 0, daytimeRateInPerHour: 0.8, snowUntil: 16 * 60 }),
      recentSnow72hIn: 0,
    };
    const inputs = testInputs({ weather });
    const clock = buildSnowClock(inputs);
    // A genuine storm dumping inches today is "current" snow (same bucket the
    // rest of the engine treats today's snowfall as) — never merely "building".
    expect(classifySnowState(inputs, clock)).not.toBe('building');
    expect(classifySnowState(inputs, clock)).not.toBe('none');
  });

  it('reads as limited when some snow is present but conditions fall short of prime', () => {
    const inputs = testInputs({
      weather: testWeather({ overnightSnowIn: 1, temperatureF: 38, windMph: 25 }),
      crowds: testCrowds(0.75),
    });
    const clock = buildSnowClock(inputs);
    expect(classifySnowState(inputs, clock)).toBe('limited');
  });

  it('reads as no significant snow when there is nothing current, recent, or incoming', () => {
    const weather = {
      ...testWeather({ overnightSnowIn: 0, temperatureF: 40, daysSinceStorm: 10 }),
      recentSnow72hIn: 0,
      snowHistory: {
        past: [],
        pastTotalIn: 0,
        future: [],
        futureTotalIn: 0,
      },
    };
    const inputs = testInputs({ weather });
    const clock = buildSnowClock(inputs);
    expect(classifySnowState(inputs, clock)).toBe('none');
  });
});
