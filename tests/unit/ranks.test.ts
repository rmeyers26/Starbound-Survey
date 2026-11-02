import { describe, it, expect } from 'vitest';
import {
  RANKS,
  firstRankForTier,
  progressToNextRank,
  rankByName,
  rankForXp,
  rankIndexForXp,
  regionsUnlockedAt,
} from '../../src/game/ranks';

describe('ranks (spec table)', () => {
  it('has the five ranks with the spec thresholds', () => {
    expect(RANKS.map((r) => [r.name, r.xp])).toEqual([
      ['Cadet', 0],
      ['Navigator', 200],
      ['Surveyor', 600],
      ['Astronomer', 1400],
      ['Director', 2800],
    ]);
  });
  it('picks the right rank at and around each threshold', () => {
    expect(rankForXp(0).name).toBe('Cadet');
    expect(rankForXp(199).name).toBe('Cadet');
    expect(rankForXp(200).name).toBe('Navigator');
    expect(rankForXp(599).name).toBe('Navigator');
    expect(rankForXp(600).name).toBe('Surveyor');
    expect(rankForXp(2800).name).toBe('Director');
    expect(rankForXp(999999).name).toBe('Director');
    expect(rankIndexForXp(1400)).toBe(3);
  });
  it('scanner level rises with rank (spec: level 2 at Navigator, spectrometer at Surveyor)', () => {
    expect(rankByName('Cadet').scannerTier).toBe(1);
    expect(rankByName('Navigator').scannerTier).toBe(2);
    expect(rankByName('Surveyor').scannerTier).toBe(3);
  });
  it('unknown rank names fall back to Cadet instead of crashing', () => {
    expect(rankByName('Admiral').name).toBe('Cadet');
  });
  it('regions accumulate as ranks rise', () => {
    expect(regionsUnlockedAt(0)).toEqual(['inner']);
    expect(regionsUnlockedAt(1)).toEqual(['inner', 'outer']);
    expect(regionsUnlockedAt(4)).toHaveLength(8); // every region of the spec's catalog
  });
  it('tells which rank unlocks each scan tier', () => {
    expect(firstRankForTier(1).name).toBe('Cadet');
    expect(firstRankForTier(2).name).toBe('Navigator');
    expect(firstRankForTier(3).name).toBe('Surveyor');
  });
  it('reports progress toward the next rank', () => {
    const p = progressToNextRank(100);
    expect(p.rank.name).toBe('Cadet');
    expect(p.next?.name).toBe('Navigator');
    expect(p.fraction).toBeCloseTo(0.5);
    expect(progressToNextRank(400).fraction).toBeCloseTo(0.5); // halfway from 200 to 600
  });
  it('top rank has no next rank and a full bar', () => {
    const p = progressToNextRank(5000);
    expect(p.next).toBeNull();
    expect(p.fraction).toBe(1);
  });
});
