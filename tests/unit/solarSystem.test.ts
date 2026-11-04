import { describe, it, expect } from 'vitest';
import realData from '../../data/objects.json';
import { VISUALS } from '../../src/engine/scale';
import { computePositions } from '../../src/engine/solarSystem';
import { validateObjects } from '../../src/game/validateObjects';

const objects = validateObjects(realData);

describe('computePositions', () => {
  it('puts the Sun at the centre and Earth/Moon at their start positions at time 0', () => {
    const p = computePositions(objects, 0);
    expect(p.get('sun')).toEqual({ x: 0, z: 0 });
    expect(p.get('earth')!.x).toBeCloseTo(60);
    expect(p.get('moon')!.x).toBeCloseTo(66); // Earth + moon orbit radius
  });
  it('keeps Earth 60 from the Sun and the Moon 6 from Earth at any time', () => {
    for (const days of [1, 50, 123.4, 9999]) {
      const p = computePositions(objects, days);
      const sun = p.get('sun')!;
      const earth = p.get('earth')!;
      const moon = p.get('moon')!;
      expect(Math.hypot(earth.x - sun.x, earth.z - sun.z)).toBeCloseTo(60);
      expect(Math.hypot(moon.x - earth.x, moon.z - earth.z)).toBeCloseTo(6);
    }
  });
  it('is back at the start after exactly one Earth year', () => {
    const p = computePositions(objects, 365.256);
    expect(p.get('earth')!.x).toBeCloseTo(60);
    expect(p.get('earth')!.z).toBeCloseTo(0);
  });
  it('throws a clear error if a period is missing from the data', () => {
    const broken = objects.map((o) => (o.id === 'earth' ? { ...o, data: {} } : o));
    expect(() => computePositions(broken, 0)).toThrow(/orbitalPeriod/);
  });

  describe('bodies do not move in sync', () => {
    const aroundSun = Object.keys(VISUALS).filter(
      (id) => VISUALS[id].orbit?.parentId === 'sun' && !VISUALS[id].comet,
    );
    /** Angle of a body around its parent, in degrees 0..360. */
    const angleOf = (
      positions: ReturnType<typeof computePositions>,
      id: string,
      parentId: string,
    ): number => {
      const body = positions.get(id)!;
      const parent = positions.get(parentId)!;
      const degrees = (Math.atan2(-(body.z - parent.z), body.x - parent.x) * 180) / Math.PI;
      return (degrees + 360) % 360;
    };
    /** Smallest turn between two angles (0..180). */
    const apart = (a: number, b: number): number => {
      const d = Math.abs(a - b) % 360;
      return d > 180 ? 360 - d : d;
    };

    it('the planets and asteroids do not start in a straight line: every pair starts at least 25 degrees apart', () => {
      const p = computePositions(objects, 0);
      for (let i = 0; i < aroundSun.length; i++) {
        for (let j = i + 1; j < aroundSun.length; j++) {
          const gap = apart(angleOf(p, aroundSun[i], 'sun'), angleOf(p, aroundSun[j], 'sun'));
          expect(gap, `${aroundSun[i]} and ${aroundSun[j]}`).toBeGreaterThanOrEqual(25);
        }
      }
    });

    it("the moons of one planet are spread round it too (Jupiter's four, Saturn's seven...)", () => {
      const p = computePositions(objects, 0);
      const parents = new Set(
        Object.keys(VISUALS)
          .map((id) => VISUALS[id].orbit?.parentId)
          .filter((parent): parent is string => parent !== undefined && parent !== 'sun'),
      );
      for (const parent of parents) {
        const moons = Object.keys(VISUALS).filter((id) => VISUALS[id].orbit?.parentId === parent);
        for (let i = 0; i < moons.length; i++) {
          for (let j = i + 1; j < moons.length; j++) {
            const gap = apart(angleOf(p, moons[i], parent), angleOf(p, moons[j], parent));
            expect(gap, `${moons[i]} and ${moons[j]} around ${parent}`).toBeGreaterThanOrEqual(20);
          }
        }
      }
    });

    it('each planet sweeps a different angle in the same stretch of time (no two move together)', () => {
      const before = computePositions(objects, 0);
      const after = computePositions(objects, 10);
      const swept = aroundSun.map((id) => {
        const turn = (angleOf(after, id, 'sun') - angleOf(before, id, 'sun') + 360) % 360;
        return { id, turn };
      });
      for (let i = 0; i < swept.length; i++) {
        for (let j = i + 1; j < swept.length; j++) {
          expect(
            Math.abs(swept[i].turn - swept[j].turn),
            `${swept[i].id} and ${swept[j].id} turned the same amount`,
          ).toBeGreaterThan(0.25);
        }
      }
    });

    it('the order of speed is the true order: the closer to the Sun, the faster', () => {
      const before = computePositions(objects, 0);
      const after = computePositions(objects, 10);
      const turned = (id: string) =>
        (angleOf(after, id, 'sun') - angleOf(before, id, 'sun') + 360) % 360;
      const nearToFar = [...aroundSun].sort(
        (a, b) => VISUALS[a].orbit!.radius - VISUALS[b].orbit!.radius,
      );
      for (let i = 1; i < nearToFar.length; i++) {
        expect(turned(nearToFar[i - 1]), `${nearToFar[i - 1]} vs ${nearToFar[i]}`).toBeGreaterThan(
          turned(nearToFar[i]),
        );
      }
    });
  });
});
