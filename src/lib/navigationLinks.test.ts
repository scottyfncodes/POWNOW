import { describe, expect, it } from 'vitest';
import { appleMapsDirectionsUrl, googleMapsDirectionsUrl, isApplePlatform } from './navigationLinks';

const keystone = { lat: 39.6084, lon: -105.9437 };
const gps = { lat: 39.7047, lon: -105.0814 };

describe('appleMapsDirectionsUrl', () => {
  it('builds a driving-directions universal link with only the destination when no origin is known', () => {
    const url = appleMapsDirectionsUrl(keystone);
    expect(url).toBe('https://maps.apple.com/?daddr=39.6084%2C-105.9437&dirflg=d');
  });

  it('includes the exact origin coordinate when one is available', () => {
    const url = appleMapsDirectionsUrl(keystone, gps);
    expect(url).toContain('saddr=39.7047%2C-105.0814');
    expect(url).toContain('daddr=39.6084%2C-105.9437');
  });
});

describe('googleMapsDirectionsUrl', () => {
  it('builds a driving-directions universal link with only the destination when no origin is known', () => {
    const url = googleMapsDirectionsUrl(keystone);
    expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=39.6084%2C-105.9437&travelmode=driving');
  });

  it('includes the exact origin coordinate when one is available', () => {
    const url = googleMapsDirectionsUrl(keystone, gps);
    expect(url).toContain('origin=39.7047%2C-105.0814');
    expect(url).toContain('destination=39.6084%2C-105.9437');
  });
});

describe('isApplePlatform', () => {
  it('recognizes iPhone Safari', () => {
    expect(
      isApplePlatform({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
        platform: 'iPhone',
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it('recognizes iPadOS reporting as MacIntel with touch support', () => {
    expect(
      isApplePlatform({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it('recognizes desktop Safari on a real Mac', () => {
    expect(
      isApplePlatform({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 0,
      }),
    ).toBe(true);
  });

  it('does not misidentify Android as Apple', () => {
    expect(
      isApplePlatform({
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
        platform: 'Linux armv8l',
        maxTouchPoints: 5,
      }),
    ).toBe(false);
  });

  it('does not misidentify Windows as Apple', () => {
    expect(
      isApplePlatform({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        platform: 'Win32',
        maxTouchPoints: 0,
      }),
    ).toBe(false);
  });
});
