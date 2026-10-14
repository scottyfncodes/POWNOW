export interface BrowseBarProps {
  view: 'map' | 'list';
  onShowMap: () => void;
  onShowList: () => void;
  /** Into the Your ride step, then every mountain ranked for your day. */
  onRank: () => void;
}

/**
 * The two ways to look at every mountain — by name (the default) or on a
 * map — as tabs of one screen, plus the way to have them ranked for you.
 */
export function BrowseBar({ view, onShowMap, onShowList, onRank }: BrowseBarProps) {
  return (
    <div className="browsebar">
      <div className={`browsebar-tabs is-${view}`} role="group" aria-label="View">
        <span className="browsebar-thumb" aria-hidden="true" />
        <button type="button" className={`browsebar-tab${view === 'list' ? ' is-active' : ''}`} aria-pressed={view === 'list'} onClick={onShowList}>
          List
        </button>
        <button type="button" className={`browsebar-tab${view === 'map' ? ' is-active' : ''}`} aria-pressed={view === 'map'} onClick={onShowMap}>
          Map
        </button>
      </div>
      <button type="button" className="browsebar-rank" onClick={onRank}>
        POW PLANNER →
      </button>
    </div>
  );
}
