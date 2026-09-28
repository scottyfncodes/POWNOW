import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildPlan } from '@/engine/plan';
import { testInputs, testOperations, testSnowpack, testWeather } from '@/test/fixtures';
import { RecommendationCard } from './RecommendationCard';

describe('RecommendationCard — base/peak and snow timeline', () => {
  it('shows base and peak temperature and wind on the front page, with peak marked unavailable rather than copied from base', () => {
    const plan = buildPlan(
      testInputs({
        weather: testWeather({
          temperatureF: 22,
          windMph: 6,
          baseSnowDepthIn: 55,
          peakUnavailable: true,
        }),
      }),
    );
    render(<RecommendationCard plan={plan} />);

    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.getByText('Peak')).toBeInTheDocument();
    expect(screen.getByText('22°F')).toBeInTheDocument();
    // Peak is null on this fixture — it must read as unavailable, not a copy of base.
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('shows a model depth once, as an estimate at the forecast point, never attributed to base or peak', () => {
    const plan = buildPlan(testInputs({ weather: testWeather({ baseSnowDepthIn: 55 }) }));
    render(<RecommendationCard plan={plan} />);
    expect(screen.getByRole('group', { name: /modeled snow depth/i })).toBeInTheDocument();
    expect(screen.getByText('~55"')).toBeInTheDocument();
    expect(screen.getByText(/from the weather model/)).toBeInTheDocument();
    expect(screen.queryByText(/55" depth/)).not.toBeInTheDocument();
  });

  it('shows a measured SNOTEL reading with its station, elevation and distance, labeled MEASURED', () => {
    const plan = buildPlan(
      testInputs({
        weather: testWeather({ baseSnowDepthIn: 55 }),
        snowpack: testSnowpack({ stationName: 'Vail Mountain', stationElevationFt: 10300, distanceMiles: 4.2, snowDepthIn: 61 }),
        usingDemoData: false,
      }),
    );
    render(<RecommendationCard plan={plan} />);
    expect(screen.getByRole('group', { name: /measured snowpack/i })).toBeInTheDocument();
    expect(screen.getByText(/Vail Mountain SNOTEL · 10,300 ft · 4 mi away/)).toBeInTheDocument();
    expect(screen.getByText('61"')).toBeInTheDocument();
    // The station reading wins; the model number is not shown alongside it.
    expect(screen.queryByRole('group', { name: /modeled snow depth/i })).not.toBeInTheDocument();
  });

  it('renders the 5-day snow timeline with distinct observed and forecast totals', () => {
    const plan = buildPlan(
      testInputs({ weather: testWeather({ past5TotalIn: 14, future5TotalIn: 8 }) }),
    );
    render(<RecommendationCard plan={plan} />);

    expect(screen.getByText('14.0″')).toBeInTheDocument();
    expect(screen.getByText('8.0″')).toBeInTheDocument();
    expect(screen.getByText('OBSERVED')).toBeInTheDocument();
    expect(screen.getAllByText('FORECAST').length).toBeGreaterThan(0);
  });

  it('replaces the normal verdict and timing with an off-season message when the mountain is closed, shown exactly once', () => {
    const plan = buildPlan(testInputs({ operations: testOperations({ status: 'closed' }) }));
    render(<RecommendationCard plan={plan} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    // The line and detail each appear exactly once — no duplicate box repeating them lower on the card.
    expect(screen.getAllByText(plan.offSeasonMessage!.line).length).toBe(1);
    expect(screen.getAllByText(plan.offSeasonMessage!.detail).length).toBe(1);
    expect(screen.queryByText('Head home')).not.toBeInTheDocument();
    expect(screen.queryByText('Prime snow')).not.toBeInTheDocument();
    // Base/peak and the snow cycle are still shown — the point is an honest
    // "not today", not a blank screen.
    expect(screen.getByText('Base')).toBeInTheDocument();
  });
});
