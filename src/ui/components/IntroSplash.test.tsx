import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { INTRO_FADE_MS, INTRO_HOLD_MS, IntroSplash } from './IntroSplash';

describe('IntroSplash', () => {
  afterEach(() => vi.useRealTimers());

  it('holds the name and its promise for a beat, then fades away once', () => {
    vi.useFakeTimers();
    const { container } = render(<IntroSplash />);
    expect(screen.getByText('Find your best mountain day.')).toBeInTheDocument();
    expect(container.querySelector('.intro')).not.toHaveClass('is-leaving');
    act(() => vi.advanceTimersByTime(INTRO_HOLD_MS));
    expect(container.querySelector('.intro')).toHaveClass('is-leaving');
    act(() => vi.advanceTimersByTime(INTRO_FADE_MS));
    expect(container.querySelector('.intro')).toBeNull();
  });

  it('a tap skips the hold', () => {
    vi.useFakeTimers();
    const { container } = render(<IntroSplash />);
    fireEvent.click(container.querySelector('.intro')!);
    expect(container.querySelector('.intro')).toHaveClass('is-leaving');
    act(() => vi.advanceTimersByTime(INTRO_FADE_MS));
    expect(container.querySelector('.intro')).toBeNull();
  });
});
