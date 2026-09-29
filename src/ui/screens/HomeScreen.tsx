import { resolveEnvironment } from '@/config/env';
import { MOUNTAINS } from '@/data/mountains';
import { Snowfall } from '@/ui/components/Snowfall';
import { Wordmark } from '@/ui/components/Wordmark';

export interface HomeScreenProps {
  onSnowNow: () => void;
  onMap: () => void;
  onList: () => void;
  usingDemoData: boolean;
}

/**
 * Three ways in, and the first one is the product.
 *
 * SNOW NOW is the decision path: say how you ride, get every mountain ranked
 * for your day, open the one you like. MAP and LIST are the browsing paths —
 * the same mountains by geography or by name, for someone who already knows
 * where they're looking. Nothing else earns a place above the fold, and no
 * chart appears before the user has asked a question.
 */
export function HomeScreen({ onSnowNow, onMap, onList, usingDemoData }: HomeScreenProps) {
  const environment = resolveEnvironment();
  // Only a separately hosted proxy naps; a same-origin one has nothing to warn about.
  const remoteProxy = environment.proxyConfigured && environment.trafficApiBaseUrl !== '';

  return (
    <main className="home">
      <Snowfall density={38} />
      <div className="home-inner shell">
        <header className="home-head">
          <h1>
            <Wordmark />
            <span className="visually-hidden">SNOWNOW</span>
          </h1>
          <p className="home-tagline">Find your best mountain day.</p>
        </header>

        <div className="home-actions">
          <button type="button" className="bigbutton bigbutton-now" onClick={onSnowNow}>
            <span className="bigbutton-word">SNOW NOW</span>
            <span className="bigbutton-sub">Tell us how you ride. We'll rank every mountain for your day.</span>
          </button>

          <div className="home-options">
            <button type="button" className="optionbutton" onClick={onMap}>
              <span className="optionbutton-word">Map</span>
              <span className="optionbutton-sub">Every mountain on a real map</span>
            </button>
            <button type="button" className="optionbutton" onClick={onList}>
              <span className="optionbutton-word">List</span>
              <span className="optionbutton-sub">All {MOUNTAINS.length} mountains, A to Z</span>
            </button>
          </div>
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
        </footer>
      </div>
    </main>
  );
}
