import { PASS_LABELS } from '@/domain/mountain';
import type { SkiDayPlan } from '@/domain/plan';
import { SNOW_STATE_LABEL } from '@/engine/snowState';
import { formatPrice, savingsVsWindow } from '@/domain/pricing';
import { formatClock, formatDuration, formatWindowLabel } from '@/domain/time';
import { BasePeakConditions } from './BasePeakConditions';
import { ConfidencePill, DataBadge } from './DataBadge';
import { PlanActions } from './PlanActions';
import { ScoreDial } from './ScoreDial';
import { SnowpackPanel } from './SnowpackPanel';
import { SnowTimeline } from './SnowTimeline';

export interface RecommendationCardProps {
  plan: SkiDayPlan;
  /** One line on why this mountain beat the runner-up. */
  why?: string;
  /** A future day shows a projection rather than a call. */
  projected?: boolean;
  onCompare?: () => void;
  /** When the recommendation was computed, for the "updated N min ago" line. */
  generatedAt?: string;
  /** Present for today's plan: re-runs the recommendation. */
  onRefresh?: () => void;
  /** The current minute, so the age line ticks. */
  nowTick?: number;
}

/**
 * Says out loud what the badges only imply. LATER is a projection, and the
 * further out it reaches the more it is leaning on pattern rather than on any
 * particular model run — so the card says so in words, every time.
 */
function projectionNote(
  horizonDays: number,
  confidence: 'high' | 'medium' | 'low',
): string {
  const when =
    horizonDays <= 1
      ? 'tomorrow'
      : `${horizonDays} days out`;
  if (confidence === 'high') {
    return `A projection for ${when}, not a promise. Close enough in that the forecast is doing most of the work.`;
  }
  if (confidence === 'medium') {
    return `A projection for ${when}, not a promise. Expect the snow totals to move before then.`;
  }
  return `A projection for ${when}, not a promise. This far out we are leaning on pattern and history more than on any single forecast — treat it as a shortlist, not a plan.`;
}

/**
 * The answer, in the order a half-awake skier asks for it:
 *
 *   where · how good · when to leave · when you're on snow · when to bail · why
 *
 * Everything on this card earns its place by answering one of those. The
 * verdict outranks the decimal — a number is only decision support, and
 * "LET'S RIDE." is the actual output of the product.
 */
export function RecommendationCard({
  plan,
  why,
  projected = false,
  onCompare,
  generatedAt,
  onRefresh,
  nowTick,
}: RecommendationCardProps) {
  const { departure, snowClock } = plan;
  const ret = plan.return;
  const ticket = plan.ticket;
  const offSeason = plan.offSeasonMessage;
  const allSourcesUnavailable =
    plan.dataSources.length > 0 && plan.dataSources.every((source) => source.status === 'unavailable');

  return (
    <section className="reccard" aria-labelledby="reccard-name">
      <div className="reccard-top">
        <div className="reccard-identity">
          {projected && <p className="eyebrow">Projected</p>}
          <h1 id="reccard-name" className="reccard-name">
            {plan.mountain.shortName}
          </h1>
          {/* "BECK" needs no gloss; "WP" does. Only spell it out when the
              short name isn't already the mountain's name. */}
          {plan.mountain.name.toUpperCase() !== plan.mountain.shortName.toUpperCase() && (
            <p className="reccard-fullname">
              {plan.mountain.name} · {plan.mountain.region}
            </p>
          )}
          <p className="reccard-verdict" role={offSeason ? 'status' : undefined}>
            {offSeason ? offSeason.line : plan.verdict}
          </p>
        </div>
        {!offSeason && (
          <div className="reccard-scorewrap">
            <ScoreDial score={plan.score.score} label={`${plan.mountain.name} day score`} />
            <p className="reccard-scorelabel">Day score</p>
          </div>
        )}
      </div>

      <p className="reccard-headline">{offSeason ? offSeason.detail : plan.headline}</p>

      <div className="reccard-badges">
        <DataBadge provenance={plan.provenance} allSourcesUnavailable={allSourcesUnavailable} />
        {!offSeason && <ConfidencePill level={plan.score.confidence} />}
      </div>

      {projected && !offSeason && (
        <p className="reccard-projection">
          {projectionNote(plan.provenance.horizonDays, plan.score.confidence)}
        </p>
      )}

      <BasePeakConditions base={plan.baseConditions} peak={plan.peakConditions} />
      <SnowpackPanel
        snowpack={plan.snowpack}
        modelSnowDepthIn={plan.modelSnowDepthIn}
        demo={plan.provenance.source === 'demo'}
      />
      <SnowTimeline history={plan.snowHistory} />

      {offSeason ? null : departure && ret ? (
        <dl className="reccard-times">
          <div className="reccard-time">
            <dt>Leave {plan.origin.shortName}</dt>
            <dd className="numeral">{formatClock(departure.departure)}</dd>
            <p className="faint">{formatDuration(departure.driveMinutes)} drive</p>
          </div>
          <div className="reccard-time">
            <dt>Arrive</dt>
            <dd className="numeral">{formatClock(departure.arrival)}</dd>
            <p className="faint">First turn {formatClock(departure.firstTurn)}</p>
          </div>
          <div className={`reccard-time is-wide${plan.snowState === 'prime' ? ' is-prime' : ''}`}>
            <dt>{SNOW_STATE_LABEL[plan.snowState]}</dt>
            <dd className="numeral">
              {snowClock.prime ? formatWindowLabel(snowClock.prime.start, snowClock.prime.end) : '—'}
            </dd>
            <p className="faint">
              {departure.primeCaptured > 0
                ? `${formatDuration(departure.primeCaptured)} of the best window is yours`
                : 'You miss the best window at this departure'}
            </p>
          </div>
          <div className="reccard-time">
            <dt>Head home</dt>
            <dd className="numeral">{formatClock(ret.departure)}</dd>
            <p className="faint">{formatDuration(ret.mountainMinutes)} on the hill</p>
          </div>
          <div className="reccard-time">
            <dt>Home by</dt>
            <dd className="numeral">{formatClock(ret.homeArrival)}</dd>
            <p className="faint">{formatDuration(ret.driveMinutes)} back</p>
          </div>
        </dl>
      ) : (
        <p className="reccard-notiming">
          {plan.timingIssue === 'too-late' || plan.timingIssue === 'too-far'
            ? plan.timingNote
            : "We can't time this day — see the notes below."}
        </p>
      )}

      {!offSeason && plan.passCoverage && (
        <p className="reccard-ticket is-pass">
          <span className="reccard-ticket-label">Lift ticket</span>
          <span className="reccard-ticket-price">On your {PASS_LABELS[plan.passCoverage]}</span>
          <span className="reccard-ticket-note">No day ticket to buy.</span>
        </p>
      )}
      {!offSeason &&
        !plan.passCoverage &&
        (ticket ? (
          <p className="reccard-ticket">
            <span className="reccard-ticket-label">Lift ticket</span>
            <span className="reccard-ticket-price numeral">
              {formatPrice(ticket.adultDay, ticket.currency)}
            </span>
            <span className="reccard-ticket-note">
              {savingsVsWindow(ticket) > 8
                ? `${formatPrice(savingsVsWindow(ticket), ticket.currency)} under the window rate`
                : ticket.note}
            </span>
          </p>
        ) : (
          plan.ticketPurchaseUrl && (
            <p className="reccard-ticket">
              <span className="reccard-ticket-label">Lift ticket</span>
              <span className="reccard-ticket-note">
                Current price unavailable —{' '}
                <a href={plan.ticketPurchaseUrl} target="_blank" rel="noreferrer">
                  buy at the resort
                </a>
              </span>
            </p>
          )
        ))}

      <div className="reccard-why">
        <h2 className="eyebrow">Why {plan.mountain.shortName}</h2>
        {offSeason ? (
          <p className="reccard-whyline">
            Base, peak and the 5-day snow cycle above are live for this mountain — there's just not a normal
            ski day to call right now.
          </p>
        ) : (
          <>
            {why && <p className="reccard-whyline">{why}</p>}
            <ul className="reccard-reasons">
              {plan.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </>
        )}
        {onCompare && !offSeason && (
          <button type="button" className="linkbutton" onClick={onCompare}>
            Compare the alternatives ↓
          </button>
        )}
      </div>

      <PlanActions plan={plan} generatedAt={generatedAt} onRefresh={onRefresh} nowTick={nowTick} />
    </section>
  );
}
