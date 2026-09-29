import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const readPreference = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY).matches
    : false;

/**
 * Respect the OS setting. Motion in POW NOW is decoration, never information.
 *
 * Read on the first render rather than in an effect, so a user who asked for
 * less motion never gets a frame of snow falling at them anyway.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(readPreference);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(QUERY);
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  return reduced;
}
