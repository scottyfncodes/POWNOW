import { describe, expect, it } from 'vitest';
import { MOUNTAINS } from '@/data/mountains';
import { PARKING_INFO, parkingInfoFor } from '@/data/parkingInfo';

describe('parking info — data integrity', () => {
  it('gives every mountain in the dataset a researched parking entry', () => {
    for (const mountain of MOUNTAINS) {
      expect(parkingInfoFor(mountain.id), `missing parking info for ${mountain.id}`).not.toBeNull();
    }
  });

  it('never carries an entry for a mountain that does not exist', () => {
    const mountainIds = new Set(MOUNTAINS.map((mountain) => mountain.id));
    for (const id of Object.keys(PARKING_INFO)) {
      expect(mountainIds.has(id), `parking entry ${id} has no matching mountain`).toBe(true);
    }
  });

  it('never asserts a live occupancy status — no public live feed exists for any of these resorts', () => {
    for (const mountain of MOUNTAINS) {
      const info = parkingInfoFor(mountain.id)!;
      expect(info.status, `${mountain.id} parking status`).toBe('unknown');
      expect(info.occupied, `${mountain.id} occupied count`).toBeNull();
      expect(info.capacity, `${mountain.id} capacity`).toBeNull();
    }
  });

  it('backs every note with a real, checkable info URL', () => {
    for (const mountain of MOUNTAINS) {
      const info = parkingInfoFor(mountain.id)!;
      expect(info.notes.length, `${mountain.id} parking notes`).toBeGreaterThan(0);
      expect(info.infoUrl, `${mountain.id} parking infoUrl`).not.toBeNull();
      expect(() => new URL(info.infoUrl!)).not.toThrow();
    }
  });
});
