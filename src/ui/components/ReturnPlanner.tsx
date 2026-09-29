import type { ReturnOption, SkiDayPlan } from '@/domain/plan';
import { formatClock, formatDelta, type MinuteOfDay } from '@/domain/time';
import { stayOrGo, stayOrGoLadder } from '@/engine/plan';
import { TRAFFIC_GLYPH, TRAFFIC_WORD } from './chart';
import { TravelCurveChart } from './TravelCurveChart';

export interface ReturnPlannerProps {
  plan: SkiDayPlan;
  /** Present only for today: enables the live stay-or-go call. */
  now?: MinuteOfDay | null;
}

/**
 * The half of the ski day everyone forgets until they are sitting in it.
 *
 * A navigation app tells you how long the drive is. This tells you whether to
 * get in the car at all — including the cases where the right answer is to
 * stay, ski another lap, and let the road empty out.
 */
export function ReturnPlanner({ plan, now }: ReturnPlannerProps) {
  const recommended = plan.return;
  if (!recommended || plan.returnOptions.length < 2) return null;

  const ladder = stayOrGoLadder(plan);
  // The live call only makes sense while the day is actually happening.
  const withinDay =
    now != null && plan.isToday && now >= plan.snowClock.open && now <= plan.snowClock.close + 150;
  const advice = withinDay ? stayOrGo(plan, now) : null;

  return (
    <section className="panel" aria-labelledby="return-heading">
      <header className="panel-head">
        <h2 id="return-heading" className="section-title">
          When to head home
        </h2>
        <p className="panel-head-note">
          Sweet spot <strong>{formatClock(recommended.departure)}</strong>
        </p>
      </header>

      <p className="return-lead">{leadFor(plan)}</p>

      {advice && (
        <div className={`stayorgo is-${advice.verdict}`} role="status">
          <p className="stayorgo-head">{advice.headline}</p>
          <p className="stayorgo-detail">{advice.detail}</p>
          {advice.leaveNow && advice.leaveLater && (
            <p className="stayorgo-compare">
              Leave now → home {formatClock(advice.leaveNow.homeArrival)}. Leave{' '}
              {formatClock(advice.leaveLater.departure)} → home{' '}
              {formatClock(advice.leaveLater.homeArrival)}.
            </p>
          )}
        </div>
      )}

      <TravelCurveChart
        points={plan.returnOptions.map((option) => ({
          departure: option.departure,
          driveMinutes: option.driveMinutes,
        }))}
        markedMinute={recommended.departure}
        label={`Drive home to ${plan.origin.shortName} by the time you leave the mountain`}
      />

      <div className="ladder-scroll scroll-x">
      <table className="ladder">
        <caption className="visually-hidden">Stay or go: leaving later versus the sweet spot</caption>
        <thead>
          <tr>
            <th scope="col">Leave</th>
            <th scope="col">Home</th>
            <th scope="col">+Mountain</th>
            <th scope="col">+Drive</th>
            <th scope="col">Traffic</th>
          </tr>
        </thead>
        <tbody>
          {ladder.map((option) => (
            <tr key={option.departure} className={option.recommended ? 'is-recommended' : ''}>
              <th scope="row" className="numeral">
                {formatClock(option.departure)}
                {option.recommended && <span className="ladder-flag">best</span>}
              </th>
              <td className="numeral">{formatClock(option.homeArrival)}</td>
              <td className="numeral">
                {option.extraMountainMinutes === 0 ? '—' : formatDelta(option.extraMountainMinutes)}
              </td>
              <td className="numeral">
                {option.extraDriveMinutes === 0 ? '—' : formatDelta(option.extraDriveMinutes)}
              </td>
              <td>
                <span className={`traffic is-${option.trafficLight}`}>
                  <span aria-hidden="true">{TRAFFIC_GLYPH[option.trafficLight]}</span>{' '}
                  {TRAFFIC_WORD[option.trafficLight]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <p className="ladder-verdict">{returnVerdict(recommended, ladder)}</p>
    </section>
  );
}

/**
 * The return decision stated up front. Without this the panel opened on a
 * chart and a table and left the reader to work out what it was arguing — for
 * the half of the ski day most people never think about until they are sitting
 * in it, that is the wrong way round.
 */
function leadFor(plan: SkiDayPlan): string {
  const recommended = plan.return;
  if (!recommended) return '';
  const worst = plan.returnOptions.reduce((top, option) =>
    option.driveMinutes > top.driveMinutes ? option : top,
  );
  const cost = worst.driveMinutes - recommended.driveMinutes;
  const home = formatClock(recommended.homeArrival);

  if (cost <= 12) {
    return `Leave at ${formatClock(recommended.departure)} and you're home by ${home}. The road holds up all afternoon, so this is about the skiing, not the traffic.`;
  }
  return `Leave at ${formatClock(recommended.departure)} and you're home by ${home}. Leave in the thick of it around ${formatClock(worst.departure)} and the same drive takes ${formatDelta(cost)} longer.`;
}

function returnVerdict(recommended: ReturnOption, ladder: ReturnOption[]): string {
  const worst = ladder.reduce((top, option) =>
    option.extraDriveMinutes > top.extraDriveMinutes ? option : top,
  );
  if (worst.extraDriveMinutes <= 10) {
    return `The road stays reasonable all afternoon — ski until you're done. ${formatClock(recommended.departure)} is simply when the day stops paying you back.`;
  }
  return `Leave at ${formatClock(recommended.departure)} and you get most of the good skiing without getting swallowed by the afternoon. Hang on until ${formatClock(worst.departure)} and the same drive costs you ${formatDelta(worst.extraDriveMinutes)}.`;
}
