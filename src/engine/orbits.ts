// Pure orbit maths (no Three.js, no DOM), so it is easy to unit test.
// All orbits are circles in the horizontal X/Z plane, which keeps the prototype simple.
//
// DIRECTION: in the game's coordinates Y points up (toward celestial north). Every planet and moon in
// the Solar System circles the Sun (or its planet) COUNTER-CLOCKWISE when seen from above the north
// pole. Because Z points toward the viewer in this right-handed system, counter-clockwise means the
// angle must carry us from +X toward -Z. That is why z is MINUS sin(angle) below.

const TWO_PI = Math.PI * 2;

/**
 * Angle (radians, 0..2π) around the orbit after `simDays` simulated days.
 * `startAngle` is where on the circle the body is at day 0. Without it every body would start on the same
 * side of its parent, in one straight line, and look as if they move together.
 */
export function orbitAngle(periodDays: number, simDays: number, startAngle = 0): number {
  if (!(periodDays > 0)) throw new RangeError('periodDays must be greater than 0');
  // `% TWO_PI` keeps the number small so precision does not degrade in long sessions.
  const angle = (startAngle + (simDays / periodDays) * TWO_PI) % TWO_PI;
  return angle < 0 ? angle + TWO_PI : angle;
}

/** Position on a circular orbit around the origin. */
export function orbitPosition(
  radius: number,
  periodDays: number,
  simDays: number,
  retrograde = false,
  startAngle = 0,
): { x: number; z: number } {
  const angle = orbitAngle(periodDays, simDays, startAngle);
  // Retrograde means "backwards": the same circle, travelled the other way (Neptune's moon Triton does this).
  const direction = retrograde ? 1 : -1;
  return { x: Math.cos(angle) * radius, z: direction * Math.sin(angle) * radius };
}
