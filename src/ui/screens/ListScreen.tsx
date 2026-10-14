import { useMemo, useState } from 'react';
import { MOUNTAINS } from '@/data/mountains';
import { ORIGIN_STATE_LABELS } from '@/data/origins';
import { PASS_LABELS, type PassAffiliation } from '@/domain/mountain';
import { BrowseBar } from '@/ui/components/BrowseBar';
import { MountainList, type ListScores } from '@/ui/components/MountainList';
import { ScreenHeader } from '@/ui/components/ScreenHeader';

export interface ListScreenProps {
  /** Today's score per mountain, from the same ranking the home screen shows. */
  scores?: ListScores;
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

/** Only the states some mountain in the dataset is actually in, in the starting-city list's order. */
const STATE_FILTERS: string[] = Object.keys(ORIGIN_STATE_LABELS).filter((state) =>
  MOUNTAINS.some((mountain) => mountain.state === state),
);

/** "Colorado, Utah, New Mexico and California" — whatever the dataset covers. */
const STATES_SENTENCE = ((names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)(
  STATE_FILTERS.map((state) => ORIGIN_STATE_LABELS[state] ?? state),
);

/**
 * Every supported mountain by name — the primary way to browse, with the
 * map one tab over. Each card carries today's score from the rider's starting
 * point, but the list stays alphabetical. A search box, state chips and pass chips narrow it; a row opens that
 * mountain's profile, separate from any ranking.
 */
export function ListScreen({ scores, onBack, onOpenMountain, onShowMap, onRank }: ListScreenProps) {
  const [query, setQuery] = useState('');
  const [pass, setPass] = useState<PassAffiliation | null>(null);
  const [state, setState] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return MOUNTAINS.filter(
      (mountain) =>
        (!pass || mountain.passAffiliations.includes(pass)) &&
        (!state || mountain.state === state) &&
        (!needle || `${mountain.name} ${mountain.shortName} ${mountain.region}`.toLowerCase().includes(needle)),
    );
  }, [query, pass, state]);
  const filtered = shown.length !== MOUNTAINS.length;

  return (
    <div className="screen listscreen">
      <ScreenHeader onBack={onBack} title="MOUNTAINS" />
      <div className="screen-body shell">
        <BrowseBar view="list" onShowMap={onShowMap} onShowList={() => {}} onRank={onRank} />

        <header className="listscreen-head">
          <h1 className="listscreen-title">
            <span className="numeral">{MOUNTAINS.length}</span> mountains
          </h1>
          <p className="listscreen-intro">
            Across {STATES_SENTENCE}. Each card shows today's score out of 10
            {scores?.status === 'ready' ? ` from ${scores.originName}` : ''} — still A to Z, no ranking unless you ask for it. Open any one for its full
            profile: the terrain, today's snow, the drive, parking and where to eat.
          </p>
        </header>

        <div className="listscreen-filters">
          <label className="listscreen-search">
            <span className="visually-hidden">Search mountains</span>
            <span aria-hidden="true" className="listscreen-search-icon">
              ⌕
            </span>
            <input type="search" placeholder="Search by name or region" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="listscreen-passes scroll-x" role="group" aria-label="Filter by state">
            <button type="button" className={`filterchip${state === null ? ' is-active' : ''}`} aria-pressed={state === null} onClick={() => setState(null)}>
              All states
            </button>
            {STATE_FILTERS.map((option) => (
              <button
                key={option}
                type="button"
                className={`filterchip${state === option ? ' is-active' : ''}`}
                aria-pressed={state === option}
                onClick={() => setState(state === option ? null : option)}
              >
                {ORIGIN_STATE_LABELS[option]}
              </button>
            ))}
          </div>
          <div className="listscreen-passes scroll-x" role="group" aria-label="Filter by pass">
            <button type="button" className={`filterchip${pass === null ? ' is-active' : ''}`} aria-pressed={pass === null} onClick={() => setPass(null)}>
              All passes
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
            scores={scores}
            label={filtered ? `${shown.length} of ${MOUNTAINS.length} mountains, alphabetical` : undefined}
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
                setState(null);
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
