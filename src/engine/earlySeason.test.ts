import { describe, expect, it } from 'vitest';
import { findMountain } from '@/data/mountains';
import { findOrigin } from '@/data/origins';
import type { OperationsReport } from '@/domain/conditions';
import type { Mountain } from '@/domain/mountain';
import { NON_SKIABLE_STATES } from '@/domain/mountainStatus';
import { ok, unavailable } from '@/domain/provenance';
import { createDemoRegistry } from '@/providers/demo';
import type { MountainProvider, ProviderRegistry } from '@/providers/types';
import { PROVENANCE, testInputs, testOperations } from '@/test/fixtures';
import { classifyOperationalState, noCallReason } from './operationalState';
import { buildPlan, noneOpenLine, recommend } from './plan';
import { seasonFor } from './season';

/**
 * A real November morning: most mountains closed with an opening day on the
 * calendar, one or two open on a single run. These pin that a closed or
 * not-yet-open mountain says so with its date and is never the pick, and that
 * a one-run mountain is open but scores like the thin day it is.
 */

const mountain = (id: string): Mountain => {
  const found = findMountain(id);
  if (!found) throw new Error(`No mountain ${id}`);
  return found;
};

/** Every lift closed, the way a resort's board reads before opening day. */
const allClosed = (total = 23): OperationsReport =>
  testOperations({
    status: 'closed',
    liftsExpectedOpen: 0,
    liftsTotal: total,
    liftsOpen: 0,
    liftsHold: 0,
    liftsScheduled: 0,
    liftsClosed: total,
    terrainOpenShare: 0,
    windHoldRisk: 0,
  });

/** A-Basin's real board on 2026-10-31: Black Mountain Express and High Noon, nothing else. */
const oneRunOpen = (): OperationsReport =>
  testOperations({
    status: 'open',
    liftsExpectedOpen: 1,
    liftsTotal: 9,
    liftsOpen: 1,
    liftsHold: 0,
    liftsScheduled: 0,
    liftsClosed: 8,
    trailsOpen: 1,
    trailsTotal: 147,
    terrainOpenShare: 1 / 147,
    windHoldRisk: 0,
  });

const NOV_1 = '2026-11-01';

describe('season dates', () => {
  it("reads Copper's projected Nov 6 opening as preseason on Nov 1", () => {
    const season = seasonFor(mountain('copper'), NOV_1);
    expect(season.phase).toBe('preseason');
    expect(season.opening).toEqual({ date: '2026-11-06', status: 'projected' });
  });

  it('is in season from opening day on', () => {
    expect(seasonFor(mountain('copper'), '2026-11-06').phase).toBe('in-season');
  });
});

describe('closed and preseason mountains', () => {
  it('says "not open yet" with the opening date when the board is all closed before opening day', () => {
    const result = classifyOperationalState(
      testInputs({ mountain: mountain('copper'), date: NOV_1, usingDemoData: false, operations: allClosed() }),
    );
    expect(result.state).toBe('PRESEASON');
    expect(result.reason).toMatch(/not open for the season yet/i);
    expect(result.reason).toMatch(/Nov 6/);
    expect(result.reason).toMatch(/projected/);
  });

  it('still says preseason with the date when the lift feed is down', () => {
    const inputs = testInputs({ mountain: mountain('copper'), date: NOV_1, usingDemoData: false, operations: 'unavailable' });
    const result = classifyOperationalState(inputs);
    expect(result.state).toBe('PRESEASON');
    expect(result.reason).toMatch(/Nov 6/);
  });

  it('says "no opening date announced" for an all-closed board at a resort with no date yet', () => {
    const result = classifyOperationalState(
      testInputs({ mountain: mountain('keystone'), date: NOV_1, usingDemoData: false, operations: allClosed(20) }),
    );
    expect(result.state).toBe('PRESEASON');
    expect(result.reason).toMatch(/no opening date announced/i);
  });

  it("does not read a preseason board's empty lifts as an outage or a weather day", () => {
    const plan = buildPlan(
      testInputs({ mountain: mountain('copper'), date: NOV_1, usingDemoData: false, operations: allClosed() }),
    );
    expect(plan.operationalState).toBe('PRESEASON');
    expect(NON_SKIABLE_STATES.has(plan.operationalState)).toBe(true);
    expect(plan.offSeasonMessage?.detail).toMatch(/Nov 6/);
    expect(plan.offSeasonMessage?.detail).not.toMatch(/hold|outage|weather/i);
    expect(plan.caveats.join(' ')).not.toMatch(/Lift report isn't talking/);
  });

  it('treats lifts on hold as a hold day, never as a closed resort', () => {
    const result = classifyOperationalState(
      testInputs({
        mountain: mountain('copper'),
        date: '2026-12-10',
        usingDemoData: false,
        operations: testOperations({ status: 'hold', liftsOpen: 0, liftsHold: 10, liftsClosed: 13, liftsTotal: 23, liftsExpectedOpen: 0, terrainOpenShare: 0.6, windHoldRisk: 0.43 }),
      }),
    );
    expect(result.state).not.toBe('CLOSED');
    expect(result.state).not.toBe('PRESEASON');
  });

  it('names the opening date in the no-call line when a TBD resort has no lift report', () => {
    const inputs = testInputs({ mountain: mountain('copper'), date: '2026-11-20', usingDemoData: false, operations: 'unavailable' });
    expect(noCallReason(inputs, classifyOperationalState(inputs).state)).toMatch(/Nov 6/);
  });
});

describe('early season, one run open', () => {
  const inputs = testInputs({ mountain: mountain('arapahoe-basin'), date: '2026-10-31', usingDemoData: false, operations: oneRunOpen() });

  it('is open with limited terrain, and says how little', () => {
    const result = classifyOperationalState(inputs);
    expect(result.state).toBe('LIMITED_OPERATIONS');
    expect(result.reason).toBe('Early season: 1 of 9 lifts and 1 of 147 runs open.');
  });

  it('scores low for limited terrain even on a perfect-weather day, and names why', () => {
    const plan = buildPlan(inputs);
    const full = buildPlan(testInputs({ mountain: mountain('arapahoe-basin'), date: '2026-10-31', usingDemoData: false }));
    expect(plan.score.score).toBeLessThanOrEqual(3.1);
    expect(full.score.score).toBeGreaterThan(plan.score.score + 2);
    expect(plan.score.penalties.map((p) => p.label)).toContain('Limited terrain: 1 of 147 runs open');
    expect(plan.offSeasonMessage).toBeNull();
  });
});

describe('recommend() on a November morning', () => {
  const denver = findOrigin('denver');

  /** A registry whose lift boards come from a table, everything else demo, read as live. */
  function registryWith(boards: Record<string, OperationsReport | 'unavailable'>): ProviderRegistry {
    const demo = createDemoRegistry();
    const mountainProvider: MountainProvider = {
      id: 'test-boards',
      async getOperations(m) {
        const board = boards[m.id] ?? 'unavailable';
        return board === 'unavailable' ? unavailable('test-boards', 'No board.') : ok(board, PROVENANCE);
      },
      getCrowdForecast: (m, c) => demo.mountain.getCrowdForecast(m, c),
    };
    return { ...demo, mountain: mountainProvider, usingDemoData: false };
  }

  const field = ['copper', 'breckenridge', 'arapahoe-basin'].map(mountain);

  it('never picks a closed or preseason mountain over an open one', async () => {
    const rec = await recommend(
      registryWith({ copper: allClosed(), breckenridge: allClosed(35), 'arapahoe-basin': oneRunOpen() }),
      { mountains: field, origin: denver, date: NOV_1, today: NOV_1, now: 6 * 60 },
    );
    expect(rec.noneOpen).toBe(false);
    expect(rec.best.mountain.id).toBe('arapahoe-basin');
    expect(rec.best.operationalState).toBe('LIMITED_OPERATIONS');
    for (const plan of rec.alternatives) expect(plan.operationalState).toBe('PRESEASON');
  });

  it('says plainly when every option is closed, and names the first opening day', async () => {
    const rec = await recommend(
      registryWith({ copper: allClosed(), breckenridge: allClosed(35), 'arapahoe-basin': allClosed(9) }),
      { mountains: field, origin: denver, date: NOV_1, today: NOV_1, now: 6 * 60 },
    );
    expect(rec.noneOpen).toBe(true);
    expect(rec.all.every((plan) => NON_SKIABLE_STATES.has(plan.operationalState))).toBe(true);
    // Copper and Breck both announced Nov 6; either is the right answer, the date is what matters.
    expect(rec.nextOpening?.date).toBe('2026-11-06');
    expect(rec.comparison).toMatch(/^None of the 3 mountains in reach are open today\. First to open: (COPPER|BRECK|.+), Nov 6 \(projected\)\.$/);
  });

  it('has a plain line when no resort in the field has announced a date', () => {
    expect(noneOpenLine(2, null)).toBe('None of the 2 mountains in reach are open today. No opening dates announced yet.');
  });
});
