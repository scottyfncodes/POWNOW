import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildPlan } from '@/engine/plan';
import { testInputs, testOperations } from '@/test/fixtures';
import { MountainCard } from './MountainCard';

describe('MountainCard — a plan\'s cover, and the button that opens it', () => {
  it('leads with the rank, the name and the verdict, and answers where, when, how long and how much', () => {
    const plan = buildPlan(testInputs());
    render(
      <ul>
        <MountainCard plan={plan} rank={1} why="Fresher snow and a shorter drive." onOpen={() => {}} />
      </ul>,
    );
    const card = screen.getByRole('button');
    expect(card.textContent).toMatch(/^BEST/);
    expect(card.textContent).toContain(plan.mountain.shortName);
    expect(card.textContent).toContain(plan.verdict);
    expect(card.textContent).toContain('Fresher snow and a shorter drive.');
    expect(screen.getByText('Leave')).toBeInTheDocument();
    expect(screen.getByText('On snow')).toBeInTheDocument();
    expect(screen.getByText('Ticket')).toBeInTheDocument();
    expect(screen.getByText(/full day plan/i)).toBeInTheDocument();
  });

  it('numbers every card after the winner and shows its trade-offs against the winner', () => {
    const plan = buildPlan(testInputs());
    plan.tradeoffs = [
      { text: 'Closer', better: true },
      { text: 'Less snow', better: false },
    ];
    render(
      <ul>
        <MountainCard plan={plan} rank={3} onOpen={() => {}} />
      </ul>,
    );
    expect(screen.getByText('#3')).toBeInTheDocument();
    expect(screen.getByText(/Closer/).className).toContain('is-better');
    expect(screen.getByText(/Less snow/).className).toContain('is-worse');
  });

  it('calls it a BEST BET, not a BEST, when the day is a projection', () => {
    const plan = buildPlan(testInputs());
    render(
      <ul>
        <MountainCard plan={plan} rank={1} projected onOpen={() => {}} />
      </ul>,
    );
    expect(screen.getByText('BEST BET')).toBeInTheDocument();
  });

  it('drops the score and the day stats for a closed mountain — nothing to time', () => {
    const plan = buildPlan(testInputs({ operations: testOperations({ status: 'closed' }) }));
    render(
      <ul>
        <MountainCard plan={plan} rank={2} onOpen={() => {}} />
      </ul>,
    );
    expect(plan.offSeasonMessage).not.toBeNull();
    expect(screen.queryByText('Leave')).not.toBeInTheDocument();
    expect(screen.queryByText(/out of 10/i)).not.toBeInTheDocument();
    expect(screen.getByText(/see the mountain/i)).toBeInTheDocument();
  });

  it('the whole card is the button', async () => {
    const onOpen = vi.fn();
    const plan = buildPlan(testInputs());
    render(
      <ul>
        <MountainCard plan={plan} rank={1} onOpen={onOpen} />
      </ul>,
    );
    await userEvent.setup().click(screen.getByText(plan.verdict));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
