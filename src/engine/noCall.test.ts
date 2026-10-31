import { describe, expect, it } from 'vitest';
import { testInputs, testOperations, testSnowpack } from '@/test/fixtures';
import { planSummary } from './explain';
import { classifyOperationalState, noCallReason } from './operationalState';
import { buildPlan } from './plan';

/**
 * A score built on neutral stand-ins reads exactly like a real one. These
 * pin down when the engine refuses to put a number on a day, and that a
 * refused day never dresses its stand-ins up as a snow window or a winner.
 */

describe('noCallReason', () => {
  it('withholds the call when the weather feed is down', () => {
    const inputs = testInputs({ weather: 'unavailable', date: '2026-01-17', usingDemoData: false });
    expect(noCallReason(inputs, classifyOperationalState(inputs).state)).toMatch(/weather feed is down/i);
  });

  it('withholds the call when the lift report is silent in a shoulder month', () => {
    const inputs = testInputs({ operations: 'unavailable', date: '2026-10-29', usingDemoData: false });
    expect(classifyOperationalState(inputs).state).toBe('UNKNOWN');
    expect(noCallReason(inputs, 'UNKNOWN')).toMatch(/isn't open/i);
  });

  it('keeps calling a mid-season day when only the lift report is silent', () => {
    const inputs = testInputs({ operations: 'unavailable', date: '2026-01-17', usingDemoData: false });
    expect(noCallReason(inputs, classifyOperationalState(inputs).state)).toBeNull();
  });

  it('keeps calling a shoulder-month day when the lift report is live', () => {
    const inputs = testInputs({ operations: testOperations(), date: '2026-11-20', usingDemoData: false });
    expect(noCallReason(inputs, classifyOperationalState(inputs).state)).toBeNull();
  });
});

describe('classifyOperationalState with a dead weather feed', () => {
  it('reads a bare station as NO_SNOW instead of UNKNOWN', () => {
    const inputs = testInputs({
      weather: 'unavailable',
      operations: 'unavailable',
      snowpack: testSnowpack({ snowDepthIn: 2, newSnow5dIn: 1 }),
      date: '2026-04-29',
      usingDemoData: false,
    });
    expect(classifyOperationalState(inputs).state).toBe('NO_SNOW');
  });

  it('does not read a bare station as NO_SNOW in the opening months, when the base is machine-made', () => {
    // 2026-10-31: A-Basin open on an 18" made base, every SNOTEL near it at 0".
    const inputs = testInputs({
      weather: 'unavailable',
      operations: 'unavailable',
      snowpack: testSnowpack({ snowDepthIn: 0, newSnow5dIn: 0 }),
      date: '2026-10-29',
      usingDemoData: false,
    });
    expect(classifyOperationalState(inputs).state).toBe('UNKNOWN');
    expect(noCallReason(inputs, 'UNKNOWN')).not.toBeNull();
  });

  it('stays UNKNOWN when the station shows a real pack', () => {
    const inputs = testInputs({
      weather: 'unavailable',
      operations: 'unavailable',
      snowpack: testSnowpack({ snowDepthIn: 30, newSnow5dIn: 1 }),
      date: '2026-01-17',
      usingDemoData: false,
    });
    expect(classifyOperationalState(inputs).state).toBe('UNKNOWN');
  });
});

describe('buildPlan without weather', () => {
  const plan = buildPlan(testInputs({ weather: 'unavailable', date: '2026-01-17', usingDemoData: false }));

  it("says CAN'T CALL IT instead of a verdict", () => {
    expect(plan.noCall).not.toBeNull();
    expect(plan.verdict).toBe("CAN'T CALL IT.");
  });

  it('names no snow window anywhere', () => {
    expect(plan.snowClock.prime).toBeNull();
    expect(plan.timeline.some((event) => /BEST WINDOW|PRIME SNOW/.test(event.label))).toBe(false);
  });

  it('leaves the score out of the summary', () => {
    expect(planSummary(plan)).not.toMatch(/out of 10/);
  });
});
