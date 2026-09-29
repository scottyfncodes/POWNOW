import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildPlan } from '@/engine/plan';
import type { TrailMap } from '@/domain/mountainProfile';
import { testInputs, testOperations, testParking, testWeather } from '@/test/fixtures';
import { MountainProfile } from './MountainProfile';

const TRAIL_MAP: TrailMap = {
  officialUrl: 'https://example.test/official-trail-map',
  source: 'official',
  imageUrl: 'https://example.test/trail-map.jpg',
  pdfUrl: null,
  season: '2025-26',
};

describe('MountainProfile — the map-to-decision hierarchy', () => {
  it('leads with the verdict, then conditions, parking, ticket, route, trail map and timing — in that order', () => {
    const plan = buildPlan(testInputs());
    render(<MountainProfile plan={plan} reference={null} />);

    const headings = screen.getAllByRole('heading').map((el) => el.textContent);
    const order = headings.filter((text) =>
      [
        plan.mountain.name,
        'Conditions',
        '🅿️ Parking',
        'Lift ticket',
        '🚗 Get there',
        '🗺️ Trail map',
        'The Snow Clock',
      ].some((label) => text?.includes(label)),
    );
    expect(order[0]).toContain(plan.mountain.name);
    expect(order.findIndex((t) => t?.includes('Conditions'))).toBeLessThan(
      order.findIndex((t) => t?.includes('Parking')),
    );
    expect(order.findIndex((t) => t?.includes('Parking'))).toBeLessThan(
      order.findIndex((t) => t?.includes('Lift ticket')),
    );
    expect(order.findIndex((t) => t?.includes('Lift ticket'))).toBeLessThan(
      order.findIndex((t) => t?.includes('Get there')),
    );
    expect(order.findIndex((t) => t?.includes('Get there'))).toBeLessThan(
      order.findIndex((t) => t?.includes('Trail map')),
    );
    expect(order.findIndex((t) => t?.includes('Trail map'))).toBeLessThan(
      order.findIndex((t) => t?.includes('Snow Clock')),
    );
  });

  it('shows the real official trail map when the mountain reference has one, prominently, not behind a generic link', () => {
    const plan = buildPlan(testInputs());
    render(
      <MountainProfile
        plan={plan}
        reference={{
          officialWebsite: 'https://example.test',
          snowReportUrl: null,
          webcamUrl: null,
          trailMap: TRAIL_MAP,
          ticketUrl: null,
          passInfoUrl: null,
          phone: null,
          address: null,
          openingDate: { date: null, status: 'tbd' },
          closingDate: { date: null, status: 'tbd' },
        }}
      />,
    );
    expect(screen.getByRole('img', { name: /trail map preview/i })).toHaveAttribute(
      'src',
      'https://example.test/trail-map.jpg',
    );
  });

  it('shows the honest trail-map-unavailable state when there is no researched mountain reference at all', () => {
    const plan = buildPlan(testInputs());
    render(<MountainProfile plan={plan} reference={null} />);
    expect(screen.getByText(/don't have researched trail-map information/i)).toBeInTheDocument();
  });

  it('uses the exact verdict the scoring engine produced — never a second, independent wording', () => {
    const plan = buildPlan(testInputs());
    render(<MountainProfile plan={plan} reference={null} />);
    expect(screen.getByText(plan.verdict)).toBeInTheDocument();
  });

  it('never says "PRIME SNOW" or "Best snow" unless the honest snow-quality state agrees — timing and snow quality stay independent', () => {
    // A day with mediocre conditions: the snow clock still names a *relative*
    // best window (it always does, for timing), but nothing here should let
    // that get relabelled as an absolute claim about snow quality.
    const plan = buildPlan(
      testInputs({
        weather: testWeather({ overnightSnowIn: 0, windMph: 28, temperatureF: 38 }),
      }),
    );
    render(<MountainProfile plan={plan} reference={null} />);

    if (plan.snowState !== 'prime') {
      expect(screen.queryByText('PRIME SNOW')).not.toBeInTheDocument();
      expect(screen.queryByText(/^Best snow/)).not.toBeInTheDocument();
    }
  });

  it('shows parking as a dedicated section, honestly unavailable rather than a fabricated status, when the feed has nothing', () => {
    const plan = buildPlan(testInputs({ parking: 'unavailable' }));
    render(<MountainProfile plan={plan} reference={null} />);
    expect(screen.getByText(/parking information unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/% occupied/i)).not.toBeInTheDocument();
  });

  it('shows real published parking rules, never a live occupancy percentage that does not exist', () => {
    const plan = buildPlan(
      testInputs({ parking: testParking({ notes: ['Free lot, no reservation.'], reservationRequired: 'not-required' }) }),
    );
    render(<MountainProfile plan={plan} reference={null} />);
    expect(screen.getByText('Free lot, no reservation.')).toBeInTheDocument();
    expect(screen.getByText(/no reservation needed/i)).toBeInTheDocument();
    expect(screen.queryByText(/\d+% occupied/)).not.toBeInTheDocument();
  });

  it('hides snow-clock and why-this-mountain timing sections off-season, but keeps conditions and parking visible', () => {
    const plan = buildPlan(testInputs({ operations: testOperations({ status: 'closed' }) }));
    render(<MountainProfile plan={plan} reference={null} />);
    expect(screen.queryByRole('heading', { name: /the snow clock/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /conditions/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /parking/i })).toBeInTheDocument();
  });
});
