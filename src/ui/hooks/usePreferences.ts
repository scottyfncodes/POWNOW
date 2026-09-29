import { useCallback, useState } from 'react';
import { DEFAULT_PREFERENCES, type RiderPreferences } from '@/config/weights';
import { HOLDABLE_PASSES, type PassAffiliation } from '@/domain/mountain';

/** Named for the app's old name on purpose: renaming it would wipe every saved setting. */
export const PREFERENCES_STORAGE_KEY = 'snownow.preferences';

/** The fields a rider can set. Origin lives in `useOrigin`; the rest of `RiderPreferences` is not user-facing. */
export type RiderSettings = Pick<
  RiderPreferences,
  'sleepVsSend' | 'powderPreference' | 'crowdTolerance' | 'maxDriveMinutes' | 'latestHomeArrival' | 'passes' | 'onlyMyPasses'
>;

export const DEFAULT_SETTINGS: RiderSettings = {
  sleepVsSend: DEFAULT_PREFERENCES.sleepVsSend,
  powderPreference: DEFAULT_PREFERENCES.powderPreference,
  crowdTolerance: DEFAULT_PREFERENCES.crowdTolerance,
  maxDriveMinutes: DEFAULT_PREFERENCES.maxDriveMinutes,
  latestHomeArrival: DEFAULT_PREFERENCES.latestHomeArrival,
  passes: DEFAULT_PREFERENCES.passes,
  onlyMyPasses: DEFAULT_PREFERENCES.onlyMyPasses,
};

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/**
 * Anything read back from storage is validated field by field: a stale or
 * hand-edited value falls back to the default for that one field rather
 * than poisoning the whole set or crashing the engine with a NaN.
 */
export function sanitizeSettings(raw: unknown): RiderSettings {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const passes = Array.isArray(source.passes)
    ? (source.passes.filter((pass): pass is PassAffiliation => HOLDABLE_PASSES.includes(pass as PassAffiliation)) as PassAffiliation[])
    : DEFAULT_SETTINGS.passes;
  return {
    sleepVsSend: clampNumber(source.sleepVsSend, 0, 1, DEFAULT_SETTINGS.sleepVsSend),
    powderPreference: clampNumber(source.powderPreference, 0.5, 1.5, DEFAULT_SETTINGS.powderPreference),
    crowdTolerance: clampNumber(source.crowdTolerance, 0, 1, DEFAULT_SETTINGS.crowdTolerance),
    maxDriveMinutes: clampNumber(source.maxDriveMinutes, 60, 600, DEFAULT_SETTINGS.maxDriveMinutes),
    latestHomeArrival: clampNumber(source.latestHomeArrival, 12 * 60, 24 * 60, DEFAULT_SETTINGS.latestHomeArrival),
    passes: [...new Set(passes)],
    onlyMyPasses: source.onlyMyPasses === true,
  };
}

function readStored(): RiderSettings {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    return raw ? sanitizeSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function store(settings: RiderSettings): void {
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode or blocked storage: the choice still holds for this visit.
  }
}

/**
 * The rider's own knobs, remembered between visits. These are preferences,
 * not account state: they live in this browser only and reset from the
 * settings sheet itself.
 */
export function usePreferences(): [RiderSettings, (patch: Partial<RiderSettings>) => void, () => void] {
  const [settings, setSettings] = useState<RiderSettings>(readStored);

  const update = useCallback((patch: Partial<RiderSettings>) => {
    setSettings((current) => {
      const next = sanitizeSettings({ ...current, ...patch });
      store(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      window.localStorage.removeItem(PREFERENCES_STORAGE_KEY);
    } catch {
      // Nothing to clear.
    }
  }, []);

  return [settings, update, reset];
}
