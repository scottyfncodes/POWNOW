import { type CSSProperties, useEffect, useState } from 'react';
import { resolveEnvironment } from '@/config/env';
import { type DateKey, relativeDateLabel } from '@/domain/dates';
import type { Origin } from '@/domain/mountain';
import type { Recommendation, SkiDayPlan } from '@/domain/plan';
import { formatClock, formatDuration } from '@/domain/time';
import { SNOW_STATE_LABEL } from '@/engine/snowState';
import { DataCredits } from '@/ui/components/DataCredits';
import { ScoreDial } from '@/ui/components/ScoreDial';
import { Snowfall } from '@/ui/components/Snowfall';
import { shortTimingLabel } from '@/ui/components/timingLabel';
import { Wordmark } from '@/ui/components/Wordmark';
import type { ClockState } from '@/ui/hooks/useClock';
import type { AsyncState } from '@/ui/hooks/useRecommendation';

export interface HomeScreenProps {
  /** The one `recommend()` call the app owns — the home reads its winner. */
  state: AsyncState<Recommendation> & { reload: () => void };
  clock: ClockState;
  date: DateKey;
  origin: Origin;
  usingDemoData: boolean;
  /** SEE WHY: the pick's whole day on its own screen. */
  onOpenMountain: (mountainId: string) => void;
  /** All mountains: the map. */
  onBrowse: () => void;
}

/**
 * The answer, first. POW NOW's whole promise is one call — best mountain,
 * which day, why — so the home screen is that call: the pick, the verdict,
 * the three facts behind it (snow, lifts, the drive), and one button to see
 * the day it adds up to. The map is one tap over for everyone who wants to
 * browse instead. The wordmark is the header now, not the button.
 *
 * While the engine is working the same layout shows as a skeleton, so the
 * answer lands in place instead of jumping the page; when it fails, the
 * failure is one line under the hero, never a box in front of it. Where the
 * numbers come from lives behind a Sources button in the header.
 */
export function HomeScreen({ state, clock, date, origin, usingDemoData, onOpenMountain, onBrowse }: HomeScreenProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const environment = resolveEnvironment();
  // Only a separately hosted proxy naps; a same-origin one has nothing to warn about.
  const remoteProxy = environment.proxyConfigured && environment.trafficApiBaseUrl !== '';

  const best = state.status === 'ready' ? state.data.best : null;
  const loading = state.status === 'loading' || state.status === 'idle';
  const dayLabel = relativeDateLabel(date, clock.today);
  const from = origin.id === 'gps' ? 'your location' : origin.shortName;

  return (
    <main className="home">
      <Snowfall density={38} />
      <div className="home-inner shell">
        <header className="home-head">
          <div className="home-brand">
            <Wordmark />
            <p className="home-tagline">Find your best mountain day.</p>
          </div>
          <button type="button" className="home-sources" onClick={() => setSourcesOpen(true)} aria-haspopup="dialog">
            Sources
          </button>
        </header>

        <section className="home-hero" aria-busy={loading} aria-labelledby="home-pick">
          <p className="home-eyebrow">
            <span>
              {dayLabel} · from {from}
            </span>
            {usingDemoData && <span className="chip chip-demo">DEMO DATA</span>}
          </p>

          {best ? (
            <Pick plan={best} />
          ) : (
            <>
              <h1 id="home-pick" className={`home-pick${state.status === 'error' ? ' is-muted' : ''}`}>
                {state.status === 'error' ? 'NO CALL YET.' : <span className="home-skel home-skel-name" />}
              </h1>
              {loading && (
                <>
                  <div className="home-call">
                    <p className="home-verdict">
                      <span className="home-skel home-skel-verdict" />
                    </p>
                  </div>
                  <ul className="home-reasons" aria-hidden="true">
                    {['Snow', 'Lifts', 'Drive'].map((key) => (
                      <li key={key}>
                        <span className="home-reason-key">{key}</span>
                        <span className="home-skel home-skel-reason" />
                      </li>
                    ))}
                  </ul>
                  <p className="visually-hidden" role="status">
                    Checking the mountain, the snow and the roads
                  </p>
                </>
              )}
            </>
          )}

          {state.status === 'error' && (
            <p className="home-error" role="alert">
              {state.message}{' '}
              <button type="button" className="home-error-retry" onClick={state.reload}>
                Try again
              </button>
            </p>
          )}
        </section>

        <div className="home-actions">
          <button
            type="button"
            className="home-cta"
            disabled={!best}
            onClick={() => best && onOpenMountain(best.mountain.id)}
            aria-label={best ? `See why ${best.mountain.shortName} — the full day plan` : 'See why — waiting on the call'}
          >
            <span>SEE WHY</span>
            <span className="home-cta-go" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
          <button type="button" className="home-browse" onClick={onBrowse} aria-label="All mountains — open the map">
            All mountains
          </button>

          {usingDemoData ? (
            <p className="home-note">
              <strong>DEMO DATA</strong> — No live weather, traffic or lift feeds are connected. Every number in
              the app is simulated — and labelled as such.
            </p>
          ) : remoteProxy ? (
            <p className="home-note">
              First traffic check in a while? It can take up to 15 seconds to wake up — that's normal, not a
              bug. Give it a moment or check again if it says unavailable.
            </p>
          ) : null}
        </div>
      </div>

      {sourcesOpen && <SourcesSheet usingDemoData={usingDemoData} onClose={() => setSourcesOpen(false)} />}
    </main>
  );
}

/** The winner: name, verdict, score, and the three facts a skier asks for first. */
function Pick({ plan }: { plan: SkiDayPlan }) {
  const offSeason = plan.offSeasonMessage;
  // The name is sized to its longest word, so KEYSTONE or TELLURIDE never breaks mid-word on a phone.
  const longestWord = Math.max(...plan.mountain.shortName.split(/\s+/).map((word) => word.length));
  return (
    <>
      <h1 id="home-pick" className="home-pick" style={{ '--chars': longestWord } as CSSProperties}>
        {plan.mountain.shortName}
      </h1>
      <div className="home-call">
        <p className={`home-verdict${offSeason ? ' is-offseason' : ''}`}>{offSeason ? offSeason.line : plan.verdict}</p>
        {!offSeason && <ScoreDial score={plan.score.score} size="lg" label={`${plan.mountain.name} day score`} />}
      </div>
      {offSeason ? (
        <p className="home-offseason">{offSeason.detail}</p>
      ) : (
        <ul className="home-reasons" aria-label="Why">
          <li>
            <span className="home-reason-key">Snow</span>
            <span className="home-reason-val">{snowLine(plan)}</span>
          </li>
          <li>
            <span className="home-reason-key">Lifts</span>
            <span className="home-reason-val">{liftsLine(plan)}</span>
          </li>
          <li>
            <span className="home-reason-key">Drive</span>
            <span className="home-reason-val numeral">{driveLine(plan)}</span>
          </li>
        </ul>
      )}
    </>
  );
}

function snowLine(plan: SkiDayPlan): string {
  if (plan.freshSnowIn == null) return 'Weather feed down';
  if (plan.freshSnowIn > 0) return `${plan.freshSnowIn.toFixed(plan.freshSnowIn < 10 ? 1 : 0)}" overnight`;
  return SNOW_STATE_LABEL[plan.snowState];
}

function liftsLine(plan: SkiDayPlan): string {
  const ops = plan.operations;
  if (!ops) return 'Lift report silent';
  return `${ops.liftsExpectedOpen} of ${ops.liftsTotal} spinning · ${Math.round(ops.terrainOpenShare * 100)}% terrain open`;
}

function driveLine(plan: SkiDayPlan): string {
  if (!plan.departure) return shortTimingLabel(plan);
  const drive = `Leave ${formatClock(plan.departure.departure)} · ${formatDuration(plan.departure.driveMinutes)}`;
  return plan.routeLabel ? `${drive} via ${plan.routeLabel}` : drive;
}

/** Where the data comes from, as a sheet over the home — one tap away, never in front of the answer. */
function SourcesSheet({ usingDemoData, onClose }: { usingDemoData: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="home-sheet-backdrop" onClick={onClose}>
      <div
        className="home-sheet shell"
        role="dialog"
        aria-modal="true"
        aria-label="Where the data comes from"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="home-sheet-close" onClick={onClose} autoFocus>
          Close
        </button>
        <DataCredits usingDemoData={usingDemoData} />
      </div>
    </div>
  );
}
