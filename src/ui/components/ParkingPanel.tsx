import {
  PARKING_STATUS_LABEL,
  RESERVATION_LABEL,
  type ParkingInfo,
} from '@/domain/parking';
import type { Availability } from '@/domain/provenance';

export interface ParkingPanelProps {
  parking: Availability<ParkingInfo>;
}

/**
 * Parking, first-class: its own section, never folded into "other mountain
 * information." See `domain/parking.ts` for why `status` is honestly
 * `'unknown'` for every real resort today — no public live occupancy feed
 * exists for any of them — and why that is still worth a whole section: the
 * resort's own published rules (reservation requirements, free lots, shuttle
 * hours) are real, useful, and exactly what a skier needs before they drive
 * up not knowing if they'll get parked.
 */
export function ParkingPanel({ parking }: ParkingPanelProps) {
  // Nothing researched for this mountain: no section, rather than a section saying there's nothing.
  if (parking.status === 'unavailable') return null;

  const info = parking.data;
  const isLive = parking.provenance.source === 'live';

  return (
    <section className="panel parkingpanel" aria-labelledby="parking-heading">
      <header className="panel-head">
        <h2 id="parking-heading" className="section-title">
          Parking
        </h2>
        {/* No resort publishes live lot occupancy, so an "unknown" status gets no badge: the panel shows the rules it does have. */}
        {info.status !== 'unknown' && (
          <span className={`chip chip-parking-${info.status}`}>{PARKING_STATUS_LABEL[info.status]}</span>
        )}
      </header>

      {info.occupied != null && info.capacity != null && (
        <p className="parkingpanel-count numeral">
          {info.occupied.toLocaleString()} / {info.capacity.toLocaleString()} spaces
          <span className="faint"> · {Math.round((info.occupied / info.capacity) * 100)}% occupied</span>
        </p>
      )}

      <p className="parkingpanel-reservation">{RESERVATION_LABEL[info.reservationRequired]}</p>

      {info.notes.length > 0 && (
        <ul className="parkingpanel-notes">
          {info.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      <div className="parkingpanel-foot">
        {info.infoUrl && (
          <a href={info.infoUrl} target="_blank" rel="noreferrer">
            Parking details ↗
          </a>
        )}
        {info.contact && <span className="faint">{info.contact}</span>}
      </div>

      {!isLive && (
        <p className="faint parkingpanel-demo-note">
          Occupancy status simulated for demo mode. The rules above are real, researched facts.
        </p>
      )}
    </section>
  );
}
