import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ok, unavailable } from '@/domain/provenance';
import { testParking } from '@/test/fixtures';
import { ParkingPanel } from './ParkingPanel';

const PROVENANCE = {
  source: 'live' as const,
  observation: 'observed' as const,
  confidence: 'medium' as const,
  provider: 'test',
  horizonDays: 0,
};

describe('ParkingPanel', () => {
  it('says parking information is unavailable rather than showing a blank or fabricated section', () => {
    render(<ParkingPanel parking={unavailable('test', 'no data')} />);
    expect(screen.getByText(/parking information unavailable/i)).toBeInTheDocument();
  });

  it('never shows an occupancy count or percentage when none was provided', () => {
    render(<ParkingPanel parking={ok(testParking({ status: 'unknown', occupied: null, capacity: null }), PROVENANCE)} />);
    expect(screen.queryByText(/spaces/)).not.toBeInTheDocument();
    expect(screen.queryByText(/% occupied/)).not.toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('shows a real occupancy count only when the data actually carries one', () => {
    render(
      <ParkingPanel
        parking={ok(testParking({ status: 'limited', occupied: 1240, capacity: 2000 }), PROVENANCE)}
      />,
    );
    expect(screen.getByText(/1,240 \/ 2,000 spaces/)).toBeInTheDocument();
    expect(screen.getByText(/62% occupied/)).toBeInTheDocument();
    expect(screen.getByText('Limited')).toBeInTheDocument();
  });

  it('marks demo-sourced occupancy honestly, distinct from the real published rules', () => {
    const demoProvenance = { ...PROVENANCE, source: 'demo' as const };
    render(<ParkingPanel parking={ok(testParking({ status: 'good' }), demoProvenance)} />);
    expect(screen.getByText(/simulated for demo mode/i)).toBeInTheDocument();
  });
});
