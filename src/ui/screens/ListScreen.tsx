import { useMemo, useState } from 'react';
import { MOUNTAINS } from '@/data/mountains';
import { ORIGIN_STATE_LABELS } from '@/data/origins';
import { PASS_LABELS, type PassAffiliation } from '@/domain/mountain';
import { BrowseBar } from '@/ui/components/BrowseBar';
import { MountainList, type ListOrder, type ListScores, type ListSnow } from '@/ui/components/MountainList';
import { ScreenHeader } from '@/ui/components/ScreenHeader';
import { SourcesSheet } from '@/ui/components/SourcesSheet';
import { addDays, daysBetween, type DateKey, formatDateLabel, weekdayLong } from '@/domain/dates';

export interface ListScreenProps {
  /** The day the scores are for, and today, so the picker can say Today and Tomorrow. */
  date: DateKey;
  today: DateKey;
  /** Picking a day re-scores every mountain for it; POW PLANNER starts from the same day. */
  onDateChange: (date: DateKey) => void;
  /** Whether every number is simulated, for the Sources sheet. */
  usingDemoData?: boolean;
  /** Today's score per mountain, from the same ranking the home screen shows. */
  scores?: ListScores;
  /** Every mountain's next five days of snow, shown on each card and sortable. */
  snow?: ListSnow;
  /** Today's single pick from the rider's starting point, for anyone heading out now. */
  onToday?: () => void;
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

/** How far ahead the list's day picker reaches: two weeks, past which a forecast is mostly guesswork. */
const DAY_PICKER_DAYS = 14;

/** "Today", "Tomorrow", "Sat, Nov 8": the picker's option text. */
const dayOption = (date: DateKey, today: DateKey): string => {
  const delta = daysBetween(today, date);
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  return formatDateLabel(date);
};

/** "today", "tomorrow", "Saturday", "Sat, Nov 22": the day in a sentence. */
export const dayName = (date: DateKey, today: DateKey): string => {
  const delta = daysBetween(today, date);
  if (delta === 0) return 'today';
  if (delta === 1) return 'tomorrow';
  if (delta > 1 && delta < 7) return weekdayLong(date);
  return formatDateLabel(date);
};

/** "today's", "Saturday's"; a date reads "the Sat, Nov 22" instead of a possessive. */
const possessive = (day: string): string => (/\d/.test(day) ? `the ${day}` : `${day}'s`);

/** "Colorado, Utah, New Mexico and California" — whatever the dataset covers. */
const STATES_SENTENCE = ((names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)(
  STATE_FILTERS.map((state) => ORIGIN_STATE_LABELS[state] ?? state),
);

/**
 * Where POW NOW opens. Most people come to plan ahead, so the first screen
 * after the intro is every supported mountain by name with its next five
 * days of snow, the map one tab over and today's single pick one link away. Each card carries today's score from the rider's starting
 * point, but the list stays alphabetical. A search box, state chips and pass chips narrow it; a row opens that
 * mountain's profile, separate from any ranking.
 */
export function ListScreen({ date, today, onDateChange, usingDemoData = false, scores, snow, onToday, onOpenMountain, onShowMap, onRank }: ListScreenProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const days = useMemo(() => {
    const options = Array.from({ length: DAY_PICKER_DAYS }, (_, i) => addDays(today, i));
    // A day picked further out in POW PLANNER stays selectable here.
    return options.includes(date) ? options : [...options, date];
  }, [date, today]);
  const day = dayName(date, today);
  const isToday = date === today;
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<ListOrder>('name');
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
      <ScreenHeader
        title="MOUNTAINS"
        right={
          <button type="button" className="home-sources" onClick={() => setSourcesOpen(true)} aria-haspopup="dialog">
            Sources
          </button>
        }
      />
      <div className="screen-body shell">
        <BrowseBar view="list" onShowMap={onShowMap} onShowList={() => {}} onRank={onRank} />

        <header className="listscreen-head">
          <h1 className="listscreen-title">
            <span className="numeral">{MOUNTAINS.length}</span> mountains
          </h1>
          <p className="listscreen-intro">
            Across {STATES_SENTENCE}. Each card shows the score out of 10 for {day}
            {scores?.status === 'ready' ? ` from ${scores.originName}` : ''} and the snow forecast for the next five days. A to Z unless you
            sort by snow. Open any one for its full profile: the terrain, today's snow, the drive, parking and where to eat.
          </p>
          {onToday && (
            <p className="listscreen-today">
              Going {day}?{' '}
              <button type="button" className="linkbutton" onClick={onToday}>
                See {possessive(day)} pick
              </button>
            </p>
          )}
        </header>

        <div className="listscreen-filters">
          {snow && (
            <div className="listscreen-sort" role="group" aria-label="Sort">
              <button type="button" className={`filterchip${order === 'name' ? ' is-active' : ''}`} aria-pressed={order === 'name'} onClick={() => setOrder('name')}>
                A to Z
              </button>
              <button
                type="button"
                className={`filterchip${order === 'snow' ? ' is-active' : ''}`}
                aria-pressed={order === 'snow'}
                disabled={snow.status !== 'ready'}
                onClick={() => setOrder('snow')}
              >
                Most snow coming
              </button>
              <label className={`filterchip listscreen-date${isToday ? '' : ' is-active'}`}>
                <span className="visually-hidden">Day to score</span>
                <select value={date} onChange={(event) => onDateChange(event.target.value)}>
                  {days.map((option) => (
                    <option key={option} value={option}>
                      {dayOption(option, today)}
                    </option>
                  ))}
                </select>
                <svg aria-hidden="true" viewBox="0 0 12 12" width="10" height="10">
                  <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </label>
            </div>
          )}
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
            snow={snow}
            order={order}
            label={
              filtered
                ? `${shown.length} of ${MOUNTAINS.length} mountains, ${order === 'snow' && snow?.status === 'ready' ? 'most snow coming first' : 'alphabetical'}`
                : undefined
            }
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
      {sourcesOpen && <SourcesSheet usingDemoData={usingDemoData} onClose={() => setSourcesOpen(false)} />}
    </div>
  );
}
