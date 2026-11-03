// Which way a body faces. Pure maths, so it can be tested without a browser.

export interface Point2D {
  x: number;
  z: number;
}

/**
 * The Moon is "tidally locked": it always shows the SAME face to Earth (the "near side").
 * This returns the rotation (in radians, around the vertical Y axis) that turns a sphere so that the
 * CENTRE of its texture faces `target`.
 *
 * Why the formula looks like this: in Three.js the centre of a sphere's image points along the +X
 * axis, and rotating by angle `a` around Y moves +X to (cos a, 0, -sin a).
 * We want that to equal the direction towards the target, (dx, dz) / length, so a = atan2(-dz, dx).
 *
 * Maps that put 0 degrees longitude in the middle of the image (NASA's Moon maps do) will then show
 * the familiar near side, with the dark "seas" (maria), toward Earth.
 */
export function faceTowards(from: Point2D, target: Point2D): number {
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  if (dx === 0 && dz === 0) return 0; // same spot: nothing to face
  return Math.atan2(-dz, dx);
}

/** Direction (radians, in the X/Z plane) pointing from one point to another. */
export function bearing(from: Point2D, to: Point2D): number {
  return Math.atan2(to.z - from.z, to.x - from.x);
}

/** Wraps an angle into the range -π..π, so "just past 359 degrees" becomes "a tiny step forward". */
export function wrapAngle(angle: number): number {
  const turn = Math.PI * 2;
  return angle - turn * Math.round(angle / turn);
}

/**
 * How much to change the camera's `yaw` so the camera travels WITH an orbiting body.
 *
 * A camera that follows a planet but never turns sees the Sun swing right round it once per year, and sees
 * a tidally locked moon (which turns once per orbit) spin. If the camera instead keeps the same angle to
 * the line joining the body and the thing it orbits, that thing holds still on screen: the Sun stays on
 * one side of a planet, and Earth hangs in the same part of the Moon's sky, which is how it looks from
 * there.
 *
 * `previous` and `current` are the bearings from the body to the thing it orbits on two consecutive frames.
 * The camera sits at x = sin(yaw), z = cos(yaw), so its compass angle is (π/2 - yaw): a turn of the
 * bearing by +d needs a yaw change of -d.
 */
export function coRotationYawDelta(previous: number, current: number): number {
  return -wrapAngle(current - previous);
}
