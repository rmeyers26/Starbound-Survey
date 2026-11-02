import { describe, expect, it } from 'vitest';
import { faceTowards } from '../../src/engine/orientation';

// Rotating the +X axis by angle a around Y gives the direction (cos a, -sin a) in (x, z).
const facing = (a: number): { x: number; z: number } => ({ x: Math.cos(a), z: -Math.sin(a) });

describe('faceTowards', () => {
  it('turns the texture centre toward the target in every direction', () => {
    const from = { x: 10, z: 5 };
    for (const target of [
      { x: 20, z: 5 }, // east (+x)
      { x: 0, z: 5 }, // west
      { x: 10, z: 25 }, // +z
      { x: 10, z: -15 }, // -z
      { x: 13, z: 9 }, // diagonal
    ]) {
      const a = faceTowards(from, target);
      const length = Math.hypot(target.x - from.x, target.z - from.z);
      const want = { x: (target.x - from.x) / length, z: (target.z - from.z) / length };
      expect(facing(a).x).toBeCloseTo(want.x, 9);
      expect(facing(a).z).toBeCloseTo(want.z, 9);
    }
  });

  it('needs no rotation when the target is straight along +X', () => {
    expect(faceTowards({ x: 0, z: 0 }, { x: 5, z: 0 })).toBeCloseTo(0, 9);
  });

  it('returns 0 instead of NaN when both points are the same', () => {
    expect(faceTowards({ x: 3, z: 3 }, { x: 3, z: 3 })).toBe(0);
  });
});
