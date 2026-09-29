import { PASS_LABELS } from '@/domain/mountain';
import type { SkiDayPlan } from '@/domain/plan';
import { formatPrice } from '@/domain/pricing';
import { formatClock, formatDuration } from '@/domain/time';
import { SNOW_STATE_LABEL } from '@/engine/snowState';
import { ScoreDial } from './ScoreDial';
import { shortTimingLabel } from './timingLabel';

export interface MountainCardProps {
  plan: SkiDayPlan;
  /** 1-based position in the ranking. */
  rank: number;
  /** Why this one beat the runner-up — only the winner carries it. */
  why?: string;
  /** A future day: the score is a projection, and the card says so. */
  projected?: boolean;
  onOpen: () => void;
}

/**
 * One mountain's day at a glance, in the order a half-awake skier asks:
 * where, how good, what the snow's doing, when to leave, what it costs.
 * Every number is the same one the full plan shows — this is the plan's
 * cover, not a second summary — and the whole card is the button that opens
 * it. The ranking already put the winner first; the card only says so.
 */
export function MountainCard({ plan, rank, why, projected = false, onOpen }: MountainCardProps) {
  const offSeason = plan.offSeasonMessage;
  const best = rank === 1;
  const showsFullName = plan.mountain.name.toUpperCase() !== plan.mountain.shortName.toUpperCase();

  return (
    <li className="mcard-item">
      <button
        type="button"
        className={`mcard${best ? ' is-best' : ''}${offSeason ? ' is-offseason' : ''}`}
        onClick={onOpen}
      >
        <span className="mcard-rank">{best ? (projected ? 'BEST BET' : 'BEST') : `#${rank}`}</span>

        <span className="mcard-head">
          <span className="mcard-names">
            <span className="mcard-name">{plan.mountain.shortName}</span>
            <span className="mcard-fullname">
              {showsFullName ? `${plan.mountain.name} · ` : ''}
              {plan.mountain.region}
            </span>
          </span>
          {!offSeason && (
            <span className="mcard-score">
              <ScoreDial score={plan.score.score} size="sm" label={`${plan.mountain.name} day score`} />
            </span>
          )}
        </span>

        <span className="mcard-verdict">{offSeason ? offSeason.line : plan.verdict}</span>
        {why && <span className="mcard-why">{why}</span>}

        {!offSeason && (
          <dl className="mcard-stats">
            <div>
              <dt>Snow</dt>
              <dd>
                {plan.freshSnowIn == null
                  ? 'Feed down'
                  : plan.freshSnowIn > 0
                    ? `${plan.freshSnowIn.toFixed(plan.freshSnowIn < 10 ? 1 : 0)}" overnight`
                    : SNOW_STATE_LABEL[plan.snowState]}
              </dd>
            </div>
            <div>
              <dt>Leave</dt>
              <dd className="numeral">
                {plan.departure
                  ? `${formatClock(plan.departure.departure)} · ${formatDuration(plan.departure.driveMinutes)}`
                  : shortTimingLabel(plan)}
              </dd>
            </div>
            <div>
              <dt>On snow</dt>
              <dd className="numeral">{plan.return ? formatDuration(plan.return.mountainMinutes) : '—'}</dd>
            </div>
            <div>
              <dt>Ticket</dt>
              <dd className="numeral">
                {plan.passCoverage
                  ? `On your ${PASS_LABELS[plan.passCoverage]}`
                  : plan.ticket
                    ? formatPrice(plan.ticket.adultDay, plan.ticket.currency)
                    : 'Unavailable'}
              </dd>
            </div>
          </dl>
        )}

        {!best && !offSeason && plan.tradeoffs.length > 0 && (
          <span className="mcard-tradeoffs">
            {plan.tradeoffs.map((tradeoff) => (
              <span key={tradeoff.text} className={`alt-tradeoff${tradeoff.better ? ' is-better' : ' is-worse'}`}>
                <span aria-hidden="true">{tradeoff.better ? '+' : '−'}</span> {tradeoff.text}
              </span>
            ))}
          </span>
        )}

        <span className="mcard-cta">{offSeason ? 'See the mountain' : 'Full day plan'} →</span>
      </button>
    </li>
  );
}
