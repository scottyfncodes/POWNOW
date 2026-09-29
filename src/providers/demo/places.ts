import type { Mountain, Origin } from '@/domain/mountain';
import { type Availability, ok } from '@/domain/provenance';
import type { PlaceKind, Place, PlacesProvider, ProviderContext } from '@/providers/types';

/**
 * Places exist only to serve the ski-day decision — mostly "where do I wait
 * out the eastbound wall". POW NOW is not a restaurant guide and this provider
 * stays deliberately thin.
 */
const CATALOG: Record<string, Place[]> = {
  vail: [
    { id: 'vail-apres-1', name: 'Vail Village patio bar', kind: 'apres', leg: 'mountain', detourMinutes: 0, note: 'Ski-off patio, 60 seconds from the gondola.' },
    { id: 'vail-coffee-1', name: 'Coffee in Frisco', kind: 'coffee', leg: 'outbound', detourMinutes: 6, note: 'Last good coffee before Vail Pass.' },
  ],
  breckenridge: [
    { id: 'breck-apres-1', name: 'Main Street brewery', kind: 'apres', leg: 'mountain', detourMinutes: 4, note: 'Walkable from the base, easy to wait out I-70.' },
    { id: 'breck-coffee-1', name: 'Coffee at the base', kind: 'coffee', leg: 'mountain', detourMinutes: 0, note: 'Open before first chair.' },
  ],
  keystone: [
    { id: 'keystone-apres-1', name: 'River Run taproom', kind: 'apres', leg: 'mountain', detourMinutes: 0, note: 'Right at the gondola.' },
  ],
  'beaver-creek': [
    { id: 'bc-apres-1', name: 'Avon taproom', kind: 'apres', leg: 'return', detourMinutes: 5, note: 'Just off the highway on the way home.' },
  ],
  'crested-butte': [
    { id: 'cb-apres-1', name: 'Elk Ave institution', kind: 'apres', leg: 'mountain', detourMinutes: 8, note: 'Worth the extra ten minutes.' },
  ],
  'winter-park': [
    { id: 'wp-apres-1', name: 'Base village pub', kind: 'apres', leg: 'mountain', detourMinutes: 0, note: 'Wait for Berthoud to settle down.' },
  ],
};

export class DemoPlacesProvider implements PlacesProvider {
  readonly id = 'demo-places';

  async getPlaces(
    mountain: Mountain,
    _origin: Origin,
    kinds: PlaceKind[],
    _context: ProviderContext,
  ): Promise<Availability<Place[]>> {
    const all = CATALOG[mountain.id] ?? [];
    const filtered = kinds.length === 0 ? all : all.filter((place) => kinds.includes(place.kind));
    return ok(filtered, {
      source: 'demo',
      observation: 'projected',
      confidence: 'low',
      provider: this.id,
      horizonDays: 0,
    });
  }
}
