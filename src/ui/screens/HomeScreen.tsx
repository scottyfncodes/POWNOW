import { resolveEnvironment } from '@/config/env';
import { DataCredits } from '@/ui/components/DataCredits';
import { Snowfall } from '@/ui/components/Snowfall';
import { Wordmark } from '@/ui/components/Wordmark';

export interface HomeScreenProps {
  /** The logo is the button: it opens the map. */
  onOpen: () => void;
  usingDemoData: boolean;
}

/**
 * The logo, and nothing else to decide. The logo is drawn as a button — a
 * lit card with a go arrow — so nobody needs telling to tap it. Tapping
 * POW NOW opens the map, where
 * every mountain is a tap away, the list is one tab over, and the ranking
 * for your day is one button more.
 */
export function HomeScreen({ onOpen, usingDemoData }: HomeScreenProps) {
  const environment = resolveEnvironment();
  // Only a separately hosted proxy naps; a same-origin one has nothing to warn about.
  const remoteProxy = environment.proxyConfigured && environment.trafficApiBaseUrl !== '';

  return (
    <main className="home">
      <Snowfall density={38} />
      <div className="home-inner shell">
        <div className="home-center">
          <h1 className="home-logo-heading">
            <button type="button" className="home-logo" onClick={onOpen} aria-label="POW NOW — open the map">
              <Wordmark />
              <span className="home-logo-go" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          </h1>
          <p className="home-tagline">Find your best mountain day.</p>
        </div>

        <footer className="home-foot">
          {usingDemoData ? (
            <p className="home-demo">
              <span className="chip chip-demo">DEMO DATA</span>
              <span>
                No live weather, traffic or lift feeds are connected. Every number in the app is
                simulated — and labelled as such.
              </span>
            </p>
          ) : remoteProxy ? (
            <p className="home-note">
              First traffic check in a while? It can take up to 15 seconds to wake up — that's
              normal, not a bug. Give it a moment or check again if it says unavailable.
            </p>
          ) : null}
          <DataCredits usingDemoData={usingDemoData} />
        </footer>
      </div>
    </main>
  );
}
