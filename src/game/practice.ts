// Practice mode: explore everything with no XP requirements.
//
// How it works (the "overlay" idea): the game normally reads your SAVED record to decide what is unlocked and
// how deep your scanner can go. In practice mode it reads a VIRTUAL record built here instead: every region
// unlocked and the best scanner. Your real save is never changed by practice, so turning practice off puts you
// back exactly where you were. Practice scans are remembered only until the page is closed.
import type { SaveRecord } from '../save/schema';
import { RANKS, regionsUnlockedAt } from './ranks';

/** What practice mode has discovered so far: object id -> deepest tier scanned. Kept in memory only. */
export type PracticeScans = Record<string, number>;

/** Keeps the deeper tier for every object that appears in either list. */
export function mergeScans(a: PracticeScans, b: PracticeScans): PracticeScans {
  const merged: PracticeScans = { ...a };
  for (const [id, tier] of Object.entries(b)) merged[id] = Math.max(merged[id] ?? 0, tier);
  return merged;
}

/**
 * The record the game should use while practice mode is on. Everything is unlocked and the scanner is at its
 * best (the top rank's), your real scans stay visible, and practice scans are added on top. XP and everything
 * else are copied unchanged, so nothing here can raise or lower real progress. Does not change its inputs.
 */
export function practiceRecord(real: SaveRecord, practiceScans: PracticeScans): SaveRecord {
  const top = RANKS.length - 1;
  return {
    ...real,
    rank: RANKS[top].name,
    unlockedRegions: regionsUnlockedAt(top),
    scannedObjects: mergeScans(real.scannedObjects, practiceScans),
  };
}
