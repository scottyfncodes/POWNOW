import { useId } from 'react';
import type { SnowClock, SnowState } from '@/domain/plan';
import { clamp, formatClock, formatClockShort, type MinuteOfDay } from '@/domain/time';
import { linearScale, smoothPath } from './chart';

const WIDTH = 720;
const HEIGHT = 210;
const PAD = { top: 30, right: 14, bottom: 26, left: 14 };

export interface SnowClockChartProps {
  clock: SnowClock;
  /** Honest, absolute snow-quality state — only `'prime'` may draw the "PRIME SNOW" label. */
  snowState: SnowState;
  /** Where the rider actually clicks in. */
  firstTurn?: MinuteOfDay | null;
  /** When they head for the car. */
  leaveAt?: MinuteOfDay | null;
  /** "Right now" marker, only meaningful for today. */
  now?: MinuteOfDay | null;
}

/**
 * The Snow Clock: the whole day at a glance.
 *
 * Deliberately not a meteogram. One curve — how good is it, right then — with
 * the moments that matter marked on top of it.
 *
 * Two things earn their complexity here. The vertical scale is zoomed to the
 * day's own range, because a curve pinned in the top quarter of a 0-100 axis
 * shows a flat line on a day that actually has a peak and a decline. And the
 * prime window is drawn as a *lit* band rather than a grey one: an earlier
 * version used a pale grey overlay, which every reader interpreted as "this
 * part is disabled" — precisely backwards.
 */
export function SnowClockChart({ clock, snowState, firstTurn, leaveAt, now }: SnowClockChartProps) {
  const gradientId = useId();
  const primeId = useId();
  const points = clock.points;
  const isPrime = snowState === 'prime';
  if (points.length === 0) return null;

  const start = points[0]!.minute;
  const end = points[points.length - 1]!.minute + clock.stepMinutes;
  const openPoints = points.filter((point) => !point.closed);
  const lowest = Math.min(...(openPoints.length > 0 ? openPoints : points).map((p) => p.quality));

  // Zoom to the day, but never so far that a flat day looks dramatic: the
  // floor is capped so a genuinely mediocre day still sits low in the frame.
  const floor = clamp(Math.floor(lowest - 14), 0, 55);

  const x = linearScale([start, end], [PAD.left, WIDTH - PAD.right]);
  const y = linearScale([floor, 100], [HEIGHT - PAD.bottom, PAD.top]);

  const curve = points.map((point) => ({ x: x(point.minute), y: y(point.quality) }));
  const line = smoothPath(curve);
  const area = `${line} L${x(end)},${HEIGHT - PAD.bottom} L${x(start)},${HEIGHT - PAD.bottom} Z`;

  const prime = clock.prime;
  const hourMarks: MinuteOfDay[] = [];
  for (let minute = Math.ceil(start / 60) * 60; minute <= end; minute += 120) hourMarks.push(minute);

  const summary = prime
    ? `Ski quality through the day. ${isPrime ? 'Prime' : 'Best'} window ${formatClock(prime.start)} to ${formatClock(prime.end)}, peaking around ${formatClock(prime.peakMinute)}.`
    : 'Ski quality through the day.';

  return (
    <figure className="snowclock">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="snowclock-svg"
        role="img"
        aria-label={summary}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ice)" stopOpacity="0.26" />
            <stop offset="72%" stopColor="var(--ice)" stopOpacity="0.03" />
            <stop offset="100%" stopColor="var(--ice)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={primeId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ice)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--ice)" stopOpacity="0.015" />
          </linearGradient>
          <clipPath id={`${primeId}-clip`}>
            {prime && (
              <rect
                x={x(prime.start)}
                width={Math.max(2, x(prime.end) - x(prime.start))}
                y={0}
                height={HEIGHT}
              />
            )}
          </clipPath>
          <clipPath id={`${primeId}-open`}>
            <rect
              x={x(clock.open)}
              width={Math.max(0, WIDTH - PAD.right - x(clock.open))}
              y={0}
              height={HEIGHT}
            />
          </clipPath>
        </defs>

        {/*
         * Three passes over one curve rather than boxes drawn on top of it.
         * Boxes read as "this region is disabled"; a curve that gets brighter
         * where the skiing gets better reads as what it is.
         */}
        <path d={area} fill={`url(#${gradientId})`} clipPath={`url(#${primeId}-open)`} />
        <path d={line} className="snowclock-line is-closed" />
        <path d={line} className="snowclock-line" clipPath={`url(#${primeId}-open)`} />
        {prime && (
          <>
            <rect
              x={x(prime.start)}
              width={Math.max(2, x(prime.end) - x(prime.start))}
              y={PAD.top - 8}
              height={HEIGHT - PAD.bottom - PAD.top + 8}
              fill={`url(#${primeId})`}
              className="snowclock-prime"
            />
            <path
              d={line}
              className={`snowclock-line${isPrime ? ' is-prime' : ''}`}
              clipPath={`url(#${primeId}-clip)`}
            />
            <g className="snowclock-primelabel">
              <text x={(x(prime.start) + x(prime.end)) / 2} y={PAD.top - 14} textAnchor="middle">
                {isPrime ? 'PRIME SNOW' : 'BEST WINDOW'}
              </text>
            </g>
          </>
        )}

        <Marker x={x(clock.open)} label="LIFTS OPEN" />
        {firstTurn != null && Math.abs(firstTurn - clock.open) > 25 && (
          <Marker x={x(firstTurn)} label="YOU ARRIVE" accent />
        )}
        {leaveAt != null && leaveAt <= end && <Marker x={x(leaveAt)} label="YOU LEAVE" accent />}
        {now != null && now >= start && now <= end && <Marker x={x(now)} label="NOW" pulse />}

        {hourMarks.map((minute) => (
          <text key={minute} x={x(minute)} y={HEIGHT - 8} className="snowclock-tick" textAnchor="middle">
            {formatClockShort(minute)}
          </text>
        ))}
      </svg>

      <figcaption className="visually-hidden">
        <table>
          <caption>Projected ski quality by time of day, 0 to 100</caption>
          <tbody>
            {points
              .filter((_, index) => index % 4 === 0)
              .map((point) => (
                <tr key={point.minute}>
                  <th scope="row">{formatClock(point.minute)}</th>
                  <td>
                    {Math.round(point.quality)} — {point.label}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

/** Labels are nudged inboard near the edges so they never clip off the chart. */
function Marker({
  x,
  label,
  accent,
  pulse,
}: {
  x: number;
  label: string;
  accent?: boolean;
  pulse?: boolean;
}) {
  const className = ['snowclock-marker', accent && 'is-accent', pulse && 'is-now']
    .filter(Boolean)
    .join(' ');
  const margin = 46;
  const anchor = x < margin ? 'start' : x > WIDTH - margin ? 'end' : 'middle';
  const textX = anchor === 'start' ? x + 4 : anchor === 'end' ? x - 4 : x;
  return (
    <g className={className}>
      <line x1={x} x2={x} y1={PAD.top - 4} y2={HEIGHT - PAD.bottom} />
      <text x={textX} y={PAD.top - 2} textAnchor={anchor}>
        {label}
      </text>
    </g>
  );
}
