import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MOUNTAINS } from '@/data/mountains';
import type { SnowHistory } from '@/domain/conditions';
import { ok, unavailable } from '@/domain/provenance';
import { loadSnowOutlooks } from '@/engine/snowOutlook';
import { makeContext } from '@/engine/inputs';
import { createDemoRegistry } from '@/providers/demo';
import { PROVENANCE } from '@/test/fixtures';
import { MountainList } from './MountainList';
import { SnowOutlook } from './SnowOutlook';

const history = (inches: number[]): SnowHistory => ({
  past: [],
  pastTotalIn: 0,
  future: inches.map((snowfallIn, i) => ({ date: `2026-11-0${i + 2}`, snowfallIn, kind: 'forecast' as const })),
  futureTotalIn: Math.round(inches.reduce((sum, n) => sum + n, 0) * 10) / 10,
});

describe('SnowOutlook', () => {
  it('shows the five-day total and says each day out loud', () => {
    render(<SnowOutlook outlook={ok(history([0, 2.5, 6, 0, 0]), PROVENANCE)} />);
    const strip = screen.getByRole('img');
    expect(strip).toHaveAccessibleName('Snow forecast, next 5 days: 8.5 inches. Mon 0.0 inches, Tue 2.5 inches, Wed 6.0 inches, Thu 0.0 inches, Fri 0.0 inches.');
    expect(strip.textContent).toContain('8.5″');
  });

  it('says None for a dry week rather than 0.0', () => {
    render(<SnowOutlook outlook={ok(history([0, 0, 0, 0, 0]), PROVENANCE)} />);
    expect(screen.getByRole('img').textContent).toContain('None');
  });

  it('says the forecast is unavailable instead of drawing zeros', () => {
    render(<SnowOutlook outlook={unavailable('open-meteo', 'down')} />);
    expect(screen.getByText('Forecast unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('MountainList with snow', () => {
  const three = MOUNTAINS.filter((m) => ['vail', 'copper', 'eldora'].includes(m.id));
  const byId = {
    vail: ok(history([1, 1, 0, 0, 0]), PROVENANCE),
    copper: ok(history([0, 5, 9, 0, 0]), PROVENANCE),
    eldora: unavailable<SnowHistory>('open-meteo', 'down'),
  };

  it('sorts by most snow coming, with no forecast last', () => {
    render(<MountainList mountains={three} onSelectMountain={() => {}} snow={{ status: 'ready', byId }} order="snow" />);
    const list = screen.getByRole('list', { name: /most snow coming first/ });
    const names = within(list).getAllByRole('button').map((row) => row.querySelector('.mountainlist-name')?.textContent);
    expect(names).toEqual(['Copper Mountain', 'Vail', 'Eldora Mountain Resort'].map((n) => three.find((m) => m.name.startsWith(n.split(' ')[0]!))!.name));
  });

  it('stays A to Z by default', () => {
    render(<MountainList mountains={three} onSelectMountain={() => {}} snow={{ status: 'ready', byId }} />);
    const names = screen.getAllByRole('button').map((row) => row.querySelector('.mountainlist-name')?.textContent ?? '');
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe('loadSnowOutlooks', () => {
  it('falls back to each mountain\'s own weather when the provider has no batch call', async () => {
    const registry = createDemoRegistry();
    const today = '2026-01-17';
    const context = makeContext(today, today, 6 * 60);
    const outlooks = await loadSnowOutlooks(registry, MOUNTAINS.slice(0, 3), context);
    for (const mountain of MOUNTAINS.slice(0, 3)) {
      const weather = await registry.weather.getMountainWeather(mountain, context);
      const entry = outlooks[mountain.id];
      expect(entry?.status).toBe('ok');
      if (entry?.status === 'ok' && weather.status === 'ok') expect(entry.data).toEqual(weather.data.snowHistory);
    }
  });
});
