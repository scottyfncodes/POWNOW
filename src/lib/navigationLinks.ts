import type { GeoPoint } from '@/domain/mountain';

/**
 * Hands the destination SNOWNOW has already decided on to the user's actual
 * turn-by-turn navigation app — SNOWNOW is the decision layer (which
 * mountain, when to leave), never the navigator. Both links are universal
 * links: they open the native app when it's installed and fall back to the
 * web when it isn't, on any platform, so no user-agent–gated app-install
 * detection or custom URL scheme (`comgooglemaps://`, `maps://`) is needed —
 * those can silently fail with no way to detect it from a web page.
 */

const round = (value: number): number => Math.round(value * 1e5) / 1e5;

export function appleMapsDirectionsUrl(destination: GeoPoint, origin?: GeoPoint): string {
  const params = new URLSearchParams({
    daddr: `${round(destination.lat)},${round(destination.lon)}`,
    dirflg: 'd',
  });
  if (origin) params.set('saddr', `${round(origin.lat)},${round(origin.lon)}`);
  return `https://maps.apple.com/?${params.toString()}`;
}

export function googleMapsDirectionsUrl(destination: GeoPoint, origin?: GeoPoint): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${round(destination.lat)},${round(destination.lon)}`,
    travelmode: 'driving',
  });
  if (origin) params.set('origin', `${round(origin.lat)},${round(origin.lon)}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Apple Maps is the default, expected navigation app only on Apple's own
 * platforms — everywhere else (Android, desktop Windows/Linux, and any
 * browser that doesn't identify as one of these) Google Maps is the safer
 * universal default. `navigator.userAgentData` (Chromium's replacement for
 * the user-agent string) doesn't expose platform on iOS Safari, so this
 * reads the traditional `userAgent`/`platform` strings, which iOS Safari
 * still supports and is the one browser this actually needs to detect.
 */
export function isApplePlatform(nav: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> = navigator): boolean {
  const ua = nav.userAgent ?? '';
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as "MacIntel" with touch support — the one case a
  // plain Mac/iPad ambiguity actually matters for picking a maps app.
  if (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1) return true;
  return /Macintosh/.test(ua) && !/Windows/.test(ua);
}
