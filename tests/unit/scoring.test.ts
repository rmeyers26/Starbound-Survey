import { describe, it, expect } from 'vitest';
import {
  XP_FIRST_SCAN,
  XP_HIGHER_TIER,
  applyScan,
  nextScanTier,
  scannerTierFor,
  xpForScan,
} from '../../src/game/scoring';
import { createEmptySave } from '../../src/save/schema';

describe('nextScanTier', () => {
  it('starts at basic for a never-scanned object', () => {
    expect(nextScanTier(0, 1, 3)).toBe(1);
  });
  it('is limited by the scanner level', () => {
    expect(nextScanTier(1, 1, 3)).toBeNull(); // Cadet scanner cannot do tier 2
    expect(nextScanTier(1, 2, 3)).toBe(2);
  });
  it('is limited by how much data the object has', () => {
    expect(nextScanTier(1, 3, 1)).toBeNull(); // object has only basic data
  });
  it('is null when everything possible is done', () => {
    expect(nextScanTier(3, 3, 3)).toBeNull();
  });
});

describe('xpForScan (spec XP table)', () => {
  it('first scan = 20, higher tier = 10, repeat = 0', () => {
    expect(XP_FIRST_SCAN).toBe(20);
    expect(XP_HIGHER_TIER).toBe(10);
    expect(xpForScan(0, 1)).toBe(20);
    expect(xpForScan(1, 2)).toBe(10);
    expect(xpForScan(2, 3)).toBe(10);
    expect(xpForScan(1, 1)).toBe(0);
    expect(xpForScan(2, 1)).toBe(0);
  });
});

describe('applyScan', () => {
  it('awards XP, records the tier, and does not mutate the original save', () => {
    const before = createEmptySave();
    const out = applyScan(before, 'moon', 1);
    expect(out.xpAwarded).toBe(20);
    expect(out.record.xp).toBe(20);
    expect(out.record.scannedObjects).toEqual({ moon: 1 });
    expect(out.rankedUpTo).toBeNull();
    expect(before.xp).toBe(0);
    expect(before.scannedObjects).toEqual({});
  });
  it('re-scanning the same tier gives nothing (no farming)', () => {
    const first = applyScan(createEmptySave(), 'moon', 1).record;
    const again = applyScan(first, 'moon', 1);
    expect(again.xpAwarded).toBe(0);
    expect(again.record.xp).toBe(20);
  });
  it('a deeper tier on a known object gives 10 and raises the stored tier', () => {
    const first = applyScan(createEmptySave(), 'moon', 1).record;
    const deeper = applyScan(first, 'moon', 2);
    expect(deeper.xpAwarded).toBe(10);
    expect(deeper.record.scannedObjects.moon).toBe(2);
  });
  it('never lowers a stored tier', () => {
    const deep = { ...createEmptySave(), scannedObjects: { moon: 3 } };
    expect(applyScan(deep, 'moon', 1).record.scannedObjects.moon).toBe(3);
  });
  it("reports a rank-up and unlocks the new rank's regions exactly once", () => {
    const nearly = { ...createEmptySave(), xp: 190 };
    const up = applyScan(nearly, 'earth', 1); // +20 -> 210
    expect(up.rankedUpTo).toBe('Navigator');
    expect(up.record.rank).toBe('Navigator');
    expect(up.newRegions).toEqual(['outer']);
    expect(up.record.unlockedRegions).toEqual(['inner', 'outer']);
    const later = applyScan(up.record, 'sun', 1);
    expect(later.rankedUpTo).toBeNull();
    expect(later.newRegions).toEqual([]);
    expect(later.record.unlockedRegions).toEqual(['inner', 'outer']);
  });
  it('scannerTierFor follows the saved rank', () => {
    expect(scannerTierFor({ ...createEmptySave(), rank: 'Navigator' })).toBe(2);
    expect(scannerTierFor(createEmptySave())).toBe(1);
  });
});
