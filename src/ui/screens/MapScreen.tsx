import { useMemo, useState } from 'react';
import { resolveEnvironment } from '@/config/env';
import { MOUNTAINS, findMountain } from '@/data/mountains';
import { mountainProfileFor } from '@/data/mountainProfiles';
import type { Origin } from '@/domain/mountain';
import { formatDuration } from '@/domain/time';
import { makeContext } from '@/engine/inputs';
import { resolveAccessRoutes } from '@/engine/routing';
import { travelAt } from '@/engine/travel';
import { describeRoutePreviewFailure, fetchRoutePreview } from '@/providers/live/routePreview';
import type { ProviderRegistry } from '@/providers/types';
import type { ClockState } from '@/ui/hooks/useClock';
import { useAsync } from '@/ui/hooks/useRecommendation';
import { ScreenHeader } from '@/ui/components/ScreenHeader';
import { MountainMap, type MapRoutePreview } from '@/ui/components/MountainMap';
import { MountainProfilePanel } from '@/ui/components/MountainProfilePanel';

type RouteResult =
  | { kind: 'ok'; preview: MapRoutePreview }
  | { kind: 'unavailable'; message: string; likelySlowWake: boolean };

export interface MapScreenProps {
  registry: ProviderRegistry;
  clock: ClockState;
  origin: Origin;
  onBack: () => void;
}

/**
 * The map answers "what are my options, where are they, and what does
 * getting there look like" — a companion to NOW, not a replacement for it.
 * Selecting a mountain resolves exactly one route (the same
 * `resolveAccessRoutes` + traffic provider pipeline NOW uses for that one
 * mountain), never a route for all thirteen — the map never triggers more
 * routing calls than the mountain the user actually tapped.
 */
export function MapScreen({ registry, clock, origin, onBack }: MapScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedMountain = selectedId ? (findMountain(selectedId) ?? null) : null;
  const environment = resolveEnvironment();
  const apiBaseUrl = environment.trafficApiBaseUrl;
  // Only the dedicated single-call preview endpoint gets used in real live
  // mode — reusing the full day-curve pipeline here would cost up to 9 extra
  // Google Routes calls per tap for samples the map never shows. Demo mode
  // (and live mode with no traffic server configured) falls back to the
  // registry, which already handles both honestly and for free.
  const useLivePreview = !registry.usingDemoData && environment.proxyConfigured;

  const routeState = useAsync(
    async (): Promise<RouteResult | null> => {
      if (!selectedMountain) return null;
      const [route] = resolveAccessRoutes(selectedMountain, origin);
      if (!route) {
        return { kind: 'unavailable', message: 'No route known from this origin.', likelySlowWake: false };
      }

      if (useLivePreview) {
        try {
          const preview = await fetchRoutePreview(route.originPoint, route.destinationPoint, apiBaseUrl);
          return {
            kind: 'ok',
            preview: { durationMinutes: preview.durationMinutes, distanceMiles: preview.distanceMiles, trafficAware: true },
          };
        } catch (error) {
          const { message, likelySlowWake } = describeRoutePreviewFailure(error);
          return { kind: 'unavailable', message, likelySlowWake };
        }
      }

      const context = makeContext(clock.today, clock.today, clock.now);
      const availability = await registry.traffic.getTravelCurve(route, 'outbound', context);
      if (availability.status !== 'ok') {
        return { kind: 'unavailable', message: "Couldn't reach the route service.", likelySlowWake: false };
      }
      const curve = availability.data;
      const estimate = travelAt(curve, clock.now);
      return {
        kind: 'ok',
        preview: {
          durationMinutes: Math.round(estimate.durationMinutes),
          distanceMiles: curve.distanceMiles ?? route.distanceMiles ?? null,
          trafficAware: false,
        },
      };
    },
    // `clock.now` is read inside but deliberately not a dependency: the
    // preview should not re-fetch a Google route every minute the tab is open.
    [selectedMountain?.id, origin.id, origin.coordinates.lat, origin.coordinates.lon, clock.today, useLivePreview],
    { enabled: selectedMountain !== null },
  );

  const mapRoute = useMemo((): MapRoutePreview | 'loading' | 'error' | null => {
    if (!selectedMountain) return null;
    if (routeState.status === 'loading' || routeState.status === 'idle') return 'loading';
    if (routeState.status === 'error') return 'error';
    if (!routeState.data) return null;
    return routeState.data.kind === 'ok' ? routeState.data.preview : 'error';
  }, [selectedMountain, routeState]);

  // A friendly, honest reason — never a raw HTTP status or provider string,
  // matching how NOW/LATER already talk about a dead traffic feed.
  const failure =
    routeState.status === 'ready' && routeState.data?.kind === 'unavailable'
      ? routeState.data
      : routeState.status === 'error'
        ? { message: "Couldn't reach the route service.", likelySlowWake: false }
        : null;

  return (
    <div className="screen">
      <ScreenHeader onBack={onBack} title="MAP" />
      <div className="screen-body shell">
        <p className="mapscreen-intro">
          Every supported mountain, where they sit relative to {origin.id === 'gps' ? 'your location' : origin.shortName}. Tap one for the drive and the profile.
        </p>

        <MountainMap
          mountains={MOUNTAINS}
          origin={origin}
          selectedMountainId={selectedId}
          onSelectMountain={(id) => setSelectedId(id)}
          route={mapRoute}
        />

        {selectedMountain && (
          <section className="panel mapscreen-route" aria-live="polite">
            <h2 className="section-title">
              Route to {selectedMountain.shortName}
            </h2>
            {mapRoute === 'loading' && <p className="faint">Checking the route…</p>}
            {mapRoute === 'error' && (
              <p className="mapscreen-route-error">
                Couldn't get a route right now. {failure?.message} We won't guess at a time or distance.
                {failure?.likelySlowWake && ' Give it a moment and try again.'}
              </p>
            )}
            {mapRoute && mapRoute !== 'loading' && mapRoute !== 'error' && (
              <dl className="mapscreen-route-stats">
                <div>
                  <dt>Drive time</dt>
                  <dd className="numeral">{formatDuration(mapRoute.durationMinutes)}</dd>
                </div>
                <div>
                  <dt>Distance</dt>
                  <dd className="numeral">
                    {mapRoute.distanceMiles != null ? `${Math.round(mapRoute.distanceMiles)} mi` : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Traffic</dt>
                  <dd>{mapRoute.trafficAware ? 'Traffic-aware' : 'Demo estimate'}</dd>
                </div>
              </dl>
            )}
          </section>
        )}

        {selectedMountain && (
          <MountainProfilePanel mountain={selectedMountain} profile={mountainProfileFor(selectedMountain.id)} />
        )}
      </div>
    </div>
  );
}
