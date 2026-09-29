import type { ReactNode } from 'react';
import type { Mountain } from '@/domain/mountain';
import type { MountainProfile, SeasonDate } from '@/domain/mountainProfile';

export interface MountainProfilePanelProps {
  mountain: Mountain;
  profile: MountainProfile | null;
}

/**
 * The deeper reference sheet for a mountain: official links, contact info,
 * and season dates. Deliberately not shown on the NOW card — this is where
 * that information belongs instead, reached from the map (see MapScreen).
 *
 * Every field here either shows a real value or an honest "not available"
 * state — never a guessed URL, an invented date, or a silently blank row.
 */
export function MountainProfilePanel({ mountain, profile }: MountainProfilePanelProps) {
  if (!profile) {
    return (
      <section className="panel profile-panel" aria-label={`${mountain.name} reference information`}>
        <p className="profile-unavailable">
          We don't have a researched profile for this mountain yet — not currently available.
        </p>
      </section>
    );
  }

  return (
    <section className="panel profile-panel" aria-label={`${mountain.name} reference information`}>
      <header className="panel-head">
        <span className="section-title">Reference &amp; links</span>
        <a className="profile-website" href={profile.officialWebsite} target="_blank" rel="noreferrer">
          Official site ↗
        </a>
      </header>

      <dl className="profile-grid">
        <ProfileRow label="Opening" value={<SeasonDateValue value={profile.openingDate} />} />
        <ProfileRow label="Closing" value={<SeasonDateValue value={profile.closingDate} />} />
        <ProfileRow label="Address" value={profile.address ?? 'Not currently available'} />
        <ProfileRow
          label="Phone"
          value={
            profile.phone ? (
              <a href={`tel:${profile.phone.replace(/[^\d+]/g, '')}`}>{profile.phone}</a>
            ) : (
              'Not currently available'
            )
          }
        />
      </dl>

      {/* Trail map has its own dedicated, prominent section elsewhere in the
          profile (see TrailMapPanel) — it isn't repeated in this reference list. */}
      <section className="profile-dining" aria-labelledby="profile-grub-heading">
        <h3 id="profile-grub-heading" className="eyebrow profile-dining-heading">
          Grub
        </h3>
        {profile.grub ? (
          <>
            {profile.grub.town && (
              <p className="profile-dining-note">
                There's little to no base-area dining here — most people eat in {profile.grub.town}.
              </p>
            )}
            {profile.grub.quickBreakfast && (
              <p className="profile-dining-note">
                <strong className="profile-dining-label profile-dining-label-bright">Best quick breakfast:</strong>{' '}
                {profile.grub.quickBreakfast.name} — {profile.grub.quickBreakfast.note}
              </p>
            )}
            <ul className="profile-dining-list">
              {profile.grub.picks.map((pick) => (
                <li key={pick.name}>
                  <strong>{pick.name}</strong> — {pick.note}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="profile-dining-note">We haven't researched restaurants for this mountain yet.</p>
        )}
      </section>

      <section className="profile-dining" aria-labelledby="profile-brews-heading">
        <h3 id="profile-brews-heading" className="eyebrow profile-dining-heading">
          Brews
        </h3>
        {profile.brews ? (
          <>
            <ul className="profile-dining-list">
              {profile.brews.picks.map((pick) => (
                <li key={pick.name}>
                  <strong>{pick.name}</strong> — {pick.note}
                </li>
              ))}
            </ul>
            {profile.brews.distilleries && profile.brews.distilleries.length > 0 && (
              <>
                <p className="profile-dining-note">
                  <strong className="profile-dining-label">Bonus — distilleries:</strong>
                </p>
                <ul className="profile-dining-list">
                  {profile.brews.distilleries.map((pick) => (
                    <li key={pick.name}>
                      <strong>{pick.name}</strong> — {pick.note}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : (
          <p className="profile-dining-note">We haven't researched breweries for this mountain yet.</p>
        )}
      </section>

      <ul className="profile-links">
        <ProfileLink label="Snow report" href={profile.snowReportUrl} />
        <ProfileLink label="Webcams" href={profile.webcamUrl} />
        <ProfileLink label="Lift tickets" href={profile.ticketUrl} />
        <ProfileLink label="Pass info" href={profile.passInfoUrl} />
      </ul>

      {profile.notes && (
        <p className="profile-note">
          <span className="eyebrow">Research notes</span> {profile.notes}
        </p>
      )}
    </section>
  );
}

function ProfileRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="profile-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ProfileLink({ label, href }: { label: string; href: string | null }) {
  return (
    <li className={href ? undefined : 'is-unavailable'}>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          {label} ↗
        </a>
      ) : (
        <span>
          {label} — <span className="faint">not currently available</span>
        </span>
      )}
    </li>
  );
}

function SeasonDateValue({ value }: { value: SeasonDate }) {
  if (!value.date) return <>Not yet announced</>;
  const formatted = new Date(`${value.date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return (
    <>
      {formatted}
      {value.status !== 'confirmed' && <span className="faint"> (projected)</span>}
    </>
  );
}
