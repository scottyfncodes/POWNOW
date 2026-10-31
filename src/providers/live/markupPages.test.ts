import { describe, expect, it } from 'vitest';
import { MARKUP_PAGES, parseMarkupPage } from '../../../server/index.mjs';
import { MOUNTAINS } from '@/data/mountains';
import { resortSourceFor } from '@/data/resortSources';

/** Markup trimmed from each resort's page as served on 2026-10-31; the classes and structure are theirs. */
const pages = {
  telluride: `<div class="tsr-report-app-lift-status"><table><tbody>
    <tr><td><span class="tsr-report-app-icon-open"></span></td><td>Free Gondola &#8211; Town to MV</td><td>Village</td><td>CLOSED</td></tr>
    <tr><td><span class="tsr-report-app-icon-closed"></span></td><td>Chondola</td><td>Meadows</td><td>CLOSED</td></tr>
    <tr><td><span class="tsr-report-app-icon-open"></span></td><td>Village Express</td><td>Village</td><td>OPEN</td></tr>
  </tbody></table></div>`,
  monarch: `<table class="lifts-table"><tbody>
    <tr><td data-label="Lift Name"> Breezeway </td><td class="td_center_data" data-label="Status"><span style="color: red;">Closed</span></td></tr>
    <tr><td data-label="Lift Name"> Garfield </td><td class="td_center_data" data-label="Status"><span style="color: green;">Open</span></td></tr>
    <tr><td data-label="Lift Name"> Kaleidoscope (Tubing Park) </td><td class="td_center_data"><span>Open</span></td></tr>
  </tbody></table>`,
  snowbasin: `<table class="mc-lifts__table"><tbody>
    <tr><td> Allen Peak Tram </td><td class="mc__table-cell"><span class="sr-only">Tram</span></td><td class="mc__table-cell"><span class="mc__icon mc__icon-closed"></span><span class="sr-only">Lift Closed</span></td></tr>
    <tr><td> Needles Gondola </td><td class="mc__table-cell"><span class="sr-only">Gondola</span></td><td class="mc__table-cell"><span class="mc__icon mc__icon-open"></span><span class="sr-only">Lift Open</span></td></tr>
  </tbody></table>`,
  brianhead: `<ul>
    <li class="m-lift-status-closed"><div><img alt="3 Person"></div><div><h3 class="m-h-s m-lift-header">Wildflower, Chair 1 </h3></div></li>
    <li class="m-lift-status-open"><div><img alt="4 Person"></div><div><h3 class="m-h-s m-lift-header">Giant Steps Express, Chair 2</h3></div></li>
    <li class="menu-item">Not a lift</li>
  </ul>`,
  sugarbowl: `
    <div id="lift_status_05_top" class="lift_status_top"><div><div class="fw_semi_bold">Jerome Hill Express</div><span data-update-id="lift_05_hours">9:00am - 4:00pm daily</span></div><div><span data-update-id="lift_05_status_text">Closed</span></div></div>
    <div id="lift_status_07_top" class="lift_status_top"><div><div class="fw_semi_bold">Mt. Judah Express</div></div><div><span data-update-id="lift_07_status_text">On Hold</span></div></div>`,
  sierra: `
    <div data-panel="lift-status" class="wp-block-group sierra-lift-row"><div data-panel="lift-status"><h4>Easy Rider Express</h4></div><p class="sierra-status-badge">closed</p></div>
    <div data-panel="lift-status" class="wp-block-group sierra-lift-row"><div><h4>Grandview Express</h4></div><p class="sierra-status-badge">open</p></div>
    <div data-panel="lift-status" class="wp-block-group sierra-lift-row"><div><h4>Blizzard Mountain Tubing</h4></div><p class="sierra-status-badge">open</p></div>
    <div data-panel="trail-status" class="wp-block-group sierra-lift-row"><div><h4>Some Trail</h4></div><p class="sierra-status-badge">open</p></div>`,
};

describe('plain-markup resort pages', () => {
  it('counts each resort\'s lifts from its own markup, skipping town transport and tubing', () => {
    expect(parseMarkupPage('telluride', pages.telluride)!.lifts).toMatchObject({ open: 1, closed: 1 });
    expect(parseMarkupPage('monarch', pages.monarch)!.lifts).toMatchObject({ open: 1, closed: 1 });
    expect(parseMarkupPage('snowbasin', pages.snowbasin)!.lifts).toMatchObject({ open: 1, closed: 1 });
    expect(parseMarkupPage('brianhead', pages.brianhead)!.lifts).toMatchObject({ open: 1, closed: 1 });
    expect(parseMarkupPage('sugarbowl', pages.sugarbowl)!.lifts).toMatchObject({ hold: 1, closed: 1 });
    expect(parseMarkupPage('sierra', pages.sierra)!.lifts).toMatchObject({ open: 1, closed: 1 });
  });

  it('reads a redesigned page as unavailable, never as closed', () => {
    for (const id of Object.keys(MARKUP_PAGES)) expect(parseMarkupPage(id, '<html><body>New site!</body></html>')).toBeNull();
  });

  it('wires every markup page to a mountain, and back', () => {
    const wired = MOUNTAINS.map((m) => resortSourceFor(m.id).officialFeed).filter((f) => f?.kind === 'markup').map((f) => f!.id);
    expect(wired.sort()).toEqual(Object.keys(MARKUP_PAGES).sort());
  });
});
