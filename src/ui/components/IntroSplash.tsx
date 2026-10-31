import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/ui/hooks/useReducedMotion';
import { Wordmark } from './Wordmark';

/**
 * How long the name holds, at least, before it fades. Long enough to read
 * POW NOW and the line under it, short enough not to stand between someone
 * and the forecast they opened the app for.
 */
export const INTRO_HOLD_MS = 900;
/** Matches the `.intro.is-leaving` transition. */
export const INTRO_FADE_MS = 300;

/**
 * The launch screen: POW NOW and its promise, alone and centred, held for a
 * beat on every cold start and then faded away once. It sits over the app,
 * which mounts and starts fetching underneath the whole time, so the hold
 * never adds to a slow load: the mountains and their forecasts are already
 * on their way when the name lifts. A tap anywhere skips it.
 */
export function IntroSplash() {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<'hold' | 'leaving' | 'gone'>('hold');

  useEffect(() => {
    if (phase === 'gone') return;
    const fade = reduced ? 0 : INTRO_FADE_MS;
    if (phase === 'leaving') {
      const gone = setTimeout(() => setPhase('gone'), fade);
      return () => clearTimeout(gone);
    }
    const leave = setTimeout(() => setPhase('leaving'), INTRO_HOLD_MS);
    return () => clearTimeout(leave);
  }, [phase, reduced]);

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
