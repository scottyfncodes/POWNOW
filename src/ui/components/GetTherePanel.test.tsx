import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { at } from '@/domain/time';
import { buildPlan } from '@/engine/plan';
import { testInputs, testTravel } from '@/test/fixtures';
import { GetTherePanel } from './GetTherePanel';

describe('GetTherePanel — when there is no departure, it says why', () => {
  it('late in the evening: too late for today, with the drive right now — not "route service unavailable"', () => {
    const tonight = testTravel({ direction: 'outbound', duration: () => 95, from: at(22, 12), to: at(22, 12) });
    render(<GetTherePanel plan={buildPlan(testInputs({ outbound: tonight }))} />);
    expect(screen.getByText(/too late to ski .* today/i)).toBeInTheDocument();
    expect(screen.queryByText(/route service unavailable/i)).not.toBeInTheDocument();
  });

  it('keeps "route service unavailable" for the case it describes: the route data is down', () => {
    render(<GetTherePanel plan={buildPlan(testInputs({ outbound: 'unavailable' }))} />);
    expect(screen.getByText(/route service unavailable/i)).toBeInTheDocument();
  });
});
