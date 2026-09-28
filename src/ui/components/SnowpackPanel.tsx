import type { SnowpackObservation } from '@/domain/snowpack';

export interface SnowpackPanelProps {
  /** A measured reading at the nearest station, when one exists. */
  snowpack: SnowpackObservation | null;
  /** The weather model's own depth estimate, when the station is silent. */
  modelSnowDepthIn: number | null;
  /** True in demo mode, so the chip says DEMO instead of MEASURED. */
  demo?: boolean;
}

/**
 * How deep is it, really.
 *
 * Two very different kinds of number can answer that, and this panel never
 * lets them wear the same label. A **measured** depth comes from a SNOTEL
 * station — a real sensor a few miles from the lifts, named here with its
 * elevation and distance so nobody reads "Vail Mountain, 10,300 ft" as the
 * base of Vail. A **modeled** depth is a weather grid's estimate for a cell
 * several kilometres wide; it is shown only when no station reading exists,
 * and it says so.
 */
export function SnowpackPanel({ snowpack, modelSnowDepthIn, demo = false }: SnowpackPanelProps) {
  if (snowpack) {
    const change = snowpack.depthChange24hIn;
    return (
      <div className="snowpack" role="group" aria-label="Measured snowpack">
        <div className="snowpack-head">
          <p className="snowpack-title">
            Snowpack <span className={`chip ${demo ? 'chip-demo' : 'chip-live'} snowpack-chip`}>{demo ? 'DEMO' : 'MEASURED'}</span>
          </p>
          <p className="snowpack-station">
            {snowpack.stationName} SNOTEL
            {snowpack.stationElevationFt !== null && ` · ${snowpack.stationElevationFt.toLocaleString()} ft`}
            {` · ${formatMiles(snowpack.distanceMiles)} away`}
          </p>
        </div>
        <dl className="snowpack-grid">
          <div>
            <dt>Depth</dt>
            <dd className="numeral">{snowpack.snowDepthIn === null ? '—' : `${Math.round(snowpack.snowDepthIn)}"`}</dd>
          </div>
          <div>
            <dt>Last 24h</dt>
            <dd className={`numeral${change !== null && change > 0 ? ' is-up' : ''}`}>{formatChange(change)}</dd>
          </div>
          <div>
            <dt>5-day new</dt>
            <dd className="numeral">{snowpack.newSnow5dIn === null ? '—' : `${snowpack.newSnow5dIn.toFixed(1)}"+`}</dd>
          </div>
          <div>
            <dt>Water</dt>
            <dd className="numeral">{snowpack.sweIn === null ? '—' : `${snowpack.sweIn.toFixed(1)}"`}</dd>
          </div>
        </dl>
        <p className="snowpack-note">
          {describePack(snowpack)} Station reading for {snowpack.observedOn}; depth changes undercount new snow as the
          pack settles.
        </p>
      </div>
    );
  }

  if (modelSnowDepthIn !== null) {
    return (
      <div className="snowpack is-model" role="group" aria-label="Modeled snow depth">
        <p className="snowpack-title">
          Snow depth <span className={`chip ${demo ? 'chip-demo' : 'chip-projected'} snowpack-chip`}>{demo ? 'DEMO' : 'MODELED'}</span>
        </p>
        <p className="snowpack-model">
          <span className="numeral">~{Math.round(modelSnowDepthIn)}"</span> at the forecast point, from the weather model — an
          estimate for a several-kilometre grid cell, not a measurement. No station reading is available for this mountain.
        </p>
      </div>
    );
  }

  return null;
}

function formatMiles(miles: number): string {
  if (miles < 1) return 'under a mile';
  return `${Math.round(miles)} mi`;
}

function formatChange(change: number | null): string {
  if (change === null) return '—';
  if (Math.abs(change) < 0.05) return 'flat';
  return `${change > 0 ? '+' : '−'}${Math.abs(change).toFixed(1)}"`;
}

function describePack(snowpack: SnowpackObservation): string {
  const density = snowpack.packDensity;
  if (density === null) return '';
  if (density < 0.2) return 'A light, unsettled pack.';
  if (density < 0.3) return 'A typical settled Colorado pack.';
  if (density < 0.4) return 'A dense, well-settled pack.';
  return 'A very dense pack — spring-like.';
}
