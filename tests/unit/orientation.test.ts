import { describe, expect, it } from 'vitest';
import { bearing, coRotationYawDelta, faceTowards, wrapAngle } from '../../src/engine/orientation';

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

describe('wrapAngle', () => {
  it('keeps angles in -π..π', () => {
    expect(wrapAngle(0)).toBeCloseTo(0);
    expect(wrapAngle(Math.PI * 2 + 0.1)).toBeCloseTo(0.1);
    expect(wrapAngle(-Math.PI * 2 - 0.1)).toBeCloseTo(-0.1);
    // Exactly half a turn is the same direction as +π and -π, so only its size matters.
    expect(Math.abs(wrapAngle(Math.PI * 3))).toBeCloseTo(Math.PI, 5);
  });
});

describe('camera co-rotation with an orbiting body', () => {
  // The camera's compass angle around its target, from the way CameraRig places it: x = sin(yaw), z = cos(yaw).
  const cameraCompass = (yaw: number): number => Math.PI / 2 - yaw;
  const sameDirection = (a: number, b: number): number => Math.abs(wrapAngle(a - b));

  it('keeps the camera at the same angle to the line from the body to what it orbits, all the way round', () => {
    const earth = { x: 0, z: 0 };
    const moonAt = (angle: number) => ({ x: 6 * Math.cos(angle), z: -6 * Math.sin(angle) });
    let previous = bearing(moonAt(0), earth);
    // Start with the camera on the Earth side of the Moon (its compass angle equals the bearing to Earth).
    let yaw = Math.PI / 2 - previous;
    for (let step = 1; step <= 200; step++) {
      const current = bearing(moonAt((step / 200) * Math.PI * 2 * 3), earth); // three full orbits
      yaw += coRotationYawDelta(previous, current);
      previous = current;
      expect(sameDirection(cameraCompass(yaw), current)).toBeLessThan(1e-9);
    }
  });

  it('does nothing when the body has not moved relative to its parent', () => {
    expect(coRotationYawDelta(1.2, 1.2)).toBeCloseTo(0);
  });

  it('takes the short way round when the bearing crosses the ±π seam', () => {
    // Bearing goes from just under π to just over -π: a tiny real step, not a near-full turn.
    expect(Math.abs(coRotationYawDelta(3.1, -3.1))).toBeLessThan(0.1);
  });
});
