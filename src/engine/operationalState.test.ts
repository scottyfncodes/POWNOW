import { describe, expect, it } from 'vitest';
import { testInputs, testOperations, testWeather } from '@/test/fixtures';
import { classifyOperationalState } from './operationalState';

/**
 * "The feed failed" and "the mountain is closed" are different facts, and
 * this classifier is the one place that turns real signals into one of the
 * eight states — never inferring OPEN from silence, never inferring CLOSED
 * from a dead feed.
 */

describe('classifyOperationalState', () => {
  it('reports OPEN for a normal operating day', () => {
    const result = classifyOperationalState(
      testInputs({ operations: testOperations({ terrainOpenShare: 0.9, windHoldRisk: 0.05 }) }),
    );
    expect(result.state).toBe('OPEN');
  });

  it('reports CLOSED only from a real "closed" status, never from a dead feed', () => {
    const closed = classifyOperationalState(testInputs({ operations: testOperations({ status: 'closed' }) }));
    expect(closed.state).toBe('CLOSED');

    const feedDown = classifyOperationalState(
      testInputs({ operations: 'unavailable', usingDemoData: false, date: '2026-01-17' }),
    );
    expect(feedDown.state).not.toBe('CLOSED');
  });

  it('reports LIMITED_OPERATIONS when only a slice of terrain is open', () => {
    const result = classifyOperationalState(
      testInputs({ operations: testOperations({ terrainOpenShare: 0.3 }) }),
    );
    expect(result.state).toBe('LIMITED_OPERATIONS');
  });

  it('reports OPEN_WITH_RESTRICTIONS for real hold risk or delay without a coverage problem', () => {
    const result = classifyOperationalState(
      testInputs({ operations: testOperations({ terrainOpenShare: 0.9, windHoldRisk: 0.4 }) }),
    );
    expect(result.state).toBe('OPEN_WITH_RESTRICTIONS');
  });

  it('reports a thin but running mountain as LIMITED_OPERATIONS, not as unskiable', () => {
    // Two lifts turning is an open mountain; the score, not a takeover, says how little.
    const result = classifyOperationalState(
      testInputs({
        date: '2026-01-17', // January — not the calendar off-season
        usingDemoData: false,
        operations: testOperations({ terrainOpenShare: 0.05, liftsExpectedOpen: 2 }),
      }),
    );
    expect(result.state).toBe('LIMITED_OPERATIONS');
  });

  it('reports OFF_SEASON for next-to-nothing open during the calendar off-season, in live mode', () => {
    const result = classifyOperationalState(
      testInputs({
        date: '2026-07-15', // July
        usingDemoData: false,
        operations: testOperations({ terrainOpenShare: 0.05, liftsExpectedOpen: 0 }),
      }),
    );
    expect(result.state).toBe('OFF_SEASON');
  });

  it('never infers OFF_SEASON from the calendar alone in demo mode', () => {
    // Demo mode always simulates a mid-season day, whatever the real date is.
    const result = classifyOperationalState(
      testInputs({
        date: '2026-07-15',
        usingDemoData: true,
        operations: 'unavailable',
        weather: testWeather({ baseSnowDepthIn: 40, past5TotalIn: 6 }),
      }),
    );
    expect(result.state).not.toBe('OFF_SEASON');
  });

  it('reports OFF_SEASON when the lift feed is down during the calendar off-season, in live mode', () => {
    const result = classifyOperationalState(
      testInputs({ date: '2026-08-01', usingDemoData: false, operations: 'unavailable' }),
    );
    expect(result.state).toBe('OFF_SEASON');
  });

  it('reports NO_SNOW from a real negligible base depth and a dry 5-day history, never from a dead feed alone', () => {
    const result = classifyOperationalState(
      testInputs({
        date: '2026-01-17', // not calendar off-season
        usingDemoData: false,
        operations: 'unavailable',
        weather: testWeather({ baseSnowDepthIn: 2, past5TotalIn: 1 }),
      }),
    );
    expect(result.state).toBe('NO_SNOW');
  });

  it('reports UNKNOWN rather than guessing when the feed is down and nothing else points anywhere', () => {
    const result = classifyOperationalState(
      testInputs({
        date: '2026-01-17',
        usingDemoData: false,
        operations: 'unavailable',
        weather: 'unavailable',
      }),
    );
    expect(result.state).toBe('UNKNOWN');
  });

  it('does not infer NO_SNOW from a healthy base depth just because the feed is down', () => {
    const result = classifyOperationalState(
      testInputs({
        date: '2026-01-17',
        usingDemoData: false,
        operations: 'unavailable',
        weather: testWeather({ baseSnowDepthIn: 55, past5TotalIn: 20 }),
      }),
    );
    expect(result.state).not.toBe('NO_SNOW');
    expect(result.state).toBe('UNKNOWN');
  });
});
