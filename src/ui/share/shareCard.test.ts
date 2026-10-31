import { describe, expect, it } from 'vitest';
import type { SnowHistory } from '@/domain/conditions';
import { testMountain } from '@/test/fixtures';
import { biggestDay, inches, type ShareCardData, shareText } from './shareCard';

// 2026-11-01 is a Sunday.
const outlook = (amounts: number[]): SnowHistory => ({
  past: [],
  pastTotalIn: 0,
  future: amounts.map((snowfallIn, i) => ({ date: `2026-11-0${i + 1}`, snowfallIn, kind: 'forecast' as const })),
  futureTotalIn: amounts.reduce((sum, value) => sum + value, 0),
});

const card = (snow: SnowHistory | null): ShareCardData => ({
  mountain: testMountain({ name: 'Wolf Creek' }),
  snow,
  today: '2026-10-31',
  usingDemoData: false,
  host: 'example.app',
});

describe('the share card line', () => {
  it('leads with the biggest day and the five-day total', () => {
    expect(shareText(card(outlook([0, 14.2, 6, 1, 0])))).toBe('Wolf Creek: 14″ Monday, 21″ in the next 5 days.');
  });

  it('skips the total when the big day is all of it', () => {
    expect(shareText(card(outlook([0, 0, 3.4, 0, 0])))).toBe('Wolf Creek: 3.4″ Tuesday.');
  });

  it('says so when nothing real is coming, and when there is no forecast', () => {
    expect(biggestDay(outlook([0, 0.2, 0, 0, 0]))).toBeNull();
    expect(shareText(card(outlook([0, 0.2, 0, 0, 0])))).toBe('Wolf Creek: no real snow in the next 5 days.');
    expect(shareText(card(null))).toBe('Wolf Creek on POW NOW.');
  });

  it('prints inches the way the app does', () => {
    expect(inches(3.44)).toBe('3.4″');
    expect(inches(14.2)).toBe('14″');
  });
});
