import { useMemo, useState } from 'react';
import { MOUNTAINS } from '@/data/mountains';
import { PASS_LABELS, type PassAffiliation } from '@/domain/mountain';
import { BrowseBar } from '@/ui/components/BrowseBar';
import { MountainList } from '@/ui/components/MountainList';
import { ScreenHeader } from '@/ui/components/ScreenHeader';

export interface ListScreenProps {
  onBack: () => void;
  /** A mountain's own profile — its facts, conditions and logistics, no ranking. */
  onOpenMountain: (mountainId: string) => void;
  onShowMap: () => void;
  onRank: () => void;
}

/** Only the passes some mountain in the dataset actually carries. */
const PASS_FILTERS: PassAffiliation[] = (['epic', 'ikon', 'indy', 'mountain-collective', 'independent'] as const).filter((pass) =>
  MOUNTAINS.some((mountain) => mountain.passAffiliations.includes(pass)),
);

/**
 * Every supported mountain by name — the primary way to browse, with the
 * map one tab over. A search box and pass chips narrow it; a row opens that
 * mountain's profile, separate from any ranking.
 */
export function ListScreen({ onBack, onOpenMountain, onShowMap, onRank }: ListScreenProps) {
  const [query, setQuery] = useState('');
  const [pass, setPass] = useState<PassAffiliation | null>(null);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return MOUNTAINS.filter(
      (mountain) =>
        (!pass || mountain.passAffiliations.includes(pass)) &&
        (!needle || `${mountain.name} ${mountain.shortName} ${mountain.region}`.toLowerCase().includes(needle)),
    );
  }, [query, pass]);
  const filtered = shown.length !== MOUNTAINS.length;

  return (
    <div className="screen listscreen">
      <ScreenHeader onBack={onBack} title="MOUNTAINS" />
      <div className="screen-body shell">
        <BrowseBar view="list" onShowMap={onShowMap} onShowList={() => {}} onRank={onRank} />

        <header className="listscreen-head">
          <h1 className="listscreen-title">
            <span className="numeral">{MOUNTAINS.length}</span> Colorado mountains
          </h1>
          <p className="listscreen-intro">Open any one for its full profile — the terrain, today's snow, the drive, parking and where to eat. No ranking unless you ask for it.</p>
        </header>

        <div className="listscreen-filters">
          <label className="listscreen-search">
            <span className="visually-hidden">Search mountains</span>
            <span aria-hidden="true" className="listscreen-search-icon">
              ⌕
            </span>
            <input type="search" placeholder="Search by name or region" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="listscreen-passes scroll-x" role="group" aria-label="Filter by pass">
            <button type="button" className={`filterchip${pass === null ? ' is-active' : ''}`} aria-pressed={pass === null} onClick={() => setPass(null)}>
              All
            </button>
            {PASS_FILTERS.map((option) => (
              <button
                key={option}
                type="button"
                className={`filterchip${pass === option ? ' is-active' : ''}`}
                aria-pressed={pass === option}
                onClick={() => setPass(pass === option ? null : option)}
              >
                {PASS_LABELS[option]}
              </button>
            ))}
          </div>
        </div>

        {shown.length > 0 ? (
          <MountainList
            mountains={shown}
            onSelectMountain={onOpenMountain}
            label={filtered ? `${shown.length} of ${MOUNTAINS.length} Colorado mountains, alphabetical` : undefined}
          />
        ) : (
          <p className="listscreen-empty">
            No mountain matches that.{' '}
            <button
              type="button"
              className="linkbutton"
              onClick={() => {
                setQuery('');
                setPass(null);
              }}
            >
              Clear filters
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
