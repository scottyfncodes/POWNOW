import type { DayScore } from '@/domain/plan';

/**
 * The score, taken apart. Anyone who wants to argue with the recommendation
 * should be able to see exactly which lever they disagree with.
 */
export function FactorBreakdown({ score }: { score: DayScore }) {
  const sorted = [...score.factors].sort((a, b) => b.weight - a.weight);

  return (
    <div className="factors">
      <ul className="factor-list">
        {sorted.map((factor) => (
          <li key={factor.key} className="factor">
            <div className="factor-head">
              <span className="factor-label">
                {factor.label}
                {factor.imputed && (
                  <span className="factor-imputed" title="No data: neutral assumption used">
                    assumed
                  </span>
                )}
              </span>
              <span className="factor-value numeral">{factor.value}</span>
            </div>
            <div
              className="factor-bar"
              role="meter"
              aria-valuenow={factor.value}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${factor.label}: ${factor.value} out of 100`}
            >
              <span
                className={`factor-fill${factor.value < 45 ? ' is-low' : factor.value > 78 ? ' is-high' : ''}`}
                style={{ width: `${factor.value}%` }}
              />
            </div>
            <p className="factor-note">{factor.note}</p>
          </li>
        ))}
      </ul>

      {score.penalties.length > 0 && (
        <ul className="penalty-list">
          {score.penalties.map((penalty) => (
            <li key={penalty.label} className="penalty">
              <span>{penalty.label}</span>
              <span className="numeral">−{(penalty.points / 10).toFixed(1)}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="factors-footnote">
        Weights are configuration, not gospel. The score is decision support. It is not a
        measurement of anything.
      </p>
    </div>
  );
}
