import { describe, it, expect } from 'vitest';
import realData from '../../data/objects.json';
import { DataValidationError, validateObjects } from '../../src/game/validateObjects';

// A minimal valid entry; tests copy it and break one thing at a time.
const good = () => ({
  id: 'test',
  name: 'Test',
  type: 'planet',
  imageType: 'simulation',
  region: 'inner',
  quick: 'A test object.',
  data: { diameter: { label: 'Diameter', value: 10, unit: 'km' } },
  source: 'Unit test',
});

const problemsFor = (raw: unknown): string[] => {
  try {
    validateObjects(raw);
  } catch (e) {
    if (e instanceof DataValidationError) return e.problems;
    throw e;
  }
  return [];
};

describe('validateObjects', () => {
  it('accepts a valid entry', () => {
    expect(validateObjects([good()])).toHaveLength(1);
  });
  it('rejects a non-array', () => {
    expect(problemsFor({})).toEqual(['Top level must be an array of objects']);
  });
  it('rejects a bad imageType', () => {
    const bad = { ...good(), imageType: 'photo' };
    expect(problemsFor([bad])[0]).toContain('"imageType"');
  });
  it('rejects a missing source', () => {
    const bad = { ...good(), source: '' };
    expect(problemsFor([bad])[0]).toContain('"source"');
  });
  it('rejects duplicate ids', () => {
    expect(problemsFor([good(), good()])).toContain('Entry "test": duplicate id');
  });
  it('rejects NaN and Infinity measurements', () => {
    const bad = { ...good(), data: { x: { label: 'X', value: Infinity } } };
    expect(problemsFor([bad])[0]).toContain('data.x.value');
  });
  it('reports every problem at once', () => {
    const bad = { ...good(), type: 'ufo', name: '' };
    expect(problemsFor([bad])).toHaveLength(2);
  });
});

describe('data/objects.json (the real game data)', () => {
  it('passes validation', () => {
    expect(problemsFor(realData)).toEqual([]);
  });
  it('contains the inner Solar System objects, ordered outward from the Sun', () => {
    const ids = validateObjects(realData).map((o) => o.id);
    expect(ids).toEqual([
      'sun',
      'mercury',
      'venus',
      'earth',
      'moon',
      'mars',
      'phobos',
      'deimos',
      'vesta',
      'ceres',
    ]);
  });
});

describe('measurement tiers', () => {
  it('accepts valid tiers and a missing tier', () => {
    const entry = {
      ...good(),
      data: {
        a: { label: 'A', value: 1, unit: 'km', tier: 'spectral' },
        b: { label: 'B', value: 2 },
      },
    };
    expect(problemsFor([entry])).toEqual([]);
  });
  it('rejects an unknown tier', () => {
    const entry = { ...good(), data: { a: { label: 'A', value: 1, tier: 'ultra' } } };
    expect(problemsFor([entry])[0]).toContain('data.a.tier');
  });
});
