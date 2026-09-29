import type { GeoPoint } from '@/domain/mountain';
import { appleMapsDirectionsUrl, googleMapsDirectionsUrl, isApplePlatform } from '@/lib/navigationLinks';

export interface NavigateLinksProps {
  destination: GeoPoint;
  destinationLabel: string;
  /** The exact origin SNOWNOW is already using — GPS or a manual city — passed through so the external app starts from the same place, not wherever it last knew the user to be. */
  origin?: GeoPoint;
}

/**
 * SNOWNOW decided which mountain and, via the route preview above, roughly
 * when — turn-by-turn from here on belongs to the navigation app the user
 * already has and trusts. Apple Maps shows first (and only) on Apple
 * platforms, matching what tapping "Maps" would open there; Google Maps is
 * always offered as the universal alternative.
 */
export function NavigateLinks({ destination, destinationLabel, origin }: NavigateLinksProps) {
  const showApple = typeof navigator !== 'undefined' && isApplePlatform();

  return (
    <div className="navigatelinks">
      {showApple && (
        <a
          className="navigatelinks-link"
          href={appleMapsDirectionsUrl(destination, origin)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Navigate to ${destinationLabel} in Apple Maps`}
        >
          Apple Maps ↗
        </a>
      )}
      <a
        className="navigatelinks-link"
        href={googleMapsDirectionsUrl(destination, origin)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Navigate to ${destinationLabel} in Google Maps`}
      >
        Google Maps ↗
      </a>
    </div>
  );
}
