import { resolveEnvironment } from '@/config/env';
import type { Origin } from '@/domain/mountain';
import { Snowfall } from '@/ui/components/Snowfall';
import { Wordmark } from '@/ui/components/Wordmark';
import { OriginPicker } from '@/ui/components/OriginPicker';
import { RiderSettingsPanel } from '@/ui/components/RiderSettings';
import type { RiderSettings } from '@/ui/hooks/usePreferences';

export interface HomeScreenProps {
  origin: Origin;
  onOriginChange: (origin: Origin) => void;
  settings: RiderSettings;
  onSettingsChange: (patch: Partial<RiderSettings>) => void;
  onSettingsReset: () => void;
  onNow: () => void;
  onLater: () => void;
  onMap: () => void;
  usingDemoData: boolean;
}

/**
 * Two choices. That's the whole homepage.
 *
 * NOW is decision mode — "I want to ski today". LATER is planning mode —
 * "what would my ski day look like on another date". Nothing else earns a
 * place above the fold, and no charts appear before the user has asked a
 * question.
 */
export function HomeScreen({
  origin,
  onOriginChange,
  settings,
  onSettingsChange,
  onSettingsReset,
  onNow,
  onLater,
  onMap,
  usingDemoData,
}: HomeScreenProps) {
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
          <button type="button" className="bigbutton bigbutton-now" onClick={onNow}>
            <span className="bigbutton-word">NOW</span>
            <span className="bigbutton-sub">I want to ski today.</span>
          </button>
          <button type="button" className="bigbutton bigbutton-later" onClick={onLater}>
            <span className="bigbutton-word">LATER</span>
            <span className="bigbutton-sub">What would my ski day look like on another date?</span>
          </button>
        </div>

        <button type="button" className="linkbutton home-map-link" onClick={onMap}>
          Explore the map ↓
        </button>

        <footer className="home-foot">
          <OriginPicker origin={origin} onChange={onOriginChange} />
          <RiderSettingsPanel settings={settings} onChange={onSettingsChange} onReset={onSettingsReset} />
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
