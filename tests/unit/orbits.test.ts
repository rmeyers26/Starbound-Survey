import { describe, it, expect } from 'vitest';
import { orbitAngle, orbitPosition } from '../../src/engine/orbits';

describe('orbitAngle', () => {
  it('is 0 at the start', () => {
    expect(orbitAngle(365, 0)).toBe(0);
  });
  it('is a quarter turn after a quarter of the period', () => {
    expect(orbitAngle(100, 25)).toBeCloseTo(Math.PI / 2);
  });
  it('wraps back to ~0 after a full period', () => {
    expect(orbitAngle(100, 100)).toBeCloseTo(0);
  });
  it('stays within 0..2π after many orbits', () => {
    const a = orbitAngle(27.322, 1e6);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(Math.PI * 2);
  });
  it('rejects a non-positive period', () => {
    expect(() => orbitAngle(0, 1)).toThrow(RangeError);
    expect(() => orbitAngle(-5, 1)).toThrow(RangeError);
  });
});

describe('orbitPosition', () => {
  it('starts on the +X axis', () => {
    const p = orbitPosition(60, 365, 0);
    expect(p.x).toBeCloseTo(60);
    expect(p.z).toBeCloseTo(0);
  });
  it('always stays at the requested radius', () => {
    for (const days of [0, 3, 77, 200, 12345]) {
      const p = orbitPosition(6, 27.322, days);
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(6);
    }
  });
});

describe('orbit direction', () => {
  // Angular momentum (the "spin direction" of a motion) is r x v. In this game Y is up (north), and
  // the right-handed cross product's Y part is z*vx - x*vz. Counter-clockwise seen from ABOVE the north
  // pole means that part is positive.
  const spinAboutNorth = (radius: number, period: number, days: number): number => {
    const step = 0.001;
    const a = orbitPosition(radius, period, days);
    const b = orbitPosition(radius, period, days + step);
    const vx = (b.x - a.x) / step;
    const vz = (b.z - a.z) / step;
    return a.z * vx - a.x * vz;
  };

  it('goes counter-clockwise seen from above the north pole, like every real planet', () => {
    for (const days of [0, 10, 50, 90, 200, 300]) {
      expect(spinAboutNorth(60, 365.256, days)).toBeGreaterThan(0);
    }
  });

  it('moves from +X toward -Z (right, then away from the camera) at the start', () => {
    const later = orbitPosition(60, 365.256, 10);
    expect(later.x).toBeGreaterThan(0);
    expect(later.z).toBeLessThan(0);
  });
});

describe('retrograde orbits', () => {
  const spin = (retrograde: boolean): number => {
    const step = 0.001;
    const a = orbitPosition(10, 100, 5, retrograde);
    const b = orbitPosition(10, 100, 5 + step, retrograde);
    return a.z * ((b.x - a.x) / step) - a.x * ((b.z - a.z) / step);
  };
  it('goes the opposite way round to a normal orbit', () => {
    expect(spin(false)).toBeGreaterThan(0); // counter-clockwise seen from above north
    expect(spin(true)).toBeLessThan(0); // clockwise
  });
  it('is the same circle, at the same speed, starting from the same place', () => {
    const normal = orbitPosition(10, 100, 25);
    const back = orbitPosition(10, 100, 25, true);
    expect(back.x).toBeCloseTo(normal.x); // same x ...
    expect(back.z).toBeCloseTo(-normal.z); // ... mirrored z
    expect(orbitPosition(10, 100, 0, true).x).toBeCloseTo(10);
  });
});
