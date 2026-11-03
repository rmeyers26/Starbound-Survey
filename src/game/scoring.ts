// The scoring rules for scanning (spec: "XP sources"), as pure functions with no DOM or storage.
import type { SaveRecord } from '../save/schema';
import { rankByName, rankIndexForXp, RANKS, regionsUnlockedAt } from './ranks';

export const XP_FIRST_SCAN = 20; // first scan of an object (basic tier)
export const XP_HIGHER_TIER = 10; // a deeper tier of an object you already scanned

/**
 * The tier the next scan of an object would reveal, or null if there is nothing new to learn:
 * either every tier this scanner can do is done, or the object has no deeper data.
 * `reached` is the deepest tier already scanned (0 = never scanned).
 */
export function nextScanTier(
  reached: number,
  scannerTier: number,
  objectMaxTier: number,
): number | null {
  const next = reached + 1;
  return next <= Math.min(scannerTier, objectMaxTier) ? next : null;
}

/** XP for completing a scan that reaches `newTier` (previous deepest tier was `previousTier`). */
export function xpForScan(previousTier: number, newTier: number): number {
  if (newTier <= previousTier) return 0; // re-scanning the same tier gives nothing: no farming
  return previousTier === 0 ? XP_FIRST_SCAN : XP_HIGHER_TIER;
}

export interface ScanOutcome {
  record: SaveRecord;
  xpAwarded: number;
  /** Name of the new rank when this scan caused a rank-up, otherwise null. */
  rankedUpTo: string | null;
  /** Regions that this rank-up newly unlocked (empty when none). */
  newRegions: string[];
}

/**
 * Applies a finished scan to a save record and reports what changed. Does not mutate the input.
 * With `awardProgress` false (practice mode) the scan is still recorded so its data is revealed, but it
 * earns no XP, so there is no rank-up and no new region.
 */
export function applyScan(
  record: SaveRecord,
  objectId: string,
  tier: number,
  awardProgress = true,
): ScanOutcome {
  const previous = record.scannedObjects[objectId] ?? 0;
  const xpAwarded = awardProgress ? xpForScan(previous, tier) : 0;
  const xp = record.xp + xpAwarded;

  const oldIndex = rankIndexForXp(record.xp);
  const newIndex = rankIndexForXp(xp);
  const rankedUp = newIndex > oldIndex;

  const known = new Set(record.unlockedRegions);
  const wanted = regionsUnlockedAt(newIndex);
  const newRegions = wanted.filter((r) => !known.has(r));

  return {
    record: {
      ...record,
      xp,
      rank: RANKS[newIndex].name,
      scannedObjects: { ...record.scannedObjects, [objectId]: Math.max(previous, tier) },
      unlockedRegions: [...record.unlockedRegions, ...newRegions],
    },
    xpAwarded,
    rankedUpTo: rankedUp ? RANKS[newIndex].name : null,
    newRegions,
  };
}

/** The deepest scan tier the player's current rank can perform. */
export const scannerTierFor = (record: SaveRecord): number => rankByName(record.rank).scannerTier;
