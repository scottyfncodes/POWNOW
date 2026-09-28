import { describe, expect, it } from 'vitest';
import { localToUtcIso, planDepartureMinutes } from '../../server/index.mjs';

/**
 * The proxy's pure helpers, tested from the same suite as everything else.
 * The server's network paths (Google, CDOT, SNOTEL) are not exercised here —
 * they are thin fetch-and-normalize wrappers whose shapes the client-side
 * provider tests cover — but the time arithmetic is exactly the kind of
 * thing that fails silently in production and never in a demo.
 */
const TZ = 'America/Denver';
const OUTBOUND = [240, 270, 300, 330, 360, 390, 420, 450, 480];

/** A UTC instant for a Denver wall-clock time on a given date. */
const denver = (date: string, hour: number, minute = 0) => new Date(localToUtcIso(date, hour * 60 + minute, TZ)).getTime();

describe('localToUtcIso', () => {
  it('converts Mountain Standard Time (UTC−7) in January', () => {
    expect(localToUtcIso('2026-01-17', 5 * 60 + 18, TZ)).toBe('2026-01-17T12:18:00.000Z');
  });

  it('converts Mountain Daylight Time (UTC−6) in April', () => {
    expect(localToUtcIso('2026-04-11', 5 * 60, TZ)).toBe('2026-04-11T11:00:00.000Z');
  });
});

describe('planDepartureMinutes — never asks Google about a departure already behind us', () => {
  it('leaves a future date untouched', () => {
    const plan = planDepartureMinutes(OUTBOUND, '2026-01-18', denver('2026-01-17', 20), TZ);
    expect(plan.map((p) => p.minute)).toEqual(OUTBOUND);
    expect(plan.every((p) => p.departureIso !== null)).toBe(true);
  });

  it('leaves today untouched when the whole grid is still ahead', () => {
    const plan = planDepartureMinutes(OUTBOUND, '2026-01-17', denver('2026-01-17', 3, 30), TZ);
    expect(plan.map((p) => p.minute)).toEqual(OUTBOUND);
  });

  it('drops past grid points and anchors the curve at "now" (no departureTime) once the day is under way', () => {
    const plan = planDepartureMinutes(OUTBOUND, '2026-01-17', denver('2026-01-17', 6, 12), TZ);
    expect(plan[0]).toEqual({ minute: 372, departureIso: null });
    expect(plan.slice(1).map((p) => p.minute)).toEqual([390, 420, 450, 480]);
    expect(plan.slice(1).every((p) => p.departureIso !== null)).toBe(true);
  });

  it('keeps a single "now" sample when every grid point is already past, rather than returning nothing', () => {
    const plan = planDepartureMinutes(OUTBOUND, '2026-01-17', denver('2026-01-17', 9, 5), TZ);
    expect(plan).toEqual([{ minute: 545, departureIso: null }]);
  });

  it('treats a grid point within two minutes of now as past — Google would reject it by the time it arrives', () => {
    const plan = planDepartureMinutes(OUTBOUND, '2026-01-17', denver('2026-01-17', 4, 59), TZ);
    expect(plan[0]?.departureIso).toBeNull();
    expect(plan[1]?.minute).toBe(330);
  });
});
