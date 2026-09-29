import { useCallback, useEffect, useRef, useState } from 'react';

export type Screen = 'home' | 'setup' | 'picks' | 'mountain' | 'list' | 'map' | 'later';

/** Where the app is: a screen, plus the one parameter a screen can carry (which mountain). */
export interface Route {
  screen: Screen;
  mountainId: string | null;
}

const HOME: Route = { screen: 'home', mountainId: null };

/** Marks history entries this app pushed, so Back knows whether it may pop one. */
const HISTORY_MARK = 'pownow';

export const routeFromHash = (hash: string): Route => {
  const path = hash.replace(/^#\/?/, '').toLowerCase();
  const [head = '', param] = path.split('/');
  switch (head) {
    case '':
      return HOME;
    case 'setup':
    case 'picks':
    case 'list':
    case 'map':
    case 'later':
      return { screen: head, mountainId: null };
    case 'mountain':
      return param ? { screen: 'mountain', mountainId: param } : HOME;
    // The old NOW screen — its bookmark lands on today's ranked picks.
    case 'now':
      return { screen: 'picks', mountainId: null };
    default:
      return HOME;
  }
};

export const hashFor = (route: Route): string => {
  if (route.screen === 'home') return '';
  if (route.screen === 'mountain') return `#/mountain/${route.mountainId ?? ''}`;
  return `#/${route.screen}`;
};

const urlFor = (route: Route): string => `${window.location.pathname}${window.location.search}${hashFor(route)}`;

/** The hash as this app would write it — so a foreign spelling (`#now`, `#/Map`) still matches its own entry. */
const canonicalHash = (hash: string): string => hashFor(routeFromHash(hash));

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
 * only in React state, that gesture left POW NOW altogether. Each screen is a
 * real history entry (`#/setup`, `#/picks`, `#/mountain/vail`, `#/map`) so
 * Back retraces the flow, and any screen can be bookmarked or shared.
 *
 * The flow is several screens deep (home → your ride → picks → a mountain),
 * so this keeps its own record of the entries it pushed. Navigating "back"
 * to a screen already in that record pops history to it instead of pushing
 * a duplicate — the in-app back arrow and the phone's Back gesture then
 * agree about where you are. Hash URLs keep all of this working on static
 * hosting with no server rewrites.
 */
export function useScreen(): [Route, (screen: Screen, mountainId?: string | null) => void] {
  const [route, setRoute] = useState<Route>(() => routeFromHash(window.location.hash));
  // The hashes of the history entries under our control, oldest first.
  const stackRef = useRef<string[]>([canonicalHash(window.location.hash)]);

  useEffect(() => {
    const sync = () => {
      const hash = canonicalHash(window.location.hash);
      const stack = stackRef.current;
      const index = stack.lastIndexOf(hash);
      // Landing on an entry we know means Back (or Forward) moved within our
      // own record; anything else is a new entry from outside it.
      stackRef.current = index === -1 ? [...stack, hash] : stack.slice(0, index + 1);
      setRoute(routeFromHash(hash));
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  useEffect(scrollToTop, [route.screen, route.mountainId]);

  const navigate = useCallback((screen: Screen, mountainId: string | null = null) => {
    const next: Route = { screen, mountainId: screen === 'mountain' ? mountainId : null };
    const target = hashFor(next);
    const stack = stackRef.current;
    const top = stack.length - 1;
    const index = stack.lastIndexOf(target);

    // Update state synchronously so the UI never waits on a history event;
    // the popstate that follows lands on the same screen and is a no-op.
    setRoute(next);

    if (index !== -1 && index < top) {
      // We pushed this entry earlier: pop back to it, so the phone's Back
      // gesture keeps agreeing with the in-app back arrow.
      stackRef.current = stack.slice(0, index + 1);
      window.history.go(index - top);
      return;
    }
    if (next.screen === 'home' && index === -1) {
      // Opened directly on a deep link: there is no in-app entry to pop.
      stackRef.current = [target];
      window.history.replaceState(null, '', urlFor(next));
      return;
    }
    if (index === top) return;
    stackRef.current = [...stack, target];
    window.history.pushState(HISTORY_MARK, '', urlFor(next));
  }, []);

  return [route, navigate];
}
