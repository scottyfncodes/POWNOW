import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { clearProviderCaches } from '@/providers/live/fetchCache';

/*
 * Deterministic, low-motion environment for component tests. jsdom ships a
 * matchMedia that always answers "no", which would leave the decorative canvas
 * running against a 2d context jsdom does not implement — so we replace it and
 * pin reduced-motion on.
 */
{
  window.matchMedia = ((query: string) => ({
    // Tests run reduced-motion: canvases and animations are decoration, and
    // jsdom has no 2d context to give them anyway.
    matches: /prefers-reduced-motion/.test(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/*
 * App state that outlives a render — the screen in the URL hash, the starting
 * city in localStorage — is reset between tests so each one opens on a fresh
 * homepage. jsdom doesn't implement scrolling; screen changes scroll to top.
 */
{
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    window.localStorage.clear();
    // Live providers share a fetch cache; a stubbed response must never
    // outlive the test that stubbed it.
    clearProviderCaches();
  });
}
