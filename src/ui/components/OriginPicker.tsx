import { useState } from 'react';
import { GPS_ORIGIN_ID, ORIGINS, findOrigin, gpsOrigin } from '@/data/origins';
import type { Origin } from '@/domain/mountain';

export interface OriginPickerProps {
  origin: Origin;
  onChange: (origin: Origin) => void;
}

type LocateState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'found' }
  | { status: 'denied'; message: string }
  | { status: 'error'; message: string };

const GEOLOCATION_OPTIONS: PositionOptions = {
  // Driving-origin selection wants the best fix the device can give, not the
  // battery-friendly default.
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 0,
};

/**
 * The user's exact coordinates become the routing origin directly — POW NOW
 * no longer snaps a GPS fix to whichever of the six manual cities is
 * closest. Permission is only ever requested here, on tap; never on mount.
 */
function useLocate(onChange: (origin: Origin) => void) {
  const [state, setState] = useState<LocateState>({ status: 'idle' });

  const locate = () => {
    if (!navigator.geolocation) {
      setState({
        status: 'error',
        message: "This browser can't share your location. Choose a starting city instead.",
      });
      return;
    }
    setState({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange(gpsOrigin(position.coords.latitude, position.coords.longitude));
        setState({ status: 'found' });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setState({
            status: 'denied',
            message: 'Location access is off. Choose a starting city instead.',
          });
          return;
        }
        if (error.code === error.TIMEOUT) {
          setState({
            status: 'error',
            message: "Location took too long to find. Choose a starting city instead.",
          });
          return;
        }
        setState({
          status: 'error',
          message: "Couldn't determine your location. Choose a starting city instead.",
        });
      },
      GEOLOCATION_OPTIONS,
    );
  };

  return { state, locate };
}

/** Minimal typing: where you're starting from is a tap, not a text field. */
export function OriginPicker({ origin, onChange }: OriginPickerProps) {
  const { state, locate } = useLocate(onChange);
  const isGps = origin.id === GPS_ORIGIN_ID;

  return (
    <div className="originpicker">
      <div className="originpicker-row">
        <label className="originpicker-label" htmlFor="origin-select">
          Starting from
        </label>
        <div className="originpicker-control">
          <select
            id="origin-select"
            value={isGps ? '' : origin.id}
            onChange={(event) => onChange(findOrigin(event.target.value))}
          >
            {isGps && (
              <option value="" disabled>
                Your current location
              </option>
            )}
            {ORIGINS.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
          <span aria-hidden="true" className="originpicker-chevron">
            ▾
          </span>
        </div>
      </div>
      <button
        type="button"
        className="originpicker-locate"
        onClick={locate}
        disabled={state.status === 'locating'}
        aria-busy={state.status === 'locating'}
      >
        <span aria-hidden="true">📍</span>
        {state.status === 'locating' ? 'Finding your location…' : 'Use my current location'}
      </button>
      {state.status === 'found' && (
        <p className="originpicker-locate-status">Using your current location</p>
      )}
      {(state.status === 'denied' || state.status === 'error') && (
        <p className="originpicker-locate-status">{state.message}</p>
      )}
    </div>
  );
}
