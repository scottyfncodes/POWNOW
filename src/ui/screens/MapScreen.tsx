import { useMemo, useState } from 'react';
import { resolveEnvironment } from '@/config/env';
import { DEFAULT_PREFERENCES, type RiderPreferences } from '@/config/weights';
import { MOUNTAINS, findMountain } from '@/data/mountains';
import { mountainProfileFor } from '@/data/mountainProfiles';
import type { Origin } from '@/domain/mountain';
import type { SkiDayPlan } from '@/domain/plan';
import { formatDuration } from '@/domain/time';
import { makeContext } from '@/engine/inputs';
import { recommend } from '@/engine/plan';
import { resolveAccessRoutes } from '@/engine/routing';
import { travelAt } from '@/engine/travel';
import { describeRoutePreviewFailure, fetchRoutePreview } from '@/providers/live/routePreview';
import type { ProviderRegistry } from '@/providers/types';
import type { ClockState } from '@/ui/hooks/useClock';
import { useAsync } from '@/ui/hooks/useRecommendation';
import { MountainMap, type MapRoutePreview, type MountainMarkerInfo } from '@/ui/components/MountainMap';
import { MountainProfile } from '@/ui/components/MountainProfile';
import { NavigateLinks } from '@/ui/components/NavigateLinks';
import { OriginPicker } from '@/ui/components/OriginPicker';
import { RiderSettingsPanel } from '@/ui/components/RiderSettings';
import { Snowfall } from '@/ui/components/Snowfall';
import { Wordmark } from '@/ui/components/Wordmark';
import type { RiderSettings } from '@/ui/hooks/usePreferences';

type RouteResult =
  | { kind: 'ok'; preview: MapRoutePreview }
  | { kind: 'unavailable'; message: string; likelySlowWake: boolean };

export interface MapScreenProps {
  registry: ProviderRegistry;
  clock: ClockState;
  origin: Origin;
  onOriginChange: (origin: Origin) => void;
  preferences?: RiderPreferences;
  /** The rider's own knobs, editable from the landing screen. */
  settings?: RiderSettings;
  onSettingsChange?: (patch: Partial<RiderSettings>) => void;
  onSettingsReset?: () => void;
  onNow: () => void;
  onLater: () => void;
  /** Unused today — MAP is the landing screen and has nowhere "back" to go — kept so the prop shape stays stable if that ever changes. */
  onBack?: () => void;
}

const tierFor = (score: number): MountainMarkerInfo['tier'] =>
  score >= 7.2 ? 'go' : score >= 4.8 ? 'mixed' : 'skip';

/**
 * The SNOWNOW landing experience: MAP → SELECT MOUNTAIN → MOUNTAIN PROFILE,
 * with the map staying visible the whole time.
 *
 * The map itself renders the instant it mounts — mountain identity needs no
 * network call. Ranking (score, verdict, "BEST NOW") comes from one shared
 * `recommend()` call, the *same* multi-mountain pipeline NOW already runs —
 * this is not a second scoring system, and it is not a per-marker or
 * per-tap fetch: one batched call for the whole map, same as NOW pays today.
 * Selecting a mountain reads its plan out of that already-computed result —
 * no additional network request. If that shared call hasn't resolved yet (or
 * failed outright), the profile falls back to the lightweight single-call
 * route preview so the screen still answers "how far is it", even with the
 * richer verdict/conditions/parking temporarily unavailable.
 */
export function MapScreen({
  registry,
  clock,
  origin,
  onOriginChange,
  preferences,
  settings,
  onSettingsChange,
  onSettingsReset,
  onNow,
  onLater,
}: MapScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const selectedMountain = selectedId ? (findMountain(selectedId) ?? null) : null;
  const environment = resolveEnvironment();
  const apiBaseUrl = environment.trafficApiBaseUrl;

  const recState = useAsync<{ all: SkiDayPlan[]; bestId: string }>(
    async () => {
      const recommendation = await recommend(registry, {
        mountains: MOUNTAINS,
        origin,
        date: clock.today,
        today: clock.today,
        now: clock.now,
        preferences: preferences ?? DEFAULT_PREFERENCES,
      });
      return { all: recommendation.all, bestId: recommendation.best.mountain.id };
    },
    // `clock.now` is read inside but deliberately not a dependency: the
    // whole-map ranking must not re-run every minute the tab is open.
    [origin.id, origin.coordinates.lat, origin.coordinates.lon, clock.today, preferences],
  );

  const plans = recState.status === 'ready' ? recState.data.all : null;
  const bestMountainId = recState.status === 'ready' ? recState.data.bestId : null;
  const selectedPlan = plans?.find((plan) => plan.mountain.id === selectedId) ?? null;

  const markerInfo = useMemo(() => {
    if (!plans) return undefined;
    const info: Record<string, MountainMarkerInfo> = {};
    for (const plan of plans) {
      info[plan.mountain.id] = {
        score: plan.score.score,
        tier: plan.offSeasonMessage ? null : tierFor(plan.score.score),
        freshSnowIn: plan.freshSnowIn,
        driveMinutes: plan.departure?.driveMinutes ?? null,
      };
    }
    return info;
  }, [plans]);

  // The single-call route preview serves two purposes. In demo mode it is
  // purely a degrade path — see the module docblock — for a mountain the
  // shared recommendation hasn't covered (still loading, or the whole call
  // failed), and is never fetched once `selectedPlan` above is available. In
  // live mode it also runs for a selected mountain because it is the only
  // source of the real driven road geometry the map draws: a `SkiDayPlan`
  // carries drive minutes, not a polyline. One cheap, proxy-cached call per
  // selection, not per marker.
  const useLivePreview = !registry.usingDemoData && environment.proxyConfigured;
  // Only a separately hosted proxy naps; a same-origin one has nothing to warn about.
  const remoteProxy = environment.proxyConfigured && apiBaseUrl !== '';
  const needsFallback =
    selectedMountain !== null && (useLivePreview || (!selectedPlan && recState.status !== 'loading'));

  const fallbackRouteState = useAsync(
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
            preview: {
              durationMinutes: preview.durationMinutes,
              distanceMiles: preview.distanceMiles,
              trafficAware: true,
              routePoints: preview.routePoints,
            },
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
          // The demo model has no road geometry; the map draws a clearly marked approximate line.
          routePoints: null,
        },
      };
    },
    // `clock.now` is read inside but deliberately not a dependency: the
    // fallback preview should not re-fetch a Google route every minute the tab is open.
    [selectedMountain?.id, origin.id, origin.coordinates.lat, origin.coordinates.lon, clock.today, useLivePreview],
    { enabled: needsFallback },
  );

  const mapRoute = useMemo((): MapRoutePreview | 'loading' | 'error' | null => {
    if (!selectedMountain) return null;
    const previewPoints =
      fallbackRouteState.status === 'ready' && fallbackRouteState.data?.kind === 'ok'
        ? fallbackRouteState.data.preview.routePoints
        : null;
    if (selectedPlan) {
      if (!selectedPlan.departure) return 'error';
      return {
        durationMinutes: Math.round(selectedPlan.departure.driveMinutes),
        distanceMiles: selectedPlan.routeDistanceMiles,
        trafficAware: !registry.usingDemoData,
        // Real geometry only when the live preview returned it; otherwise the
        // map draws a clearly marked approximate line, never a fake road.
        routePoints: previewPoints,
      };
    }
    if (!needsFallback) return 'loading';
    if (fallbackRouteState.status === 'loading' || fallbackRouteState.status === 'idle') return 'loading';
    if (fallbackRouteState.status === 'error') return 'error';
    if (!fallbackRouteState.data) return null;
    return fallbackRouteState.data.kind === 'ok' ? fallbackRouteState.data.preview : 'error';
  }, [selectedMountain, selectedPlan, needsFallback, fallbackRouteState, registry.usingDemoData]);

  const fallbackFailure =
    fallbackRouteState.status === 'ready' && fallbackRouteState.data?.kind === 'unavailable'
      ? fallbackRouteState.data
      : fallbackRouteState.status === 'error'
        ? { message: "Couldn't reach the route service.", likelySlowWake: false }
        : null;

  return (
    <div className="screen mapscreen">
      <Snowfall density={18} />
      <header className="mapscreen-top shell">
        <h1>
          <Wordmark size="sm" />
          <span className="visually-hidden">SNOWNOW</span>
        </h1>
        <p className="mapscreen-tagline">Where should I ski today?</p>

        <div className="mapscreen-actions">
          <button type="button" className="bigbutton bigbutton-now" onClick={onNow}>
            <span className="bigbutton-word">NOW</span>
          </button>
          <button type="button" className="bigbutton bigbutton-later" onClick={onLater}>
            <span className="bigbutton-word">LATER</span>
          </button>
        </div>

        <OriginPicker origin={origin} onChange={onOriginChange} />
        {settings && onSettingsChange && onSettingsReset && (
          <RiderSettingsPanel settings={settings} onChange={onSettingsChange} onReset={onSettingsReset} />
        )}

        {registry.usingDemoData ? (
          <p className="home-demo">
            <span className="chip chip-demo">DEMO DATA</span>
            <span>No live weather, traffic or lift feeds are connected. Every number in the app is simulated — and labelled as such.</span>
          </p>
        ) : remoteProxy ? (
          <p className="home-note">
            First traffic check in a while? It can take up to 15 seconds to wake up — that's normal, not a bug.
          </p>
        ) : null}
      </header>

      <div className="mapscreen-body mapscreen-split">
        <MountainMap
          mountains={MOUNTAINS}
          origin={origin}
          selectedMountainId={selectedId}
          onSelectMountain={(id) => {
            setSelectedId(id);
            setSheetExpanded(true);
          }}
          route={mapRoute}
          markerInfo={markerInfo}
          bestMountainId={bestMountainId}
        />

        {selectedMountain && (
          <div className={`mapscreen-profile mapscreen-sheet${sheetExpanded ? '' : ' is-collapsed'}`}>
            <div className="mapscreen-sheet-handle">
              <button
                type="button"
                aria-label={sheetExpanded ? 'Collapse mountain profile' : 'Expand mountain profile'}
                aria-expanded={sheetExpanded}
                onClick={() => setSheetExpanded((value) => !value)}
              />
            </div>
            <div className="shell">
              {selectedPlan ? (
                <MountainProfile plan={selectedPlan} reference={mountainProfileFor(selectedMountain.id)} now={clock.now} />
              ) : (
                <section className="panel mapscreen-route" aria-live="polite">
                  <h2 className="section-title">Route to {selectedMountain.shortName}</h2>
                  {mapRoute === 'loading' && <p className="faint">Checking the route…</p>}
                  {mapRoute === 'error' && (
                    <p className="mapscreen-route-error">
                      Couldn't get a route right now. {fallbackFailure?.message} We won't guess at a time or distance.
                      {fallbackFailure?.likelySlowWake && ' Give it a moment and try again.'}
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
                  <NavigateLinks
                    destination={selectedMountain.coordinates}
                    destinationLabel={selectedMountain.name}
                    origin={origin.coordinates}
                  />
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
