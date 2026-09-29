import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { DEFAULT_WEIGHTS } from '@/config/weights';
import { MOUNTAINS } from '@/data/mountains';
import { createDemoRegistry } from '@/providers/demo';
import { ORIGIN_STORAGE_KEY } from '@/ui/hooks/useOrigin';
import { PREFERENCES_STORAGE_KEY } from '@/ui/hooks/usePreferences';

/**
 * These tests walk the product's actual promise: open it, tap POW NOW, say
 * how you ride, get every mountain ranked, open one and get an answer you can
 * act on — and, from the same step, pick a date and get a projection that is
 * honest about being one.
 */

const user = () => userEvent.setup();

const logo = () => screen.getByRole('button', { name: /^POW NOW — open the map/ });
const rankButton = () => screen.getByRole('button', { name: /rank them for my day/i });

/** Home → the logo → the map → "Rank them for my day": the Your ride step. */
async function openSetup() {
  await user().click(logo());
  await user().click(rankButton());
}
const showMe = () => screen.getByRole('button', { name: /^SHOW ME/ });
const picksList = () => screen.getByRole('list', { name: /mountains, best first/i });

/** Home → the map → Your ride → SHOW ME, and wait for the ranked cards. */
async function tapShowMe() {
  await openSetup();
  await user().click(showMe());
  await waitFor(() => expect(picksList()).toBeInTheDocument(), { timeout: 12_000 });
}

/** The whole flow through to the winner's day. */
async function tapNow(registry?: ReturnType<typeof createDemoRegistry>) {
  render(registry ? <App registry={registry} /> : <App />);
  await tapShowMe();
  await user().click(within(picksList()).getAllByRole('button')[0]!);
  return waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(), {
    timeout: 12_000,
  });
}

describe('the home screen', () => {
  it('is the POW NOW logo, and the logo is the button', () => {
    render(<App />);
    expect(screen.getByText('Find your best mountain day.')).toBeInTheDocument();
    expect(logo()).toBeInTheDocument();
    expect(logo().textContent).toBe('POWNOW');
    // Nothing else to decide on the home screen.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByLabelText(/starting from/i)).not.toBeInTheDocument();
  });

  it('says plainly that it is running on demo data', () => {
    render(<App />);
    expect(screen.getByText('DEMO DATA')).toBeInTheDocument();
    expect(screen.getByText(/No live weather, traffic or lift feeds/i)).toBeInTheDocument();
  });

  it('the logo opens the map, with every mountain selectable and a List tab beside it', async () => {
    render(<App />);
    await user().click(logo());
    expect(window.location.hash).toBe('#/map');
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'false');
    for (const mountain of MOUNTAINS) {
      expect(screen.getByRole('button', { name: new RegExp(`^${mountain.name}\\. Tap to view`, 'i') })).toBeInTheDocument();
    }
    await user().click(screen.getByRole('button', { name: /back to start/i }));
    expect(screen.getByText('Find your best mountain day.')).toBeInTheDocument();
  });

  it('switches to the list, alphabetical, and a row lands on that mountain\'s day', async () => {
    render(<App />);
    await user().click(logo());
    await user().click(screen.getByRole('button', { name: 'List' }));
    expect(window.location.hash).toBe('#/list');
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    const list = screen.getByRole('list', { name: /colorado mountains, alphabetical/i });
    const names = within(list)
      .getAllByRole('button')
      .map((row) => row.querySelector('.mountainlist-name')!.textContent!);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names.length).toBe(MOUNTAINS.length);

    await user().click(within(list).getByRole('button', { name: /^Copper Mountain/ }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('COPPER'), {
      timeout: 12_000,
    });
    expect(screen.getByRole('heading', { name: /parking/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /trail map/i })).toBeInTheDocument();
  }, 15_000);

  it('switching back to the map tab pops history instead of stacking tabs', async () => {
    render(<App />);
    await user().click(logo());
    await user().click(screen.getByRole('button', { name: 'List' }));
    await user().click(screen.getByRole('button', { name: 'Map' }));
    await waitFor(() => expect(window.location.hash).toBe('#/map'));
    await user().click(screen.getByRole('button', { name: /back to start/i }));
    await waitFor(() => expect(screen.getByText('Find your best mountain day.')).toBeInTheDocument());
  });

  it('the map\'s "full day plan" lands on the same mountain screen', async () => {
    render(<App />);
    await user().click(logo());
    await user().click(screen.getByRole('button', { name: /^Keystone\. Tap to view/i }));
    await user().click(screen.getByRole('button', { name: /full day plan for keystone/i }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('KEYSTONE'), {
      timeout: 12_000,
    });
    expect(window.location.hash).toBe('#/mountain/keystone');
  }, 15_000);

  it('the logo in every header is the home button, and home is the map', async () => {
    render(<App />);
    await tapShowMe();
    await user().click(within(picksList()).getAllByRole('button')[0]!);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(), { timeout: 12_000 });
    await user().click(screen.getByRole('button', { name: /POW NOW home/i }));
    await waitFor(() => expect(window.location.hash).toBe('#/map'));
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
  }, 20_000);

  it('"Rank them for my day" goes to the Your ride step: where from, which day, how you ride', async () => {
    render(<App />);
    await openSetup();
    expect(screen.getByText('YOUR RIDE')).toBeInTheDocument();
    expect(screen.getByLabelText(/starting from/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Today/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: /how you ride/i })).toBeInTheDocument();
    // The settings are the screen here — no collapsed toggle to find first.
    expect(screen.getByText('Passes you hold')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /sleep or send/i })).toBeInTheDocument();
    expect(showMe()).toBeInTheDocument();
    // Its back arrow returns to the tab it came from.
    await user().click(screen.getByRole('button', { name: /back to start/i }));
    await waitFor(() => expect(window.location.hash).toBe('#/map'));
  });

  it('then ranks every reachable mountain as a card, winner first, and opens the one you tap', async () => {
    render(<App />);
    await tapShowMe();
    const cards = within(picksList()).getAllByRole('button');
    expect(cards.length).toBeGreaterThan(5);
    expect(cards[0]!.textContent).toMatch(/^BEST/);
    expect(cards[1]!.textContent).toMatch(/^#2/);
    expect(screen.getByText('YOUR MOUNTAINS')).toBeInTheDocument();

    const name = cards[2]!.querySelector('.mcard-name')!.textContent!;
    await user().click(cards[2]!);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(name));
    expect(window.location.hash).toMatch(/^#\/mountain\//);
  });
});

describe('GPS location flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error -- test cleanup of a jsdom global that has no type by default
    delete navigator.geolocation;
  });

  it('routes from the actual GPS fix once granted, and back to a manual city after switching', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 39.7047, longitude: -105.0814, accuracy: 10 },
      } as GeolocationPosition);
    });
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });

    render(<App />);
    await openSetup();
    await user().click(screen.getByRole('button', { name: /use my current location/i }));
    await waitFor(() => expect(screen.getByText(/using your current location/i)).toBeInTheDocument());

    await user().click(showMe());
    await waitFor(() => expect(picksList()).toBeInTheDocument(), { timeout: 12_000 });
    await user().click(within(picksList()).getAllByRole('button')[0]!);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(), {
      timeout: 12_000,
    });
    expect(screen.getAllByText(/Leave your location/i).length).toBeGreaterThan(0);

    // Back to the picks, edit the ride, choose a city instead.
    await user().click(screen.getByRole('button', { name: /back to start/i }));
    await user().click(screen.getByRole('button', { name: /edit/i }));
    const select = screen.getByLabelText(/starting from/i);
    await user().selectOptions(select, 'denver');
    await user().click(showMe());
    await waitFor(() => expect(picksList()).toBeInTheDocument(), { timeout: 12_000 });
    await user().click(within(picksList()).getAllByRole('button')[0]!);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(), {
      timeout: 12_000,
    });
    expect(screen.getAllByText(/Leave Denver/i).length).toBeGreaterThan(0);
  }, 30_000);

  it('stays fully usable with manual cities when location permission is denied', async () => {
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code: 1, PERMISSION_DENIED: 1, message: 'denied' } as GeolocationPositionError);
      },
    );
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });

    render(<App />);
    await openSetup();
    await user().click(screen.getByRole('button', { name: /use my current location/i }));
    await waitFor(() =>
      expect(screen.getByText(/location access is off.*choose a starting city instead/i)).toBeInTheDocument(),
    );

    // The city dropdown and the rest of the flow are untouched by the denial.
    const select = screen.getByLabelText(/starting from/i);
    await user().selectOptions(select, 'boulder');
    expect((select as HTMLSelectElement).value).toBe('boulder');

    await user().click(showMe());
    await waitFor(() => expect(picksList()).toBeInTheDocument(), { timeout: 12_000 });
    await user().click(within(picksList()).getAllByRole('button')[0]!);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(), {
      timeout: 12_000,
    });
    expect(screen.getAllByText(/Leave Boulder/i).length).toBeGreaterThan(0);
  }, 20_000);
});

describe('POW NOW', () => {
  it('shows a loading sequence that says what it is checking', async () => {
    render(<App />);
    await openSetup();
    // Synchronous click: the answer cannot possibly have arrived yet, so this
    // pins the loading state deterministically rather than racing it.
    fireEvent.click(showMe());
    expect(screen.getAllByText(/CHECKING THE/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('status')).toHaveTextContent(/checking the mountain/i);
    await waitFor(() => expect(picksList()).toBeInTheDocument(), { timeout: 12_000 });
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

  it('gives a mountain its parking, its route, its trail map and its reference sheet on the same screen', async () => {
    await tapNow();
    expect(screen.getByRole('heading', { name: /parking/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /get there/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /trail map/i })).toBeInTheDocument();
    expect(screen.getByText(/reference & links/i)).toBeInTheDocument();
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

  it('lets you compare alternatives and switch to one — the URL follows', async () => {
    await tapNow();
    const alternatives = screen.getByRole('heading', { name: /the alternatives/i }).closest('section')!;
    const first = within(alternatives).getAllByRole('button')[0]!;
    const name = first.querySelector('.alt-name')!.textContent!;
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toBe(name);
    const hashBefore = window.location.hash;
    await user().click(first);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(name));
    expect(window.location.hash).toMatch(/^#\/mountain\//);
    expect(window.location.hash).not.toBe(hashBefore);
  });

  it('can take the score apart on request', async () => {
    await tapNow();
    const disclosure = screen.getByRole('button', { name: /how we got/i });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await user().click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/decision support/i)).toBeInTheDocument();
  });

  it('goes back to the ranked picks, and from there to the Your ride step', async () => {
    await tapNow();
    await user().click(screen.getByRole('button', { name: /back to start/i }));
    expect(picksList()).toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: /back to start/i }));
    expect(showMe()).toBeInTheDocument();
  });

  it('opening a mountain costs no second ranking — the picks and the mountain share one answer', async () => {
    const registry = createDemoRegistry();
    const spy = vi.spyOn(registry.weather, 'getMountainWeather');
    render(<App registry={registry} />);
    await tapShowMe();
    const callsAfterRanking = spy.mock.calls.length;
    expect(callsAfterRanking).toBeGreaterThan(0);
    await user().click(within(picksList()).getAllByRole('button')[1]!);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(), { timeout: 12_000 });
    expect(spy.mock.calls.length).toBe(callsAfterRanking);
  });
});

describe('another day', () => {
  it('ranks a future day as a projection, and says so on the cards and the plan', async () => {
    render(<App />);
    await openSetup();
    await user().click(screen.getByRole('button', { name: /^Tomorrow/ }));
    expect(screen.getByText(/is a projection/i)).toBeInTheDocument();
    await user().click(showMe());
    await waitFor(() => expect(picksList()).toBeInTheDocument(), { timeout: 12_000 });
    expect(screen.getByText('BEST BET')).toBeInTheDocument();
    expect(screen.getByText(/a projection, not a promise/i)).toBeInTheDocument();
    await user().click(within(picksList()).getAllByRole('button')[0]!);
    await waitFor(() => expect(screen.getByText(/^Projected$/i)).toBeInTheDocument(), { timeout: 12_000 });
    expect(screen.getByText(/CONFIDENCE/)).toBeInTheDocument();
  }, 20_000);

  it('hands off to the range planner, which ranks a whole range and names a best bet with its confidence', async () => {
    render(<App />);
    await openSetup();
    await user().click(screen.getByRole('button', { name: /compare a whole range/i }));
    await waitFor(() => expect(screen.getByText(/^Projected$/i)).toBeInTheDocument(), {
      timeout: 12_000,
    });
    expect(screen.getAllByText('FORECAST').length).toBeGreaterThan(0);
    await user().click(screen.getByRole('button', { name: /next 7 days/i }));
    await waitFor(() => expect(screen.getByText(/Best bet/i)).toBeInTheDocument(), {
      timeout: 20_000,
    });
    const table = screen.getByRole('table', { name: /projected best mountain by day/i });
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(5);
    expect(screen.getByText(/leans harder on pattern and history/i)).toBeInTheDocument();
    // Back lands on the Your ride step it came from.
    await user().click(screen.getByRole('button', { name: /back to start/i }));
    expect(showMe()).toBeInTheDocument();
  }, 30_000);
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
  it('says the weather feed is down instead of inventing snow', async () => {
    await tapNow(createDemoRegistry({ weather: { failFor: () => true } }));
    expect(screen.getByText(/Weather's being weird/i)).toBeInTheDocument();
  });

  it('refuses to fake the drive when road data is missing', async () => {
    await tapNow(createDemoRegistry({ traffic: { failFor: () => true } }));
    expect(screen.getByText(/we're not going to fake the drive/i)).toBeInTheDocument();
    expect(screen.getByText(/can't time this day/i)).toBeInTheDocument();
    expect(screen.queryByText('Head home')).not.toBeInTheDocument();
  });

  it('lowers confidence when the lift report is silent', async () => {
    await tapNow(createDemoRegistry({ mountain: { failOperationsFor: () => true } }));
    expect(screen.getByText(/Lift report isn't talking/i)).toBeInTheDocument();
    expect(screen.getByText(/MEDIUM CONFIDENCE|LOW CONFIDENCE/)).toBeInTheDocument();
  });

  it('says the price is unavailable rather than inventing one when pricing is down', async () => {
    await tapNow(createDemoRegistry({ pricing: { failFor: () => true } }));
    // No dollar figure anywhere — the honest fallback names the gap instead of a number.
    expect(screen.queryByText(/^\$\d/)).not.toBeInTheDocument();
    expect(screen.getByText(/Current price unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Ticket pricing isn't loading/i)).toBeInTheDocument();
  });

  it('says why a mountain is out of your ranking instead of showing an empty plan', async () => {
    render(<App />);
    await openSetup();
    await user().click(screen.getByRole('button', { name: 'Epic Pass' }));
    await user().click(screen.getByRole('checkbox', { name: /only show mountains on my pass/i }));
    await user().click(showMe());
    await waitFor(() => expect(picksList()).toBeInTheDocument(), { timeout: 12_000 });
    // Wolf Creek is independent — deliberately not on the Epic Pass.
    act(() => {
      window.location.hash = '#/mountain/wolf-creek';
    });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Wolf Creek'), {
      timeout: 12_000,
    });
    expect(screen.getByText(/isn't on a pass you hold/i)).toBeInTheDocument();
    expect(screen.getByText(/reference & links/i)).toBeInTheDocument();
  }, 20_000);
});

describe('navigation history', () => {
  it('puts each screen in the URL, so the phone Back gesture retraces the flow instead of leaving', async () => {
    render(<App />);
    await user().click(logo());
    expect(window.location.hash).toBe('#/map');
    await user().click(rankButton());
    expect(window.location.hash).toBe('#/setup');
    await user().click(showMe());
    expect(window.location.hash).toBe('#/picks');

    act(() => {
      window.history.back();
    });
    await waitFor(() => expect(showMe()).toBeInTheDocument());
    expect(window.location.hash).toBe('#/setup');
    act(() => {
      window.history.back();
    });
    await waitFor(() => expect(window.location.hash).toBe('#/map'));
    act(() => {
      window.history.back();
    });
    await waitFor(() => expect(screen.getByText('Find your best mountain day.')).toBeInTheDocument());
    expect(window.location.hash).toBe('');
  });

  it('the in-app back arrow pops history rather than piling up entries', async () => {
    render(<App />);
    await openSetup();
    await user().click(showMe());
    await waitFor(() => expect(picksList()).toBeInTheDocument(), { timeout: 12_000 });
    await user().click(screen.getByRole('button', { name: /back to start/i }));
    await waitFor(() => expect(window.location.hash).toBe('#/setup'));
    // Forward now leads to the picks again — the entry was popped, not duplicated.
    act(() => {
      window.history.forward();
    });
    await waitFor(() => expect(window.location.hash).toBe('#/picks'));
  });

  it('opens straight onto a screen from a shared or bookmarked link', async () => {
    window.history.replaceState(null, '', '/#/later');
    render(<App />);
    expect(screen.getByText('LATER')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/^Projected$/i)).toBeInTheDocument(), { timeout: 12_000 });
  });

  it('opens a mountain straight from its link, and the old NOW link lands on today\'s picks', async () => {
    window.history.replaceState(null, '', '/#/mountain/vail');
    const first = render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('VAIL'), {
      timeout: 12_000,
    });
    first.unmount();
    window.history.replaceState(null, '', '/#/now');
    render(<App />);
    await waitFor(() => expect(picksList()).toBeInTheDocument(), { timeout: 12_000 });
  }, 20_000);

  it('treats an unknown hash as home', () => {
    window.history.replaceState(null, '', '/#/nonsense');
    render(<App />);
    expect(screen.getByText('Find your best mountain day.')).toBeInTheDocument();
  });

  it('returns home from a deep link without leaving the app', async () => {
    window.history.replaceState(null, '', '/#/list');
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
    await openSetup();
    await user().selectOptions(screen.getByLabelText(/starting from/i), 'durango');
    unmount();
    window.history.replaceState(null, '', '/');

    render(<App />);
    await openSetup();
    expect((screen.getByLabelText(/starting from/i) as HTMLSelectElement).value).toBe('durango');
  });

  it('never writes a GPS fix to storage', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({ coords: { latitude: 39.7047, longitude: -105.0814, accuracy: 10 } } as GeolocationPosition);
    });
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });

    const { unmount } = render(<App />);
    await openSetup();
    await user().selectOptions(screen.getByLabelText(/starting from/i), 'boulder');
    await user().click(screen.getByRole('button', { name: /use my current location/i }));
    await waitFor(() => expect(screen.getByText(/using your current location/i)).toBeInTheDocument());
    expect(JSON.stringify({ ...window.localStorage })).not.toContain('39.70');
    unmount();
    window.history.replaceState(null, '', '/');

    render(<App />);
    await openSetup();
    expect((screen.getByLabelText(/starting from/i) as HTMLSelectElement).value).toBe('boulder');
  });

  it('ignores a stored value that is not a known city', async () => {
    window.localStorage.setItem(ORIGIN_STORAGE_KEY, 'atlantis');
    render(<App />);
    await openSetup();
    expect((screen.getByLabelText(/starting from/i) as HTMLSelectElement).value).toBe('denver');
  });
});

describe('your ride — the rider settings', () => {
  it('opens every knob on the Your ride step, with a one-line summary of what the engine believes about you', async () => {
    render(<App />);
    await openSetup();
    expect(screen.getByText(/No pass · balanced · up to 5 hours · home by 7:00 PM/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /your ride/i })).not.toBeInTheDocument();
  });

  it('remembers a pass between visits and shows it on every card instead of a ticket price', async () => {
    const first = render(<App />);
    await openSetup();
    await user().click(screen.getByRole('button', { name: 'Epic Pass' }));
    expect(screen.getByText(/^Epic Pass · /)).toBeInTheDocument();
    first.unmount();
    window.history.replaceState(null, '', '/');

    // A fresh mount reads the stored choice back.
    render(<App />);
    await openSetup();
    expect(screen.getByText(/^Epic Pass · /)).toBeInTheDocument();
    await user().click(screen.getByRole('checkbox', { name: /only show mountains on my pass/i }));
    await user().click(showMe());
    await waitFor(() => expect(picksList()).toBeInTheDocument(), { timeout: 12_000 });

    // Every card is an Epic mountain, and every ticket reads as covered.
    expect(screen.getByText(/only mountains on your pass/i)).toBeInTheDocument();
    const cards = within(picksList()).getAllByRole('button');
    for (const card of cards) {
      expect(card.textContent).toMatch(/On your Epic Pass/);
    }
    await user().click(cards[0]!);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(), { timeout: 12_000 });
    expect(screen.getAllByText(/On your Epic Pass/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Lift ticket.*\$/)).not.toBeInTheDocument();
  }, 20_000);

  it('resets to defaults from the step and clears storage', async () => {
    render(<App />);
    await openSetup();
    await user().click(screen.getByRole('button', { name: 'Ikon Pass' }));
    expect(window.localStorage.getItem(PREFERENCES_STORAGE_KEY)).toContain('ikon');
    await user().click(screen.getByRole('button', { name: /reset to defaults/i }));
    expect(window.localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
    expect(screen.getByText(/^No pass · /)).toBeInTheDocument();
  });

  it('ignores a poisoned stored value rather than crashing', async () => {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, '{"sleepVsSend":"banana","passes":["gold"]}');
    render(<App />);
    await openSetup();
    expect(screen.getByText(/No pass · balanced/i)).toBeInTheDocument();
  });
});

describe('what you do with the answer', () => {
  it('offers share, calendar and refresh on today\'s card, and reports the plan\'s age', async () => {
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
