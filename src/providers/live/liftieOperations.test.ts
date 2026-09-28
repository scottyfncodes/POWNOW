import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESORT_SOURCES } from '@/data/resortSources';
import { at } from '@/domain/time';
import { makeContext } from '@/engine/inputs';
import { testMountain } from '@/test/fixtures';
import { extractLiftCounts, getLiftieOperations } from './liftieOperations';

const TODAY = '2026-01-17'; // a Saturday
const context = makeContext(TODAY, TODAY, at(9, 30));
const vail = testMountain({ id: 'vail', name: 'Vail' });
// No entry in data/resortSources.ts.
const unknownMountain = testMountain({ id: 'nowhere', name: 'Nowhere Peak' });

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Liftie's real response shape (github.com/pirxpilot/liftie): a status map plus its own tally. */
function liftieResponse(status: Record<string, string>, extra: Record<string, unknown> = {}) {
  const stats = { open: 0, hold: 0, scheduled: 0, closed: 0 };
  for (const word of Object.values(status)) {
    if (word in stats) stats[word as keyof typeof stats] += 1;
  }
  return {
    id: 'vail',
    name: 'Vail',
    href: 'https://www.vail.com',
    status,
    stats: { ...stats, percentage: { open: 50, hold: 0, scheduled: 0, closed: 50 } },
    timestamp: Date.now() - 5 * 60_000,
    ...extra,
  };
}

const respond = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

describe('getLiftieOperations — Tier 3 gating', () => {
  it('never even makes a request for a mountain with no known Liftie slug', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const result = await getLiftieOperations(unknownMountain, context);
    expect(result.status).toBe('unavailable');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('every resort in the dataset has a Liftie id in Liftie\'s compact, hyphen-free style', () => {
    for (const [mountainId, source] of Object.entries(RESORT_SOURCES)) {
      expect(source.liftieSlug, `${mountainId} should have a Liftie id`).toBeTruthy();
      expect(source.liftieSlug).toMatch(/^[a-z0-9]+$/);
    }
  });
});

describe('getLiftieOperations — Liftie\'s real shape', () => {
  it('normalizes a status map + stats into OperationsReport, live and attributed', async () => {
    vi.stubGlobal(
      'fetch',
      respond(
        liftieResponse({
          'Gondola One': 'open',
          'Chair 4': 'open',
          'Chair 6': 'hold',
          'Riva Bahn': 'closed',
          'High Noon': 'scheduled',
          'Chair 2': 'open',
        }),
      ),
    );
    const result = await getLiftieOperations(vail, context);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.liftsOpen).toBe(3);
    expect(result.data.liftsHold).toBe(1);
    expect(result.data.liftsScheduled).toBe(1);
    expect(result.data.liftsClosed).toBe(1);
    expect(result.data.liftsTotal).toBe(6);
    expect(result.data.liftsExpectedOpen).toBe(3);
    expect(result.data.status).toBe('open');
    expect(result.data.sourceUrl).toContain('vail.com');
    expect(result.provenance.source).toBe('live');
    expect(result.provenance.provider).toBe('liftie');
    expect(result.provenance.attribution).toMatch(/third-party/i);
    expect(result.provenance.fetchedAt).toBeTruthy();
    expect(result.provenance.validUntil).toBeTruthy();
  });

  it('uses the status map alone when stats are missing', () => {
    expect(extractLiftCounts({ status: { A: 'open', B: 'closed', C: 'open' } })).toEqual({
      open: 2,
      hold: 0,
      scheduled: 0,
      closed: 1,
    });
  });

  it('refuses a response whose stats and status map disagree about the board', () => {
    expect(
      extractLiftCounts({ status: { A: 'open', B: 'open' }, stats: { open: 10, hold: 0, scheduled: 0, closed: 5 } }),
    ).toBeNull();
  });

  it('reads a pre-opening board as "scheduled to open", not closed', async () => {
    vi.stubGlobal(
      'fetch',
      respond(liftieResponse({ A: 'scheduled', B: 'scheduled', C: 'closed', D: 'scheduled' })),
    );
    const early = makeContext(TODAY, TODAY, at(6, 15)); // before an 8:30 first chair
    const result = await getLiftieOperations(vail, early);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.status).not.toBe('closed');
    expect(result.data.liftsExpectedOpen).toBe(3);
    expect(result.data.notes.join(' ')).toMatch(/scheduled to open/);
  });

  it('reads an all-closed board during operating hours as closed', async () => {
    vi.stubGlobal('fetch', respond(liftieResponse({ A: 'closed', B: 'closed', C: 'closed' })));
    const result = await getLiftieOperations(vail, makeContext(TODAY, TODAY, at(11)));
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.status).toBe('closed');
  });

  it('marks a board for a future date as a forecast at low confidence, not an observation', async () => {
    vi.stubGlobal('fetch', respond(liftieResponse({ A: 'open', B: 'open' })));
    const result = await getLiftieOperations(vail, makeContext('2026-01-20', TODAY, at(9)));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.provenance.observation).toBe('forecast');
    expect(result.provenance.confidence).toBe('low');
  });

  it('refuses a board Liftie itself last updated many hours ago', async () => {
    vi.stubGlobal(
      'fetch',
      respond(liftieResponse({ A: 'open', B: 'open' }, { timestamp: Date.now() - 14 * 3_600_000 })),
    );
    const result = await getLiftieOperations(vail, context);
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') expect(result.reason).toMatch(/hours old/);
  });

  it('never presents grooming as observed — it stays a documented stand-in', async () => {
    vi.stubGlobal('fetch', respond(liftieResponse({ A: 'open' })));
    const result = await getLiftieOperations(vail, context);
    if (result.status === 'ok') expect(typeof result.data.groomedShare).toBe('number');
  });
});

describe('getLiftieOperations — legacy shapes still accepted', () => {
  it('pre-aggregated lifts.status counts', async () => {
    vi.stubGlobal('fetch', respond({ lifts: { status: { open: 10, hold: 2, scheduled: 1, closed: 3 } } }));
    const result = await getLiftieOperations(vail, context);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.liftsTotal).toBe(16);
  });

  it('a flat lifts.list', async () => {
    vi.stubGlobal(
      'fetch',
      respond({
        lifts: {
          list: [
            { name: 'Gondola One', status: 'open' },
            { name: 'Chair 4', status: 'open' },
            { name: 'Chair 6', status: 'hold' },
            { name: 'Riva Bahn', status: 'closed' },
            { name: 'High Noon', status: 'scheduled' },
          ],
        },
      }),
    );
    const result = await getLiftieOperations(vail, context);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.liftsOpen).toBe(2);
    expect(result.data.liftsTotal).toBe(5);
  });
});

describe('getLiftieOperations — fails safe, never fabricates', () => {
  it('returns unavailable on an unrecognized response shape', async () => {
    vi.stubGlobal('fetch', respond({ nonsense: true }));
    expect((await getLiftieOperations(vail, context)).status).toBe('unavailable');
  });

  it('returns unavailable when most status values are words it does not know', async () => {
    vi.stubGlobal('fetch', respond({ status: { A: 'mysterious', B: 'unknown', C: 'open' } }));
    expect((await getLiftieOperations(vail, context)).status).toBe('unavailable');
  });

  it('returns unavailable when the resort reports zero lifts', async () => {
    vi.stubGlobal('fetch', respond({ status: {}, stats: { open: 0, hold: 0, scheduled: 0, closed: 0 } }));
    expect((await getLiftieOperations(vail, context)).status).toBe('unavailable');
  });

  it('returns unavailable on a non-2xx response, a network failure and malformed JSON', async () => {
    const { clearProviderCaches } = await import('./fetchCache');
    for (const make of [
      async () => new Response('down', { status: 503 }),
      async () => {
        throw new TypeError('Failed to fetch');
      },
      async () => new Response('{broken', { status: 200 }),
    ]) {
      clearProviderCaches();
      vi.stubGlobal('fetch', vi.fn(make));
      expect((await getLiftieOperations(vail, context)).status).toBe('unavailable');
    }
  });
});
