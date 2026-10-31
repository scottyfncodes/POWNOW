import { describe, expect, it } from 'vitest';
import { embeddedJson, parseAltaPage, parseLovelandPage, parseVailPage } from '../../../server/index.mjs';
import { findMountain } from '@/data/mountains';
import { classifyOperationalState } from '@/engine/operationalState';
import { testInputs, testOperations } from '@/test/fixtures';

/**
 * Trimmed from the real pages as served on 2026-10-31. The shapes and field
 * names are the resorts' own; lists are shortened, counts noted.
 */
const keystonePage = `<html><head><script>
  FR.Config = {"a":1};
  FR.TerrainStatusFeed = {"Date":"\\/Date(1793475877427)\\/","ResortId":7,"GroomingAreas":[{"Id":1,"Name":"Dercum Mountain","Trails":[{"Id":1,"Name":"Schoolmarm","IsOpen":true},{"Id":2,"Name":"Spring Dipper {lower}","IsOpen":false},{"Id":3,"Name":"Flying Dutchman","IsOpen":false}],"Lifts":[]}],"Lifts":[{"Id":1,"Name":"River Run Gondola","Status":1},{"Id":2,"Name":"Montezuma Express","Status":1},{"Id":3,"Name":"Peru Express","Status":0},{"Id":4,"Name":"Santiago Express","Status":0}],"ErrorDetails":null,"IsSuccessful":true};
</script></head><body>...</body></html>`;

/** Breck before its board is built for the season: the lists are empty. */
const breckPreseasonPage = `<script>FR.TerrainStatusFeed = {"Date":"\\/Date(1793475932353)\\/","ResortId":4,"GroomingAreas":[{"Id":183,"Name":"Back Bowls","Trails":[],"Lifts":[]}],"Lifts":[],"ErrorDetails":null,"IsSuccessful":true};</script>`;

const altaPage = `<script>window.Alta = {"DST":true,"liftStatus":{"lifts":[{"id":2,"name":"Sunnyside","open":false},{"id":3,"name":"Supreme","open":false},{"id":4,"name":"Sugarloaf","open":false},{"id":5,"name":"Collins","open":false},{"id":6,"name":"Wildcat","open":false}],"accessGates":[]},"operations":{"lifts":{"open":0,"total":5},"runs":{"open":0,"total":118}}};</script>`;

const lovelandPage = ['Rainbow Magic Carpet - CLOSED', "Chet's Dream - OPEN", 'Lift 2 - CLOSED', 'PTARMIGAN LIFT - CLOSED']
  .map((name, i) => `<h2 class="tablepress-table-name tablepress-table-name-id-${i}">${name}</h2><table>...</table>`)
  .join('\n');

describe('resort status pages', () => {
  it("counts Keystone's lifts and runs from the page's embedded feed", () => {
    const status = parseVailPage(keystonePage)!;
    expect(status.lifts).toEqual({ open: 2, hold: 0, scheduled: 0, closed: 2, unknown: 0 });
    expect(status.trails).toEqual({ open: 1, total: 3 });
  });

  it('reports an unbuilt preseason board as zero lifts, not as closed', () => {
    const status = parseVailPage(breckPreseasonPage)!;
    expect(status.lifts.open + status.lifts.closed).toBe(0);
  });

  it("reads Alta's own lift list and run summary", () => {
    const status = parseAltaPage(altaPage)!;
    expect(status.lifts).toMatchObject({ open: 0, closed: 5 });
    expect(status.trails).toEqual({ open: 0, total: 118 });
  });

  it("reads Loveland's lift report titles", () => {
    expect(parseLovelandPage(lovelandPage)!.lifts).toMatchObject({ open: 1, closed: 3 });
  });

  it('parses JSON only, never runs page script, and refuses a page whose shape moved', () => {
    expect(embeddedJson('x = {a: 1, b: alert(1)}', /x\s*=\s*\{/)).toBeNull();
    expect(embeddedJson('x = {"a":"}{","b":2};', /x\s*=\s*\{/)).toEqual({ a: '}{', b: 2 });
    expect(parseVailPage('<html>redesigned</html>')).toBeNull();
    expect(parseAltaPage('<html></html>')).toBeNull();
    expect(parseLovelandPage('<html></html>')).toBeNull();
  });
});

describe('a lift turning is not a ski day by itself', () => {
  it('reads Heavenly\'s gondola three weeks before opening day, with no runs reported, as not open yet', () => {
    const result = classifyOperationalState(
      testInputs({
        mountain: findMountain('heavenly')!,
        date: '2026-10-31',
        usingDemoData: false,
        operations: testOperations({ status: 'open', liftsOpen: 1, liftsClosed: 1, liftsTotal: 2, liftsExpectedOpen: 1, terrainOpenShare: 0.5, windHoldRisk: 0 }),
      }),
    );
    expect(result.state).toBe('PRESEASON');
    expect(result.reason).toMatch(/a lift is turning, but no runs are reported open/);
    expect(result.reason).toMatch(/Nov 20/);
  });

  it('reads Keystone, two lifts and one run open, as open with limited terrain', () => {
    const result = classifyOperationalState(
      testInputs({
        mountain: findMountain('keystone')!,
        date: '2026-10-31',
        usingDemoData: false,
        operations: testOperations({ status: 'open', liftsOpen: 2, liftsClosed: 19, liftsTotal: 21, liftsExpectedOpen: 2, trailsOpen: 1, trailsTotal: 144, terrainOpenShare: 1 / 144, windHoldRisk: 0 }),
      }),
    );
    expect(result.state).toBe('LIMITED_OPERATIONS');
  });

  it('in season, lifts turning with every run closed is not skiable', () => {
    const result = classifyOperationalState(
      testInputs({
        mountain: findMountain('heavenly')!,
        date: '2027-01-10',
        usingDemoData: false,
        operations: testOperations({ status: 'open', liftsOpen: 1, liftsTotal: 28, liftsExpectedOpen: 1, trailsOpen: 0, trailsTotal: 97, terrainOpenShare: 0, windHoldRisk: 0 }),
      }),
    );
    expect(result.state).toBe('INSUFFICIENT_COVERAGE');
  });
});
