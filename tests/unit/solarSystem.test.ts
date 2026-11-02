import { describe, it, expect } from 'vitest';
import realData from '../../data/objects.json';
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
});
