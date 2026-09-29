import { describe, expect, it } from 'vitest';
import { decodePolyline } from './polyline';

describe('decodePolyline', () => {
  it('decodes Google\'s own documented example exactly', () => {
    // https://developers.google.com/maps/documentation/utilities/polylinealgorithm
    const points = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(points).toEqual([
      { lat: 38.5, lon: -120.2 },
      { lat: 40.7, lon: -120.95 },
      { lat: 43.252, lon: -126.453 },
    ]);
  });

  it('returns an empty list for an empty string', () => {
    expect(decodePolyline('')).toEqual([]);
  });

  it('handles a single-point polyline', () => {
    const points = decodePolyline('_p~iF~ps|U');
    expect(points).toEqual([{ lat: 38.5, lon: -120.2 }]);
  });
});
