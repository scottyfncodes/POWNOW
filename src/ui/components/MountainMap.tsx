import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { GeoPoint, Mountain, Origin } from '@/domain/mountain';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

export interface MapRoutePreview {
  durationMinutes: number;
  distanceMiles: number | null;
  trafficAware: boolean;
  /**
   * The real driven road geometry, decoded from Google's polyline. `null`
   * when no real geometry is available (demo mode, or a live proxy that
   * didn't return one) — the map then draws a clearly-marked approximate
   * direction line instead of pretending it's the actual road.
   */
  routePoints: GeoPoint[] | null;
}

export interface MountainMapProps {
  mountains: Mountain[];
  origin: Origin;
  selectedMountainId: string | null;
  onSelectMountain: (mountainId: string) => void;
  /** `null` while nothing is selected or the route hasn't resolved; `'error'` when routing genuinely failed — never a guessed number. */
  route?: MapRoutePreview | 'loading' | 'error' | null;
  /**
   * 'home' (default): the full browsing map, tall enough to be the home
   * screen's main event. 'compact': a smaller, subordinate map for use inside
   * a mountain's full-screen profile — same real route/pin rendering, just
   * not competing with the profile content below it for the screen.
   */
  variant?: 'home' | 'compact';
}

const toLatLng = (point: GeoPoint): L.LatLngTuple => [point.lat, point.lon];

/**
 * Leaflet only applies a vector layer's `className` option once, at the
 * moment its SVG `<path>` is first created (see `Renderer._initPath` in
 * Leaflet's own source) — react-leaflet's declarative `pathOptions`,
 * however, is applied a render tick later via `layer.setStyle(...)`, which
 * updates stroke/weight/opacity/dashArray attributes directly but never
 * touches `className` (`Renderer._updateStyle` doesn't set it). A
 * `pathOptions={{ className: ... }}` prop is therefore silently ignored in
 * practice — verified against the compiled Leaflet/react-leaflet source,
 * not assumed — so the route lines are styled with real Leaflet path
 * options here instead of a CSS class the DOM never receives.
 */
const REAL_ROUTE_STYLE: L.PathOptions = { color: 'var(--ice)', weight: 4, opacity: 0.85 };
const APPROXIMATE_ROUTE_STYLE: L.PathOptions = {
  color: 'var(--ink-faint)',
  weight: 2,
  opacity: 0.6,
  dashArray: '2 10',
};

/**
 * A snow-capped double peak (a real mountain range, not a single triangle),
 * big enough to read at a glance on a phone, and colored (not just outlined)
 * so it's visible against the map at rest, not only on hover. The back peak
 * renders first and dimmer for depth; the front peak paints over it at full
 * color. Plain SVG shapes rather than an emoji glyph: an emoji's colors are
 * fixed by the font and can't be recolored for the selected state.
 */
function mountainDivIcon(selected: boolean): L.DivIcon {
  return L.divIcon({
    className: `mm-pin${selected ? ' is-selected' : ''}`,
    html: `
      <svg class="mm-pin-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path class="mm-pin-back" d="M7 7 L16 20 H0.5 Z" />
        <path class="mm-pin-back-cap" d="M7 7 L9.5 11.8 7.3 10.4 4.9 12 Z" />
        <path class="mm-pin-base" d="M15 3.5 L23.5 20 H5 Z" />
        <path class="mm-pin-cap" d="M15 3.5 L18.6 10.3 15.4 8.3 12 10.6 Z" />
      </svg>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    tooltipAnchor: [0, -16],
  });
}

function originDivIcon(isGps: boolean): L.DivIcon {
  return L.divIcon({
    className: `mm-origin${isGps ? ' is-gps' : ''}`,
    html: '<span class="mm-origin-dot" aria-hidden="true"></span><span class="mm-origin-ring" aria-hidden="true"></span>',
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });
}

function clusterDivIcon(cluster: L.MarkerCluster): L.DivIcon {
  return L.divIcon({
    className: 'mm-cluster',
    html: `<span class="mm-cluster-count" aria-hidden="true">${cluster.getChildCount()}</span>`,
    iconSize: [40, 40],
  });
}

/**
 * Several Colorado resorts (Summit County above all) sit only a few real
 * miles apart — close enough that at any zoom wide enough to show the whole
 * state, their markers physically overlap on a phone screen, and a tap can
 * land on the wrong one. `leaflet.markercluster` is the standard answer for
 * exactly this: nearby pins collapse into one cluster bubble that expands
 * (zooming in) on tap, so a mistaken tap is never actually possible — it
 * either hits one unambiguous mountain, or a cluster that has to be opened
 * first. Individual peaks that aren't part of a tight cluster stay single-tap.
 *
 * This manages its own imperative Leaflet layer (clustering needs one)
 * rather than react-leaflet's declarative `<Marker>` — real coordinates and
 * click wiring are identical either way, only the mounting mechanism differs.
 */
function MountainClusterLayer({
  mountains,
  selectedMountainId,
  onSelectMountain,
}: {
  mountains: Mountain[];
  selectedMountainId: string | null;
  onSelectMountain: (mountainId: string) => void;
}) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const group = L.markerClusterGroup({
      maxClusterRadius: 28,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: clusterDivIcon,
    });
    group.addTo(map);
    groupRef.current = group;
    return () => {
      group.remove();
      groupRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();
    for (const mountain of mountains) {
      const isSelected = mountain.id === selectedMountainId;
      const marker = L.marker(toLatLng(mountain.coordinates), {
        icon: mountainDivIcon(isSelected),
        keyboard: false,
      });
      marker.on('click', () => onSelectMountain(mountain.id));
      marker.bindTooltip(mountain.shortName, {
        permanent: isSelected,
        direction: 'top',
        offset: [0, -16],
        className: 'mm-tooltip',
      });
      // The real accessible/keyboard control for this mountain is the button
      // below the map (see the visually-hidden mountain list) — marking the
      // visual pin `aria-hidden` avoids the same target being announced
      // twice, once for a decorative element whose geometry a screen reader
      // has no use for.
      marker.on('add', () => marker.getElement()?.setAttribute('aria-hidden', 'true'));
      group.addLayer(marker);
    }
  }, [mountains, selectedMountainId, onSelectMountain]);

  return null;
}

/**
 * Keeps the map framed on whatever's relevant: Colorado (plus the origin, if
 * it's off in another state) when nothing is selected, or the origin and the
 * selected mountain — and the real route between them, when one exists —
 * once a mountain is tapped. Runs inside `MapContainer` so it can reach the
 * live Leaflet map instance via `useMap()`.
 */
function MapFraming({
  origin,
  selectedMountain,
  routePoints,
  homeBounds,
}: {
  origin: Origin;
  selectedMountain: Mountain | null;
  routePoints: GeoPoint[] | null;
  homeBounds: L.LatLngBounds;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedMountain) {
      const points = routePoints && routePoints.length > 1 ? routePoints : [origin.coordinates, selectedMountain.coordinates];
      const bounds = L.latLngBounds(points.map(toLatLng));
      map.flyToBounds(bounds, { padding: [48, 48], maxZoom: 12, duration: 0.6 });
      return;
    }
    const bounds = L.latLngBounds(homeBounds.getSouthWest(), homeBounds.getNorthEast()).extend(
      toLatLng(origin.coordinates),
    );
    map.flyToBounds(bounds, { padding: [30, 30], duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMountain?.id, origin.coordinates.lat, origin.coordinates.lon, routePoints, homeBounds]);

  return null;
}

/**
 * `MapContainer` only forwards `className`/`id`/`style` to the DOM node it
 * renders — everything else, `aria-label` included, is treated as a Leaflet
 * `Map` constructor option and silently dropped. Setting it here, directly
 * on the real container Leaflet built, is the only way it actually reaches
 * the accessibility tree.
 */
function MapAccessibleLabel({ label }: { label: string }) {
  const map = useMap();
  useEffect(() => {
    map.getContainer().setAttribute('aria-label', label);
  }, [map, label]);
  return null;
}

/**
 * The home map's container is sized by flex (`flex: 1` down a chain of flex
 * parents, see `.mountainmap-home` in components.css), not a fixed height —
 * deliberately, so it fills whatever room is actually left below the header.
 * Leaflet, however, measures its container's pixel size once at
 * initialization and caches it; it has no way to know the flex layout
 * settled into a different size a moment later. On mobile Safari in
 * particular, the address bar's collapse/expand animation and `100dvh`
 * resolving after first paint both change the available height *after*
 * Leaflet has already measured a too-small (sometimes zero) box — which
 * renders as a blank map with no tiles, no pins, not even the zoom control,
 * because Leaflet believes there's nothing to draw. A `ResizeObserver` on
 * the real container calls `invalidateSize()` every time its actual size
 * changes, so the map always catches up to the layout instead of being
 * stuck with its first, possibly-wrong measurement.
 */
function MapAutoResize() {
  const map = useMap();
  useEffect(() => {
    // Not available in the test environment (jsdom) — the map still works
    // there, it just can't self-correct a stale size, which no test needs.
    if (typeof ResizeObserver === 'undefined') return;
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

/**
 * A real, pannable, zoomable Colorado map — Esri's keyless World Dark Gray
 * basemap (no API key, same "no secrets in the client" rule the traffic
 * proxy already follows), rendered as its own dark cartography rather than a
 * CSS filter faking one from light tiles (that was the OpenStreetMap
 * fallback used after CARTO's free dark tiles started requiring a key — this
 * reads noticeably cleaner: legible labels, no color-inversion artifacts).
 * Every mountain sits at its real coordinates from the canonical `Mountain`
 * dataset. Selecting a mountain draws the real driven route when one is
 * available, and a clearly-marked approximate line — never a route dressed
 * up as real — when it isn't.
 */
export function MountainMap({
  mountains,
  origin,
  selectedMountainId,
  onSelectMountain,
  route,
  variant = 'home',
}: MountainMapProps) {
  const selected = mountains.find((m) => m.id === selectedMountainId) ?? null;
  const isGps = origin.id === 'gps';

  const resolvedRoute = route && route !== 'loading' && route !== 'error' ? route : null;
  const routePoints = resolvedRoute?.routePoints ?? null;
  const showApproximateLine = Boolean(selected) && Boolean(resolvedRoute) && !routePoints;

  const originIcon = useMemo(() => originDivIcon(isGps), [isGps]);

  // The default view frames every supported mountain, not the whole state
  // rectangle — Colorado has a lot of empty plains a resort map has no
  // reason to show, and a tighter default fit is also what keeps closely
  // spaced resorts (Summit County) far enough apart in screen pixels to stay
  // out of the same cluster at first glance.
  const homeBounds = useMemo(() => L.latLngBounds(mountains.map((m) => toLatLng(m.coordinates))), [mountains]);

  return (
    <figure className={`mountainmap mountainmap-${variant}`}>
      <MapContainer
        bounds={homeBounds}
        className="mountainmap-leaflet"
        scrollWheelZoom
        attributionControl
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS"
          maxZoom={16}
        />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />

        <MapAccessibleLabel label={`Map of ${mountains.length} Colorado mountains relative to ${origin.name}`} />
        <MapAutoResize />
        <MapFraming origin={origin} selectedMountain={selected} routePoints={routePoints} homeBounds={homeBounds} />

        {routePoints && routePoints.length > 1 && (
          <Polyline positions={routePoints.map(toLatLng)} pathOptions={REAL_ROUTE_STYLE} />
        )}
        {showApproximateLine && selected && (
          <Polyline
            positions={[toLatLng(origin.coordinates), toLatLng(selected.coordinates)]}
            pathOptions={APPROXIMATE_ROUTE_STYLE}
          />
        )}

        <MountainClusterLayer
          mountains={mountains}
          selectedMountainId={selectedMountainId}
          onSelectMountain={onSelectMountain}
        />

        <Marker
          position={toLatLng(origin.coordinates)}
          icon={originIcon}
          interactive={false}
          keyboard={false}
          ref={(instance) => {
            const el = instance?.getElement();
            el?.setAttribute('aria-hidden', 'true');
          }}
        >
          <Tooltip permanent direction="top" offset={[0, -6]} className="mm-origin-tooltip">
            {isGps ? 'You' : origin.shortName}
          </Tooltip>
        </Marker>
      </MapContainer>

      {/*
       * A map pin is a mouse/touch affordance a screen reader can't usefully
       * navigate by shape or position. This list is the real, focusable
       * control for every mountain — visually hidden, but functionally
       * identical to tapping its pin, and exactly what keyboard and
       * screen-reader users actually interact with.
       */}
      <div className="visually-hidden" role="group" aria-label="Mountains">
        {mountains.map((mountain) => {
          const isSelected = mountain.id === selectedMountainId;
          return (
            <button
              key={mountain.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectMountain(mountain.id)}
            >
              {mountain.name}
              {isSelected ? ' (selected)' : ''}. Tap to view mountain conditions and route.
            </button>
          );
        })}
      </div>

      {showApproximateLine && (
        <figcaption className="mountainmap-legend">
          <span className="mountainmap-legend-item mountainmap-legend-note">
            Dashed line is approximate direction, not the actual road
          </span>
        </figcaption>
      )}
    </figure>
  );
}
