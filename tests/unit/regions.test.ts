import { describe, expect, it } from 'vitest';
import {
  isObjectUnlocked,
  isRegionUnlocked,
  rankThatUnlocks,
  unlockedObjects,
  visibleBodyIds,
} from '../../src/game/regions';
import type { CelestialObject } from '../../src/game/types';

const make = (id: string, region: string): CelestialObject => ({
  id,
  name: id,
  type: 'planet',
  imageType: 'simulation',
  region,
  quick: 'x',
  data: {},
  source: 'x',
});
const objects = [make('earth', 'inner'), make('mars', 'inner'), make('jupiter', 'outer')];

describe('regions', () => {
  it('a new player has only the inner region', () => {
    const progress = { unlockedRegions: ['inner'] };
    expect(isRegionUnlocked('inner', progress)).toBe(true);
    expect(isRegionUnlocked('outer', progress)).toBe(false);
    expect(isObjectUnlocked(objects[2], progress)).toBe(false);
  });

  it('filters objects to the unlocked ones and keeps their order', () => {
    expect(unlockedObjects(objects, { unlockedRegions: ['inner'] }).map((o) => o.id)).toEqual([
      'earth',
      'mars',
    ]);
    expect(
      unlockedObjects(objects, { unlockedRegions: ['inner', 'outer'] }).map((o) => o.id),
    ).toEqual(['earth', 'mars', 'jupiter']);
  });

  it('gives the set of body ids a view may draw', () => {
    expect([...visibleBodyIds(objects, ['inner'])]).toEqual(['earth', 'mars']);
    expect(visibleBodyIds(objects, []).size).toBe(0);
  });

  it('names the rank that unlocks a region, for the "reach Navigator" message', () => {
    expect(rankThatUnlocks('inner')?.name).toBe('Cadet');
    expect(rankThatUnlocks('outer')?.name).toBe('Navigator');
    expect(rankThatUnlocks('nowhere')).toBeUndefined();
  });
});
