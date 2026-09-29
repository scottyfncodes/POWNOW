import { afterEach, describe, expect, it, vi } from 'vitest';
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('MapScreen', () => {
  it('shows every supported mountain as a selectable marker', () => {
    render(
      <MapScreen registry={createDemoRegistry()} clock={clock} origin={findOrigin('denver')} onBack={() => {}} />,
    );
    for (const mountain of MOUNTAINS) {
      expect(screen.getByRole('button', { name: new RegExp(`^${mountain.name}\\. Tap to view`, 'i') })).toBeInTheDocument();
    }
  });

  it('resolves a route, shows drive time and distance, and opens the profile when a mountain is selected', async () => {
    render(
      <MapScreen registry={createDemoRegistry()} clock={clock} origin={findOrigin('denver')} onBack={() => {}} />,
    );
    const vail = MOUNTAINS.find((m) => m.id === 'vail')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`^${vail.name}\\. Tap to view`, 'i') }));

    await waitFor(() => expect(screen.getByText('Drive time')).toBeInTheDocument());
    expect(screen.getByText('Distance')).toBeInTheDocument();
    // Demo data is honestly labelled as a demo estimate, never claimed traffic-aware.
    expect(screen.getByText('Demo estimate')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: vail.name })).toBeInTheDocument();
    expect(screen.getByText('Official site ↗')).toBeInTheDocument();
  });

  it('in real live mode, resolves a route with exactly one network call — never the whole day-curve grid', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'live');
    vi.stubEnv('VITE_API_BASE_URL', 'https://proxy.example.test');
    const fetchSpy = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ durationMinutes: 121, distanceMiles: 99.4 }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const liveRegistry = createLiveRegistry({ trafficApiBaseUrl: 'https://proxy.example.test' });
    render(<MapScreen registry={liveRegistry} clock={clock} origin={findOrigin('denver')} onBack={() => {}} />);
    const vail = MOUNTAINS.find((m) => m.id === 'vail')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`^${vail.name}\\. Tap to view`, 'i') }));

    await waitFor(() => expect(screen.getByText('2h01')).toBeInTheDocument());
    expect(screen.getByText('99 mi')).toBeInTheDocument();
    expect(screen.getByText('Traffic-aware')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]![0]).toBe('https://proxy.example.test/api/route-preview');
  });

  it('works the same way for a GPS origin as for a manual city', async () => {
    const origin = gpsOrigin(39.7, -105.2);
    render(<MapScreen registry={createDemoRegistry()} clock={clock} origin={origin} onBack={() => {}} />);
    const breck = MOUNTAINS.find((m) => m.id === 'breckenridge')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`^${breck.name}\\. Tap to view`, 'i') }));
    await waitFor(() => expect(screen.getByText('Drive time')).toBeInTheDocument());
    expect(screen.getAllByText(/your location/i).length).toBeGreaterThan(0);
  });

  it('never fabricates a time or distance when routing fails — it says so honestly, without leaking a raw provider error', async () => {
    const failingRegistry: ProviderRegistry = {
      ...createDemoRegistry(),
      traffic: {
        id: 'failing-traffic',
        getTravelCurve: async () => unavailable('failing-traffic', '502 Bad Gateway'),
      },
    };

    render(<MapScreen registry={failingRegistry} clock={clock} origin={findOrigin('denver')} onBack={() => {}} />);
    const keystone = MOUNTAINS.find((m) => m.id === 'keystone')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`^${keystone.name}\\. Tap to view`, 'i') }));

    await waitFor(() => expect(screen.getByText(/Couldn't get a route/i)).toBeInTheDocument());
    // The failure is explained in plain language — never the raw provider
    // reason (which could be a bare HTTP status code like "502").
    expect(screen.queryByText(/502/)).not.toBeInTheDocument();
    expect(screen.queryByText('Drive time')).not.toBeInTheDocument();
  });
});
