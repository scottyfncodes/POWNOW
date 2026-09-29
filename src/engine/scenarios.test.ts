import { describe, expect, it } from 'vitest';
import { findMountain } from '@/data/mountains';
import { displayStatus, type Availability } from '@/domain/provenance';
import { at } from '@/domain/time';
import { sampleCurve } from '@/lib/curve';
import {
  testCrowds,
  testInputs,
  testMountain,
  testOperations,
  testTicket,
  testTravel,
  testWeather,
} from '@/test/fixtures';
import { buildPlan } from './plan';

/**
 * REAL-DATA GATE — scenario sanity suite.
 *
 * These are not unit tests for a function; they are the question the whole
 * product exists to answer, asked ten different realistic ways: "would a
 * knowledgeable Colorado skier agree this call makes sense?" Each scenario
 * states the real-world situation in a comment, then checks that the plan's
 * numbers *and its own explanation of itself* land where a local would expect
 * them to. Where a scenario's premise doesn't map onto real mountain
 * geography (Wolf Creek and Copper are not actually a two-mountain choice
 * anyone faces), it is adapted to the nearest situation that is faithful to
 * the underlying mountains' real character rather than forced into a
 * comparison nobody would make.
 */

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

const afternoonWallReturn = (base = 90) =>
  testTravel({
    direction: 'return',
    duration: (departure) =>
      base *
      (1 +
        sampleCurve(
          [
            { minute: at(10), value: 0.05 },
            { minute: at(14), value: 0.2 },
            { minute: at(15, 15), value: 2.6 },
            { minute: at(16, 30), value: 3.0 },
            { minute: at(17, 45), value: 0.4 },
            { minute: at(20), value: 0.05 },
          ],
          departure,
        )),
    congestion: (departure) =>
      sampleCurve(
        [
          { minute: at(10), value: 0.05 },
          { minute: at(14), value: 0.3 },
          { minute: at(16), value: 0.99 },
          { minute: at(17, 45), value: 0.15 },
          { minute: at(20), value: 0.05 },
        ],
        departure,
      ),
  });

describe('scenario 1 — huge overnight storm at a deep, out-of-the-way mountain', () => {
  it('calls it a great day and says why in terms of the actual snow', () => {
    const wolfCreek = findMountain('wolf-creek')!;
    const plan = buildPlan(
      testInputs({
        mountain: wolfCreek,
        weather: testWeather({ overnightSnowIn: 28, temperatureF: 12, windMph: 10, daysSinceStorm: 0 }),
        operations: testOperations({ terrainOpenShare: 0.95, liftsExpectedOpen: 9, liftsTotal: 9 }),
        crowds: testCrowds(0.2),
        ticket: testTicket(94, 99),
      }),
    );

    expect(plan.score.score).toBeGreaterThan(7);
    expect(['LET\'S RIDE.', 'SEND IT.', 'WORTH IT.']).toContain(plan.verdict);
    expect(plan.snowClock.prime).not.toBeNull();
    expect(plan.reasons.join(' ')).toMatch(/28\.0"|stacking/i);
    const snow = plan.score.factors.find((f) => f.key === 'snow')!;
    expect(snow.value).toBeGreaterThan(70);
    expect(snow.imputed).toBe(false);
  });
});

describe('scenario 2 — light snow at a mountain that leans on its groomers', () => {
  it('is a real day, not a great one, and the score reflects the modest total honestly', () => {
    const copper = findMountain('copper')!;
    const plan = buildPlan(
      testInputs({
        mountain: copper,
        weather: testWeather({ overnightSnowIn: 2, temperatureF: 18, windMph: 12 }),
        operations: testOperations({ groomedShare: 0.85, terrainOpenShare: 0.9 }),
      }),
    );

    expect(plan.departure).not.toBeNull();
    const snow = plan.score.factors.find((f) => f.key === 'snow')!;
    // Real, but modest — nowhere near the storm-day scenario above.
    expect(snow.value).toBeGreaterThan(20);
    expect(snow.value).toBeLessThan(65);
    expect(plan.reasons.join(' ')).not.toMatch(/no new snow/i);
  });
});

describe('scenario 3 — a wind event where the sheltered mountain wins', () => {
  it('scores the exposed alpine mountain below its sheltered neighbour on the same wind day', () => {
    const exposed = testMountain({
      id: 'exposed-peak',
      terrain: { trails: 150, acres: 3000, aboveTreelineShare: 0.55, lateOpeningShare: 0.2 },
      lifts: { total: 20, highSpeed: 8, windExposed: 14 },
    });
    const sheltered = testMountain({
      id: 'sheltered-valley',
      terrain: { trails: 150, acres: 3000, aboveTreelineShare: 0.05, lateOpeningShare: 0.2 },
      lifts: { total: 20, highSpeed: 8, windExposed: 2 },
    });

    // Strong, not off-the-charts: gusts around 42mph. Extreme enough gusts
    // saturate the wind-quality curve to zero for everyone, which would hide
    // exactly the exposure difference this scenario is testing.
    const highWindWeather = testWeather({ overnightSnowIn: 4, windMph: 28, temperatureF: 15 });

    const exposedPlan = buildPlan(
      testInputs({
        mountain: exposed,
        weather: highWindWeather,
        operations: testOperations({ windHoldRisk: 0.75, liftsExpectedOpen: 11, liftsTotal: 20 }),
      }),
    );
    const shelteredPlan = buildPlan(
      testInputs({
        mountain: sheltered,
        weather: highWindWeather,
        operations: testOperations({ windHoldRisk: 0.1, liftsExpectedOpen: 19, liftsTotal: 20 }),
      }),
    );

    expect(shelteredPlan.score.score).toBeGreaterThan(exposedPlan.score.score);
    const exposedWind = exposedPlan.score.factors.find((f) => f.key === 'wind')!;
    const shelteredWind = shelteredPlan.score.factors.find((f) => f.key === 'wind')!;
    expect(shelteredWind.value).toBeGreaterThan(exposedWind.value);
    // The explanation has to carry the reason, not just the number.
    expect([...exposedPlan.reasons, ...exposedPlan.score.weaknesses.map((f) => f.note)].join(' ')).toMatch(
      /wind|gust/i,
    );
  });
});

describe('scenario 4 — heavy I-70 traffic on an otherwise fine snow day', () => {
  it('keeps the mountain call sound but marks the drive down honestly', () => {
    const clean = buildPlan(
      testInputs({
        weather: testWeather({ overnightSnowIn: 6 }),
        outbound: testTravel({ direction: 'outbound', duration: () => 90, congestion: () => 0.05 }),
        inbound: testTravel({ direction: 'return', duration: () => 90, congestion: () => 0.05 }),
      }),
    );
    const jammed = buildPlan(
      testInputs({
        weather: testWeather({ overnightSnowIn: 6 }),
        outbound: rushHourOutbound(),
        inbound: afternoonWallReturn(),
      }),
    );

    expect(jammed.score.score).toBeLessThan(clean.score.score);
    expect(jammed.departure).not.toBeNull(); // still gives a plan, just a worse one
    const trafficFactor = jammed.score.factors.find((f) => f.key === 'traffic')!;
    expect(trafficFactor.value).toBeLessThan(70);
  });
});

describe('scenario 5 — I-70 closed, no way around it from this origin', () => {
  it('refuses to time the day and says which road, not just "something is wrong"', () => {
    const plan = buildPlan(
      testInputs({
        outbound: 'unavailable',
        inbound: 'unavailable',
        closedCorridors: ['I-70 west / Eisenhower Tunnel'],
      }),
    );

    expect(plan.departure).toBeNull();
    expect(plan.return).toBeNull();
    expect(plan.caveats.some((c) => c.includes('I-70 west / Eisenhower Tunnel'))).toBe(true);
    expect(plan.caveats.some((c) => /not going to fake the drive/i.test(c))).toBe(true);
  });
});

describe('scenario 6 — great morning snow, ugly afternoon traffic', () => {
  it('captures the morning window and recommends leaving before the wall builds', () => {
    const plan = buildPlan(
      testInputs({
        weather: testWeather({ overnightSnowIn: 10, temperatureF: 14 }),
        outbound: rushHourOutbound(),
        inbound: afternoonWallReturn(),
      }),
    );

    expect(plan.snowClock.prime).not.toBeNull();
    expect(plan.snowClock.prime!.peakMinute).toBeLessThan(at(13));
    expect(plan.return).not.toBeNull();
    // The recommended departure should sit ahead of where the wall peaks (~4:30pm).
    expect(plan.return!.departure).toBeLessThan(at(15, 30));
    expect(plan.return!.trafficLight).not.toBe('red');
  });
});

describe('scenario 7 — poor new snow, but the groomers make it a real day', () => {
  it('heads the day as a groomer day, not a bust, because that is what it is', () => {
    const plan = buildPlan(
      testInputs({
        weather: testWeather({ overnightSnowIn: 0, temperatureF: 22, windMph: 8, daysSinceStorm: 3 }),
        operations: testOperations({ groomedShare: 0.97, terrainOpenShare: 0.95 }),
        crowds: testCrowds(0.15),
      }),
    );

    expect(plan.headline).toBe('GROOMERS ARE THE PLAY.');
    expect(plan.score.score).toBeGreaterThan(5);
    const surfaceNote = plan.reasons.join(' ');
    expect(surfaceNote).not.toMatch(/28"|overnight/i);
  });
});

describe('scenario 8 — missing traffic data', () => {
  it('never fabricates a drive time; the timing goes away, the mountain call does not', () => {
    const plan = buildPlan(testInputs({ outbound: 'unavailable', inbound: 'unavailable' }));

    expect(plan.departure).toBeNull();
    expect(plan.return).toBeNull();
    expect(plan.caveats.some((c) => /not going to fake the drive/i.test(c))).toBe(true);
    const travelFactor = plan.score.factors.find((f) => f.key === 'travel')!;
    expect(travelFactor.imputed).toBe(true);
    // The score is still a real, renderable number — not NaN, not a crash.
    expect(Number.isFinite(plan.score.score)).toBe(true);
  });
});

describe('scenario 9 — missing weather data', () => {
  it('keeps the timing (traffic and ops do not need a forecast) and flags the snow honestly', () => {
    const plan = buildPlan(testInputs({ weather: 'unavailable' }));

    expect(plan.departure).not.toBeNull();
    expect(plan.return).not.toBeNull();
    expect(plan.caveats.some((c) => /can't confidently call the snow/i.test(c))).toBe(true);
    const snow = plan.score.factors.find((f) => f.key === 'snow')!;
    expect(snow.imputed).toBe(true);
    expect(plan.score.confidence).not.toBe('high');
  });
});

describe('scenario 10 — stale provider data', () => {
  it("a live value past its own freshness window reads as STALE, and the plan's data-sources panel says so", () => {
    const staleWeather: Availability<ReturnType<typeof testWeather>> = {
      status: 'ok',
      data: testWeather({ overnightSnowIn: 5 }),
      provenance: {
        source: 'live',
        observation: 'observed',
        confidence: 'high',
        provider: 'fixture-stale-weather',
        horizonDays: 0,
        fetchedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3h ago
        validUntil: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // expired 2h ago
      },
    };

    // The mechanism, exercised directly.
    expect(displayStatus(staleWeather)).toBe('stale');

    // And end to end: a full plan built on that stale weather feed reports it
    // in the data-sources panel — never upgraded back to LIVE, never quietly
    // demoted to looking like DEMO.
    const baseInputs = testInputs();
    const plan = buildPlan({ ...baseInputs, weather: staleWeather });
    const source = plan.dataSources.find((s) => s.label === 'Weather')!;
    expect(source.status).toBe('stale');
    expect(source.provider).toBe('fixture-stale-weather');
  });
});

describe('scenario 11 — great snow, a significant lift closure', () => {
  it('marks operations down for real, without touching the snow it correctly reads as good', () => {
    const halfClosed = buildPlan(
      testInputs({
        weather: testWeather({ overnightSnowIn: 10, temperatureF: 15, windMph: 10 }),
        operations: testOperations({
          liftsExpectedOpen: 6,
          liftsTotal: 20,
          terrainOpenShare: 0.3,
          status: 'delayed',
          notes: ['Upper mountain closed pending avalanche control.'],
        }),
      }),
    );
    const fullyOpen = buildPlan(
      testInputs({
        weather: testWeather({ overnightSnowIn: 10, temperatureF: 15, windMph: 10 }),
        operations: testOperations({ liftsExpectedOpen: 19, liftsTotal: 20, terrainOpenShare: 0.95 }),
      }),
    );

    const snow = halfClosed.score.factors.find((f) => f.key === 'snow')!;
    expect(snow.imputed).toBe(false);
    expect(snow.value).toBeGreaterThan(60); // The storm itself is still real and good.

    const ops = halfClosed.score.factors.find((f) => f.key === 'operations')!;
    expect(ops.imputed).toBe(false); // This is real data, not missing data.
    expect(ops.value).toBeLessThan(50);
    expect(halfClosed.score.score).toBeLessThan(fullyOpen.score.score);
  });
});

describe('scenario 12 — great snow, operations unavailable', () => {
  it('imputes a neutral operations read rather than assuming everything is open', () => {
    const plan = buildPlan(
      testInputs({
        weather: testWeather({ overnightSnowIn: 10, temperatureF: 15, windMph: 10 }),
        operations: 'unavailable',
      }),
    );

    const ops = plan.score.factors.find((f) => f.key === 'operations')!;
    const terrain = plan.score.factors.find((f) => f.key === 'terrain')!;
    expect(ops.imputed).toBe(true);
    expect(terrain.imputed).toBe(true);
    // Neutral, not perfect: a made-up "everything is open" would score near
    // the fully-open scenario above; a made-up "everything is closed" would
    // score near zero. Neither is the honest answer to "we don't know."
    expect(ops.value).toBeGreaterThan(30);
    expect(ops.value).toBeLessThan(75);
    expect(plan.score.confidence).not.toBe('high');
    // The snow itself is still known and real — one missing feed doesn't
    // drag down data the engine actually has.
    const snow = plan.score.factors.find((f) => f.key === 'snow')!;
    expect(snow.imputed).toBe(false);
  });
});

describe('scenario 13 — a cheap ticket does not paper over a mediocre day', () => {
  it('lets a low price nudge the score, never dominate what actually drives the day', () => {
    const mediocreWeather = testWeather({ overnightSnowIn: 0, daysSinceStorm: 6, temperatureF: 36, windMph: 22 });
    const expensive = buildPlan(
      testInputs({ weather: mediocreWeather, ticket: testTicket(279, 289) }),
    );
    const cheap = buildPlan(testInputs({ weather: mediocreWeather, ticket: testTicket(45, 49) }));

    // A real, visible nudge from a ~$234 swing in price...
    expect(cheap.score.score).toBeGreaterThan(expensive.score.score);
    // ...but small next to the scale a real ski day moves on (0-10): the
    // full spread of the ticket market is calibrated (config/weights.ts) to
    // never be able to swing the published score by more than ~0.35.
    expect(cheap.score.score - expensive.score.score).toBeLessThan(0.5);
    // Ticket stays a minor contributor next to what actually drives the day.
    const ticketFactor = cheap.score.factors.find((f) => f.key === 'ticket')!;
    const snowFactor = cheap.score.factors.find((f) => f.key === 'snow')!;
    expect(ticketFactor.weight).toBeLessThan(snowFactor.weight);
  });
});

describe('scenario 14 — total provider outage', () => {
  it('still produces a real, finite, honestly-caveated plan when every feed but the mountain itself is down', () => {
    const plan = buildPlan(
      testInputs({
        weather: 'unavailable',
        operations: 'unavailable',
        crowds: 'unavailable',
        ticket: 'unavailable',
        alerts: 'unavailable',
        parking: 'unavailable',
        outbound: 'unavailable',
        inbound: 'unavailable',
      }),
    );

    expect(Number.isFinite(plan.score.score)).toBe(true);
    expect(plan.score.confidence).toBe('low');
    expect(plan.departure).toBeNull();
    expect(plan.return).toBeNull();
    expect(plan.ticket).toBeNull();
    expect(plan.caveats.length).toBeGreaterThan(0);
    // Every disclosed feed says so honestly — none silently reads as live or demo.
    for (const source of plan.dataSources) {
      expect(source.status).toBe('unavailable');
    }
    // Still names a mountain and a headline — a bad day for data is not a crash.
    expect(plan.mountain).toBeTruthy();
    expect(plan.headline.length).toBeGreaterThan(0);
  });
});
