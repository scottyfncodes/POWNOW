import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/ui/hooks/useReducedMotion';
import { Wordmark } from './Wordmark';

/**
 * How long the name holds before it fades. The first time someone opens POW
 * NOW it gets a real pause, to meet the name and the promise under it. After
 * that it is a short beat, long enough to read, short enough not to stand
 * between a regular and the forecast they opened the app for.
 */
export const INTRO_FIRST_HOLD_MS = 2200;
export const INTRO_HOLD_MS = 1200;
/** Remembers that this browser has seen the intro once already. */
export const INTRO_SEEN_STORAGE_KEY = 'pownow:intro-seen';
/** Matches the `.intro.is-leaving` transition. */
export const INTRO_FADE_MS = 300;

/** Whether this browser has never seen the intro. Blocked storage counts as seen. */
const seenBefore = (): boolean => {
  try {
    return window.localStorage.getItem(INTRO_SEEN_STORAGE_KEY) !== null;
  } catch {
    return true;
  }
};

/**
 * The launch screen: POW NOW and its promise, alone and centred, held on
 * every cold start (longer the very first time) and then faded away once. It sits over the app,
 * which mounts and starts fetching underneath the whole time, so the hold
 * never adds to a slow load: the mountains and their forecasts are already
 * on their way when the name lifts. A tap anywhere skips it.
 */
export function IntroSplash() {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<'hold' | 'leaving' | 'gone'>('hold');
  const [hold] = useState(() => (seenBefore() ? INTRO_HOLD_MS : INTRO_FIRST_HOLD_MS));

  useEffect(() => {
    try {
      window.localStorage.setItem(INTRO_SEEN_STORAGE_KEY, '1');
    } catch {
      // Storage blocked (private mode): every open gets the short hold.
    }
  }, []);

  useEffect(() => {
    if (phase === 'gone') return;
    const fade = reduced ? 0 : INTRO_FADE_MS;
    if (phase === 'leaving') {
      const gone = setTimeout(() => setPhase('gone'), fade);
      return () => clearTimeout(gone);
    }
    const leave = setTimeout(() => setPhase('leaving'), hold);
    return () => clearTimeout(leave);
  }, [phase, reduced, hold]);

  if (phase === 'gone') return null;
  return (
    <div className={`intro${phase === 'leaving' ? ' is-leaving' : ''}`} aria-hidden="true" onClick={() => setPhase('leaving')}>
      <div className="intro-brand">
        <Wordmark />
        <p className="intro-tagline">Find your best mountain day.</p>
      </div>
    </div>
  );
}
