import { PASS_LABELS, type Mountain } from '@/domain/mountain';
import { forecastTotal, type SnowOutlooks } from '@/engine/snowOutlook';
import { SnowOutlook } from '@/ui/components/SnowOutlook';
import { tierFor } from '@/ui/scoreTier';

/** One mountain's score for today, as the engine scored it from the rider's starting point. */
export interface ListScore {
  score: number;
  /** Off season: the score stands, but it isn't a verdict worth a colour. */
  offSeason: boolean;
}

/**
 * What the list knows about today's scores: still being worked out, worked
 * out (a mountain missing from `byId` is out of reach from the origin), or
 * unavailable because the ranking itself failed.
 */
export type ListScores =
  | { status: 'loading' }
  | { status: 'ready'; byId: Record<string, ListScore>; originName: string }
  | { status: 'error' };

/** Every mountain's five-day snow forecast: loading, loaded, or the whole request failed. */
export type ListSnow = { status: 'loading' } | { status: 'ready'; byId: SnowOutlooks } | { status: 'error' };

export type ListOrder = 'name' | 'snow';

export interface MountainListProps {
  mountains: Mountain[];
  onSelectMountain: (mountainId: string) => void;
  /** Overrides the list's accessible name, e.g. when a filter has narrowed it. */
  label?: string;
  /** Today's 0–10 score per mountain. Omitted, the cards show no score at all. */
  scores?: ListScores;
  /** The next five days of snow per mountain. Omitted, the cards show no forecast strip. */
  snow?: ListSnow;
  /** A to Z (the default), or most snow coming first. */
  order?: ListOrder;
}

function ScoreBadge({ mountain, scores }: { mountain: Mountain; scores: ListScores }) {
  if (scores.status === 'loading') {
    return (
      <span className="mountainlist-score is-loading" aria-label="Score loading">
        <span className="numeral">…</span>
      </span>
    );
  }
  const entry = scores.status === 'ready' ? scores.byId[mountain.id] : undefined;
  if (!entry) {
    const why = scores.status === 'ready' ? `Out of range from ${scores.originName}` : 'Score unavailable';
    return (
      <span className="mountainlist-score is-none" aria-label={why} title={why}>
        {scores.status === 'ready' ? 'Too far' : <span className="numeral">–</span>}
      </span>
    );
  }
  const tier = entry.offSeason ? 'off' : tierFor(entry.score);
  const shown = entry.score.toFixed(1);
  return (
    <span className={`mountainlist-score is-${tier}`} aria-label={`Today's score ${shown} out of 10`}>
      <span className="numeral">{shown}</span>
      <span className="mountainlist-score-of">/10</span>
    </span>
  );
}

/** The tallest vertical in the dataset, so each row's bar reads against the same scale. */
const maxVertical = (mountains: Mountain[]) => Math.max(1, ...mountains.map((mountain) => mountain.elevations.verticalFt));

/**
 * The no-geography view: one alphabetized card per mountain, each enough of a
 * profile to browse by (region, size, passes, the character line used in
 * explanations) without running the whole day-plan pipeline just to fill a
 * list — that runs only when someone asks for a mountain's call.
 */
export function MountainList({ mountains, onSelectMountain, label, scores, snow, order = 'name' }: MountainListProps) {
  const byName = [...mountains].sort((a, b) => a.name.localeCompare(b.name));
  const outlooks = snow?.status === 'ready' ? snow.byId : null;
  // Most snow first; a mountain with no forecast goes last, never guessed into the order.
  const sorted =
    order === 'snow' && outlooks
      ? [...byName].sort((a, b) => (forecastTotal(outlooks, b.id) ?? -1) - (forecastTotal(outlooks, a.id) ?? -1))
      : byName;
  const tallest = maxVertical(sorted);

  return (
    <ul
      className="mountainlist"
      aria-label={label ?? `${sorted.length} mountains, ${order === 'snow' && outlooks ? 'most snow coming first' : 'alphabetical'}`}
    >
      {sorted.map((mountain) => (
        <li key={mountain.id}>
          <button type="button" className="mountainlist-row" onClick={() => onSelectMountain(mountain.id)}>
            <span className="mountainlist-top">
              <span className="mountainlist-name">{mountain.name}</span>
              <span className="mountainlist-region">
                {mountain.region}, {mountain.state}
              </span>
              {scores && <ScoreBadge mountain={mountain} scores={scores} />}
            </span>
            {snow && (
              <SnowOutlook
                outlook={
                  snow.status === 'ready'
                    ? (snow.byId[mountain.id] ?? { status: 'unavailable', reason: 'No forecast.', provider: 'none' })
                    : snow.status === 'error'
                      ? { status: 'unavailable', reason: 'Forecast request failed.', provider: 'none' }
                      : undefined
                }
              />
            )}
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
