// Safety net: the game data (data/objects.json) and the scene table (VISUALS in scale.ts) are two
// separate lists that must agree. If someone adds an object to one and forgets the other, the game
// would crash or silently show nothing. These tests catch that immediately.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SIM_DAYS_PER_SECOND,
  VISUALS,
  overviewDistanceFor,
  reachFromSun,
} from '../../src/engine/scale';
import { visibleBodyIds } from '../../src/game/regions';
import { speedNote } from '../../src/ui/format';
import { auToScene, checkElements } from '../../src/engine/comet';
import { cometElementsOf, cometMoment, computePositions } from '../../src/engine/solarSystem';
import { textureUrlFor } from '../../src/engine/textures';
import { RANKS } from '../../src/game/ranks';
import { validateObjects } from '../../src/game/validateObjects';

const objects = validateObjects(JSON.parse(readFileSync('data/objects.json', 'utf8')));

describe('objects.json and the 3D scene agree', () => {
  it('every object in the data has a place in the scene', () => {
    const missing = objects.map((o) => o.id).filter((id) => !VISUALS[id]);
    expect(missing).toEqual([]);
  });

  it('every body in the scene has data (so it can be selected and scanned)', () => {
    const ids = new Set(objects.map((o) => o.id));
    expect(Object.keys(VISUALS).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('every orbiting body has a numeric orbital period and a real parent', () => {
    for (const [id, spec] of Object.entries(VISUALS)) {
      if (!spec.orbit) continue;
      expect(VISUALS[spec.orbit.parentId], `${id}'s parent`).toBeDefined();
    }
    expect(() => computePositions(objects, 0)).not.toThrow();
  });

  it('planets sit in order of distance from the Sun, as in real life', () => {
    const radius = (id: string): number => VISUALS[id].orbit!.radius;
    expect(radius('mercury')).toBeLessThan(radius('venus'));
    expect(radius('venus')).toBeLessThan(radius('earth'));
    expect(radius('earth')).toBeLessThan(radius('mars'));
  });

  it('every body is drawn in the same size order as its real diameter (Deimos smallest, Sun largest)', () => {
    const real = (id: string): number =>
      objects.find((o) => o.id === id)!.data.diameter.value as number;
    // A comet's nucleus size is "Not yet checked" (there is no number to order by), so it is left out of this one.
    const ids = Object.keys(VISUALS).filter((id) => !VISUALS[id].comet);
    const byScene = [...ids].sort((a, b) => VISUALS[a].radius - VISUALS[b].radius);
    const byReal = [...ids].sort((a, b) => real(a) - real(b));
    expect(byScene).toEqual(byReal);
  });

  it('planets are the real way round: nothing overlaps the Sun', () => {
    for (const id of ['mercury', 'venus', 'earth', 'mars']) {
      expect(VISUALS[id].orbit!.radius).toBeGreaterThan(VISUALS.sun.radius + VISUALS[id].radius);
    }
  });

  it('the simulation is slow enough to follow: the Moon takes at least 8 seconds to circle Earth', () => {
    const moonDays = objects.find((o) => o.id === 'moon')!.data.orbitalPeriod.value as number;
    expect(moonDays / SIM_DAYS_PER_SECOND).toBeGreaterThanOrEqual(8);
  });

  it('...but not so slow that Mars feels frozen (its year is under 5 minutes)', () => {
    const marsDays = objects.find((o) => o.id === 'mars')!.data.orbitalPeriod.value as number;
    expect(marsDays / SIM_DAYS_PER_SECOND).toBeLessThan(300);
  });

  it('every body that names a texture has a picture file for it (a typo would silently leave it flat)', () => {
    for (const [id, spec] of Object.entries(VISUALS)) {
      if (!spec.texture) continue;
      expect(textureUrlFor(spec.texture, 1024), `${id} 1k`).not.toBeNull();
      expect(textureUrlFor(spec.texture, 2048), `${id} 2k`).not.toBeNull();
    }
  });

  describe('display speed of orbits (sped up if too slow to see, slowed if a blur)', () => {
    const realPeriod = (id: string): number =>
      objects.find((o) => o.id === id)!.data.orbitalPeriod.value as number;
    const shownPeriod = (id: string): number => VISUALS[id].visualPeriodDays ?? realPeriod(id);
    const orbiting = Object.keys(VISUALS).filter((id) => VISUALS[id].orbit);
    const MIN_LAP_DAYS = 3 * SIM_DAYS_PER_SECOND; // a lap under 3 seconds is too fast to follow

    it('keeps the true order of speeds around each planet: Io laps faster than Europa, and so on', () => {
      const parents = new Set(orbiting.map((id) => VISUALS[id].orbit!.parentId));
      for (const parent of parents) {
        const family = orbiting.filter((id) => VISUALS[id].orbit!.parentId === parent);
        const byReal = [...family].sort((a, b) => realPeriod(a) - realPeriod(b));
        const byShown = [...family].sort((a, b) => shownPeriod(a) - shownPeriod(b));
        expect(byShown, `bodies orbiting ${parent}`).toEqual(byReal);
      }
    });

    const MAX_LAP_DAYS = 10 * 60 * SIM_DAYS_PER_SECOND; // a lap over 10 minutes looks frozen

    it('every lap takes between 3 seconds and 10 minutes: never a blur, never frozen', () => {
      for (const id of orbiting) {
        expect(shownPeriod(id), `${id} is too fast`).toBeGreaterThanOrEqual(MIN_LAP_DAYS);
        expect(shownPeriod(id), `${id} is too slow to see`).toBeLessThanOrEqual(MAX_LAP_DAYS);
      }
    });

    it('no orbit is drawn more than 60 times faster or slower than real', () => {
      for (const id of orbiting) {
        const change = Math.max(realPeriod(id) / shownPeriod(id), shownPeriod(id) / realPeriod(id));
        expect(change, id).toBeLessThanOrEqual(60);
      }
    });

    it('every body whose real lap would be a blur or frozen declares a display period', () => {
      for (const id of orbiting) {
        const real = realPeriod(id);
        if (real < MIN_LAP_DAYS || real > MAX_LAP_DAYS) {
          expect(VISUALS[id].visualPeriodDays, `${id} needs a display period`).toBeDefined();
        }
      }
    });

    it('the inner planets, the Moon and Iapetus are drawn at their true speed', () => {
      for (const id of ['mercury', 'venus', 'earth', 'mars', 'moon', 'iapetus']) {
        expect(VISUALS[id].visualPeriodDays, id).toBeUndefined();
      }
    });

    it('every orbit drawn at a different speed is explained to the player in the info panel', () => {
      for (const id of orbiting) {
        if (VISUALS[id].visualPeriodDays === undefined) continue;
        expect(speedNote(realPeriod(id), shownPeriod(id)), id).not.toBeNull();
      }
    });
  });

  describe("the direction every body really travels, from the game's own position code", () => {
    // Angular momentum about north (+Y) of a body relative to what it orbits: positive = counter-clockwise
    // seen from above the north pole, negative = clockwise.
    const spinAboutParent = (id: string): number => {
      const parent = VISUALS[id].orbit!.parentId;
      const t0 = computePositions(objects, 3);
      const t1 = computePositions(objects, 3.01);
      const rel = (m: ReturnType<typeof computePositions>) => ({
        x: m.get(id)!.x - m.get(parent)!.x,
        z: m.get(id)!.z - m.get(parent)!.z,
      });
      const a = rel(t0);
      const b = rel(t1);
      return a.z * (b.x - a.x) - a.x * (b.z - a.z);
    };

    it('every planet, asteroid and normal moon goes counter-clockwise seen from above north', () => {
      for (const id of Object.keys(VISUALS)) {
        if (!VISUALS[id].orbit || VISUALS[id].retrograde) continue;
        expect(spinAboutParent(id), id).toBeGreaterThan(0);
      }
    });

    it('Triton goes clockwise round Neptune, the opposite way to Io round Jupiter', () => {
      expect(spinAboutParent('io')).toBeGreaterThan(0);
      expect(spinAboutParent('triton')).toBeLessThan(0);
    });
  });

  describe('atmosphere haze', () => {
    const withAir = Object.keys(VISUALS).filter((id) => VISUALS[id].atmosphere);

    it('only worlds that really have a substantial atmosphere get one', () => {
      expect(withAir.sort()).toEqual(
        ['earth', 'jupiter', 'mars', 'neptune', 'saturn', 'titan', 'uranus', 'venus'].sort(),
      );
    });

    it('airless worlds get none (Mercury, our Moon, the asteroids and the small moons)', () => {
      for (const id of [
        'mercury',
        'moon',
        'ceres',
        'vesta',
        'phobos',
        'deimos',
        'europa',
        'enceladus',
      ]) {
        expect(VISUALS[id].atmosphere, id).toBeUndefined();
      }
    });

    it('every haze is a thin shell just outside its planet and not absurdly bright', () => {
      for (const id of withAir) {
        const { thickness, strength } = VISUALS[id].atmosphere!;
        expect(thickness, id).toBeGreaterThan(1.02);
        expect(thickness, id).toBeLessThan(1.3);
        expect(strength, id).toBeGreaterThan(0);
        expect(strength, id).toBeLessThanOrEqual(1.5);
      }
    });

    it('Venus and Titan (famously thick air) are hazier than thin-aired Mars', () => {
      const thickness = (id: string): number => VISUALS[id].atmosphere!.thickness;
      expect(thickness('venus')).toBeGreaterThan(thickness('mars'));
      expect(thickness('titan')).toBeGreaterThan(thickness('mars'));
    });
  });

  describe('retrograde orbits', () => {
    it('only Triton orbits the "wrong" way (Neptune\'s big moon is a captured object)', () => {
      expect(Object.keys(VISUALS).filter((id) => VISUALS[id].retrograde)).toEqual(['triton']);
    });
  });

  it('the first rank-up is reachable using ONLY the inner region (otherwise the game would dead-end)', () => {
    const firstScanXp = 20; // spec: first scan of an object = 20 XP
    const innerObjects = objects.filter((o) => o.region === 'inner');
    expect(innerObjects.length * firstScanXp).toBeGreaterThanOrEqual(RANKS[1].xp);
  });

  it('Surveyor is reachable using ONLY what Navigator can reach (first scan + detailed scan of every object)', () => {
    const firstScanXp = 20;
    const detailedScanXp = 10; // Navigator's scanner can do the detailed tier, not the spectral one
    const navigatorRegions = new Set([...RANKS[0].regions, ...RANKS[1].regions]);
    const reachable = objects.filter((o) => navigatorRegions.has(o.region));
    expect(reachable.length * (firstScanXp + detailedScanXp)).toBeGreaterThanOrEqual(RANKS[2].xp);
  });

  it('every object belongs to a region that some rank unlocks', () => {
    const unlockable = new Set(RANKS.flatMap((r) => r.regions));
    for (const o of objects) expect(unlockable.has(o.region), `${o.id}: ${o.region}`).toBe(true);
  });

  describe('framing the overview camera', () => {
    const reachOf = (regions: string[]): number => reachFromSun(visibleBodyIds(objects, regions));
    const MAX_CAMERA_DISTANCE = 700; // MAX_DISTANCE in cameraRig.ts

    it('the outer planets reach farther out than the inner system', () => {
      expect(reachOf(['inner', 'outer'])).toBeGreaterThan(reachOf(['inner']));
    });

    it("a moon adds its parent planet's orbit to its reach", () => {
      expect(reachFromSun(['phobos'])).toBe(
        VISUALS.mars.orbit!.radius + VISUALS.phobos.orbit!.radius,
      );
    });

    it('the overview widens when the outer region unlocks, and still fits within the camera limit', () => {
      const before = overviewDistanceFor(reachOf(['inner']));
      const after = overviewDistanceFor(reachOf(['inner', 'outer']));
      expect(after).toBeGreaterThan(before);
      expect(after).toBeLessThanOrEqual(MAX_CAMERA_DISTANCE);
    });

    it('with nothing unlocked the overview still has a sensible minimum', () => {
      expect(overviewDistanceFor(0)).toBeGreaterThanOrEqual(150);
    });
  });

  it('Saturn has rings and nothing else does', () => {
    expect(Object.keys(VISUALS).filter((id) => VISUALS[id].rings)).toEqual(['saturn']);
  });
});

describe('comet C/2026 A2 (Bok): only checked numbers, and everything else plainly marked', () => {
  const comet = objects.find((o) => o.id === 'c2026a2')!;
  const MISSING = 'Not yet checked';

  it('is a comet in the inner region, with a scene entry that names it a comet', () => {
    expect(comet.type).toBe('comet');
    expect(comet.region).toBe('inner');
    expect(VISUALS.c2026a2.comet).toBeDefined();
    expect(VISUALS.c2026a2.orbit).toBeUndefined(); // its orbit is not a circle
  });

  it('has exactly the checked numbers: closest distance 1.94 AU, tilt 82 degrees, shape 0.99761492', () => {
    expect(comet.data.perihelionDistance).toMatchObject({ value: 1.94, unit: 'AU' });
    expect(comet.data.inclination).toMatchObject({ value: 82, unit: 'degrees' });
    expect(comet.data.eccentricity.value).toBe(0.99761492);
  });

  it('marks every missing value "Not yet checked" instead of inventing it', () => {
    for (const key of [
      'perihelionDate',
      'nucleusDiameter',
      'ascendingNode',
      'argumentOfPerihelion',
    ]) {
      expect(String(comet.data[key].value), key).toContain(MISSING);
    }
    // The two angles the scene has to draw anyway are said to be placeholders on the info panel.
    expect(String(comet.data.ascendingNode.value)).toContain('drawn as 0 degrees');
    expect(String(comet.data.argumentOfPerihelion.value)).toContain('drawn as 0 degrees');
    // ...and the scene really does use 0 for them (the data and the scene must agree).
    expect(VISUALS.c2026a2.comet!.nodeDeg).toBe(0);
    expect(VISUALS.c2026a2.comet!.argPerihelionDeg).toBe(0);
  });

  it('says where each value came from, and that it has NOT yet been checked against JPL', () => {
    expect(comet.source).toMatch(/LESIA/);
    expect(comet.source).toMatch(/JPL/);
    expect(comet.source).toMatch(/NOT yet checked/);
    expect(comet.quick).toMatch(/replayed on a loop/);
  });

  it('gives the comet orbit built from the data a closed orbit that the maths accepts', () => {
    const elements = cometElementsOf(objects, 'c2026a2');
    expect(elements).toMatchObject({
      perihelionAu: 1.94,
      eccentricity: 0.99761492,
      inclinationDeg: 82,
    });
    expect(() => checkElements(elements)).not.toThrow();
  });

  it("is drawn at a distance from the Sun that fits the inner region's view, and never touches the Sun", () => {
    for (let days = 0; days < 400; days += 4) {
      const { x, y, z } = cometMoment(objects, 'c2026a2', days);
      const distanceFromSun = Math.hypot(x, y, z);
      expect(distanceFromSun).toBeGreaterThan(VISUALS.sun.radius + 5);
      expect(distanceFromSun).toBeLessThanOrEqual(
        auToScene(VISUALS.c2026a2.comet!.windowAu) + 1e-6,
      );
    }
  });

  it("is part of the overview framing, which covers the comet's whole path", () => {
    const inner = visibleBodyIds(objects, ['inner']);
    expect(inner.has('c2026a2')).toBe(true);
    expect(reachFromSun(inner)).toBeGreaterThanOrEqual(auToScene(VISUALS.c2026a2.comet!.windowAu));
  });

  it('shows up in the position list with a height (its orbit is tilted), and everything else stays flat', () => {
    // Day 200 into the loop: the comet is part way through its flyby, well above or below the planets' plane.
    const positions = computePositions(objects, 200);
    expect(Math.abs(positions.get('c2026a2')!.y!)).toBeGreaterThan(1);
    for (const [id, p] of positions) {
      if (id !== 'c2026a2') expect(p.y, id).toBeUndefined();
    }
  });

  it('is reachable without breaking the first rank-up (more objects only makes it easier)', () => {
    const inner = objects.filter((o) => o.region === 'inner');
    expect(inner.length * 20).toBeGreaterThanOrEqual(RANKS[1].xp);
  });
});
