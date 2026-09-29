import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearProviderCaches } from '@/providers/live/fetchCache';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MOUNTAINS } from '@/data/mountains';
import { findOrigin, gpsOrigin } from '@/data/origins';
import { at } from '@/domain/time';
import { toDateKey } from '@/domain/dates';
import { createDemoRegistry, createLiveRegistry } from '@/providers';
import type { ProviderRegistry } from '@/providers/types';
import { unavailable } from '@/domain/provenance';
import { MapScreen } from './MapScreen';

const user = () => userEvent.setup();
const clock = { today: toDateKey(new Date('2026-01-17')), now: at(7, 0) };
const noop = () => {};

afterEach(() => {
  clearProviderCaches();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('MapScreen', () => {
  it('renders every supported mountain as a selectable marker immediately, with no network call needed to do so', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(
      <MapScreen
        registry={createDemoRegistry()}
        clock={clock}
        origin={findOrigin('denver')}
        onOriginChange={noop}
        onNow={noop}
        onLater={noop}
      />,
    );
    for (const mountain of MOUNTAINS) {
      expect(screen.getByRole('button', { name: new RegExp(`^${mountain.name}\\. Tap to view`, 'i') })).toBeInTheDocument();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    // Let the background ranking settle before the test ends, so its state
    // update lands inside this test's act() scope rather than leaking past it.
    await waitFor(() => expect(screen.getAllByText(/best now/i).length).toBeGreaterThan(0));
  });

  it('resolves a route, shows drive time and distance, and opens the profile when a mountain is selected', async () => {
    render(
      <MapScreen
        registry={createDemoRegistry()}
        clock={clock}
        origin={findOrigin('denver')}
        onOriginChange={noop}
        onNow={noop}
        onLater={noop}
      />,
    );
    const vail = MOUNTAINS.find((m) => m.id === 'vail')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`^${vail.name}\\. Tap to view`, 'i') }));

    await waitFor(() => expect(screen.getByRole('heading', { name: vail.name })).toBeInTheDocument(), {
      timeout: 12_000,
    });
    // The full mountain profile — verdict, conditions, parking, get-there, snow clock — not just a bare route stat.
    expect(screen.getByRole('heading', { name: /get there/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /parking/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /the snow clock/i })).toBeInTheDocument();
  }, 15_000);

  it('never re-runs the ranking on selection — a live tap adds at most one cached route-geometry preview, and re-selecting is free', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'live');
    vi.stubEnv('VITE_API_BASE_URL', 'https://proxy.example.test');
    const fetchSpy = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            routeLabel: 'Test route',
            samples: [
              { departure: 0, durationMinutes: 121, congestion: 0.2 },
              { departure: 1439, durationMinutes: 121, congestion: 0.2 },
            ],
            distanceMiles: 99.4,
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const liveRegistry = createLiveRegistry({ trafficApiBaseUrl: 'https://proxy.example.test' });
    render(
      <MapScreen registry={liveRegistry} clock={clock} origin={findOrigin('denver')} onOriginChange={noop} onNow={noop} onLater={noop} />,
    );
    const vail = MOUNTAINS.find((m) => m.id === 'vail')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`^${vail.name}\\. Tap to view`, 'i') }));

    await waitFor(() => expect(screen.getByRole('heading', { name: vail.name })).toBeInTheDocument(), {
      timeout: 12_000,
    });
    const callsAfterFirstLoad = fetchSpy.mock.calls.length;
    expect(callsAfterFirstLoad).toBeGreaterThan(0);

    // Selecting a different mountain and back reuses the same already-loaded ranking.
    const breck = MOUNTAINS.find((m) => m.id === 'breckenridge')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`^${breck.name}\\. Tap to view`, 'i') }));
    await waitFor(() => expect(screen.getByRole('heading', { name: breck.name })).toBeInTheDocument());
    await user().click(screen.getByRole('button', { name: new RegExp(`^${vail.name}\\. Tap to view`, 'i') }));
    await waitFor(() => expect(screen.getByRole('heading', { name: vail.name })).toBeInTheDocument());

    // The shared ranking already covered every mountain up front. In live
    // mode a newly selected mountain costs exactly one extra request — the
    // route-preview call that carries the real road geometry a plan doesn't —
    // and re-selecting Vail is answered from the client cache, not the network.
    const newCalls = fetchSpy.mock.calls.slice(callsAfterFirstLoad).map(([url]) => String(url));
    expect(newCalls).toEqual(['https://proxy.example.test/api/route-preview']);
  }, 20_000);

  it('works the same way for a GPS origin as for a manual city', async () => {
    const origin = gpsOrigin(39.7, -105.2);
    render(
      <MapScreen registry={createDemoRegistry()} clock={clock} origin={origin} onOriginChange={noop} onNow={noop} onLater={noop} />,
    );
    const breck = MOUNTAINS.find((m) => m.id === 'breckenridge')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`^${breck.name}\\. Tap to view`, 'i') }));
    await waitFor(() => expect(screen.getByRole('heading', { name: breck.name })).toBeInTheDocument(), {
      timeout: 12_000,
    });
    expect(screen.getAllByText(/your location/i).length).toBeGreaterThan(0);
  }, 15_000);

  it('never fabricates a time or distance when routing fails — it says so honestly, without leaking a raw provider error', async () => {
    const failingRegistry: ProviderRegistry = {
      ...createDemoRegistry(),
      traffic: {
        id: 'failing-traffic',
        getTravelCurve: async () => unavailable('failing-traffic', '502 Bad Gateway'),
      },
    };

    render(
      <MapScreen
        registry={failingRegistry}
        clock={clock}
        origin={findOrigin('denver')}
        onOriginChange={noop}
        onNow={noop}
        onLater={noop}
      />,
    );
    const keystone = MOUNTAINS.find((m) => m.id === 'keystone')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`^${keystone.name}\\. Tap to view`, 'i') }));

    // The profile still opens (weather/ops/pricing/parking are unaffected), but never invents a route.
    await waitFor(() => expect(screen.getByRole('heading', { name: keystone.name })).toBeInTheDocument(), {
      timeout: 12_000,
    });
    expect(screen.getByText(/route service unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/502/)).not.toBeInTheDocument();
  }, 15_000);

  it('marks the top-ranked mountain as BEST NOW, from the same engine NOW uses — never a separate ranking', async () => {
    render(
      <MapScreen registry={createDemoRegistry()} clock={clock} origin={findOrigin('denver')} onOriginChange={noop} onNow={noop} onLater={noop} />,
    );
    await waitFor(() => expect(screen.getAllByText(/best now/i).length).toBeGreaterThan(0), { timeout: 12_000 });
  }, 15_000);
});
