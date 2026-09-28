import type { ElevationConditions } from '@/domain/conditions';

export interface BasePeakConditionsProps {
  base: ElevationConditions | null;
  peak: ElevationConditions | null;
}

/**
 * Base and peak, side by side, above the fold: temperature and wind for both
 * ends of the mountain without opening anything. Peak never borrows base's
 * numbers — `null` renders as "Unavailable", not a copy.
 *
 * Snow depth is deliberately not here. A model's depth is one grid-cell
 * number regardless of elevation, and a measured depth belongs to a named
 * station — both live in `SnowpackPanel`, labeled for what they are.
 */
export function BasePeakConditions({ base, peak }: BasePeakConditionsProps) {
  if (!base && !peak) return null;
  return (
    <div className="basepeak" role="group" aria-label="Base and peak conditions">
      <ElevationColumn label="Base" conditions={base} />
      <ElevationColumn label="Peak" conditions={peak} />
    </div>
  );
}

function ElevationColumn({ label, conditions }: { label: string; conditions: ElevationConditions | null }) {
  return (
    <div className="basepeak-col">
      <p className="basepeak-label">{label}</p>
      {conditions ? (
        <>
          <p className="basepeak-temp numeral">{Math.round(conditions.temperatureF)}°F</p>
          <p className="basepeak-sub">
            {Math.round(conditions.windMph)} mph
            {conditions.windGustMph > conditions.windMph + 8 ? ` · gusts ${Math.round(conditions.windGustMph)}` : ''}
          </p>
        </>
      ) : (
        <p className="basepeak-unavailable">Unavailable</p>
      )}
    </div>
  );
}
