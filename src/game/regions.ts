// Which parts of the Solar System the player may use yet (spec: "Regions unlock by rank").
// Pure functions on plain data, so they are easy to test and the views, buttons and scanner all agree.
import type { SaveRecord } from '../save/schema';
import { RANKS, type RankDef } from './ranks';
import type { CelestialObject } from './types';

/** The part of a save these rules need. */
export type RegionProgress = Pick<SaveRecord, 'unlockedRegions'>;

/** True if the player has unlocked `region` (for example 'inner', 'outer'). */
export function isRegionUnlocked(region: string, progress: RegionProgress): boolean {
  return progress.unlockedRegions.includes(region);
}

export function isObjectUnlocked(object: CelestialObject, progress: RegionProgress): boolean {
  return isRegionUnlocked(object.region, progress);
}

/** Only the objects the player can currently use, in their original order. */
export function unlockedObjects(
  objects: CelestialObject[],
  progress: RegionProgress,
): CelestialObject[] {
  return objects.filter((o) => isObjectUnlocked(o, progress));
}

/** The ids of the objects whose region is in `unlockedRegions` (what a view should draw and let you pick). */
export function visibleBodyIds(objects: CelestialObject[], unlockedRegions: string[]): Set<string> {
  return new Set(objects.filter((o) => unlockedRegions.includes(o.region)).map((o) => o.id));
}

/** The first rank that unlocks `region`, for messages like "Reach Navigator to unlock it". */
export function rankThatUnlocks(region: string): RankDef | undefined {
  return RANKS.find((rank) => rank.regions.includes(region));
}
