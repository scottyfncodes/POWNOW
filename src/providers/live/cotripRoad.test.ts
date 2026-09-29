import { afterEach, describe, expect, it, vi } from 'vitest';
import { CORRIDORS } from '@/data/corridors';
import { at } from '@/domain/time';
import { makeContext } from '@/engine/inputs';
import { CDOT_ROUTES, CotripRoadProvider, eventMatches, summarize, type RoadEvent } from './cotripRoad';

const TODAY = '2026-01-17';
const context = makeContext(TODAY, TODAY, at(5));
const provider = () => new CotripRoadProvider({ apiBaseUrl: 'https://proxy.test' });

afterEach(() => {
  vi.unstubAllGlobals();
});

/** What the proxy's /api/road-conditions returns — see server/index.mjs. */
function proxyResponse(events: RoadEvent[]) {
  return new Response(
    JSON.stringify({ events, feeds: { roadConditions: true, incidents: true }, sourceTimestamp: '2026-01-17T12:00:00Z' }),
    { status: 200 },
  );
}

const fullClosure: RoadEvent = {
  kind: 'incident',
  routeName: 'I-70',
  type: 'Road Closure',
  description: 'I-70 westbound: Road closed between Exit 205 (Silverthorne) and Exit 216 (Loveland Pass) due to safety concerns.',
  direction: 'west',
  startMarker: 205,
  endMarker: 216,
  startTime: '2026-01-17T06:10:00Z',
};

const laneClosure: RoadEvent = {
  kind: 'incident',
  routeName: 'I-70',
  type: 'Road Closure',
  description: 'I-70 eastbound: Right lane closed at MP 244 due to a crash.',
  startMarker: 244,
  endMarker: 244,
};

const chainLaw: RoadEvent = {
  kind: 'condition',
  routeName: 'I-70',
  description: 'Snow Packed',
  impacts: ['Chain Law Code 17 (Passenger Vehicle Traction Law)'],
  startMarker: 176,
  endMarker: 205,
};

describe('CotripRoadProvider — calls the proxy, never CDOT directly, and never without a corridor mapping', () => {
  it('asks the proxy for the normalized road events', async () => {
    const fetchSpy = vi.fn(async (_url: string) => proxyResponse([]));
    vi.stubGlobal('fetch', fetchSpy);
    const result = await provider().getCorridorStatus('i70-west', context);
    expect(result.status).toBe('ok');
    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url).toBe('https://proxy.test/api/road-conditions');
    expect(url).not.toContain('cotrip.org'); // the key lives on the server
  });

  it('has a CDOT route mapping for every corridor in the dataset except local roads', () => {
    for (const corridorId of Object.keys(CORRIDORS)) {
      if (corridorId === 'local') continue;
      expect(CDOT_ROUTES[corridorId], `${corridorId} needs a CDOT mapping`).toBeTruthy();
    }
  });

  it('returns unavailable for a corridor with no CDOT mapping, without a request', async () => {
    const fetchSpy = vi.fn(async () => proxyResponse([]));
    vi.stubGlobal('fetch', fetchSpy);
    expect((await provider().getCorridorStatus('local', context)).status).toBe('unavailable');
    expect((await provider().getCorridorStatus('made-up', context)).status).toBe('unavailable');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses to project road status onto a future date', async () => {
    const fetchSpy = vi.fn(async () => proxyResponse([fullClosure]));
    vi.stubGlobal('fetch', fetchSpy);
    const result = await provider().getCorridorStatus('i70-west', makeContext('2026-01-20', TODAY, at(5)));
    expect(result.status).toBe('unavailable');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('CotripRoadProvider — what it claims', () => {
  it('reports closed, with the closure, for a CDOT road-closure incident on the corridor stretch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => proxyResponse([fullClosure])));
    const result = await provider().getCorridorStatus('i70-west', context);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.condition).toBe('closed');
    expect(result.data.closures).toHaveLength(1);
    expect(result.data.closures[0]?.location).toContain('MP 205');
    expect(result.provenance.confidence).toBe('high');
    expect(result.provenance.attribution).toBeUndefined(); // official source, no third-party caveat
  });

  it('does not treat a lane closure as a road closure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => proxyResponse([laneClosure])));
    const result = await provider().getCorridorStatus('i70-west', context);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.condition).toBe('clear');
      expect(result.data.closures).toEqual([]);
    }
  });

  it('reports chains-required with the traction law for a chain-law segment', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => proxyResponse([chainLaw])));
    const result = await provider().getCorridorStatus('i70-west', context);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.condition).toBe('chains-required');
    expect(result.data.tractionLawInEffect).toBe(true);
    expect(result.data.closures).toEqual([]);
  });

  it('ignores an I-70 closure far outside the ski stretch (mile markers), and matches one with no markers', async () => {
    const grandJunction: RoadEvent = { ...fullClosure, startMarker: 30, endMarker: 35, description: 'I-70: Road closed near Grand Junction.' };
    vi.stubGlobal('fetch', vi.fn(async () => proxyResponse([grandJunction])));
    const far = await provider().getCorridorStatus('i70-west', context);
    expect(far.status === 'ok' && far.data.condition).toBe('clear');

    const noMarkers: RoadEvent = { ...fullClosure, startMarker: null, endMarker: null };
    expect(eventMatches(noMarkers, CDOT_ROUTES['i70-west']![0]!)).toBe(true);
  });

  it('reports clear at medium confidence when the feed was understood but said nothing about the corridor', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => proxyResponse([{ ...chainLaw, routeName: 'US 40' }])));
    const result = await provider().getCorridorStatus('i70-west', context);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.condition).toBe('clear');
    expect(result.provenance.confidence).toBe('medium');
  });

  it('matches highway names loosely: "I 70" and "Interstate 70" are I-70; "US-40" is US 40', () => {
    const route = CDOT_ROUTES['i70-west']![0]!;
    expect(eventMatches({ kind: 'condition', routeName: 'I 70', startMarker: 200, endMarker: 210 }, route)).toBe(true);
    expect(eventMatches({ kind: 'condition', routeName: 'Interstate 70', startMarker: 200, endMarker: 210 }, route)).toBe(true);
    expect(eventMatches({ kind: 'condition', routeName: 'US 6', startMarker: 200, endMarker: 210 }, route)).toBe(false);
    expect(eventMatches({ kind: 'condition', routeName: 'US-40', startMarker: 240 }, CDOT_ROUTES['us40-berthoud']![0]!)).toBe(true);
  });

  it('summarize() takes the worst surface across events and never fabricates a closure from a crash', () => {
    const crash: RoadEvent = { kind: 'incident', routeName: 'I-70', type: 'Crash', description: 'I-70 westbound: Crash at MP 210. Expect delays.' };
    const wet: RoadEvent = { kind: 'condition', routeName: 'I-70', description: 'Wet' };
    const result = summarize([crash, wet]);
    expect(result.condition).toBe('wet');
    expect(result.closures).toEqual([]);
    expect(result.tractionLaw).toBe(false);
  });
});

describe('CotripRoadProvider — fails safe', () => {
  it('is unavailable, not clear, when the proxy answer has no events array', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ nonsense: 1 }), { status: 200 })));
    expect((await provider().getCorridorStatus('i70-west', context)).status).toBe('unavailable');
  });

  it('is unavailable on 503 (no CDOT key on the server), 502, malformed JSON and network failure', async () => {
    for (const make of [
      async () => new Response(JSON.stringify({ error: 'no key' }), { status: 503 }),
      async () => new Response('bad gateway', { status: 502 }),
      async () => new Response('{broken', { status: 200 }),
      async () => {
        throw new TypeError('Failed to fetch');
      },
    ]) {
      vi.stubGlobal('fetch', vi.fn(make));
      const { clearProviderCaches } = await import('./fetchCache');
      clearProviderCaches();
      expect((await provider().getCorridorStatus('i70-west', context)).status).toBe('unavailable');
    }
  });

  it('tolerates events with missing fields without crashing or inventing anything', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => proxyResponse([{ kind: 'incident', routeName: 'I-70' }, { kind: 'condition', routeName: 'I-70' }])),
    );
    const result = await provider().getCorridorStatus('i70-west', context);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.closures).toEqual([]);
  });

  it('one proxy fetch serves every corridor asked in the same window', async () => {
    const fetchSpy = vi.fn(async () => proxyResponse([chainLaw]));
    vi.stubGlobal('fetch', fetchSpy);
    const p = provider();
    await Promise.all([
      p.getCorridorStatus('i70-west', context),
      p.getCorridorStatus('us40-berthoud', context),
      p.getCorridorStatus('us6-loveland', context),
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
