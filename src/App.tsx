import { useEffect, useMemo } from 'react';
import { DEFAULT_PREFERENCES } from '@/config/weights';
import { resolveEnvironment } from '@/config/env';
import { warmUpTrafficService } from '@/lib/warmup';
import { createProviderRegistry } from '@/providers';
import type { ProviderRegistry } from '@/providers/types';
import { useClock } from '@/ui/hooks/useClock';
import { useOrigin } from '@/ui/hooks/useOrigin';
import { usePreferences } from '@/ui/hooks/usePreferences';
import { useScreen } from '@/ui/hooks/useScreen';
import { HomeScreen } from '@/ui/screens/HomeScreen';
import { LaterScreen } from '@/ui/screens/LaterScreen';
import { MapScreen } from '@/ui/screens/MapScreen';
import { NowScreen } from '@/ui/screens/NowScreen';

/**
 * SNOWNOW.
 *
 * The provider registry is created once and injected downward: the screens
 * know they are talking to *a* weather/traffic/mountain provider, never which
 * one. Swapping the demo bundle for live integrations happens on this line and
 * nowhere else.
 */
export interface AppProps {
  /** Injectable so tests (and, later, a live bundle) can supply their own providers. */
  registry?: ProviderRegistry;
}

export default function App({ registry: injected }: AppProps = {}) {
  const registry = useMemo(() => injected ?? createProviderRegistry(), [injected]);
  const clock = useClock();
  const [mode, setMode] = useScreen();
  const [origin, setOrigin] = useOrigin(DEFAULT_PREFERENCES.originId);
  const [settings, updateSettings, resetSettings] = usePreferences();

  // A separately hosted proxy on a free tier can be asleep; give its cold
  // start a head start against the user's dwell time on the homepage. A
  // same-origin proxy (serverless functions beside this page) wakes in
  // milliseconds and needs no ping. See lib/warmup.ts.
  useEffect(() => {
    const environment = resolveEnvironment();
    if (environment.proxyConfigured && environment.trafficApiBaseUrl) {
      warmUpTrafficService(environment.trafficApiBaseUrl);
    }
  }, []);

  const preferences = useMemo(
    () => ({ ...DEFAULT_PREFERENCES, ...settings, originId: origin.id }),
    [origin.id, settings],
  );

  if (mode === 'now') {
    return (
      <NowScreen
        registry={registry}
        clock={clock}
        origin={origin}
        preferences={preferences}
        onBack={() => setMode('home')}
      />
    );
  }

  if (mode === 'later') {
    return (
      <LaterScreen
        registry={registry}
        clock={clock}
        origin={origin}
        preferences={preferences}
        onBack={() => setMode('home')}
      />
    );
  }

  if (mode === 'map') {
    return <MapScreen registry={registry} clock={clock} origin={origin} onBack={() => setMode('home')} />;
  }

  return (
    <HomeScreen
      origin={origin}
      onOriginChange={setOrigin}
      settings={settings}
      onSettingsChange={updateSettings}
      onSettingsReset={resetSettings}
      onNow={() => setMode('now')}
      onLater={() => setMode('later')}
      onMap={() => setMode('map')}
      usingDemoData={registry.usingDemoData}
    />
  );
}
