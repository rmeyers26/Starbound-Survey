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
