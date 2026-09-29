import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string };

/**
 * A tiny async runner with an artificial floor on how fast it can finish.
 *
 * The floor is not a fake progress bar: the loading sequence is where POW NOW
 * tells you what it is doing on your behalf ("checking the roads…"), and a
 * result that flashes past in 40ms reads as if nothing was checked at all.
 */
/**
 * Tests should exercise the loading state, not sit through it.
 */
const FLOOR_SCALE = import.meta.env.MODE === 'test' ? 0.08 : 1;

export function useAsync<T>(
  run: () => Promise<T>,
  deps: unknown[],
  options: { enabled?: boolean; minimumMs?: number } = {},
): AsyncState<T> & { reload: () => void } {
  const { enabled = true } = options;
  const minimumMs = (options.minimumMs ?? 0) * FLOOR_SCALE;
  const [state, setState] = useState<AsyncState<T>>({ status: 'idle' });
  const [nonce, setNonce] = useState(0);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    const startedAt = Date.now();

    runRef
      .current()
      .then(async (data) => {
        const elapsed = Date.now() - startedAt;
        if (elapsed < minimumMs) {
          await new Promise((resolve) => setTimeout(resolve, minimumMs - elapsed));
        }
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Something went sideways.',
        });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, minimumMs, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  return { ...state, reload };
}
