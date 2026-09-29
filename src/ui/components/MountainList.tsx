import { PASS_LABELS, type Mountain } from '@/domain/mountain';

export interface MountainListProps {
  mountains: Mountain[];
  onSelectMountain: (mountainId: string) => void;
}

/**
 * The no-geography view: one alphabetized row per mountain, each enough of a
 * profile to browse by (region, size, passes, the character line used in
 * explanations) without running the whole day-plan pipeline just to fill a
 * list — that runs when a mountain is actually opened.
 */
export function MountainList({ mountains, onSelectMountain }: MountainListProps) {
  const sorted = [...mountains].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ul className="mountainlist" aria-label={`${sorted.length} Colorado mountains, alphabetical`}>
      {sorted.map((mountain) => (
        <li key={mountain.id}>
          <button type="button" className="mountainlist-row" onClick={() => onSelectMountain(mountain.id)}>
            <span className="mountainlist-name">{mountain.name}</span>
            <span className="mountainlist-meta">
              {mountain.region} · {mountain.terrain.trails} trails · {mountain.elevations.verticalFt.toLocaleString()}′ vertical
            </span>
            <span className="mountainlist-character">{mountain.character}</span>
            <span className="mountainlist-passes">
              {mountain.passAffiliations.map((pass) => (
                <span key={pass} className="chip">
                  {PASS_LABELS[pass]}
                </span>
              ))}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
