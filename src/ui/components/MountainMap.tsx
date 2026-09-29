import { useMemo } from 'react';
import type { Mountain, Origin } from '@/domain/mountain';
import { buildProjector } from '@/lib/geoProjection';
import { smoothPath } from './chart';

const WIDTH = 640;
const HEIGHT = 480;
const PADDING = 34;

export interface MapRoutePreview {
  durationMinutes: number;
  distanceMiles: number | null;
  trafficAware: boolean;
}

/** What a marker can show at a glance, once the background ranking has resolved. Never shown until real. */
export interface MountainMarkerInfo {
  score: number | null;
  /** Coarse verdict tier, driving marker colour — never a second scoring system, just a bucket of the real score. */
  tier: 'go' | 'mixed' | 'skip' | null;
  freshSnowIn: number | null;
  driveMinutes: number | null;
}

export interface MountainMapProps {
  mountains: Mountain[];
  origin: Origin;
  selectedMountainId: string | null;
  onSelectMountain: (mountainId: string) => void;
  /** `null` while nothing is selected or the route hasn't resolved; `'error'` when routing genuinely failed — never a guessed number. */
  route?: MapRoutePreview | 'loading' | 'error' | null;
  /** Per-mountain ranking info, keyed by mountain id. Absent/`undefined` entries render as plain, unranked markers — not zero, not "skip". */
  markerInfo?: Record<string, MountainMarkerInfo | undefined>;
  /** The mountain the ranking engine currently favours most, if the ranking has resolved at all. */
  bestMountainId?: string | null;
}

/**
 * A hand-drawn schematic map, in the same spirit as the Snow Clock and
 * travel charts elsewhere in the app: real coordinates, a real projection,
 * no tile server and no mapping library. The connecting line between origin
 * and a selected mountain is a schematic route indicator — it shows *that*
 * and roughly *how far*, not a turn-by-turn road path — the numbers next to
 * it (drive time, distance) are the real, non-fabricated claim.
 */
export function MountainMap({
  mountains,
  origin,
  selectedMountainId,
  onSelectMountain,
  route,
  markerInfo,
  bestMountainId,
}: MountainMapProps) {
  const points = [origin.coordinates, ...mountains.map((m) => m.coordinates)];
  const project = buildProjector(points, WIDTH, HEIGHT, PADDING);
  const originXY = project(origin.coordinates);
  const selected = mountains.find((m) => m.id === selectedMountainId) ?? null;

  // Several I-70 corridor resorts sit only ~16-20 projected units apart on
  // this whole-state schematic — labelling all of them at once turns that
  // cluster into unreadable overlapping text ("Do not overcrowd the map").
  // A mountain's label stays always-on only when it has room to itself;
  // inside a cluster, only the selected and BEST NOW markers keep a
  // permanent label — the rest reveal theirs on hover/focus, so a crowded
  // corridor stays legible without hiding any mountain from selection.
  const CLUSTER_THRESHOLD = 30;
  const crowded = useMemo(() => {
    const projected = mountains.map((m) => ({ id: m.id, xy: project(m.coordinates) }));
    const crowdedIds = new Set<string>();
    for (let i = 0; i < projected.length; i += 1) {
      for (let j = i + 1; j < projected.length; j += 1) {
        const a = projected[i]!;
        const b = projected[j]!;
        const distance = Math.hypot(a.xy.x - b.xy.x, a.xy.y - b.xy.y);
        if (distance < CLUSTER_THRESHOLD) {
          crowdedIds.add(a.id);
          crowdedIds.add(b.id);
        }
      }
    }
    return crowdedIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mountains]);

  const routeLine =
    selected && route && route !== 'loading' && route !== 'error'
      ? smoothPath([originXY, project(selected.coordinates)])
      : null;


  const isGps = origin.id === 'gps';

  return (
    <figure className="mountainmap">
      {/* `role="group"`, not `role="img"`: an image hides its children from
          assistive technology, and every marker here is a real button. */}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mountainmap-svg"
        role="group"
        aria-label={`Map of ${mountains.length} mountains relative to ${origin.name}. Each mountain is a button.`}
      >
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} className="mountainmap-bg" rx={16} />

        {routeLine && <path d={routeLine} className="mountainmap-route" />}
        {selected && !routeLine && route !== 'loading' && (
          <line
            x1={originXY.x}
            y1={originXY.y}
            x2={project(selected.coordinates).x}
            y2={project(selected.coordinates).y}
            className="mountainmap-route is-pending"
          />
        )}

        {mountains.map((mountain) => {
          const { x, y } = project(mountain.coordinates);
          const isSelected = mountain.id === selectedMountainId;
          const isBest = bestMountainId != null && mountain.id === bestMountainId;
          const info = markerInfo?.[mountain.id];
          const tierClass = info?.tier ? ` is-tier-${info.tier}` : '';
          const labelAlwaysOn = isSelected || isBest || !crowded.has(mountain.id);

          return (
            <g
              key={mountain.id}
              className={`mountainmap-marker${isSelected ? ' is-selected' : ''}${isBest ? ' is-best' : ''}${tierClass}${labelAlwaysOn ? '' : ' is-declutter'}`}
              transform={`translate(${x}, ${y})`}
              role="button"
              tabIndex={0}
              aria-label={`Select ${mountain.name}${isBest ? ' — best mountain right now' : ''}${isSelected ? ' (selected)' : ''}`}
              onClick={() => onSelectMountain(mountain.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectMountain(mountain.id);
                }
              }}
            >
              {/*
                A generous, invisible hit target — the visible dot is deliberately
                small, but the tap/click target isn't. Radius 9 is a deliberate
                compromise, not a full fix: several I-70 corridor resorts sit
                only ~16-20 projected units apart on this whole-state schematic
                (Vail/Beaver Creek closest, at ~16), so their hit circles still
                touch at this density regardless of radius short of shrinking
                them below a usable touch target. A real fix is map zoom or
                marker clustering, out of scope for this pass — see the
                production report.
              */}
              <circle r={9} className="mountainmap-hit" />
              {isBest && (
                <text y={-24} textAnchor="middle" className="mountainmap-best-ribbon">
                  BEST NOW
                </text>
              )}
              <circle r={isSelected || isBest ? 8 : 5} className="mountainmap-dot" />
              <text y={-11} textAnchor="middle" className="mountainmap-label">
                {mountain.shortName}
              </text>
              {info?.score != null && (isBest || isSelected) && (
                <text y={16} textAnchor="middle" className="mountainmap-score numeral">
                  {info.score.toFixed(1)}
                  {info.driveMinutes != null && ` · ${Math.round(info.driveMinutes)}m`}
                </text>
              )}
            </g>
          );
        })}

        <g className="mountainmap-origin" transform={`translate(${originXY.x}, ${originXY.y})`}>
          <circle r={8} className={`mountainmap-origin-dot${isGps ? ' is-gps' : ''}`} />
          <circle r={14} className="mountainmap-origin-ring" />
          <text y={-18} textAnchor="middle" className="mountainmap-origin-label">
            {isGps ? 'YOU' : origin.shortName.toUpperCase()}
          </text>
        </g>
      </svg>

      <figcaption className="mountainmap-legend">
        <span className="mountainmap-legend-item">
          <span className="mountainmap-swatch is-origin" aria-hidden="true" /> {isGps ? 'Your location' : origin.shortName}
        </span>
        <span className="mountainmap-legend-item">
          <span className="mountainmap-swatch is-mountain" aria-hidden="true" /> Mountain
        </span>
        {bestMountainId && (
          <span className="mountainmap-legend-item">
            <span className="mountainmap-swatch is-best" aria-hidden="true" /> Best right now
          </span>
        )}
      </figcaption>
    </figure>
  );
}
