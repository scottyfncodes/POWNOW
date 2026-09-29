import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, OPTIMIZER_CONFIG } from '@/config/weights';
import { at } from '@/domain/time';
import { sampleCurve } from '@/lib/curve';
import { testInputs, testOperations, testTravel, testWeather } from '@/test/fixtures';
import { optimizeDay } from './optimize';
import { buildSnowClock } from './snowClock';
import type { DayInputs } from './inputs';

const prefs = DEFAULT_PREFERENCES;

const run = (inputs: DayInputs, preferences = prefs) => {
  const clock = buildSnowClock(inputs);
  return { clock, ...optimizeDay(inputs, clock, { preferences }) };
};

/** Morning traffic that gets steadily worse after 6am — the classic corridor. */
const rushHourOutbound = (base = 90) =>
  testTravel({
    direction: 'outbound',
    duration: (departure) =>
      base *
      (1 +
        sampleCurve(
          [
            { minute: at(4), value: 0 },
            { minute: at(6), value: 0.1 },
            { minute: at(7), value: 0.9 },
            { minute: at(8), value: 1.2 },
            { minute: at(10), value: 0.2 },
          ],
          departure,
        )),
    congestion: (departure) =>
      sampleCurve(
        [
          { minute: at(4), value: 0.02 },
          { minute: at(7), value: 0.85 },
          { minute: at(10), value: 0.1 },
        ],
        departure,
      ),
  });

/** Afternoon wall: fine until 2, brutal 3–5, clear again by 7. */
const afternoonWallReturn = (base = 90) =>
  testTravel({
    direction: 'return',
    duration: (departure) =>
      base *
      (1 +
        sampleCurve(
          [
            { minute: at(10), value: 0.05 },
            { minute: at(14), value: 0.15 },
            { minute: at(15), value: 1.1 },
            { minute: at(16, 30), value: 1.5 },
            { minute: at(18), value: 0.7 },
            { minute: at(19, 30), value: 0.1 },
          ],
          departure,
        )),
    congestion: (departure) =>
      sampleCurve(
        [
          { minute: at(10), value: 0.05 },
          { minute: at(14), value: 0.2 },
          { minute: at(16), value: 0.98 },
          { minute: at(19, 30), value: 0.08 },
        ],
        departure,
      ),
  });

describe('morning departure optimisation', () => {
  it('evaluates a whole grid of departures, not one drive time', () => {
    const { departureOptions } = run(testInputs());
    expect(departureOptions.length).toBeGreaterThan(20);
    const times = departureOptions.map((option) => option.departure);
    expect(new Set(times).size).toBe(times.length);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('derives arrival from the departure-dependent drive, not a constant', () => {
    const { departureOptions } = run(testInputs({ outbound: rushHourOutbound() }));
    const early = departureOptions.find((o) => o.departure <= at(5))!;
    const rush = departureOptions.reduce((worst, o) =>
      o.driveMinutes > worst.driveMinutes ? o : worst,
    );
    expect(rush.driveMinutes).toBeGreaterThan(early.driveMinutes * 1.5);
    expect(early.arrival).toBe(early.departure + early.driveMinutes);
  });

  it('leaves early enough to catch the prime window on a powder day', () => {
    const { clock, departure } = run(
      testInputs({
        weather: testWeather({ overnightSnowIn: 12 }),
        outbound: rushHourOutbound(),
        inbound: afternoonWallReturn(),
      }),
    );
    expect(departure).not.toBeNull();
    expect(clock.prime).not.toBeNull();
    expect(departure!.firstTurn).toBeLessThanOrEqual(clock.prime!.start + 15);
    expect(departure!.primeCaptured).toBeGreaterThan(30);
  });

  it('does not leave absurdly early just to stand in the car park', () => {
    const { clock, departure } = run(testInputs({ outbound: testTravel({ direction: 'outbound', duration: () => 90 }) }));
    const idle = clock.open - (departure!.arrival + OPTIMIZER_CONFIG.baseToLiftMinutes);
    expect(idle).toBeLessThanOrEqual(OPTIMIZER_CONFIG.firstTracksMaxMinutes + 15);
  });

  it('never plans a first turn before the lifts run', () => {
    const inputs = testInputs({ operations: testOperations({ expectedOpen: at(10, 0) }) });
    const { departureOptions } = run(inputs);
    expect(departureOptions.every((option) => option.firstTurn >= at(10, 0))).toBe(true);
  });

  it('shows a real cost to leaving later on a busy corridor', () => {
    const { departureOptions } = run(
      testInputs({ weather: testWeather({ overnightSnowIn: 10 }), outbound: rushHourOutbound() }),
    );
    const best = departureOptions.find((o) => o.recommended)!;
    const late = departureOptions.find((o) => o.departure >= best.departure + 120)!;
    expect(late.score).toBeLessThan(best.score);
    expect(late.primeCaptured).toBeLessThanOrEqual(best.primeCaptured);
  });

  it('respects a hard drive-time ceiling', () => {
    const result = run(
      testInputs({
        outbound: testTravel({ direction: 'outbound', duration: () => 200 }),
        inbound: testTravel({ direction: 'return', duration: () => 200 }),
      }),
      { ...prefs, maxDriveMinutes: 120 },
    );
    expect(result.departure).toBeNull();
    expect(result.unavailableReason).toBeTruthy();
  });

  it('gives the recommended departure the best published score', () => {
    const { departureOptions } = run(
      testInputs({ weather: testWeather({ overnightSnowIn: 9 }), outbound: rushHourOutbound() }),
    );
    const best = departureOptions.find((o) => o.recommended)!;
    for (const option of departureOptions) expect(option.score).toBeLessThanOrEqual(best.score);
  });
});

describe('return optimisation', () => {
  it('aims for the valley before the afternoon wall', () => {
    const { ret } = run(
      testInputs({ weather: testWeather({ overnightSnowIn: 8 }), inbound: afternoonWallReturn() }),
    );
    expect(ret).not.toBeNull();
    expect(ret!.departure).toBeGreaterThan(at(12));
    expect(ret!.departure).toBeLessThan(at(15));
    expect(ret!.trafficLight).not.toBe('red');
  });

  it('quantifies what waiting costs', () => {
    const { returnOptions, ret } = run(
      testInputs({ weather: testWeather({ overnightSnowIn: 8 }), inbound: afternoonWallReturn() }),
    );
    const inTheWall = returnOptions.find((o) => o.departure >= at(16))!;
    expect(inTheWall.extraDriveMinutes).toBeGreaterThan(30);
    expect(inTheWall.homeArrival).toBeGreaterThan(ret!.homeArrival);
    expect(inTheWall.trafficLight).toBe('red');
  });

  it('will wait past last chair when that genuinely beats sitting in traffic', () => {
    // A wall so severe that leaving at last chair is worse than waiting it out.
    const brutal = testTravel({
      direction: 'return',
      duration: (departure) =>
        90 *
        (1 +
          sampleCurve(
            [
              { minute: at(10), value: 0.05 },
              { minute: at(15), value: 3.4 },
              { minute: at(16, 30), value: 3.6 },
              { minute: at(17, 30), value: 0.6 },
              { minute: at(19), value: 0.05 },
            ],
            departure,
          )),
      congestion: (departure) => (departure > at(14, 30) && departure < at(17, 15) ? 0.98 : 0.1),
    });
    const { ret, returnOptions } = run(
      testInputs({ weather: testWeather({ overnightSnowIn: 12 }), inbound: brutal }),
    );
    const atLastChair = returnOptions.find((o) => o.departure >= at(16))!;
    expect(ret!.departure === atLastChair.departure).toBe(false);
    expect(ret!.driveMinutes).toBeLessThan(atLastChair.driveMinutes);
  });

  it('never leaves the mountain before a real ski day has happened', () => {
    const { clock, returnOptions, departure } = run(testInputs());
    for (const option of returnOptions) {
      expect(option.departure - departure!.firstTurn).toBeGreaterThanOrEqual(
        OPTIMIZER_CONFIG.minSkiMinutes,
      );
      expect(option.departure).toBeLessThanOrEqual(
        clock.close + OPTIMIZER_CONFIG.maxWaitAfterLastChair,
      );
    }
  });

  it('measures mountain time up to last chair only', () => {
    const { clock, returnOptions, departure } = run(testInputs());
    const late = returnOptions[returnOptions.length - 1]!;
    expect(late.mountainMinutes).toBe(Math.min(late.departure, clock.close) - departure!.firstTurn);
  });
});

describe('rider preferences', () => {
  it('a rider who values sleep leaves later than one who does not', () => {
    const inputs = testInputs({ outbound: rushHourOutbound(), weather: testWeather({ overnightSnowIn: 6 }) });
    const sendIt = run(inputs, { ...prefs, sleepVsSend: 1 }).departure!;
    const sleepIn = run(inputs, { ...prefs, sleepVsSend: 0 }).departure!;
    expect(sleepIn.departure).toBeGreaterThanOrEqual(sendIt.departure);
  });

  it('honours the earliest acceptable departure', () => {
    const { departureOptions } = run(testInputs(), { ...prefs, earliestDeparture: at(6, 30) });
    expect(Math.min(...departureOptions.map((o) => o.departure))).toBeGreaterThanOrEqual(at(6, 30));
  });
});

describe('missing travel data', () => {
  it('refuses to invent a drive when the road feed is down', () => {
    const result = run(testInputs({ outbound: 'unavailable' }));
    expect(result.departure).toBeNull();
    expect(result.ret).toBeNull();
    expect(result.departureOptions).toEqual([]);
    expect(result.unavailableReason).toMatch(/route/i);
  });

  it('refuses when only the return leg is missing', () => {
    const result = run(testInputs({ inbound: 'unavailable' }));
    expect(result.departure).toBeNull();
  });
});

describe('why a day has no departure — the rider hears the real reason', () => {
  it('names a route-service outage as one', () => {
    expect(run(testInputs({ outbound: 'unavailable' })).timingIssue).toBe('no-route');
    expect(run(testInputs({ inbound: 'unavailable' })).timingIssue).toBe('no-route');
  });

  it('at 10pm, a working route is "too late for today", with the drive right now — not "route service unavailable"', () => {
    // What the proxy sends late in the evening: past departures dropped, one "now" sample left.
    const tonight = testTravel({ direction: 'outbound', duration: () => 95, from: at(22, 12), to: at(22, 12) });
    const result = run(testInputs({ outbound: tonight }));
    expect(result.departure).toBeNull();
    expect(result.timingIssue).toBe('too-late');
    expect(result.unavailableReason).toMatch(/too late to ski .* today/i);
    expect(result.unavailableReason).toMatch(/1h35 drive/);
    expect(result.unavailableReason).not.toMatch(/unavailable/i);
  });

  it('says when every departure is longer than the drive the rider said they would make', () => {
    const long = testTravel({ direction: 'outbound', duration: () => 250 });
    const result = run(testInputs({ outbound: long }), { ...prefs, maxDriveMinutes: 180 });
    expect(result.timingIssue).toBe('too-far');
    expect(result.unavailableReason).toMatch(/4h10 drive — longer than the 3h you said you'd make/);
  });

  it('a timed day has no issue at all', () => {
    const result = run(testInputs());
    expect(result.departure).not.toBeNull();
    expect(result.timingIssue).toBeNull();
  });
});
