import { describe, it, expect } from 'vitest';
import realData from '../../data/objects.json';
import { focusDistance, scanRange } from '../../src/engine/scale';
import {
  DEFAULT_SCAN_SECONDS,
  ScanSession,
  SCAN_BLOCK_MESSAGE,
  checkScan,
  readScanSeconds,
} from '../../src/game/scanner';
import { objectMaxTier, splitByTier, tierNumber } from '../../src/game/tiers';
import { validateObjects } from '../../src/game/validateObjects';
import { createEmptySave } from '../../src/save/schema';

const objects = validateObjects(realData);
const moon = objects.find((o) => o.id === 'moon')!;

describe('ScanSession', () => {
  it('fills from 0 to 1 over the duration, using real elapsed time', () => {
    const s = new ScanSession(3);
    expect(s.progress(0)).toBe(0);
    s.start(1000);
    expect(s.active).toBe(true);
    expect(s.progress(1000)).toBe(0);
    expect(s.progress(2500)).toBeCloseTo(0.5);
    expect(s.progress(4000)).toBe(1);
    expect(s.progress(99999)).toBe(1); // never above 1
  });
  it('cancelling resets it', () => {
    const s = new ScanSession(3);
    s.start(0);
    s.cancel();
    expect(s.active).toBe(false);
    expect(s.progress(5000)).toBe(0);
  });
});

describe('readScanSeconds (testing override)', () => {
  it('uses 3 seconds by default', () => {
    expect(DEFAULT_SCAN_SECONDS).toBe(3);
    expect(readScanSeconds('')).toBe(3);
  });
  it('reads a valid override and clamps extremes', () => {
    expect(readScanSeconds('?scanSeconds=0.5')).toBe(0.5);
    expect(readScanSeconds('?scanSeconds=0')).toBe(0.2);
    expect(readScanSeconds('?scanSeconds=999')).toBe(10);
  });
  it('ignores nonsense', () => {
    expect(readScanSeconds('?scanSeconds=abc')).toBe(3);
  });
});

describe('checkScan', () => {
  const base = {
    state: 'EXPLORE' as const,
    object: moon,
    record: createEmptySave(),
    distance: 4,
    range: scanRange(0.55),
  };

  it('allows a scan in range and says which tier it reveals', () => {
    expect(checkScan(base)).toEqual({ ok: true, tier: 1 });
  });
  it('blocks when a screen is open', () => {
    expect(checkScan({ ...base, state: 'LOGBOOK' })).toEqual({
      ok: false,
      reason: 'not-exploring',
    });
  });
  it('blocks with nothing selected', () => {
    expect(checkScan({ ...base, object: undefined })).toEqual({
      ok: false,
      reason: 'no-selection',
    });
  });
  it('blocks when too far, or when the distance is unknown', () => {
    expect(checkScan({ ...base, distance: 150 })).toEqual({ ok: false, reason: 'too-far' });
    expect(checkScan({ ...base, distance: null })).toEqual({ ok: false, reason: 'too-far' });
  });
  it('is allowed at exactly the range limit', () => {
    expect(checkScan({ ...base, distance: base.range }).ok).toBe(true);
  });
  it('blocks when this scanner has nothing deeper to reveal (Cadet after a basic scan)', () => {
    const scanned = { ...createEmptySave(), scannedObjects: { moon: 1 } };
    expect(checkScan({ ...base, record: scanned })).toEqual({ ok: false, reason: 'complete' });
  });
  it('offers the deeper tier once the rank allows it', () => {
    const navigator = {
      ...createEmptySave(),
      rank: 'Navigator',
      xp: 200,
      scannedObjects: { moon: 1 },
    };
    expect(checkScan({ ...base, record: navigator })).toEqual({ ok: true, tier: 2 });
  });
  it('has a player-facing message for every block reason', () => {
    for (const msg of Object.values(SCAN_BLOCK_MESSAGE)) expect(msg.length).toBeGreaterThan(5);
  });
});

describe('scan range (compressed scale)', () => {
  it('is twice the focus distance, so flying to an object always puts it in range', () => {
    expect(scanRange(2)).toBe(focusDistance(2) * 2);
    expect(focusDistance(2)).toBeLessThan(scanRange(2));
  });
  it('is far smaller than the overview distance, so you must fly in to scan', () => {
    for (const r of [8, 2, 0.55]) expect(scanRange(r)).toBeLessThan(150);
  });
});

describe('tiers in the real data', () => {
  it('numbers tiers 1 to 3 and treats missing tier as basic', () => {
    expect(tierNumber({})).toBe(1);
    expect(tierNumber({ tier: 'detailed' })).toBe(2);
    expect(tierNumber({ tier: 'spectral' })).toBe(3);
  });
  it('every object has basic data, so a first scan always reveals something', () => {
    for (const o of objects) expect(splitByTier(o, 1).unlocked.length).toBeGreaterThan(0);
  });
  it('splits Moon data by tier with nothing lost or duplicated', () => {
    const total = Object.keys(moon.data).length;
    for (const tier of [0, 1, 2, 3]) {
      const split = splitByTier(moon, tier);
      expect(split.unlocked.length + split.locked.length).toBe(total);
    }
    expect(splitByTier(moon, 0).unlocked).toEqual([]);
    expect(splitByTier(moon, 3).locked).toEqual([]);
  });
  it('shows only the basic measurements after a basic scan', () => {
    const labels = splitByTier(moon, 1).unlocked.map((m) => m.label);
    expect(labels).toEqual(['Mean diameter', 'Average distance from Earth']);
    expect(objectMaxTier(moon)).toBe(3);
  });
});
