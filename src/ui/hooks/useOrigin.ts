import { useCallback, useState } from 'react';
import { findOrigin, isManualCityOrigin } from '@/data/origins';
import type { Origin } from '@/domain/mountain';

export const ORIGIN_STORAGE_KEY = 'snownow.originId';

const readStoredOriginId = (): string | null => {
  try {
    return window.localStorage.getItem(ORIGIN_STORAGE_KEY);
  } catch {
    return null;
  }
};

const storeOriginId = (id: string) => {
  try {
    window.localStorage.setItem(ORIGIN_STORAGE_KEY, id);
  } catch {
    // Private mode or blocked storage: the choice still holds for this visit.
  }
};

/**
 * Where you're starting from, remembered between visits.
 *
 * Only a manual city is ever written to storage. A GPS fix is used for the
 * current visit and never persisted — exact coordinates don't belong on disk,
 * and yesterday's location isn't today's anyway. Picking GPS leaves the last
 * chosen city in place as the fallback for next time.
 */
export function useOrigin(defaultOriginId: string): [Origin, (origin: Origin) => void] {
  const [origin, setOriginState] = useState<Origin>(() => {
    const stored = readStoredOriginId();
    return findOrigin(stored && isManualCityOrigin(stored) ? stored : defaultOriginId);
  });

  const setOrigin = useCallback((next: Origin) => {
    setOriginState(next);
    if (isManualCityOrigin(next.id)) storeOriginId(next.id);
  }, []);

  return [origin, setOrigin];
}
