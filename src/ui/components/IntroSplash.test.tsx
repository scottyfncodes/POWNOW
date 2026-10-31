import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { INTRO_FADE_MS, INTRO_FIRST_HOLD_MS, INTRO_HOLD_MS, INTRO_SEEN_STORAGE_KEY, IntroSplash } from './IntroSplash';

describe('IntroSplash', () => {
  afterEach(() => vi.useRealTimers());

  it('pauses longer the very first time, and remembers it was seen', () => {
    window.localStorage.removeItem(INTRO_SEEN_STORAGE_KEY);
    vi.useFakeTimers();
    const { container } = render(<IntroSplash />);
    act(() => vi.advanceTimersByTime(INTRO_HOLD_MS));
    expect(container.querySelector('.intro')).not.toHaveClass('is-leaving');
    act(() => vi.advanceTimersByTime(INTRO_FIRST_HOLD_MS - INTRO_HOLD_MS));
    expect(container.querySelector('.intro')).toHaveClass('is-leaving');
    expect(window.localStorage.getItem(INTRO_SEEN_STORAGE_KEY)).toBe('1');
  });

  it('on a return visit, holds the name and its promise for a beat, then fades away once', () => {
    window.localStorage.setItem(INTRO_SEEN_STORAGE_KEY, '1');
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
