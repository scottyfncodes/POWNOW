import type { GeoPoint } from '@/domain/mountain';

/**
 * Decodes Google's polyline encoding (the same algorithm Google Maps,
 * Google Routes, and the Google Maps Roads API all use) into a list of
 * real lat/lon points describing the actual driven road geometry.
 *
 * This is the one piece of route *shape* SNOWNOW ever draws: everywhere
 * else a "route" is a duration/distance number from Google Routes, honestly
 * labelled. When this decodes a real `encodedPolyline` from the traffic
 * proxy, the line on the map is the real road path, not a straight guess.
 *
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string): GeoPoint[] {
  const points: GeoPoint[] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  const decodeNext = (): number => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    lat += decodeNext();
    lon += decodeNext();
    points.push({ lat: lat / 1e5, lon: lon / 1e5 });
  }

  return points;
}
