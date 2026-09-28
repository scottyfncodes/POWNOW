import { describe, expect, it } from 'vitest';
import { buildPlan } from '@/engine/plan';
import { testInputs } from '@/test/fixtures';
import { planCalendarIcs, planShareText } from './share';

const plan = buildPlan(testInputs());

describe('planShareText', () => {
  it('says the mountain, the verdict, when to leave, when to head home — and that it is demo data when it is', () => {
    const text = planShareText(plan, 'https://example.test/#/now');
    expect(text).toContain(plan.mountain.shortName);
    expect(text).toContain(plan.verdict);
    expect(text).toMatch(/Leave Test City \d{1,2}:\d{2} (AM|PM)/);
    expect(text).toMatch(/Head home \d{1,2}:\d{2} (AM|PM)/);
    expect(text).toContain('(demo data)');
    expect(text.trim().endsWith('https://example.test/#/now')).toBe(true);
  });

  it('falls back to the headline when the day could not be timed', () => {
    const untimed = buildPlan(testInputs({ outbound: 'unavailable' }));
    const text = planShareText(untimed);
    expect(text).toContain(untimed.headline);
    expect(text).not.toMatch(/Leave/);
  });
});

describe('planCalendarIcs', () => {
  it('produces a valid single-event calendar with a 30-minute alarm at the departure time', () => {
    const ics = planCalendarIcs(plan);
    expect(ics).not.toBeNull();
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('TRIGGER:-PT30M');
    const depart = plan.departure!.departure;
    const hh = String(Math.floor(depart / 60)).padStart(2, '0');
    const mm = String(depart % 60).padStart(2, '0');
    expect(ics).toContain(`DTSTART:20260117T${hh}${mm}00`);
    expect(ics!.split('\r\n').filter((line) => line.startsWith('SUMMARY:'))).toHaveLength(1);
  });

  it('escapes commas and newlines the way iCalendar requires', () => {
    const ics = planCalendarIcs(plan)!;
    const description = ics.split('\r\n').find((line) => line.startsWith('DESCRIPTION:'))!;
    expect(description).not.toContain('\n');
    expect(description).toContain('\\n');
  });

  it('returns null when there is no timed departure to put on a calendar', () => {
    expect(planCalendarIcs(buildPlan(testInputs({ outbound: 'unavailable' })))).toBeNull();
  });
});
