import { PASS_LABELS, type Mountain } from '@/domain/mountain';

export interface MountainListProps {
  mountains: Mountain[];
  onSelectMountain: (mountainId: string) => void;
  /** Overrides the list's accessible name, e.g. when a filter has narrowed it. */
  label?: string;
}

/** The tallest vertical in the dataset, so each row's bar reads against the same scale. */
const maxVertical = (mountains: Mountain[]) => Math.max(1, ...mountains.map((mountain) => mountain.elevations.verticalFt));

/**
 * The no-geography view: one alphabetized card per mountain, each enough of a
 * profile to browse by (region, size, passes, the character line used in
 * explanations) without running the whole day-plan pipeline just to fill a
 * list — that runs only when someone asks for a mountain's call.
 */
export function MountainList({ mountains, onSelectMountain, label }: MountainListProps) {
  const sorted = [...mountains].sort((a, b) => a.name.localeCompare(b.name));
  const tallest = maxVertical(sorted);

  return (
    <ul className="mountainlist" aria-label={label ?? `${sorted.length} Colorado mountains, alphabetical`}>
      {sorted.map((mountain) => (
        <li key={mountain.id}>
          <button type="button" className="mountainlist-row" onClick={() => onSelectMountain(mountain.id)}>
            <span className="mountainlist-top">
              <span className="mountainlist-name">{mountain.name}</span>
              <span className="mountainlist-region">{mountain.region}</span>
            </span>
            <span className="mountainlist-stats">
              <span>
                <strong className="numeral">{mountain.elevations.verticalFt.toLocaleString()}′</strong> vert
              </span>
              <span>
                <strong className="numeral">{mountain.terrain.acres.toLocaleString()}</strong> acres
              </span>
              <span>
                <strong className="numeral">{mountain.terrain.trails}</strong> trails
              </span>
              <span>
                <strong className="numeral">{mountain.elevations.summitFt.toLocaleString()}′</strong> summit
              </span>
            </span>
            <span className="mountainlist-bar" aria-hidden="true">
              <span style={{ width: `${(mountain.elevations.verticalFt / tallest) * 100}%` }} />
            </span>
            <span className="mountainlist-character">{mountain.character}</span>
            <span className="mountainlist-passes">
              {mountain.passAffiliations.map((pass) => (
                <span key={pass} className={`chip passchip passchip-${pass}`}>
                  {PASS_LABELS[pass]}
                </span>
              ))}
            </span>
            <span className="mountainlist-chevron" aria-hidden="true">
              →
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
