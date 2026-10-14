import type { TicketPricingProfile } from '@/data/pricing';
import type { Mountain } from '@/domain/mountain';
import type { MountainProfile } from '@/domain/mountainProfile';
import type { ParkingInfo } from '@/domain/parking';

/**
 * The demo world's fixed character for one mountain — see
 * `providers/demo/scenario.ts`, which is the only reader. These are what make
 * a demo day *mean* something: a distinct strength and a distinct weakness.
 */
export interface DemoCharacter {
  /** Multiplier on regional snowfall. */
  snow: number;
  /** Multiplier on regional wind, before terrain exposure. */
  wind: number;
  /** Multiplier on lift/terrain reliability, >1 is more dependable. */
  operations: number;
  /** Multiplier on crowding. */
  crowds: number;
  /** How much of the open terrain gets groomed overnight, 0..1. */
  grooming: number;
  /** Typical avalanche-control delay on a big storm, minutes. */
  controlDelay: number;
}

/**
 * Everything one batch of mountains brings with it, kept in one file so a
 * state's research lives together. The flat registries
 * (`mountains.ts`, `mountainProfiles.ts`, `parkingInfo.ts`, `pricing.ts`,
 * `providers/demo/scenario.ts`) merge every dataset in, so nothing
 * downstream knows or cares which file a mountain came from. Every record
 * is keyed by the mountain's id, and the integrity tests require all four
 * (profile, parking, pricing, demo character) for every mountain.
 */
export interface RegionDataset {
  mountains: Mountain[];
  profiles: Record<string, MountainProfile>;
  parking: Record<string, ParkingInfo>;
  pricing: Record<string, TicketPricingProfile>;
  demo: Record<string, DemoCharacter>;
}
