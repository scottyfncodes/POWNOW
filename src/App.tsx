import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_PREFERENCES } from '@/config/weights';
import { resolveEnvironment } from '@/config/env';
import { MOUNTAINS } from '@/data/mountains';
import type { DateKey } from '@/domain/dates';
import { at } from '@/domain/time';
import { recommend } from '@/engine/plan';
import { warmUpTrafficService } from '@/lib/warmup';
import { createProviderRegistry } from '@/providers';
import type { ProviderRegistry } from '@/providers/types';
import { useClock } from '@/ui/hooks/useClock';
import { HomeContext } from '@/ui/hooks/useHome';
import { useOrigin } from '@/ui/hooks/useOrigin';
import { usePreferences } from '@/ui/hooks/usePreferences';
import { useAsync } from '@/ui/hooks/useRecommendation';
import { type Route, type Screen, useScreen } from '@/ui/hooks/useScreen';
import { HomeScreen } from '@/ui/screens/HomeScreen';
import { LaterScreen } from '@/ui/screens/LaterScreen';
import { ListScreen } from '@/ui/screens/ListScreen';
import { MapScreen } from '@/ui/screens/MapScreen';
import { MountainScreen } from '@/ui/screens/MountainScreen';
import { PicksScreen } from '@/ui/screens/PicksScreen';
import { ProfileScreen } from '@/ui/screens/ProfileScreen';
import { SetupScreen } from '@/ui/screens/SetupScreen';

/**
 * POW NOW.
 *
 * The provider registry is created once and injected downward: the screens
 * know they are talking to *a* weather/traffic/mountain provider, never which
 * one. Swapping the demo bundle for live integrations happens on this line and
 * nowhere else.
 *
 * Home is today's answer — the engine's pick, why, and SEE WHY — with All
 * mountains one tap over to the list; on every other screen the POW NOW logo
 * in the header goes there too. The list (primary) and the map are two
 * tabs of the same browse screen. Browsing opens a mountain's profile — its
 * facts, today's conditions and logistics, with no ranking — and from there
 * or from the browse bar the rider can ask for the engine's call:
 * YOUR RIDE → YOUR MOUNTAINS (ranked for your day), and every ranked path lands on
 * the same mountain screen. One `recommend()` call, owned here, feeds both
 * the ranked picks and every mountain screen, so opening a card costs no
 * second computation and a mountain never has two different days depending
 * on the door you came in. Each screen is a real history entry (`#/setup`,
 * `#/picks`, `#/mountain/vail`, `#/profile/vail`, `#/map`, `#/list`), so the phone's Back
 * gesture retraces the flow instead of leaving the app.
 */
export interface AppProps {
  /** Injectable so tests (and, later, a live bundle) can supply their own providers. */
  registry?: ProviderRegistry;
}

export default function App({ registry: injected }: AppProps = {}) {
  const registry = useMemo(() => injected ?? createProviderRegistry(), [injected]);
  const clock = useClock();
  const [route, navigate] = useScreen();
  const [origin, setOrigin] = useOrigin(DEFAULT_PREFERENCES.originId);
  const [settings, updateSettings, resetSettings] = usePreferences();
  const [chosenDate, setChosenDate] = useState<DateKey>(clock.today);
  // Where a mountain screen was opened from, so its back arrow returns there.
  const returnToRef = useRef<Route>({ screen: 'picks', mountainId: null });
  // Where a profile was opened from, likewise.
  const profileReturnRef = useRef<Route>({ screen: 'list', mountainId: null });
  // Which browse tab the rider came from, so Your ride's back arrow returns there.
  const browseRef = useRef<'map' | 'list'>('list');

  // A separately hosted proxy on a free tier can be asleep; give its cold
  // start a head start against the user's dwell time on the home screen. A
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

  // A day chosen yesterday and left in the tab is today's problem now.
  const date = chosenDate < clock.today ? clock.today : chosenDate;
  const isToday = date === clock.today;

  // Home leads with the answer, so it runs the same call the picks and the
  // mountain screens read — tapping SEE WHY costs no second ranking.
  const wantsPlans = route.screen === 'home' || route.screen === 'picks' || route.screen === 'mountain';
  const plans = useAsync(
    () =>
      recommend(registry, {
        mountains: MOUNTAINS,
        origin,
        date,
        today: clock.today,
        // A future day is planned from a normal morning, not from whatever
        // minute it happens to be right now.
        now: isToday ? clock.now : at(6, 0),
        preferences,
      }),
    // `clock.now` is read inside but deliberately not a dependency: the
    // ranking must not re-run every minute the tab is open.
    [origin.id, origin.coordinates.lat, origin.coordinates.lon, date, clock.today, preferences],
    // The home skeleton is already the waiting state; the "checking the
    // roads…" sequence only earns its floor on the picks screen.
    { enabled: wantsPlans, minimumMs: route.screen === 'home' ? 0 : 1900 },
  );

  const goBackTo = (target: Route) => navigate(target.screen, target.mountainId);

  // A mountain's profile and its day plan link to each other. When the one
  // being opened is exactly where the current screen came from, go back to it
  // instead of stacking a new entry — otherwise the two back arrows would
  // bounce between each other forever.
  const openMountain = (from: Screen) => (mountainId: string) => {
    const cameFrom = profileReturnRef.current;
    if (from === 'profile' && cameFrom.screen === 'mountain' && cameFrom.mountainId === mountainId) {
      goBackTo(cameFrom);
      return;
    }
    returnToRef.current = { screen: from, mountainId: route.mountainId };
    navigate('mountain', mountainId);
  };

  const openProfile = (from: Screen) => (mountainId: string) => {
    const cameFrom = returnToRef.current;
    if (from === 'mountain' && cameFrom.screen === 'profile' && cameFrom.mountainId === mountainId) {
      goBackTo(cameFrom);
      return;
    }
    profileReturnRef.current = { screen: from, mountainId: route.mountainId };
    navigate('profile', mountainId);
  };

  const rank = (from: 'map' | 'list') => () => {
    browseRef.current = from;
    navigate('setup');
  };

  return <HomeContext.Provider value={() => navigate('list')}>{renderScreen()}</HomeContext.Provider>;

  function renderScreen() {
    switch (route.screen) {
      case 'setup':
        return (
          <SetupScreen
            clock={clock}
            origin={origin}
            onOriginChange={setOrigin}
            settings={settings}
            onSettingsChange={updateSettings}
            onSettingsReset={resetSettings}
            date={date}
            onDateChange={setChosenDate}
            onBack={() => navigate(browseRef.current)}
            onShow={() => navigate('picks')}
            onCompareRange={() => navigate('later')}
          />
        );
      case 'picks':
        return (
          <PicksScreen
            state={plans}
            clock={clock}
            date={date}
            settings={settings}
            onBack={() => navigate('setup')}
            onEdit={() => navigate('setup')}
            onOpenMountain={openMountain('picks')}
          />
        );
      case 'mountain':
        return (
          <MountainScreen
            mountainId={route.mountainId ?? ''}
            state={plans}
            clock={clock}
            date={date}
            settings={settings}
            onBack={() => goBackTo(returnToRef.current)}
            onSelectMountain={(mountainId) => navigate('mountain', mountainId)}
            onOpenProfile={openProfile('mountain')}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            mountainId={route.mountainId ?? ''}
            registry={registry}
            clock={clock}
            origin={origin}
            onBack={() => goBackTo(profileReturnRef.current)}
            onSeeCall={openMountain('profile')}
          />
        );
      case 'list':
        return (
          <ListScreen
            onBack={() => navigate('home')}
            onOpenMountain={openProfile('list')}
            onShowMap={() => navigate('map')}
            onRank={rank('list')}
          />
        );
      case 'map':
        return (
          <MapScreen
            registry={registry}
            clock={clock}
            origin={origin}
            onOriginChange={setOrigin}
            preferences={preferences}
            onBack={() => navigate('home')}
            onOpenMountain={openMountain('map')}
            onOpenProfile={openProfile('map')}
            onShowList={() => navigate('list')}
            onRank={rank('map')}
          />
        );
      case 'later':
        return (
          <LaterScreen
            registry={registry}
            clock={clock}
            origin={origin}
            preferences={preferences}
            onBack={() => navigate('setup')}
          />
        );
      default:
        return (
          <HomeScreen
            state={plans}
            clock={clock}
            date={date}
            origin={origin}
            usingDemoData={registry.usingDemoData}
            onOpenMountain={openMountain('home')}
            onBrowse={() => navigate('list')}
          />
        );
    }
  }
}
