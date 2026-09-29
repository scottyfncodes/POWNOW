import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings } from './usePreferences';

describe('sanitizeSettings — anything from storage is validated field by field', () => {
  it('returns defaults for garbage', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ sleepVsSend: 'lots', passes: 'epic', latestHomeArrival: NaN })).toEqual(DEFAULT_SETTINGS);
  });

  it('clamps out-of-range numbers instead of letting them reach the engine', () => {
    const out = sanitizeSettings({ sleepVsSend: 7, powderPreference: 0, crowdTolerance: -1, maxDriveMinutes: 9999, latestHomeArrival: 100 });
    expect(out.sleepVsSend).toBe(1);
    expect(out.powderPreference).toBe(0.5);
    expect(out.crowdTolerance).toBe(0);
    expect(out.maxDriveMinutes).toBe(600);
    expect(out.latestHomeArrival).toBe(12 * 60);
  });

  it('keeps only real, holdable passes and de-duplicates them', () => {
    const out = sanitizeSettings({ passes: ['epic', 'ikon', 'epic', 'independent', 'gold-card'] });
    expect(out.passes).toEqual(['epic', 'ikon']);
  });

  it('treats onlyMyPasses as a strict boolean', () => {
    expect(sanitizeSettings({ onlyMyPasses: 'yes' }).onlyMyPasses).toBe(false);
    expect(sanitizeSettings({ onlyMyPasses: true }).onlyMyPasses).toBe(true);
  });
});
