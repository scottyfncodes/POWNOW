import type { Elevations } from '@/domain/mountain';

export interface ElevationSilhouetteProps {
  elevations: Elevations;
  /** 0..1 share of terrain above treeline — drawn as the snowline on the ridge. */
  aboveTreelineShare: number;
}

/** Colorado's highest summit sits near 14.4k; every bar is drawn against the same scale so mountains compare honestly. */
const SCALE_FLOOR_FT = 6000;
const SCALE_CEIL_FT = 13500;

const yFor = (ft: number) => {
  const share = (ft - SCALE_FLOOR_FT) / (SCALE_CEIL_FT - SCALE_FLOOR_FT);
  return 112 - Math.max(0.04, Math.min(1, share)) * 100;
};

/**
 * The mountain's real base, summit and vertical, drawn as a ridge on a fixed
 * Colorado-wide scale — so Vail's 3,450′ and Eldora's 1,600′ look as
 * different as they are. Decorative only in shape; every number it labels is
 * the mountain's own data.
 */
export function ElevationSilhouette({ elevations, aboveTreelineShare }: ElevationSilhouetteProps) {
  const summitY = yFor(elevations.summitFt);
  const baseY = yFor(elevations.baseFt);
  // The treeline sits that share of the vertical below the summit.
  const treelineY = summitY + (baseY - summitY) * Math.min(1, Math.max(0, aboveTreelineShare));

  const ridge = `M0 ${baseY + 8} L38 ${baseY} L92 ${(baseY + summitY) / 2 + 6} L128 ${summitY + 10} L156 ${summitY} L186 ${summitY + 14} L224 ${(baseY + summitY) / 2} L280 ${baseY + 4} L320 ${baseY + 10} L320 120 L0 120 Z`;
  const snowcap = `M108 ${treelineY + 4} L128 ${summitY + 10} L156 ${summitY} L186 ${summitY + 14} L204 ${treelineY + 2} L184 ${treelineY - 2} L166 ${treelineY + 5} L146 ${treelineY - 1} L126 ${treelineY + 6} Z`;

  return (
    <figure className="elevation" aria-label={`Base ${elevations.baseFt.toLocaleString()} feet, summit ${elevations.summitFt.toLocaleString()} feet, ${elevations.verticalFt.toLocaleString()} feet of vertical`}>
      <svg viewBox="0 0 320 120" preserveAspectRatio="none" className="elevation-art" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="elevation-rock" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(124, 231, 255, 0.34)" />
            <stop offset="100%" stopColor="rgba(124, 231, 255, 0.02)" />
          </linearGradient>
        </defs>
        <path d={ridge} fill="url(#elevation-rock)" stroke="rgba(124, 231, 255, 0.55)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        {aboveTreelineShare > 0.02 && <path d={snowcap} fill="rgba(243, 247, 255, 0.82)" />}
        <line x1="156" x2="300" y1={summitY} y2={summitY} className="elevation-guide" vectorEffect="non-scaling-stroke" />
        <line x1="38" x2="300" y1={baseY} y2={baseY} className="elevation-guide" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="elevation-labels">
        <span className="elevation-label is-summit" style={{ top: `${(summitY / 120) * 100}%` }}>
          <span className="numeral">{elevations.summitFt.toLocaleString()}′</span> summit
        </span>
        <span className="elevation-label is-base" style={{ top: `${(baseY / 120) * 100}%` }}>
          <span className="numeral">{elevations.baseFt.toLocaleString()}′</span> base
        </span>
        <span className="elevation-vertical">
          <span className="numeral">{elevations.verticalFt.toLocaleString()}′</span>
          <span>vertical</span>
        </span>
      </figcaption>
    </figure>
  );
}
