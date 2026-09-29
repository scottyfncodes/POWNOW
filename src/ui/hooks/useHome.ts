import { createContext, useContext } from 'react';

/**
 * What tapping the POW NOW logo does. The logo is the home button on every
 * screen, and home is the map — the place every path in the app starts from.
 * `null` outside the app (a screen rendered alone in a test), where the logo
 * is just a logo.
 */
export const HomeContext = createContext<(() => void) | null>(null);

export const useHome = () => useContext(HomeContext);
