import { describe, expect, it } from 'vitest';
import realData from '../../data/objects.json';
import { splitLayersByTier } from '../../src/game/tiers';
import { validateObjects } from '../../src/game/validateObjects';

const objects = validateObjects(realData);
const sun = objects.find((o) => o.id === 'sun')!;
const layers = sun.layers!;
const byId = (id: string) => layers.find((l) => l.id === id)!;

describe("the Sun's layers (NASA's seven zones)", () => {
  it('has the seven layers, listed from the inside out', () => {
    expect(layers.map((l) => l.name)).toEqual([
      'The Core',
      'The Radiative Zone',
      'The Convection Zone',
      'The Photosphere',
      'The Chromosphere',
      'The Transition Region',
      'The Corona',
    ]);
  });

  it('puts three layers inside the Sun and four in its atmosphere', () => {
    expect(layers.filter((l) => l.zone === 'interior').map((l) => l.id)).toEqual([
      'core',
      'radiative-zone',
      'convection-zone',
    ]);
    expect(layers.filter((l) => l.zone === 'atmosphere').map((l) => l.id)).toEqual([
      'photosphere',
      'chromosphere',
      'transition-region',
      'corona',
    ]);
  });

  it("keeps NASA's key facts in the descriptions", () => {
    expect(byId('core').summary).toMatch(/hydrogen to form helium/);
    expect(byId('radiative-zone').summary).toMatch(/radiation/);
    expect(byId('convection-zone').summary).toMatch(/200,000 km/);
    expect(byId('convection-zone').summary).toMatch(/granules and supergranules/);
    expect(byId('photosphere').summary).toBe('The visible surface of the Sun.');
    expect(byId('chromosphere').summary).toMatch(/6,000 °C to about 20,000 °C/);
    expect(byId('transition-region').summary).toMatch(
      /separates the hot corona from the much cooler chromosphere/,
    );
    expect(byId('corona').summary).toBe("The Sun's outer atmosphere.");
  });

  it('draws the bands with no gaps and no overlaps, from the centre to the edge', () => {
    const sorted = [...layers].sort((a, b) => a.ring[0] - b.ring[0]);
    expect(sorted[0].ring[0]).toBe(0);
    expect(sorted.at(-1)!.ring[1]).toBe(1);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].ring[0], sorted[i].id).toBeCloseTo(sorted[i - 1].ring[1], 9);
    }
  });

  it('draws the inside of the Sun to scale: the core reaches about a quarter of the radius, the radiative zone about 70%', () => {
    const sunEdge = byId('photosphere').ring[0]; // where the Sun's body ends in the picture
    expect(byId('core').ring[1] / sunEdge).toBeCloseTo(0.25, 2);
    expect(byId('radiative-zone').ring[1] / sunEdge).toBeCloseTo(0.7, 2);
    expect(byId('convection-zone').ring[1] / sunEdge).toBeCloseTo(1, 9);
  });

  it('is clear where the information comes from', () => {
    expect(sun.layersSource).toMatch(/NASA/);
    expect(sun.layersSource).toMatch(/not yet confirmed/); // honest: the page address still needs confirming
  });

  it('only the Sun has layers so far', () => {
    expect(objects.filter((o) => o.layers).map((o) => o.id)).toEqual(['sun']);
  });
});

describe('revealing layers by scan level', () => {
  const names = (tier: number) => splitLayersByTier(sun, tier).unlocked.map((l) => l.id);

  it('shows nothing before the first scan', () => {
    expect(names(0)).toEqual([]);
    expect(splitLayersByTier(sun, 0).locked).toHaveLength(7);
  });

  it('a basic scan reveals the atmosphere, which can be seen from outside', () => {
    expect(names(1)).toEqual(['photosphere', 'chromosphere', 'transition-region', 'corona']);
  });

  it('a detailed scan adds the convection and radiative zones', () => {
    expect(names(2)).toEqual(
      expect.arrayContaining(['convection-zone', 'radiative-zone', 'photosphere', 'corona']),
    );
    expect(names(2)).toHaveLength(6);
    expect(names(2)).not.toContain('core');
  });

  it('a spectral scan reveals the core, the deepest layer, and so everything', () => {
    expect(names(3)).toHaveLength(7);
    expect(splitLayersByTier(sun, 3).locked).toEqual([]);
  });

  it('every layer is either revealed or still hidden, never both or neither', () => {
    for (const tier of [0, 1, 2, 3]) {
      const { unlocked, locked } = splitLayersByTier(sun, tier);
      expect(unlocked.length + locked.length).toBe(7);
    }
  });

  it('an object without layers has none to reveal', () => {
    const earth = objects.find((o) => o.id === 'earth')!;
    expect(splitLayersByTier(earth, 3)).toEqual({ unlocked: [], locked: [] });
  });
});

describe('validating layers in the data file', () => {
  const base = realData.find((o) => o.id === 'moon')!;
  const goodLayer = {
    id: 'crust',
    name: 'The Crust',
    zone: 'interior',
    summary: 'The outer shell.',
    ring: [0.5, 1],
    color: '#aabbcc',
  };
  // `extra` holds the object's other layer fields; pass {} to leave layersSource out entirely.
  const problemsFor = (
    layers: unknown,
    extra: Record<string, unknown> = { layersSource: 'A source' },
  ) => {
    try {
      validateObjects([{ ...base, layers, ...extra }]);
      return [];
    } catch (error) {
      return (error as { problems: string[] }).problems;
    }
  };

  it('accepts a well-formed layer', () => {
    expect(problemsFor([goodLayer])).toEqual([]);
    expect(problemsFor([{ ...goodLayer, tier: 'detailed', detail: 'More.' }])).toEqual([]);
  });

  it('rejects a bad zone, tier, colour or ring', () => {
    expect(problemsFor([{ ...goodLayer, zone: 'sideways' }]).join()).toMatch(/zone/);
    expect(problemsFor([{ ...goodLayer, tier: 'deep' }]).join()).toMatch(/tier/);
    expect(problemsFor([{ ...goodLayer, color: 'red' }]).join()).toMatch(/color/);
    expect(problemsFor([{ ...goodLayer, ring: [0.8, 0.2] }]).join()).toMatch(/ring/); // inner above outer
    expect(problemsFor([{ ...goodLayer, ring: [0, 1.5] }]).join()).toMatch(/ring/); // beyond the edge
    expect(problemsFor([{ ...goodLayer, ring: [0.1] }]).join()).toMatch(/ring/);
  });

  it('rejects missing text and duplicate ids', () => {
    expect(problemsFor([{ ...goodLayer, summary: '' }]).join()).toMatch(/summary/);
    expect(problemsFor([{ ...goodLayer, name: undefined }]).join()).toMatch(/name/);
    expect(problemsFor([goodLayer, goodLayer]).join()).toMatch(/duplicate/);
  });

  it('rejects an empty list or a list that is not a list', () => {
    expect(problemsFor([]).join()).toMatch(/non-empty list/);
    expect(problemsFor('layers').join()).toMatch(/non-empty list/);
  });

  it('demands a source for the layers (honest science)', () => {
    expect(problemsFor([goodLayer], {}).join()).toMatch(/layersSource/); // left out entirely
    expect(problemsFor([goodLayer], { layersSource: '' }).join()).toMatch(/layersSource/); // empty
  });
});
