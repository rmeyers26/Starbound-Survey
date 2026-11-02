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
