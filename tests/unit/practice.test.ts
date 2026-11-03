import { describe, expect, it } from 'vitest';
import { mergeScans, practiceRecord } from '../../src/game/practice';
import { RANKS, regionsUnlockedAt } from '../../src/game/ranks';
import { applyScan, scannerTierFor } from '../../src/game/scoring';
import { defaultSettings, normalizeSettings } from '../../src/game/settings';
import { createEmptySave } from '../../src/save/schema';

describe('practiceRecord (everything unlocked, nothing real changed)', () => {
  const real = {
    ...createEmptySave(),
    xp: 130,
    inspectedObjects: { moon: 2 },
    scannedObjects: { moon: 1, earth: 2 },
  };

  it('unlocks every region, including ones no real rank has reached', () => {
    const record = practiceRecord(real, {});
    expect(record.unlockedRegions).toEqual(regionsUnlockedAt(RANKS.length - 1));
    for (const region of ['inner', 'outer', 'kuiper', 'galaxies', 'extreme']) {
      expect(record.unlockedRegions).toContain(region);
    }
  });

  it('gives the best scanner immediately, with no XP needed', () => {
    expect(scannerTierFor(real)).toBe(1); // a real Cadet can only do basic scans
    expect(scannerTierFor(practiceRecord(real, {}))).toBe(3); // practice can do every tier
    expect(real.xp).toBeLessThan(RANKS[1].xp); // ... even though the real XP is below Navigator
  });

  it('never changes the real record, and leaves real XP and saved data exactly as they were', () => {
    const before = JSON.stringify(real);
    const record = practiceRecord(real, { jupiter: 3 });
    expect(JSON.stringify(real)).toBe(before); // the input is not modified
    expect(record.xp).toBe(real.xp);
    expect(record.inspectedObjects).toEqual(real.inspectedObjects);
    expect(real.rank).toBe('Cadet');
    expect(real.unlockedRegions).toEqual(['inner']);
  });

  it('shows real scans and practice scans together, keeping the deeper tier', () => {
    const record = practiceRecord(real, { moon: 3, jupiter: 2 });
    expect(record.scannedObjects).toEqual({ moon: 3, earth: 2, jupiter: 2 });
    expect(practiceRecord(real, { moon: 1, earth: 1 }).scannedObjects).toEqual({
      moon: 1,
      earth: 2,
    });
  });
});

describe('mergeScans', () => {
  it('takes the deepest tier per object and ignores nothing', () => {
    expect(mergeScans({ a: 1, b: 3 }, { a: 2, c: 1 })).toEqual({ a: 2, b: 3, c: 1 });
    expect(mergeScans({}, {})).toEqual({});
  });
  it('does not change either input', () => {
    const a = { a: 1 };
    const b = { a: 2 };
    mergeScans(a, b);
    expect(a).toEqual({ a: 1 });
    expect(b).toEqual({ a: 2 });
  });
});

describe('a practice scan (applyScan without progress)', () => {
  const start = { ...createEmptySave(), xp: 190 }; // 10 XP short of Navigator

  it('still reveals the data, but awards no XP, no rank-up and no new region', () => {
    const outcome = applyScan(start, 'moon', 1, false);
    expect(outcome.record.scannedObjects.moon).toBe(1);
    expect(outcome.xpAwarded).toBe(0);
    expect(outcome.record.xp).toBe(190);
    expect(outcome.rankedUpTo).toBeNull();
    expect(outcome.newRegions).toEqual([]);
    expect(outcome.record.rank).toBe('Cadet');
  });

  it('is the normal scan (20 XP, and here a rank-up) when progress is awarded', () => {
    const outcome = applyScan(start, 'moon', 1);
    expect(outcome.xpAwarded).toBe(20);
    expect(outcome.rankedUpTo).toBe('Navigator');
    expect(outcome.newRegions).toEqual(['outer']);
  });
});

describe('practiceMode setting', () => {
  const defaults = defaultSettings(false);

  it('is off by default', () => {
    expect(defaults.practiceMode).toBe(false);
  });

  it('keeps a valid saved value and ignores a bad one', () => {
    expect(normalizeSettings({ practiceMode: true }, defaults).practiceMode).toBe(true);
    expect(normalizeSettings({ practiceMode: 'yes' }, defaults).practiceMode).toBe(false);
    expect(normalizeSettings({}, defaults).practiceMode).toBe(false);
    expect(normalizeSettings(null, defaults).practiceMode).toBe(false);
  });
});
