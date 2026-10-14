import type { RegionDataset } from './types';
import { CALIFORNIA } from './california';
import { COLORADO } from './colorado';
import { NEW_MEXICO } from './newMexico';
import { UTAH } from './utah';

/** Every mountain batch beyond the original fifteen, in the order the list and map add them. */
export const REGION_DATASETS: RegionDataset[] = [COLORADO, UTAH, NEW_MEXICO, CALIFORNIA];

export type { DemoCharacter, RegionDataset } from './types';
