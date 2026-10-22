import type { TimelineEvent } from '@/domain/plan';
import { formatClock } from '@/domain/time';

/** The recommendation as a plan for the day, not a set of readings. */
export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section className="panel" aria-labelledby="timeline-heading">
      <header className="panel-head">
        <h2 id="timeline-heading" className="section-title">
          Your day
        </h2>
      </header>
      <ol className="timeline">
        {events.map((event, index) => (
          <li
            key={`${event.minute}-${index}`}
            className={`timeline-item${event.emphasis ? ' is-key' : ''}`}
          >
            <span className="timeline-time numeral">{formatClock(event.minute)}</span>
            <span className="timeline-marker" aria-hidden="true" />
            <span className="timeline-body">
              <span className="timeline-label">{event.label}</span>
              {event.detail && <span className="timeline-detail">{event.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
