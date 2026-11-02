// Pure orbit maths (no Three.js, no DOM), so it is easy to unit test.
// All orbits are circles in the horizontal X/Z plane, which keeps the prototype simple.

const TWO_PI = Math.PI * 2;

/** Angle (radians, 0..2π) around the orbit after `simDays` simulated days. */
export function orbitAngle(periodDays: number, simDays: number): number {
  if (!(periodDays > 0)) throw new RangeError('periodDays must be greater than 0');
  // `% TWO_PI` keeps the number small so precision does not degrade in long sessions.
  const angle = ((simDays / periodDays) * TWO_PI) % TWO_PI;
  return angle < 0 ? angle + TWO_PI : angle;
}

/** Position on a circular orbit around the origin. */
export function orbitPosition(
  radius: number,
  periodDays: number,
  simDays: number,
): { x: number; z: number } {
  const angle = orbitAngle(periodDays, simDays);
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}
