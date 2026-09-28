import { useId } from 'react';
import { formatClockShort, formatDuration, type MinuteOfDay } from '@/domain/time';
import { linearScale, smoothPath } from './chart';

const WIDTH = 720;
const HEIGHT = 150;
const PAD = { top: 14, right: 12, bottom: 24, left: 12 };

export interface TravelPoint {
  departure: MinuteOfDay;
  driveMinutes: number;
}

export interface TravelCurveChartProps {
  points: TravelPoint[];
  markedMinute?: MinuteOfDay | null;
  label: string;
}

/**
 * Drive time as a function of when you leave. This is the picture that makes
 * the whole product make sense: the curve has valleys, and you are allowed to
 * aim for one.
 */
export function TravelCurveChart({ points, markedMinute, label }: TravelCurveChartProps) {
  const gradientId = useId();
  if (points.length < 2) return null;

  const minutes = points.map((point) => point.departure);
  const durations = points.map((point) => point.driveMinutes);
  const x = linearScale([Math.min(...minutes), Math.max(...minutes)], [PAD.left, WIDTH - PAD.right]);
  const y = linearScale(
    [Math.min(...durations) * 0.94, Math.max(...durations) * 1.03],
    [HEIGHT - PAD.bottom, PAD.top],
  );

  const curve = points.map((point) => ({ x: x(point.departure), y: y(point.driveMinutes) }));
  const line = smoothPath(curve);
  const area = `${line} L${x(minutes[minutes.length - 1]!)},${HEIGHT - PAD.bottom} L${x(minutes[0]!)},${HEIGHT - PAD.bottom} Z`;

  const best = points.reduce((low, point) => (point.driveMinutes < low.driveMinutes ? point : low));
  const marked = markedMinute != null ? points.reduce(
    (closest, point) =>
      Math.abs(point.departure - markedMinute) < Math.abs(closest.departure - markedMinute)
        ? point
        : closest,
    points[0]!,
  ) : null;

  const ticks: MinuteOfDay[] = [];
  const first = Math.ceil(Math.min(...minutes) / 60) * 60;
  for (let minute = first; minute <= Math.max(...minutes); minute += 120) ticks.push(minute);

  return (
    <figure className="travelchart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${label}. Quickest around ${formatClockShort(best.departure)} at ${formatDuration(best.driveMinutes)}.`}
        preserveAspectRatio="none"
        className="travelchart-svg"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--wait)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--wait)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} className="travelchart-line" />

        {marked && (
          <g className="travelchart-marker">
            <line
              x1={x(marked.departure)}
              x2={x(marked.departure)}
              y1={PAD.top - 4}
              y2={HEIGHT - PAD.bottom}
            />
            <circle cx={x(marked.departure)} cy={y(marked.driveMinutes)} r="5" />
          </g>
        )}

        {ticks.map((minute) => (
          <text key={minute} x={x(minute)} y={HEIGHT - 7} textAnchor="middle" className="travelchart-tick">
            {formatClockShort(minute)}
          </text>
        ))}
      </svg>
      <figcaption className="visually-hidden">
        <table>
          <caption>{label}</caption>
          <tbody>
            {points
              .filter((_, index) => index % 6 === 0)
              .map((point) => (
                <tr key={point.departure}>
                  <th scope="row">{formatClockShort(point.departure)}</th>
                  <td>{formatDuration(point.driveMinutes)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
