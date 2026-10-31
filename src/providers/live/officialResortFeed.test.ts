import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeLiftList, normalizeMtnPowder, normalizePowdr, liftWord } from '../../../server/index.mjs';
import { findMountain } from '@/data/mountains';
import { at } from '@/domain/time';
import { makeContext } from '@/engine/inputs';
import { getLiftieOperations } from './liftieOperations';
import { LiveMountainProvider } from './mountainStatus';
import { getOfficialOperations } from './officialResortFeed';

afterEach(() => {
  vi.unstubAllGlobals();
});

const abasin = findMountain('arapahoe-basin')!;
const copper = findMountain('copper')!;
const respond = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

/**
 * Arapahoe Basin's MtnPowder board as it read on 2026-10-31, trimmed to the
 * fields the proxy reads (two of the nine lifts and three of the runs kept
 * per status for size; the counts below are the real ones). Note
 * `OperatingStatus: "Closed"` with a lift spinning: that field is not
 * trustworthy, which is why the proxy counts lifts instead.
 */
const abasinBoard = {
  Name: 'Arapahoe Basin',
  OperatingStatus: 'Closed',
  LastUpdate: '2026-10-31T12:32:54-0600',
  SnowReport: { LastUpdate: '2026-10-31T06:28:23-0600', OpenTerrainAcres: '0', TotalTerrainAcres: '1428' },
  MountainAreas: [
    {
      Name: 'Front Side',
      Lifts: [
        { Name: 'Black Mountain Express Lift', Status: 'Open', StatusEnglish: 'open', UpdateDate: '2026-10-28T08:39:15-0600' },
        ...['Lenawee Express Lift', 'Pallavicini Lift', 'Molly Hogan Lift', "Molly's Magic Carpet", 'Pika Place Carpet', 'Beavers', 'Zuma Lift', 'Lazy J Tow'].map((Name) => ({
          Name,
          Status: 'Closed',
          StatusEnglish: 'closed',
          UpdateDate: '2026-10-28T08:55:58-0600',
        })),
      ],
      Trails: [
        { Name: 'High Noon', Status: 'Open', StatusEnglish: 'open' },
        ...Array.from({ length: 146 }, (_, i) => ({ Name: `Run ${i}`, Status: 'Closed', StatusEnglish: 'closed' })),
      ],
    },
  ],
};

describe('proxy normalizers', () => {
  it("counts A-Basin's real board: 1 of 9 lifts, 1 of 147 runs, stamped by the snow report", () => {
    const status = normalizeMtnPowder(abasinBoard)!;
    expect(status.lifts).toEqual({ open: 1, hold: 0, scheduled: 0, closed: 8, unknown: 0 });
    expect(status.trails).toEqual({ open: 1, total: 147 });
    expect(new Date(status.boardUpdatedAt!).toISOString()).toBe('2026-10-31T12:28:23.000Z');
  });

  it('refuses a board it does not understand rather than calling it closed', () => {
    expect(normalizeMtnPowder({ Name: 'x' })).toBeNull();
    expect(normalizeMtnPowder({ MountainAreas: [{ Lifts: [{ StatusEnglish: 'sparkly' }, { StatusEnglish: 'mystery' }] }] })).toBeNull();
    expect(normalizePowdr({ error: 'nope' }, null)).toBeNull();
  });

  it("reads POWDR's shape, winter lifts and alpine runs only", () => {
    const lifts = [
      { name: 'Super Bee', season: 'winter', status: 'closed', updated: 1781961132 },
      { name: 'American Eagle', season: 'winter', status: 'open', updated: 1793448000 },
      { name: 'Bike lift', season: 'summer', status: 'open', updated: 1781961132 },
    ];
    const trails = [
      { name: 'Far East', season: 'winter', type: 'alpine_trail', include: true, status: 'closed', updated: 1781961132 },
      { name: 'Ptarmigan', season: 'all', type: 'alpine_trail', include: true, status: 'open', updated: 1793448000 },
      { name: 'Hidden', season: 'winter', type: 'alpine_trail', include: false, status: 'closed' },
      { name: 'Bike', season: 'summer', type: 'mountain_bike_trail', include: true, status: 'open' },
    ];
    const status = normalizePowdr(lifts, trails)!;
    expect(status.lifts).toMatchObject({ open: 1, closed: 1 });
    expect(status.trails).toEqual({ open: 1, total: 2 });
  });

  it("reads Aspen Snowmass's and Boyne's lift lists as captured on 2026-10-31", () => {
    // Aspen Mountain: eight lifts, all closed, no update time in the feed.
    const aspen = normalizeLiftList(
      { lastUpdated: null, liftStatuses: Array.from({ length: 8 }, (_, i) => ({ status: 'Closed', liftName: `Lift ${i}`, type: '4' })) },
      'aspen',
    )!;
    expect(aspen.lifts).toEqual({ open: 0, hold: 0, scheduled: 0, closed: 8, unknown: 0 });
    expect(aspen.trails.total).toBe(0);
    expect(aspen.boardUpdatedAt).toBeNull();
    // Brighton (Boyne): a bare array.
    const brighton = normalizeLiftList([{ name: 'Caterpillar', status: 'Closed' }, { name: 'Crest 6', status: 'Open' }], 'boyne')!;
    expect(brighton.lifts).toMatchObject({ open: 1, closed: 1 });
    expect(normalizeLiftList({ nope: true }, 'aspen')).toBeNull();
  });

  it('maps status words without guessing', () => {
    expect(liftWord('Open')).toBe('open');
    expect(liftWord('Wind Hold')).toBe('hold');
    expect(liftWord('Expected')).toBe('scheduled');
    expect(liftWord('Closed for season')).toBe('closed');
    expect(liftWord('')).toBe('unknown');
  });
});

describe('getOfficialOperations', () => {
  const fetchedAt = Date.parse('2026-10-31T13:00:00-0600');

  it("reports A-Basin's one run as open with its real terrain share, attributed to the resort", async () => {
    vi.useFakeTimers({ now: fetchedAt, toFake: ['Date'] });
    vi.stubGlobal('fetch', respond({ feed: 'mtnpowder', ...normalizeMtnPowder(abasinBoard) }));
    const result = await getOfficialOperations(abasin, makeContext('2026-10-31', '2026-10-31', at(13, 0)), { apiBaseUrl: '' });
    vi.useRealTimers();
    expect(result?.status).toBe('ok');
    if (result?.status !== 'ok') return;
    expect(result.data).toMatchObject({ status: 'open', liftsOpen: 1, liftsTotal: 9, trailsOpen: 1, trailsTotal: 147 });
    expect(result.data.terrainOpenShare).toBeCloseTo(1 / 147);
    expect(result.provenance.attribution).toMatch(/resort's own/);
  });

  it('reads an all-closed board as closed even if nobody has touched it in weeks', async () => {
    vi.stubGlobal('fetch', respond({ feed: 'powdr', lifts: { open: 0, hold: 0, scheduled: 0, closed: 23, unknown: 0 }, trails: { open: 0, total: 163 }, boardUpdatedAt: Date.parse('2026-09-08T15:22:13Z') }));
    const result = await getOfficialOperations(copper, makeContext('2026-11-01', '2026-11-01', at(6, 0)), { apiBaseUrl: '' });
    expect(result?.status).toBe('ok');
    if (result?.status === 'ok') expect(result.data).toMatchObject({ status: 'closed', liftsOpen: 0, terrainOpenShare: 0 });
  });

  it('refuses a stale board that claims lifts are open', async () => {
    vi.stubGlobal('fetch', respond({ feed: 'powdr', lifts: { open: 5, hold: 0, scheduled: 0, closed: 18, unknown: 0 }, trails: { open: 20, total: 163 }, boardUpdatedAt: Date.now() - 5 * 86_400_000 }));
    const result = await getOfficialOperations(copper, makeContext('2026-11-10', '2026-11-10', at(9, 0)), { apiBaseUrl: '' });
    expect(result?.status).toBe('unavailable');
  });

  it('falls back to Liftie when the resort feed fails, and says why when both do', async () => {
    vi.stubGlobal('fetch', respond({ error: 'down' }, 502));
    const provider = new LiveMountainProvider({ apiBaseUrl: '' });
    const result = await provider.getOperations(copper, makeContext('2026-11-10', '2026-11-10', at(9, 0)));
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') expect(result.reason).toMatch(/Liftie/);
  });
});

describe('Liftie on a closed resort at dawn', () => {
  it('reads nothing open and nothing scheduled as closed, not as "waiting for first chair"', async () => {
    const status = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`Lift ${i}`, 'closed']));
    vi.stubGlobal('fetch', respond({ id: 'copper', name: 'Copper', status, stats: { open: 0, hold: 0, scheduled: 0, closed: 10 }, timestamp: Date.now() }));
    const result = await getLiftieOperations(copper, makeContext('2026-11-01', '2026-11-01', at(6, 0)));
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.status).toBe('closed');
  });
});
