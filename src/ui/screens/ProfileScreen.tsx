import { type ReactNode, useMemo, useState } from 'react';
import { corridorFor } from '@/data/corridors';
import { findMountain } from '@/data/mountains';
import { mountainProfileFor } from '@/data/mountainProfiles';
import { resortSourceFor } from '@/data/resortSources';
import type { WeatherAlert } from '@/domain/alerts';
import type { MountainWeather, OperationsReport } from '@/domain/conditions';
import { PASS_LABELS, type Mountain, type Origin } from '@/domain/mountain';
import type { ParkingInfo } from '@/domain/parking';
import { formatPrice, type TicketPrice } from '@/domain/pricing';
import { type Availability, unavailable } from '@/domain/provenance';
import type { SnowpackObservation } from '@/domain/snowpack';
import { formatClock, formatDuration } from '@/domain/time';
import { makeContext } from '@/engine/inputs';
import { resolveAccessRoutes } from '@/engine/routing';
import type { ProviderRegistry } from '@/providers/types';
import { AlertBanner } from '@/ui/components/AlertBanner';
import { BasePeakConditions } from '@/ui/components/BasePeakConditions';
import { DataBadge } from '@/ui/components/DataBadge';
import { ElevationSilhouette } from '@/ui/components/ElevationSilhouette';
import { MountainProfilePanel } from '@/ui/components/MountainProfilePanel';
import { NavigateLinks } from '@/ui/components/NavigateLinks';
import { ParkingPanel } from '@/ui/components/ParkingPanel';
import { ScreenHeader } from '@/ui/components/ScreenHeader';
import { SnowpackPanel } from '@/ui/components/SnowpackPanel';
import { SnowTimeline } from '@/ui/components/SnowTimeline';
import { TrailMapPanel } from '@/ui/components/TrailMapPanel';
import type { ClockState } from '@/ui/hooks/useClock';
import { useAsync } from '@/ui/hooks/useRecommendation';
import { ShareSheet } from '@/ui/share/ShareSheet';
import type { ShareCardData } from '@/ui/share/shareCard';
import { ErrorScreen } from './ErrorScreen';

export interface ProfileScreenProps {
  mountainId: string;
  registry: ProviderRegistry;
  clock: ClockState;
  origin: Origin;
  onBack: () => void;
  /** Over to the engine's take on this mountain: verdict, score and when to leave. */
  onSeeCall: (mountainId: string) => void;
}

interface MountainFacts {
  weather: Availability<MountainWeather>;
  snowpack: Availability<SnowpackObservation>;
  operations: Availability<OperationsReport>;
  alerts: Availability<WeatherAlert[]>;
  parking: Availability<ParkingInfo>;
  ticket: Availability<TicketPrice>;
}

/** A thrown provider error becomes an honest empty state, same as the engine's own input boundary. */
const attempt = async <T,>(providerId: string, run: () => Promise<Availability<T>>): Promise<Availability<T>> => {
  try {
    return await run();
  } catch (error) {
    return unavailable<T>(providerId, error instanceof Error ? error.message : 'Provider request failed.');
  }
};

/**
 * A mountain on its own terms: what it is, what's on the ground today, how
 * to get there, where to park, what to eat — with no score, no verdict and no
 * ranking. The engine's call is one tap away ("Today's call"), never mixed
 * in, so browsing a mountain never means sitting through the algorithm.
 *
 * Reads straight from the providers — one parallel batch for this mountain,
 * not the whole-state ranking — and, like everywhere else, shows a real value
 * or says it's unavailable.
 */
export function ProfileScreen({ mountainId, registry, clock, origin, onBack, onSeeCall }: ProfileScreenProps) {
  const mountain = findMountain(mountainId) ?? null;

  const facts = useAsync<MountainFacts | null>(
    async () => {
      if (!mountain) return null;
      const context = makeContext(clock.today, clock.today, clock.now);
      const [weather, snowpack, operations, alerts, parking, ticket] = await Promise.all([
        attempt(registry.weather.id, () => registry.weather.getMountainWeather(mountain, context)),
        attempt(registry.snowpack.id, () => registry.snowpack.getSnowpack(mountain, context)),
        attempt(registry.mountain.id, () => registry.mountain.getOperations(mountain, context)),
        attempt(registry.alerts.id, () => registry.alerts.getAlerts(mountain, context)),
        attempt(registry.parking.id, () => registry.parking.getParkingInfo(mountain, context)),
        attempt(registry.pricing.id, () => registry.pricing.getTicketPrice(mountain, context)),
      ]);
      return { weather, snowpack, operations, alerts, parking, ticket };
    },
    // `clock.now` is read inside but deliberately not a dependency: the
    // profile must not re-fetch every minute the tab is open.
    [mountain?.id, clock.today, registry],
  );

  const [sharing, setSharing] = useState(false);
  const snowForCard = facts.status === 'ready' && facts.data?.weather.status === 'ok' ? facts.data.weather.data.snowHistory : null;
  const shareData = useMemo(
    (): ShareCardData | null =>
      mountain
        ? { mountain, snow: snowForCard, today: clock.today, usingDemoData: registry.usingDemoData, host: window.location.host }
        : null,
    [mountain, snowForCard, clock.today, registry.usingDemoData],
  );

  if (!mountain) {
    return <ErrorScreen message={`We don't know a mountain called "${mountainId}".`} onBack={onBack} />;
  }

  const reference = mountainProfileFor(mountain.id);
  const ready = facts.status === 'ready' && facts.data ? facts.data : null;

  return (
    <div className="screen profilescreen">
      <ScreenHeader onBack={onBack} title="PROFILE" />
      <div className="screen-body shell stack profilescreen-body">
        <ProfileHero
          mountain={mountain}
          officialSite={reference?.officialWebsite ?? null}
          onSeeCall={() => onSeeCall(mountain.id)}
          // The card is about the snow coming: wait for the forecast before offering it.
          onShare={facts.status === 'loading' || facts.status === 'idle' ? null : () => setSharing(true)}
        />

        <MountainStats mountain={mountain} />

        <section className="panel profilescreen-now" aria-labelledby="profile-now-heading" aria-busy={!ready}>
          <header className="panel-head">
            <h2 id="profile-now-heading" className="section-title">
              On the ground today
            </h2>
            {ready?.weather.status === 'ok' && <DataBadge provenance={ready.weather.provenance} />}
          </header>
          {ready ? <GroundToday facts={ready} /> : <NowSkeleton failed={facts.status === 'error'} onRetry={facts.reload} />}
        </section>

        <GettingThere mountain={mountain} origin={origin} />

        <TicketFacts mountain={mountain} ticket={ready?.ticket ?? null} />

        {ready && <ParkingPanel parking={ready.parking} />}

        <TrailMapPanel mountain={mountain} trailMap={reference?.trailMap ?? null} />

        <MountainProfilePanel mountain={mountain} profile={reference} />

        <button type="button" className="profilescreen-callout" onClick={() => onSeeCall(mountain.id)}>
          <span className="eyebrow">Want the engine's take?</span>
          <span className="profilescreen-callout-line">
            See today's call for {mountain.shortName} <span aria-hidden="true">→</span>
          </span>
          <span className="profilescreen-callout-note">Verdict, score, when to leave and when to head home.</span>
        </button>
      </div>
      {sharing && shareData && <ShareSheet data={shareData} onClose={() => setSharing(false)} />}
    </div>
  );
}

function ProfileHero({
  mountain,
  officialSite,
  onSeeCall,
  onShare,
}: {
  mountain: Mountain;
  officialSite: string | null;
  onSeeCall: () => void;
  /** Null while the forecast the card is built on is still loading. */
  onShare: (() => void) | null;
}) {
  return (
    <section className="profilehero" aria-labelledby="profilehero-name">
      <p className="eyebrow profilehero-region">
        {mountain.region} · {mountain.state}
      </p>
      <h1 id="profilehero-name" className="profilehero-name">
        {mountain.name}
      </h1>
      <p className="profilehero-character">{mountain.character}</p>
      <ul className="profilehero-passes" aria-label="Passes">
        {mountain.passAffiliations.map((pass) => (
          <li key={pass} className={`chip passchip passchip-${pass}`}>
            {PASS_LABELS[pass]}
          </li>
        ))}
      </ul>
      <ElevationSilhouette elevations={mountain.elevations} aboveTreelineShare={mountain.terrain.aboveTreelineShare} />
      <div className="profilehero-actions">
        <button type="button" className="button profilehero-call" onClick={onSeeCall}>
          Today's call →
        </button>
        {officialSite && (
          <a className="button button-quiet profilehero-site" href={officialSite} target="_blank" rel="noreferrer">
            Official site ↗
          </a>
        )}
        <button type="button" className="button button-quiet profilehero-share" onClick={onShare ?? undefined} disabled={!onShare}>
          Share
        </button>
      </div>
    </section>
  );
}

function MountainStats({ mountain }: { mountain: Mountain }) {
  const { terrain, lifts, operations, elevations } = mountain;
  const sameOpen = operations.weekdayOpen === operations.weekendOpen;
  return (
    <section className="panel profilestats" aria-labelledby="profilestats-heading">
      <h2 id="profilestats-heading" className="section-title">
        The mountain
      </h2>
      <dl className="profilestats-grid">
        <Stat label="Vertical" value={`${elevations.verticalFt.toLocaleString()}′`} />
        <Stat label="Acres" value={terrain.acres.toLocaleString()} />
        <Stat label="Trails" value={terrain.trails} />
        <Stat label="Lifts" value={lifts.total} note={`${lifts.highSpeed} high-speed`} />
        <Stat label="Above treeline" value={`${Math.round(terrain.aboveTreelineShare * 100)}%`} />
        <Stat label="Wind-prone lifts" value={lifts.windExposed} />
      </dl>
      <dl className="profilestats-hours">
        <div>
          <dt>{sameOpen ? 'First chair' : 'First chair · weekdays'}</dt>
          <dd className="numeral">{formatClock(operations.weekdayOpen)}</dd>
        </div>
        {!sameOpen && (
          <div>
            <dt>First chair · weekends</dt>
            <dd className="numeral">{formatClock(operations.weekendOpen)}</dd>
          </div>
        )}
        <div>
          <dt>Last chair</dt>
          <dd className="numeral">{formatClock(operations.lastChair)}</dd>
        </div>
      </dl>
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="profilestat">
      <dt>{label}</dt>
      <dd>
        <span className="profilestat-value numeral">{value}</span>
        {note && <span className="profilestat-note">{note}</span>}
      </dd>
    </div>
  );
}

function GroundToday({ facts }: { facts: MountainFacts }) {
  const weather = facts.weather.status === 'ok' ? facts.weather.data : null;
  const ops = facts.operations.status === 'ok' ? facts.operations.data : null;
  const snowpack = facts.snowpack.status === 'ok' ? facts.snowpack.data : null;
  const alerts = facts.alerts.status === 'ok' ? facts.alerts.data : [];
  const demo = facts.weather.status === 'ok' && facts.weather.provenance.source === 'demo';

  return (
    <div className="stack profilenow">
      <AlertBanner alerts={alerts} />

      {weather ? (
        <>
          <dl className="profilenow-snow">
            <div className={weather.overnightSnowIn >= 3 ? 'is-fresh' : undefined}>
              <dt>Overnight</dt>
              <dd className="numeral">{weather.overnightSnowIn.toFixed(1)}″</dd>
            </div>
            <div>
              <dt>Last 72 hours</dt>
              <dd className="numeral">{weather.recentSnow72hIn.toFixed(1)}″</dd>
            </div>
            <div>
              <dt>Since a refresh</dt>
              <dd className="numeral">
                {weather.daysSinceStorm === 0 ? 'Today' : `${weather.daysSinceStorm} day${weather.daysSinceStorm === 1 ? '' : 's'}`}
              </dd>
            </div>
          </dl>
          {weather.summary && <p className="profilenow-summary">{weather.summary}</p>}
          <BasePeakConditions base={weather.base} peak={weather.peak} />
        </>
      ) : (
        <p className="profilenow-unavailable">Weather unavailable for this mountain right now.</p>
      )}

      <SnowpackPanel snowpack={snowpack} modelSnowDepthIn={weather?.modelSnowDepthIn ?? null} demo={demo} />

      <SnowTimeline history={weather?.snowHistory ?? null} />

      {ops ? (
        <dl className="conditionspanel-ops">
          <div>
            <dt>Lifts</dt>
            <dd className="numeral">
              {ops.liftsOpen != null ? ops.liftsOpen : ops.liftsExpectedOpen} / {ops.liftsTotal}
            </dd>
          </div>
          <div>
            <dt>Terrain open</dt>
            <dd className="numeral">
              {ops.trailsOpen != null && ops.trailsTotal
                ? `${ops.trailsOpen} / ${ops.trailsTotal} trails`
                : `${Math.round(ops.terrainOpenShare * 100)}%`}
            </dd>
          </div>
          <div>
            <dt>Groomed</dt>
            <dd className="numeral">{Math.round(ops.groomedShare * 100)}%</dd>
          </div>
        </dl>
      ) : (
        <p className="profilenow-unavailable">Lift and terrain status unavailable.</p>
      )}
    </div>
  );
}

function NowSkeleton({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  if (failed) {
    return (
      <p className="profilenow-unavailable">
        Couldn't load today's conditions.{' '}
        <button type="button" className="linkbutton" onClick={onRetry}>
          Try again
        </button>
      </p>
    );
  }
  return (
    <div className="profilenow-skeleton" aria-label="Loading today's conditions">
      <span />
      <span />
      <span />
    </div>
  );
}

function GettingThere({ mountain, origin }: { mountain: Mountain; origin: Origin }) {
  const [route] = resolveAccessRoutes(mountain, origin);
  const from = origin.id === 'gps' ? 'your location' : origin.shortName;
  return (
    <section className="panel profileroute" aria-labelledby="profileroute-heading">
      <header className="panel-head">
        <h2 id="profileroute-heading" className="section-title">
          Getting there
        </h2>
        <span className="panel-head-note">from {from}</span>
      </header>
      {route ? (
        <>
          <p className="profileroute-label">{route.label}</p>
          <dl className="mapscreen-route-stats">
            <div>
              <dt>Distance</dt>
              <dd className="numeral">{Math.round(route.distanceMiles)} mi</dd>
            </div>
            <div>
              <dt>No traffic</dt>
              <dd className="numeral">{formatDuration(route.freeFlowMinutes)}</dd>
            </div>
            <div>
              <dt>Road</dt>
              <dd>{corridorFor(route.corridorId).shorthand}</dd>
            </div>
          </dl>
          <p className="profileroute-note">
            Drive time with no traffic and dry roads. Today's call times the real drive and tells you when to leave.
          </p>
        </>
      ) : (
        <p className="profilenow-unavailable">No route known from {from}.</p>
      )}
      <NavigateLinks destination={mountain.coordinates} destinationLabel={mountain.name} origin={origin.coordinates} />
    </section>
  );
}

function TicketFacts({ mountain, ticket }: { mountain: Mountain; ticket: Availability<TicketPrice> | null }) {
  const purchaseUrl = resortSourceFor(mountain.id).officialPurchaseUrl;
  const price = ticket?.status === 'ok' ? ticket.data : null;
  const passes = mountain.passAffiliations.filter((pass) => pass !== 'independent');
  return (
    <section className="panel ticketpanel" aria-labelledby="profileticket-heading">
      <h2 id="profileticket-heading" className="section-title">
        Lift tickets
      </h2>
      <p className="profileticket-passes">
        {passes.length > 0
          ? `Included on the ${passes.map((pass) => PASS_LABELS[pass]).join(' and ')}.`
          : 'Not on a multi-resort pass (independent).'}
      </p>
      {price ? (
        <p className="ticketpanel-price">
          <span className="ticketpanel-amount numeral">{formatPrice(price.adultDay, price.currency)}</span>
          <span className="ticketpanel-note">
            adult day today · window {formatPrice(price.windowRate, price.currency)}
          </span>
        </p>
      ) : null}
      {purchaseUrl && (
        <a className="profileticket-buy" href={purchaseUrl} target="_blank" rel="noreferrer">
          Buy at the resort ↗
        </a>
      )}
    </section>
  );
}
