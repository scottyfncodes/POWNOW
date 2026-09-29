import { useCallback, useEffect, useState } from 'react';

export type Screen = 'home' | 'now' | 'later' | 'map';

const SCREENS: readonly Screen[] = ['home', 'now', 'later', 'map'];

/** Marks history entries this app pushed, so Back knows whether it may pop one. */
const HISTORY_MARK = 'snownow';

export const screenFromHash = (hash: string): Screen => {
  const name = hash.replace(/^#\/?/, '').toLowerCase();
  return SCREENS.find((screen) => screen === name) ?? 'home';
};

const hashFor = (screen: Screen): string => (screen === 'home' ? '' : `#/${screen}`);

const urlFor = (screen: Screen): string =>
  `${window.location.pathname}${window.location.search}${hashFor(screen)}`;

const scrollToTop = () => {
  try {
    window.scrollTo(0, 0);
  } catch {
    // Not every environment implements scrolling; a new screen at the old
    // scroll offset is cosmetic, not worth failing over.
  }
};

/**
 * Which screen is showing, mirrored into the URL hash.
 *
 * A phone's Back gesture is how people leave a screen; when navigation lived
 * only in React state, that gesture left SNOWNOW altogether. Each screen is
 * now a real history entry (`#/now`, `#/later`, `#/map`) — Back returns home,
 * and a screen can be bookmarked or opened directly. Hash URLs keep this
 * working on static hosting (GitHub Pages) with no server rewrites.
 */
export function useScreen(): [Screen, (next: Screen) => void] {
  const [screen, setScreen] = useState<Screen>(() => screenFromHash(window.location.hash));

  useEffect(() => {
    const sync = () => setScreen(screenFromHash(window.location.hash));
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  useEffect(scrollToTop, [screen]);

  const navigate = useCallback((next: Screen) => {
    // Update state synchronously so the UI never waits on a history event;
    // the popstate that follows a Back lands on the same screen and is a no-op.
    setScreen(next);
    if (next !== 'home') {
      window.history.pushState(HISTORY_MARK, '', urlFor(next));
    } else if (window.history.state === HISTORY_MARK) {
      // We pushed this entry: pop it, so Back/Forward stay in step with the UI.
      window.history.back();
    } else {
      // Opened directly on a deep link: there is no in-app entry to pop.
      window.history.replaceState(null, '', urlFor('home'));
    }
  }, []);

  return [screen, navigate];
}
