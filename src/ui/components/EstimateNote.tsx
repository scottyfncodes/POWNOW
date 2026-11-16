import type { Origin } from '@/domain/mountain';

export interface EstimateNoteProps {
  /** True when the scores shown were timed from one sampled drive each way. */
  estimated: boolean;
  /** The named city a GPS user's ranking was computed from, when it was. */
  rankedFrom?: Origin | null;
  className?: string;
}

/**
 * Says how precise a ranking is, wherever one is shown. The list, Today's pick,
 * the picks and the range are ranked on one Google drive each way per
 * mountain (a budget decision), so none of them may read with the precision of
 * a full traffic curve, and a GPS user is told the ranking is from a city, not
 * from where they stand.
 */
export function EstimateNote({ estimated, rankedFrom, className }: EstimateNoteProps) {
  if (!estimated && !rankedFrom) return null;
  return (
    <p className={`estimatenote${className ? ` ${className}` : ''}`}>
      {estimated && (
        <>
          <span className="chip chip-estimate">ESTIMATE</span>{' '}
          <span>Each drive is one Google sample each way, not a full traffic curve. Open a mountain for its full curve.</span>
        </>
      )}
      {rankedFrom && (
        <span>
          {estimated ? ' ' : ''}Ranked from {rankedFrom.name}, the nearest city we sample, not your exact location.
        </span>
      )}
    </p>
  );
}
