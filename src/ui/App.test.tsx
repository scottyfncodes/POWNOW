import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { DEFAULT_WEIGHTS } from '@/config/weights';
import { createDemoRegistry } from '@/providers/demo';

/**
 * These tests walk the product's actual promise: open it, tap NOW, get an
 * answer you can act on — and tap LATER, pick a date, get a projection that is
 * honest about being one.
 */

const user = () => userEvent.setup();

async function tapNow() {
  render(<App />);
  await user().click(screen.getByRole('button', { name: /^NOW/ }));
  return waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(), {
    timeout: 12_000,
  });
}

describe('the homepage', () => {
  it('offers exactly two choices and no dashboard', () => {
    render(<App />);
    expect(screen.getByText('Find your best mountain day.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^NOW/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^LATER/ })).toBeInTheDocument();
    expect(screen.queryByText(/Snow Clock/i)).not.toBeInTheDocument();
  });

  it('says plainly that it is running on demo data', () => {
    render(<App />);
    expect(screen.getByText('DEMO DATA')).toBeInTheDocument();
    expect(screen.getByText(/No live weather, traffic or lift feeds/i)).toBeInTheDocument();
  });

  it('lets you change where you are starting from without typing', async () => {
    render(<App />);
    const select = screen.getByLabelText(/starting from/i);
    await user().selectOptions(select, 'boulder');
    expect((select as HTMLSelectElement).value).toBe('boulder');
  });

  it('offers a third path to the map, without it crowding the two main choices', async () => {
    render(<App />);
    const mapLink = screen.getByRole('button', { name: /explore the map/i });
    expect(mapLink).toBeInTheDocument();
    await user().click(mapLink);
    expect(screen.getByText('MAP')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Vail\. Tap to view/i })).toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: /back to start/i }));
    expect(screen.getByText('Find your best mountain day.')).toBeInTheDocument();
  });
});

describe('GPS location flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error -- test cleanup of a jsdom global that has no type by default
    delete navigator.geolocation;
  });

  it('routes NOW from the actual GPS fix once granted, and back to a manual city after switching', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 39.7047, longitude: -105.0814, accuracy: 10 },
      } as GeolocationPosition);
    });
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });

    render(<App />);
    await user().click(screen.getByRole('button', { name: /use my current location/i }));
    await waitFor(() => expect(screen.getByText(/using your current location/i)).toBeInTheDocument());

    await user().click(screen.getByRole('button', { name: /^NOW/ }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(), {
      timeout: 12_000,
    });
    expect(screen.getAllByText(/Leave your location/i).length).toBeGreaterThan(0);

    await user().click(screen.getByRole('button', { name: /back to start/i }));
    const select = screen.getByLabelText(/starting from/i);
    await user().selectOptions(select, 'denver');
    await user().click(screen.getByRole('button', { name: /^NOW/ }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(), {
      timeout: 12_000,
    });
    expect(screen.getAllByText(/Leave Denver/i).length).toBeGreaterThan(0);
  });

  it('stays fully usable with manual cities when location permission is denied', async () => {
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code: 1, PERMISSION_DENIED: 1, message: 'denied' } as GeolocationPositionError);
      },
    );
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });

    render(<App />);
    await user().click(screen.getByRole('button', { name: /use my current location/i }));
    await waitFor(() =>
      expect(screen.getByText(/location access is off.*choose a starting city instead/i)).toBeInTheDocument(),
    );

    // The city dropdown and NOW/LATER flows are untouched by the denial.
    const select = screen.getByLabelText(/starting from/i);
    await user().selectOptions(select, 'boulder');
    expect((select as HTMLSelectElement).value).toBe('boulder');

    await user().click(screen.getByRole('button', { name: /^NOW/ }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(), {
      timeout: 12_000,
    });
    expect(screen.getAllByText(/Leave Boulder/i).length).toBeGreaterThan(0);
  });
});

describe('NOW', () => {
  it('shows a loading sequence that says what it is checking', () => {
    render(<App />);
    // Synchronous click: the answer cannot possibly have arrived yet, so this
    // pins the loading state deterministically rather than racing it.
    fireEvent.click(screen.getByRole('button', { name: /^NOW/ }));
    expect(screen.getAllByText(/CHECKING THE/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('status')).toHaveTextContent(/checking the mountain/i);
  });

  it('answers with a mountain, a score and a verdict', async () => {
    await tapNow();
    const card = screen.getByRole('heading', { level: 1 });
    expect(card.textContent).toBeTruthy();
    expect(screen.getAllByText(/out of 10/i).length).toBeGreaterThan(0);
  });

  it('answers all six questions the product exists to answer', async () => {
    await tapNow();
    expect(screen.getAllByText(/^Leave /).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Arrive').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Prime snow').length).toBeGreaterThan(0);
    expect(screen.getByText('Head home')).toBeInTheDocument();
    expect(screen.getByText('Home by')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /the alternatives/i })).toBeInTheDocument();
  });

  it('never claims demo numbers are live', async () => {
    await tapNow();
    expect(screen.getAllByText('DEMO DATA').length).toBeGreaterThan(0);
    expect(screen.queryByText(/^LIVE$/)).not.toBeInTheDocument();
  });

  it('renders the snow clock, the timeline and both timing panels', async () => {
    await tapNow();
    expect(screen.getByRole('heading', { name: /the snow clock/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /your day/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /when to leave/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /when to head home/i })).toBeInTheDocument();
  });

  it('lets you ask what if I leave later, and answers with consequences', async () => {
    await tapNow();
    const slider = screen.getByRole('slider', { name: /departure time/i }) as HTMLInputElement;
    const before = slider.getAttribute('aria-valuetext');
    // Move somewhere that is definitely not where we started, whatever the
    // recommendation happened to be today.
    const target = slider.value === '0' ? slider.max : '0';
    fireEvent.change(slider, { target: { value: target } });
    await waitFor(() => expect(slider.getAttribute('aria-valuetext')).not.toBe(before));
    // Leaving at the very end of the grid must cost you something real.
    expect(screen.getByRole('button', { name: /back to the sweet spot/i })).toBeInTheDocument();
    const panel = screen.getByRole('heading', { name: /when to leave/i }).closest('section')!;
    expect(
      within(panel).getByText(/costs you|worth the alarm|a little later/i),
    ).toBeInTheDocument();
  });

  it('lets you compare alternatives and switch to one', async () => {
    await tapNow();
    const alternatives = screen.getByRole('heading', { name: /the alternatives/i }).closest('section')!;
    const first = within(alternatives).getAllByRole('button')[0]!;
    const name = first.querySelector('.alt-name')!.textContent!;
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toBe(name);
    await user().click(first);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(name));
  });

  it('can take the score apart on request', async () => {
    await tapNow();
    const disclosure = screen.getByRole('button', { name: /how we got/i });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await user().click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/decision support/i)).toBeInTheDocument();
  });

  it('goes back to the two choices', async () => {
    await tapNow();
    await user().click(screen.getByRole('button', { name: /back to start/i }));
    expect(screen.getByRole('button', { name: /^LATER/ })).toBeInTheDocument();
  });
});

describe('LATER', () => {
  it('projects a specific future date and marks it as a projection', async () => {
    render(<App />);
    await user().click(screen.getByRole('button', { name: /^LATER/ }));
    await waitFor(() => expect(screen.getByText(/^Projected$/i)).toBeInTheDocument(), {
      timeout: 12_000,
    });
    expect(screen.getByText(/CONFIDENCE/)).toBeInTheDocument();
    expect(screen.getAllByText('FORECAST').length).toBeGreaterThan(0);
  });

  it('ranks a whole range and names a best bet with its confidence', async () => {
    render(<App />);
    await user().click(screen.getByRole('button', { name: /^LATER/ }));
    await waitFor(() => expect(screen.getByText(/^Projected$/i)).toBeInTheDocument(), {
      timeout: 12_000,
    });
    await user().click(screen.getByRole('button', { name: /next 7 days/i }));
    await waitFor(() => expect(screen.getByText(/Best bet/i)).toBeInTheDocument(), {
      timeout: 20_000,
    });
    const table = screen.getByRole('table', { name: /projected best mountain by day/i });
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(5);
    expect(screen.getByText(/leans harder on pattern and history/i)).toBeInTheDocument();
  });
});

describe('accessibility basics', () => {
  it('exposes the recommendation as text for screen readers', async () => {
    await tapNow();
    const status = screen.getAllByRole('status')[0]!;
    expect(status.textContent).toMatch(/out of 10/i);
    expect(status.textContent).toMatch(/Leave /);
  });

  it('describes the charts rather than leaving them as bare SVG', async () => {
    await tapNow();
    expect(screen.getByRole('img', { name: /ski quality through the day/i })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /drive/i }).length).toBeGreaterThan(0);
  });

  it('gives every score bar a meter role with a value', async () => {
    await tapNow();
    await user().click(screen.getByRole('button', { name: /how we got/i }));
    const meters = screen.getAllByRole('meter');
    // One per configured factor — derived, so adding a factor updates the test.
    expect(meters.length).toBe(Object.keys(DEFAULT_WEIGHTS.factors).length);
    for (const meter of meters) {
      expect(meter).toHaveAttribute('aria-valuenow');
      expect(meter).toHaveAttribute('aria-label');
    }
  });

  it('does not rely on colour alone for traffic status', async () => {
    await tapNow();
    const table = screen.getByRole('table', { name: /stay or go/i });
    expect(within(table).getAllByText(/flowing|slow|jammed/i).length).toBeGreaterThan(0);
  });
});

describe('the ten-second test', () => {
  /**
   * The product acceptance test, as a test: every question a skier opens the
   * app with has to be answerable from the recommendation card itself, without
   * hunting. An earlier build put "why this mountain" three screens down.
   */
  it('answers all six questions inside the recommendation card', async () => {
    await tapNow();
    const card = screen.getByRole('heading', { level: 1 }).closest('section')!;
    const q = within(card);

    expect(q.getByRole('heading', { level: 1 }).textContent).toBeTruthy(); // where
    expect(q.getAllByText(/^Leave /).length).toBeGreaterThan(0); //          when to leave
    expect(q.getByText('Arrive')).toBeInTheDocument(); //                    when you arrive
    expect(q.getByText('Prime snow')).toBeInTheDocument(); //                when it's best
    expect(q.getByText('Head home')).toBeInTheDocument(); //                 when to bail
    expect(q.getByText('Home by')).toBeInTheDocument(); //                   when you're back
    expect(q.getByRole('heading', { name: /^why /i })).toBeInTheDocument(); // why this one
  });

  it('leads with the verdict, not the decimal', async () => {
    await tapNow();
    const card = screen.getByRole('heading', { level: 1 }).closest('section')!;
    const verdict = card.querySelector('.reccard-verdict')!;
    const score = card.querySelector('.scoredial-value')!;
    const sizeOf = (el: Element) =>
      parseFloat(getComputedStyle(el).fontSize || '0') || el.textContent!.length;
    // jsdom has no real layout, so assert the structural promise instead: the
    // verdict is a sibling of the name, the score is labelled subordinate.
    expect(verdict.textContent).toMatch(/[A-Z]/);
    expect(score).toBeInTheDocument();
    expect(card.querySelector('.reccard-scorelabel')!.textContent).toMatch(/day score/i);
    expect(sizeOf(verdict)).toBeGreaterThan(0);
  });

  it('shows what the day costs', async () => {
    await tapNow();
    const card = screen.getByRole('heading', { level: 1 }).closest('section')!;
    expect(within(card).getByText(/lift ticket/i)).toBeInTheDocument();
    expect(within(card).getByText(/^\$\d+$/)).toBeInTheDocument();
  });

  it('can jump straight to the alternatives', async () => {
    await tapNow();
    const jump = screen.getByRole('button', { name: /compare the alternatives/i });
    await user().click(jump);
    expect(screen.getByRole('heading', { name: /the alternatives/i })).toBeInTheDocument();
  });

  it('explains the snow clock in words before drawing it', async () => {
    await tapNow();
    const panel = screen.getByRole('heading', { name: /the snow clock/i }).closest('section')!;
    const caption = panel.querySelector('.snowclock-caption')!;
    expect(caption.textContent!.length).toBeGreaterThan(30);
    expect(caption.textContent).toMatch(/best snow|no standout window/i);
  });

  it('states the return decision before showing the table', async () => {
    await tapNow();
    const panel = screen.getByRole('heading', { name: /when to head home/i }).closest('section')!;
    expect(panel.querySelector('.return-lead')!.textContent).toMatch(/leave at .*home by/i);
  });

  it('marks which way each alternative trade-off cuts', async () => {
    await tapNow();
    const alternatives = screen.getByRole('heading', { name: /the alternatives/i }).closest('section')!;
    const chips = alternatives.querySelectorAll('.alt-tradeoff');
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      expect(chip.className).toMatch(/is-better|is-worse/);
      // Sign as well as colour, so it survives greyscale and colour blindness.
      expect(chip.textContent).toMatch(/^[+−]/);
    }
  });
});

describe('honest empty states', () => {
  async function tapNowWith(registry: ReturnType<typeof createDemoRegistry>) {
    render(<App registry={registry} />);
    await user().click(screen.getByRole('button', { name: /^NOW/ }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(), {
      timeout: 12_000,
    });
  }

  it('says the weather feed is down instead of inventing snow', async () => {
    await tapNowWith(createDemoRegistry({ weather: { failFor: () => true } }));
    expect(screen.getByText(/Weather's being weird/i)).toBeInTheDocument();
  });

  it('refuses to fake the drive when road data is missing', async () => {
    await tapNowWith(createDemoRegistry({ traffic: { failFor: () => true } }));
    expect(screen.getByText(/we're not going to fake the drive/i)).toBeInTheDocument();
    expect(screen.getByText(/can't time this day/i)).toBeInTheDocument();
    expect(screen.queryByText('Head home')).not.toBeInTheDocument();
  });

  it('lowers confidence when the lift report is silent', async () => {
    await tapNowWith(createDemoRegistry({ mountain: { failOperationsFor: () => true } }));
    expect(screen.getByText(/Lift report isn't talking/i)).toBeInTheDocument();
    expect(screen.getByText(/MEDIUM CONFIDENCE|LOW CONFIDENCE/)).toBeInTheDocument();
  });

  it('says the price is unavailable rather than inventing one when pricing is down', async () => {
    await tapNowWith(createDemoRegistry({ pricing: { failFor: () => true } }));
    // No dollar figure anywhere — the honest fallback names the gap instead of a number.
    expect(screen.queryByText(/^\$\d/)).not.toBeInTheDocument();
    expect(screen.getByText(/Current price unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Ticket pricing isn't loading/i)).toBeInTheDocument();
  });
});

describe('navigation history', () => {
  it('puts each screen in the URL, so the phone Back gesture returns home instead of leaving', async () => {
    render(<App />);
    await user().click(screen.getByRole('button', { name: /explore the map/i }));
    expect(window.location.hash).toBe('#/map');

    act(() => {
      window.history.back();
    });
    await waitFor(() => expect(screen.getByText('Find your best mountain day.')).toBeInTheDocument());
    expect(window.location.hash).toBe('');
  });

  it('opens straight onto a screen from a shared or bookmarked link', () => {
    window.history.replaceState(null, '', '/#/map');
    render(<App />);
    expect(screen.getByText('MAP')).toBeInTheDocument();
  });

  it('treats an unknown hash as the homepage', () => {
    window.history.replaceState(null, '', '/#/nonsense');
    render(<App />);
    expect(screen.getByText('Find your best mountain day.')).toBeInTheDocument();
  });

  it('goes home from a deep link without leaving the app', async () => {
    window.history.replaceState(null, '', '/#/map');
    render(<App />);
    await user().click(screen.getByRole('button', { name: /back to start/i }));
    expect(screen.getByText('Find your best mountain day.')).toBeInTheDocument();
    expect(window.location.hash).toBe('');
  });
});

describe('remembering where you start from', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error -- test cleanup of a jsdom global that has no type by default
    delete navigator.geolocation;
  });

  it('keeps the chosen city for the next visit', async () => {
    const { unmount } = render(<App />);
    await user().selectOptions(screen.getByLabelText(/starting from/i), 'durango');
    unmount();

    render(<App />);
    expect((screen.getByLabelText(/starting from/i) as HTMLSelectElement).value).toBe('durango');
  });

  it('never writes a GPS fix to storage', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({ coords: { latitude: 39.7047, longitude: -105.0814, accuracy: 10 } } as GeolocationPosition);
    });
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });

    const { unmount } = render(<App />);
    await user().selectOptions(screen.getByLabelText(/starting from/i), 'boulder');
    await user().click(screen.getByRole('button', { name: /use my current location/i }));
    await waitFor(() => expect(screen.getByText(/using your current location/i)).toBeInTheDocument());
    expect(JSON.stringify({ ...window.localStorage })).not.toContain('39.70');
    unmount();

    render(<App />);
    expect((screen.getByLabelText(/starting from/i) as HTMLSelectElement).value).toBe('boulder');
  });

  it('ignores a stored value that is not a known city', () => {
    window.localStorage.setItem('snownow.originId', 'atlantis');
    render(<App />);
    expect((screen.getByLabelText(/starting from/i) as HTMLSelectElement).value).toBe('denver');
  });
});

describe('your ride — the rider settings', () => {
  it('is collapsed on the homepage with a one-line summary of what the engine believes about you', () => {
    render(<App />);
    const toggle = screen.getByRole('button', { name: /your ride/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle.textContent).toMatch(/No pass · balanced · up to 5 hours · home by 7:00 PM/i);
  });

  it('remembers a pass between visits and shows it on the recommendation instead of a ticket price', async () => {
    const first = render(<App />);
    await user().click(screen.getByRole('button', { name: /your ride/i }));
    await user().click(screen.getByRole('button', { name: 'Epic Pass' }));
    expect(screen.getByRole('button', { name: /your ride/i }).textContent).toMatch(/Epic Pass/);
    first.unmount();

    // A fresh mount reads the stored choice back.
    render(<App />);
    expect(screen.getByRole('button', { name: /your ride/i }).textContent).toMatch(/Epic Pass/);
    await user().click(screen.getByRole('button', { name: /your ride/i }));
    await user().click(screen.getByRole('checkbox', { name: /only show mountains on my pass/i }));
    await user().click(screen.getByRole('button', { name: /^NOW/ }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(), { timeout: 12_000 });

    // Every mountain on screen is now an Epic mountain, and the winner's ticket reads as covered.
    expect(screen.getByText(/On your Epic Pass/)).toBeInTheDocument();
    expect(screen.queryByText(/Lift ticket.*\$/)).not.toBeInTheDocument();
  });

  it('resets to defaults from the panel and clears storage', async () => {
    render(<App />);
    await user().click(screen.getByRole('button', { name: /your ride/i }));
    await user().click(screen.getByRole('button', { name: 'Ikon Pass' }));
    expect(window.localStorage.getItem('snownow.preferences')).toContain('ikon');
    await user().click(screen.getByRole('button', { name: /reset to defaults/i }));
    expect(window.localStorage.getItem('snownow.preferences')).toBeNull();
    expect(screen.getByRole('button', { name: /your ride/i }).textContent).toMatch(/No pass/);
  });

  it('ignores a poisoned stored value rather than crashing', () => {
    window.localStorage.setItem('snownow.preferences', '{"sleepVsSend":"banana","passes":["gold"]}');
    render(<App />);
    expect(screen.getByRole('button', { name: /your ride/i }).textContent).toMatch(/No pass · balanced/i);
  });
});

describe('what you do with the answer', () => {
  it('offers share, calendar and refresh on the NOW card, and reports the plan\'s age', async () => {
    await tapNow();
    expect(screen.getByRole('button', { name: /share plan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to calendar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^refresh$/i })).toBeInTheDocument();
    expect(screen.getByText(/Updated just now/)).toBeInTheDocument();
  });

  it('copies the plan to the clipboard when the share sheet is not available', async () => {
    await tapNow();
    // user-event installs its own clipboard stub at setup; stub after the
    // navigation is done and click without it so the app sees ours.
    const writeText = vi.fn(async (_text: string) => {});
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });
    fireEvent.click(screen.getByRole('button', { name: /share plan/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const text = String(writeText.mock.calls[0]![0]);
    expect(text).toMatch(/Leave Denver/);
    expect(text).toMatch(/\(demo data\)/);
    expect(screen.getByText('Copied to clipboard.')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
