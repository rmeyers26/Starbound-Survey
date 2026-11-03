// The "cinematic" camera: a self-directing film crew that follows the spacecraft.
// It is built as PURE functions (no Three.js), so every shot can be unit tested like the flight rules.
//
// How a film camera differs from the other views:
//   - It CUTS between shots (a hard cut is the normal way films change angle), and moves smoothly within one.
//   - Every shot is described relative to the SHIP (a bit to its right, a bit above, a bit ahead), so when the ship
//     turns, the camera crew turns with it and the framing stays the same.
//   - It uses a narrower "telephoto" lens (CINEMATIC_FOV), which makes the ship look bigger against the stars.
// With Reduce motion on there is no sweeping and no cutting: one still, dramatic angle is held instead.
import { clamp, forwardVector, length, vec, type ShipState, type Vec3 } from './flight';
import type { CameraPose } from './shipViews';

/** The lens angle in degrees (the normal camera uses 50; smaller looks more like a film lens). */
export const CINEMATIC_FOV = 36;

type ShipPose = Pick<ShipState, 'position' | 'yaw' | 'pitch'>;

/** The directions that belong to the ship: where its nose points, and which way is its right-hand side. */
interface Frame {
  forward: Vec3;
  right: Vec3;
}

const WORLD_UP = vec(0, 1, 0);

function frameOf(ship: ShipPose): Frame {
  const forward = forwardVector(ship.yaw, ship.pitch);
  // right = forward x up, which works out to (-forward.z, 0, forward.x). It is zero if the nose points straight up
  // or down (the ship never does: pitch is limited).
  let right = vec(-forward.z, 0, forward.x);
  const l = length(right);
  right = l < 1e-6 ? vec(1, 0, 0) : vec(right.x / l, right.y / l, right.z / l);
  return { forward, right };
}

/** A point `right` units to the ship's right, `up` units above it and `ahead` units in front of it. */
function around(ship: ShipPose, frame: Frame, right: number, up: number, ahead: number): Vec3 {
  return vec(
    ship.position.x + frame.right.x * right + frame.forward.x * ahead,
    ship.position.y + up + frame.right.y * right + frame.forward.y * ahead,
    ship.position.z + frame.right.z * right + frame.forward.z * ahead,
  );
}

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;
/** Eases in and out, so a shot starts and ends gently (a camera on a real dolly does not start instantly). */
const ease = (t: number): number => t * t * (3 - 2 * t);

interface Shot {
  name: string;
  /** How long the shot lasts, in seconds. */
  seconds: number;
  /** The camera's position and what it looks at, for a progress `p` from 0 (start of the shot) to 1 (end). */
  frame(ship: ShipPose, f: Frame, p: number): { position: Vec3; lookAt: Vec3 };
}

export const SHOTS: readonly Shot[] = [
  {
    // The hero flyby: swing from behind the ship, round its right side, toward its nose.
    name: 'flyby',
    seconds: 7,
    frame(ship, f, p) {
      const e = ease(p);
      const angle = lerp(0.5, 2.7, e); // 0 = directly behind, pi/2 = beside, pi = in front
      const radius = lerp(3.6, 3.0, e);
      return {
        position: around(
          ship,
          f,
          Math.sin(angle) * radius,
          0.45 + 0.35 * Math.sin(e * Math.PI),
          -Math.cos(angle) * radius,
        ),
        lookAt: around(ship, f, 0, 0, 0.15),
      };
    },
  },
  {
    // A low tracking shot from the side: the ship slides past the camera from front to back.
    name: 'side track',
    seconds: 6,
    frame(ship, f, p) {
      const e = ease(p);
      return {
        position: around(ship, f, 2.3, -0.3, lerp(1.6, -1.0, e)),
        lookAt: around(ship, f, 0, 0, 0.1),
      };
    },
  },
  {
    // Head on: the camera flies ahead and a little above, looking back at the ship as it comes toward us (a front three-quarter view, so the wings show).
    name: 'head on',
    seconds: 5.5,
    frame(ship, f, p) {
      const e = ease(p);
      return {
        position: around(ship, f, lerp(1.7, 1.0, e), lerp(0.95, 0.65, e), lerp(4.0, 2.8, e)),
        lookAt: around(ship, f, 0, 0, 0),
      };
    },
  },
  {
    // An overhead dolly: high above and slightly behind, sliding across while looking down on the ship.
    name: 'overhead',
    seconds: 6,
    frame(ship, f, p) {
      const e = ease(p);
      return {
        position: around(ship, f, lerp(-1.1, 1.1, e), lerp(2.7, 1.9, e), -1.6),
        lookAt: around(ship, f, 0, 0, 0.8),
      };
    },
  },
];

/** The length of the whole sequence of shots, in seconds (it then starts again). */
export const CINEMATIC_LOOP_SECONDS = SHOTS.reduce((sum, shot) => sum + shot.seconds, 0);

/** Which shot is on at `elapsed` seconds, and how far through it we are (0 to 1). Nonsense times start at the beginning. */
export function shotAt(elapsed: number): { index: number; progress: number } {
  const time = Number.isFinite(elapsed) && elapsed > 0 ? elapsed % CINEMATIC_LOOP_SECONDS : 0;
  let start = 0;
  for (let index = 0; index < SHOTS.length; index++) {
    const end = start + SHOTS[index].seconds;
    if (time < end) return { index, progress: clamp((time - start) / SHOTS[index].seconds, 0, 1) };
    start = end;
  }
  return { index: 0, progress: 0 }; // cannot happen (time < loop length), but never leave the camera undefined
}

/** The still angle held with Reduce motion on: the flyby, part of the way through. */
const STILL_PROGRESS = 0.45;

/**
 * Where the film camera is, and what it looks at, at `elapsed` seconds into the sequence.
 * `reducedMotion` holds one still angle instead of moving and cutting.
 */
export function cinematicPose(ship: ShipPose, elapsed: number, reducedMotion = false): CameraPose {
  const frame = frameOf(ship);
  const { index, progress } = reducedMotion
    ? { index: 0, progress: STILL_PROGRESS }
    : shotAt(elapsed);
  const { position, lookAt } = SHOTS[index].frame(ship, frame, progress);
  return { position, lookAt, up: WORLD_UP, fov: CINEMATIC_FOV };
}
