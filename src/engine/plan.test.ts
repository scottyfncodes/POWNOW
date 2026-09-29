import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES } from '@/config/weights';
import { MOUNTAINS } from '@/data/mountains';
import { findOrigin, gpsOrigin } from '@/data/origins';
import { at } from '@/domain/time';
import { createDemoRegistry } from '@/providers/demo';
import { testInputs, testMountain, testOperations, testTravel, testWeather } from '@/test/fixtures';
import { sampleCurve } from '@/lib/curve';
import { buildPlan, recommend, stayOrGo, stayOrGoLadder } from './plan';

const TODAY = '2026-01-17';
const origin = findOrigin('denver');

const afternoonWall = testTravel({
  direction: 'return',
  duration: (departure) =>
    95 *
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

describe('buildPlan', () => {
  it('produces a complete, timed, explained day', () => {
    const plan = buildPlan(testInputs({ weather: testWeather({ overnightSnowIn: 9 }) }));
    expect(plan.departure).not.toBeNull();
    expect(plan.return).not.toBeNull();
    expect(plan.snowClock.points.length).toBeGreaterThan(10);
    expect(plan.reasons.length).toBeGreaterThan(1);
    expect(plan.verdict).toMatch(/[A-Z]/);
    expect(plan.timeline.length).toBeGreaterThan(3);
  });

  it('orders the timeline and marks the key moments', () => {
    const plan = buildPlan(testInputs({ weather: testWeather({ overnightSnowIn: 9 }) }));
    const minutes = plan.timeline.map((event) => event.minute);
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
    expect(plan.timeline.some((event) => event.label === 'BEST TIME TO HEAD HOME')).toBe(true);
    expect(plan.timeline.some((event) => event.label === 'Home')).toBe(true);
  });

  it('says what is missing instead of guessing', () => {
    const plan = buildPlan(testInputs({ outbound: 'unavailable' }));
    expect(plan.departure).toBeNull();
    expect(plan.caveats.join(' ')).toMatch(/road intel is offline/i);
  });

  it('flags an unreliable lift report as a caveat', () => {
    const plan = buildPlan(testInputs({ operations: 'unavailable' }));
    expect(plan.caveats.join(' ')).toMatch(/lift report/i);
  });

  it('carries parking through to the plan, and lists it in the data-sources disclosure', () => {
    const plan = buildPlan(testInputs());
    expect(plan.parking.status).toBe('ok');
    expect(plan.dataSources.some((source) => source.label === 'Parking')).toBe(true);
  });

  it('reports parking honestly unavailable rather than a fabricated status when the feed is down', () => {
    const plan = buildPlan(testInputs({ parking: 'unavailable' }));
    expect(plan.parking.status).toBe('unavailable');
  });

  it('carries a real route distance/label through to the plan, from the live curve when traffic succeeded', () => {
    const plan = buildPlan(testInputs());
    expect(plan.routeDistanceMiles).toBe(80);
    expect(plan.routeLabel).toBe('Test Highway');
  });

  it('falls back to the pre-authored route distance, never a guess, when traffic is unavailable', () => {
    const plan = buildPlan(testInputs({ outbound: 'unavailable' }));
    expect(plan.routeDistanceMiles).toBe(testMountain().accessRoutes[0]!.distanceMiles);
  });
});

describe('recommend', () => {
  it('ranks every reachable mountain and names a winner', async () => {
    const result = await recommend(createDemoRegistry(), {
      mountains: MOUNTAINS,
      origin,
      date: TODAY,
      today: TODAY,
      now: at(4, 47),
    });
    expect(result.all.length).toBeGreaterThan(3);
    const scores = result.all.map((plan) => plan.score.raw);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(result.best).toBe(result.all[0]);
    expect(result.alternatives.length).toBe(result.all.length - 1);
  });

  it('explains why the winner won and what each alternative trades away', async () => {
    const result = await recommend(createDemoRegistry(), {
      mountains: MOUNTAINS,
      origin,
      date: TODAY,
      today: TODAY,
      now: at(4, 47),
    });
    expect(result.comparison.length).toBeGreaterThan(20);
    expect(result.comparison).toContain(result.best.mountain.shortName);
    for (const alternative of result.alternatives) {
      expect(alternative.tradeoffs.length).toBeGreaterThan(0);
    }
  });

  it('flags demo data on the recommendation itself', async () => {
    const result = await recommend(createDemoRegistry(), {
      mountains: MOUNTAINS,
      origin,
      date: TODAY,
      today: TODAY,
      now: at(4, 47),
    });
    expect(result.usingDemoData).toBe(true);
    expect(result.best.provenance.source).toBe('demo');
  });

  it('skips mountains with no route from the chosen starting point', async () => {
    const unreachable = { ...MOUNTAINS[0]!, id: 'nowhere', accessRoutes: [] };
    const result = await recommend(createDemoRegistry(), {
      mountains: [...MOUNTAINS, unreachable],
      origin,
      date: TODAY,
      today: TODAY,
      now: at(4, 47),
    });
    expect(result.all.some((plan) => plan.mountain.id === 'nowhere')).toBe(false);
  });

  it('is deterministic for the same day and starting point', async () => {
    const options = {
      mountains: MOUNTAINS,
      origin,
      date: TODAY,
      today: TODAY,
      now: at(4, 47),
    };
    const [a, b] = await Promise.all([
      recommend(createDemoRegistry(), options),
      recommend(createDemoRegistry(), options),
    ]);
    expect(a.best.mountain.id).toBe(b.best.mountain.id);
    expect(a.best.score.score).toBe(b.best.score.score);
    expect(a.best.departure?.departure).toBe(b.best.departure?.departure);
  });

  it('throws only when nothing at all is reachable', async () => {
    await expect(
      recommend(createDemoRegistry(), {
        mountains: [],
        origin,
        date: TODAY,
        today: TODAY,
        now: at(4, 47),
      }),
    ).rejects.toThrow(/reachable/i);
  });
});

describe('recommend — GPS origin', () => {
  // A real point in Lakewood, CO: close to Denver but not the same coordinate,
  // and not the center of any of the six manual cities.
  const gps = gpsOrigin(39.7047, -105.0814);

  it('routes every mountain from the one GPS fix, not just the ones reachable from a manual city', async () => {
    const result = await recommend(createDemoRegistry(), {
      mountains: MOUNTAINS,
      origin: gps,
      date: TODAY,
      today: TODAY,
      now: at(4, 47),
    });
    // Purgatory has no manual route from Denver, but every mountain is
    // reachable from a live GPS fix.
    expect(result.all.some((plan) => plan.mountain.id === 'purgatory')).toBe(true);
    expect(result.all.length).toBe(MOUNTAINS.length);
    for (const plan of result.all) {
      expect(plan.origin.coordinates).toEqual({ lat: 39.7047, lon: -105.0814 });
    }
  });

  it('keeps the rest of the recommendation honest when routing fails for just one mountain', async () => {
    const registry = createDemoRegistry({
      traffic: { failFor: (route) => route.id.startsWith('vail:') },
    });
    const result = await recommend(registry, {
      mountains: MOUNTAINS,
      origin: gps,
      date: TODAY,
      today: TODAY,
      now: at(4, 47),
    });
    const vailPlan = result.all.find((plan) => plan.mountain.id === 'vail')!;
    expect(vailPlan.departure).toBeNull();
    expect(vailPlan.caveats.some((c) => /not going to fake the drive/i.test(c))).toBe(true);
    // Nearby mountains, unaffected by Vail's routing failure, still get a
    // normal, timed plan — one failed route does not take down the others.
    const copperPlan = result.all.find((plan) => plan.mountain.id === 'copper')!;
    expect(copperPlan.departure).not.toBeNull();
    expect(copperPlan.caveats.some((c) => /not going to fake the drive/i.test(c))).toBe(false);
  });

  it('never fabricates route data when routing fails for every mountain', async () => {
    const registry = createDemoRegistry({ traffic: { failFor: () => true } });
    const result = await recommend(registry, {
      mountains: MOUNTAINS,
      origin: gps,
      date: TODAY,
      today: TODAY,
      now: at(4, 47),
    });
    expect(result.all.length).toBeGreaterThan(0);
    for (const plan of result.all) {
      expect(plan.departure).toBeNull();
      expect(plan.return).toBeNull();
      expect(plan.caveats.some((c) => /not going to fake the drive/i.test(c))).toBe(true);
    }
  });
});

describe('more snow is not automatically a better day', () => {
  it('prefers a close, well-run mountain over a deeper one behind a brutal drive', () => {
    const deepAndFar = buildPlan(
      testInputs({
        weather: testWeather({ overnightSnowIn: 16 }),
        outbound: testTravel({ direction: 'outbound', duration: () => 215, congestion: () => 0.8 }),
        inbound: testTravel({ direction: 'return', duration: () => 230, congestion: () => 0.85 }),
      }),
    );
    const shallowAndClose = buildPlan(
      testInputs({
        weather: testWeather({ overnightSnowIn: 7 }),
        outbound: testTravel({ direction: 'outbound', duration: () => 82, congestion: () => 0.08 }),
        inbound: testTravel({ direction: 'return', duration: () => 86, congestion: () => 0.1 }),
      }),
    );
    expect(shallowAndClose.score.score).toBeGreaterThan(deepAndFar.score.score);
  });
});

describe('stay or go', () => {
  const plan = () =>
    buildPlan(
      testInputs({ weather: testWeather({ overnightSnowIn: 10 }), inbound: afternoonWall }),
      { preferences: DEFAULT_PREFERENCES },
    );

  it('tells you to stay when you are standing in the middle of the wall', () => {
    const advice = stayOrGo(plan(), at(15, 12));
    expect(advice.verdict).toBe('stay');
    expect(advice.headline).toMatch(/don't leave yet|one more lap|stay a while/i);
    expect(advice.minutesToWait).toBeGreaterThan(30);
    expect(advice.leaveLater!.driveMinutes).toBeLessThan(advice.leaveNow!.driveMinutes);
    // The whole point: waiting is not just less driving, it's a better day.
    expect(advice.leaveLater!.score).toBeGreaterThan(advice.leaveNow!.score);
    expect(advice.detail).toMatch(/stay another|hang on/i);
  });

  it('calls the window open when leaving now is already the best move', () => {
    const advice = stayOrGo(plan(), plan().return!.departure);
    expect(advice.verdict).toBe('window-open');
    expect(advice.headline).toMatch(/window/i);
  });

  it('stops offering advice once the options run out', () => {
    const advice = stayOrGo(plan(), at(23, 0));
    expect(advice.verdict).toBe('go-now');
    expect(advice.leaveNow).toBeNull();
  });

  it('builds a ladder that spans the afternoon and always includes the recommendation', () => {
    const subject = plan();
    const ladder = stayOrGoLadder(subject);
    expect(ladder.length).toBeGreaterThan(2);
    expect(ladder.some((option) => option.recommended)).toBe(true);
    for (let i = 1; i < ladder.length; i += 1) {
      expect(ladder[i]!.departure).toBeGreaterThan(ladder[i - 1]!.departure);
    }
    // Both sides of the decision, so the table still says something on days
    // when the recommendation is already last chair.
    const first = subject.returnOptions[0]!;
    const last = subject.returnOptions[subject.returnOptions.length - 1]!;
    expect(ladder[0]!.departure).toBe(first.departure);
    expect(ladder[ladder.length - 1]!.departure).toBe(last.departure);
  });
});

describe('base/peak conditions and off-season handling on the plan', () => {
  it('carries base, peak and the 5-day snow history through to the plan, honestly, when the weather feed succeeded', () => {
    const built = buildPlan(
      testInputs({ weather: testWeather({ baseSnowDepthIn: 55, peakUnavailable: true, past5TotalIn: 12 }) }),
    );
    expect(built.baseConditions).not.toBeNull();
    expect(built.modelSnowDepthIn).toBe(55);
    // Peak was unavailable on the source — never backfilled from base.
    expect(built.peakConditions).toBeNull();
    expect(built.snowHistory!.pastTotalIn).toBe(12);
  });

  it('reports no base/peak/history at all when the whole weather feed is down, rather than a fabricated fallback', () => {
    const built = buildPlan(testInputs({ weather: 'unavailable' }));
    expect(built.baseConditions).toBeNull();
    expect(built.peakConditions).toBeNull();
    expect(built.snowHistory).toBeNull();
  });

  it('gives a normal recommendation (no off-season message) on an ordinary open day', () => {
    const built = buildPlan(testInputs());
    expect(built.operationalState).toBe('OPEN');
    expect(built.offSeasonMessage).toBeNull();
  });

  it('replaces the normal call with an off-season message when the mountain is genuinely closed', () => {
    const built = buildPlan(testInputs({ operations: testOperations({ status: 'closed' }) }));
    expect(built.operationalState).toBe('CLOSED');
    expect(built.offSeasonMessage).not.toBeNull();
    expect(built.offSeasonMessage!.line.length).toBeGreaterThan(0);
  });

  it('explains a slow traffic-service wake-up in the caveat, and stays generic for other traffic failures', () => {
    const waking = buildPlan(
      testInputs({ outbound: 'unavailable', outboundReason: 'The traffic service took too long to answer.' }),
    );
    expect(waking.caveats.some((c) => /wake up/i.test(c))).toBe(true);

    const genericFailure = buildPlan(
      testInputs({ outbound: 'unavailable', outboundReason: 'Traffic service request failed.' }),
    );
    expect(genericFailure.caveats.some((c) => /not going to fake the drive/i.test(c))).toBe(true);
    expect(genericFailure.caveats.some((c) => /wake up/i.test(c))).toBe(false);
  });

  it('never turns a routine dead lift-status feed into an off-season takeover', () => {
    // This is the exact shape of several existing "honest empty state" tests:
    // the lift report is down but everything else is fine. That should stay
    // a normal, lower-confidence recommendation, not a wall.
    const built = buildPlan(testInputs({ operations: 'unavailable' }));
    expect(built.operationalState).toBe('UNKNOWN');
    expect(built.offSeasonMessage).toBeNull();
    expect(built.departure).not.toBeNull();
  });
});
