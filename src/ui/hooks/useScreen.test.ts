import { describe, expect, it } from 'vitest';
import { hashFor, routeFromHash } from './useScreen';

describe('routeFromHash — every screen is a URL', () => {
  it('reads each screen and the mountain parameter', () => {
    expect(routeFromHash('')).toEqual({ screen: 'home', mountainId: null });
    expect(routeFromHash('#/setup')).toEqual({ screen: 'setup', mountainId: null });
    expect(routeFromHash('#/picks')).toEqual({ screen: 'picks', mountainId: null });
    expect(routeFromHash('#/list')).toEqual({ screen: 'list', mountainId: null });
    expect(routeFromHash('#/map')).toEqual({ screen: 'map', mountainId: null });
    expect(routeFromHash('#/later')).toEqual({ screen: 'later', mountainId: null });
    expect(routeFromHash('#/mountain/wolf-creek')).toEqual({ screen: 'mountain', mountainId: 'wolf-creek' });
  });

  it('tolerates a missing slash and any case', () => {
    expect(routeFromHash('#Map')).toEqual({ screen: 'map', mountainId: null });
    expect(routeFromHash('#/Mountain/VAIL')).toEqual({ screen: 'mountain', mountainId: 'vail' });
  });

  it('sends the old NOW bookmark to today\'s ranked picks, and anything unknown home', () => {
    expect(routeFromHash('#/now')).toEqual({ screen: 'picks', mountainId: null });
    expect(routeFromHash('#/nonsense')).toEqual({ screen: 'home', mountainId: null });
    // A mountain screen with no mountain is not a place.
    expect(routeFromHash('#/mountain')).toEqual({ screen: 'home', mountainId: null });
  });

  it('round-trips through hashFor', () => {
    for (const hash of ['', '#/setup', '#/picks', '#/list', '#/map', '#/later', '#/mountain/eldora']) {
      expect(hashFor(routeFromHash(hash))).toBe(hash);
    }
  });
});
