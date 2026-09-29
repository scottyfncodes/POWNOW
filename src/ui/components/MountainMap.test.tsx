import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MOUNTAINS } from '@/data/mountains';
import { findOrigin, gpsOrigin } from '@/data/origins';
import { MountainMap } from './MountainMap';

const user = () => userEvent.setup();
const origin = findOrigin('denver');

describe('MountainMap', () => {
  it('renders every supported mountain, each with its own accessible control', () => {
    render(
      <MountainMap
        mountains={MOUNTAINS}
        origin={origin}
        selectedMountainId={null}
        onSelectMountain={() => {}}
      />,
    );
    const group = screen.getByRole('group', { name: /mountains/i });
    for (const mountain of MOUNTAINS) {
      expect(
        within(group).getByRole('button', { name: new RegExp(`^${mountain.name}\\. Tap to view`, 'i') }),
      ).toBeInTheDocument();
    }
    expect(within(group).getAllByRole('button')).toHaveLength(MOUNTAINS.length);
  });

  it('renders exactly the mountains it is given — no second, hidden dataset', () => {
    const subset = MOUNTAINS.slice(0, 3);
    render(
      <MountainMap mountains={subset} origin={origin} selectedMountainId={null} onSelectMountain={() => {}} />,
    );
    const group = screen.getByRole('group', { name: /mountains/i });
    expect(within(group).getAllByRole('button')).toHaveLength(3);
  });

  it('calls onSelectMountain with the tapped mountain\'s id', async () => {
    const onSelectMountain = vi.fn();
    const keystone = MOUNTAINS.find((m) => m.id === 'keystone')!;
    render(
      <MountainMap
        mountains={MOUNTAINS}
        origin={origin}
        selectedMountainId={null}
        onSelectMountain={onSelectMountain}
      />,
    );
    await user().click(screen.getByRole('button', { name: new RegExp(`^${keystone.name}\\. Tap to view`, 'i') }));
    expect(onSelectMountain).toHaveBeenCalledWith('keystone');
  });

  it('marks the selected mountain distinctly from the rest', () => {
    const vail = MOUNTAINS.find((m) => m.id === 'vail')!;
    render(
      <MountainMap
        mountains={MOUNTAINS}
        origin={origin}
        selectedMountainId="vail"
        onSelectMountain={() => {}}
      />,
    );
    const selectedButton = screen.getByRole('button', { name: new RegExp(`^${vail.name} \\(selected\\)`, 'i') });
    expect(selectedButton).toHaveAttribute('aria-pressed', 'true');

    const other = MOUNTAINS.find((m) => m.id === 'breckenridge')!;
    const otherButton = screen.getByRole('button', { name: new RegExp(`^${other.name}\\. Tap to view`, 'i') });
    expect(otherButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('labels the live map region with the real mountain count and origin', () => {
    const { container } = render(
      <MountainMap
        mountains={MOUNTAINS}
        origin={origin}
        selectedMountainId={null}
        onSelectMountain={() => {}}
      />,
    );
    const labelled = container.querySelector('[aria-label*="Colorado mountains relative to Denver"]');
    expect(labelled).toBeInTheDocument();
    expect(labelled?.getAttribute('aria-label')).toContain(String(MOUNTAINS.length));
  });

  it('works the same way for a GPS origin as for a manual city', () => {
    render(
      <MountainMap
        mountains={MOUNTAINS}
        origin={gpsOrigin(39.7, -105.2)}
        selectedMountainId={null}
        onSelectMountain={() => {}}
      />,
    );
    expect(screen.getAllByText(/^you$/i).length).toBeGreaterThan(0);
  });

  it('draws no fabricated route line when nothing has resolved yet', () => {
    const { container } = render(
      <MountainMap
        mountains={MOUNTAINS}
        origin={origin}
        selectedMountainId="vail"
        onSelectMountain={() => {}}
        route="loading"
      />,
    );
    // A route line is the only thing Leaflet ever draws into its own overlay
    // pane here (markers are HTML div-icons, not vector shapes); its
    // color/weight come from Leaflet pathOptions rather than a CSS class
    // (see REAL_ROUTE_STYLE in MountainMap.tsx), so this checks for the
    // element itself instead of a class that was never on it.
    expect(container.querySelector('.leaflet-overlay-pane path')).not.toBeInTheDocument();
  });

  it('never labels a real route as approximate when the traffic proxy returned real geometry', () => {
    // jsdom can't lay out Leaflet's SVG renderer well enough to assert on the
    // drawn <path> itself (no real getBoundingClientRect) — the legend note
    // is driven by the exact same `routePoints` branch and is real DOM.
    render(
      <MountainMap
        mountains={MOUNTAINS}
        origin={origin}
        selectedMountainId="vail"
        onSelectMountain={() => {}}
        route={{
          durationMinutes: 100,
          distanceMiles: 100,
          trafficAware: true,
          routePoints: [
            { lat: 39.7392, lon: -104.9903 },
            { lat: 39.7, lon: -105.5 },
            { lat: 39.6403, lon: -106.3742 },
          ],
        }}
      />,
    );
    expect(screen.queryByText(/approximate direction, not the actual road/i)).not.toBeInTheDocument();
  });

  it('clearly marks the line as approximate — never a route dressed up as real — when there is no real geometry', () => {
    render(
      <MountainMap
        mountains={MOUNTAINS}
        origin={origin}
        selectedMountainId="vail"
        onSelectMountain={() => {}}
        route={{ durationMinutes: 100, distanceMiles: 100, trafficAware: false, routePoints: null }}
      />,
    );
    expect(screen.getByText(/approximate direction, not the actual road/i)).toBeInTheDocument();
  });
});
