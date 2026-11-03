// The spacecraft's flight rules, as PURE functions (no Three.js, no browser), so every rule can be unit tested.
//
// Design choice: "arcade" flight, not real physics. A throttle lever sets how fast you want to go, the ship eases
// to that speed, and the top speed shrinks as you get close to a planet. That makes it easy to cross the Solar
// System quickly AND to stop gently beside a world, with keys or with on-screen touch buttons. Real thrust-and-drift
// physics is harder to control than a beginner (or a thumb on a phone) deserves. The spec says the same:
// "orbit and fly-to ... is much easier to control than free flight, especially on a phone."
//
// Directions: yaw 0 faces -Z (the way Three.js's default camera looks); a positive yaw turns LEFT (counter-clockwise
// seen from above, the same turning direction the planets orbit). A positive pitch points the nose UP.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ShipState {
  position: Vec3;
  /** Heading in radians (see the note above). Always kept between -PI and PI. */
  yaw: number;
  /** Nose up/down in radians, kept inside +-MAX_PITCH so the ship can never flip over. */
  pitch: number;
  /** The throttle lever: -REVERSE_LIMIT (back) to 1 (full ahead). */
  throttle: number;
  /** How fast the ship is actually moving along its heading, in scene units per second (negative = backwards). */
  speed: number;
}

/** A sphere the ship must not fly into (a planet, moon or the Sun). */
export interface Body {
  id: string;
  position: Vec3;
  radius: number;
}

/** What the player is asking for right now. Each axis runs from -1 to 1. */
export interface FlightInput {
  /** +1 = turn left, -1 = turn right. */
  yaw: number;
  /** +1 = nose up, -1 = nose down. */
  pitch: number;
  /** +1 = raise the throttle lever, -1 = lower it. */
  throttle: number;
  /** True = bring the ship to a stop. */
  brake: boolean;
}

export const NO_INPUT: FlightInput = { yaw: 0, pitch: 0, throttle: 0, brake: false };

// ---- tuning numbers (all in one place so they are easy to adjust and to explain) ----
export const TURN_RATE = 1.4; // radians per second at full steering (about 80 degrees a second)
export const PITCH_RATE = 1.0;
export const MAX_PITCH = 1.4; // about 80 degrees: stops just short of straight up or down
export const THROTTLE_RATE = 0.7; // lever movement per second while a key is held
export const BRAKE_RATE = 2.5; // lever movement per second while braking
export const REVERSE_LIMIT = 0.3; // you can back up, but only slowly
export const MAX_SPEED = 45; // far from anything, full throttle: crosses the whole system in a few seconds
export const MIN_SPEED_CAP = 1.5; // right beside a surface you can still creep along
export const SPEED_RESPONSE = 3; // how quickly the real speed follows the lever (per second)
/** How close to a body's surface the ship may get, as a fraction of its radius, plus a fixed margin. */
export const CLEARANCE_FACTOR = 1.15;
export const CLEARANCE_MARGIN = 0.3;
/** Within this many radii (plus 2 units) of a body, the ship is carried along with it as it orbits. */
export const ANCHOR_RADII = 6;
export const AUTOPILOT_TURN_RATE = 2.2;
/** Autopilot: wanted speed = this many units per second for every unit of distance left. */
export const AUTOPILOT_APPROACH = 1.5;
/** Autopilot: the most its speed may change per second (so it never lurches). */
export const AUTOPILOT_ACCELERATION = 90;
export const ARRIVE_TOLERANCE = 0.4;
/**
 * The most a body can move in one step and still carry a nearby ship with it. Planets move a fraction of a unit a
 * frame. A body that JUMPS (a replayed comet going back to the start of its loop) is a teleport, not an orbit, and
 * must not drag a parked ship across the map with it.
 */
export const MAX_CARRY_PER_STEP = 15;

// ---- small vector helpers (we avoid Three.js here so these rules stay testable on their own) ----
export const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3): Vec3 => vec(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: Vec3, b: Vec3): Vec3 => vec(a.x - b.x, a.y - b.y, a.z - b.z);
const scale = (a: Vec3, k: number): Vec3 => vec(a.x * k, a.y * k, a.z * k);
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 =>
  vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const distance = (a: Vec3, b: Vec3): number => length(sub(a, b));
const normalize = (a: Vec3): Vec3 => {
  const l = length(a);
  return l < 1e-9 ? vec(0, 0, 0) : scale(a, 1 / l);
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Wraps any angle into -PI..PI so a ship that keeps turning never gets a huge number. */
export function wrapAngle(angle: number): number {
  const turn = Math.PI * 2;
  return angle - turn * Math.round(angle / turn);
}

/** Moves `current` toward `target` by at most `maxStep`, taking the short way round. */
export function approachAngle(current: number, target: number, maxStep: number): number {
  const difference = wrapAngle(target - current);
  return wrapAngle(current + clamp(difference, -maxStep, maxStep));
}

/** The direction the nose points, as a unit vector. */
export function forwardVector(yaw: number, pitch: number): Vec3 {
  const c = Math.cos(pitch);
  return vec(-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c);
}

/** The yaw and pitch that point the nose along `direction` (the opposite of `forwardVector`). */
export function headingToward(direction: Vec3): { yaw: number; pitch: number } {
  return {
    yaw: Math.atan2(-direction.x, -direction.z),
    pitch: Math.atan2(direction.y, Math.hypot(direction.x, direction.z)),
  };
}

/** A new ship at rest, at `position`, nose pointing at `lookAt`. */
export function spawnShip(position: Vec3, lookAt: Vec3): ShipState {
  const toward = sub(lookAt, position);
  const heading = length(toward) < 1e-6 ? { yaw: 0, pitch: 0 } : headingToward(toward);
  return {
    position: { ...position },
    yaw: heading.yaw,
    pitch: clamp(heading.pitch, -MAX_PITCH, MAX_PITCH),
    throttle: 0,
    speed: 0,
  };
}

/** The ship's distance from the nearest body's SURFACE (never negative). Infinity if there are no bodies. */
export function nearestAltitude(position: Vec3, bodies: readonly Body[]): number {
  let nearest = Infinity;
  for (const body of bodies) {
    nearest = Math.min(nearest, distance(position, body.position) - body.radius);
  }
  return Math.max(0, nearest);
}

/**
 * The fastest the ship may go at this height above the nearest surface. Far away it is MAX_SPEED; close in it
 * shrinks smoothly, so approaching a planet at full throttle slows you down by itself instead of ramming it.
 */
export function maxSpeedAt(altitude: number): number {
  if (!Number.isFinite(altitude)) return MAX_SPEED;
  return clamp(MIN_SPEED_CAP + altitude * 0.9, MIN_SPEED_CAP, MAX_SPEED);
}

/** Steering by dragging a finger or mouse: dragging right turns right, dragging down points the nose down. */
export function steerByDrag(
  ship: ShipState,
  dxPixels: number,
  dyPixels: number,
  radiansPerPixel = 0.004,
): ShipState {
  return {
    ...ship,
    yaw: wrapAngle(ship.yaw - dxPixels * radiansPerPixel),
    pitch: clamp(ship.pitch - dyPixels * radiansPerPixel, -MAX_PITCH, MAX_PITCH),
  };
}

/** Pushes the ship out of any body it has flown into. Returns the corrected position and what it touched. */
export function keepOutsideBodies(
  position: Vec3,
  bodies: readonly Body[],
): { position: Vec3; touched: string | null } {
  let result = position;
  let touched: string | null = null;
  for (const body of bodies) {
    const minimum = body.radius * CLEARANCE_FACTOR + CLEARANCE_MARGIN;
    const away = sub(result, body.position);
    const d = length(away);
    if (d >= minimum) continue;
    // Straight out from the centre; if exactly at the centre, any direction will do.
    const direction = d < 1e-9 ? vec(0, 1, 0) : scale(away, 1 / d);
    result = add(body.position, scale(direction, minimum));
    touched = body.id;
  }
  return { position: result, touched };
}

/**
 * Which body (if any) the ship is "parked beside". Near a body the game carries the ship along with it, because
 * planets really move: without this, a planet orbiting at several units a second would slide away from a ship
 * that is sitting still, and you could never stay next to one to scan it.
 */
export function anchorBody(position: Vec3, bodies: readonly Body[]): string | null {
  let best: string | null = null;
  let bestAltitude = Infinity;
  for (const body of bodies) {
    const altitude = distance(position, body.position) - body.radius;
    if (altitude < body.radius * ANCHOR_RADII + 2 && altitude < bestAltitude) {
      best = body.id;
      bestAltitude = altitude;
    }
  }
  return best;
}

/**
 * Carries the ship along with the body it is parked beside. Call it once per frame with every body's position
 * BEFORE and AFTER the planets moved. If the ship is near a body, it moves by the same amount that body did.
 * This is also what lets the autopilot catch a moving planet: once beside it, the ship shares its motion.
 */
export function carryAlong(position: Vec3, before: readonly Body[], after: readonly Body[]): Vec3 {
  const id = anchorBody(position, before);
  if (id === null) return position;
  const was = before.find((body) => body.id === id);
  const now = after.find((body) => body.id === id);
  if (!was || !now) return position;
  const moved = sub(now.position, was.position);
  if (length(moved) > MAX_CARRY_PER_STEP) return position; // a teleport, not an orbit: leave the ship where it is
  return add(position, moved);
}

/** Moves the speed toward `target` smoothly. The same result at 30 and at 144 frames per second. */
function easeSpeed(speed: number, target: number, dt: number): number {
  return speed + (target - speed) * (1 - Math.exp(-SPEED_RESPONSE * dt));
}

/** Moves `speed` toward `target` by at most `maxChange`. */
function slewSpeed(speed: number, target: number, maxChange: number): number {
  return speed + clamp(target - speed, -maxChange, maxChange);
}

export interface StepResult {
  ship: ShipState;
  /** The id of a body the ship bumped into this step, or null. */
  touched: string | null;
}

/** Advances the ship by `dt` seconds of manual flight. */
export function stepShip(
  ship: ShipState,
  input: FlightInput,
  dt: number,
  bodies: readonly Body[],
): StepResult {
  const yaw = wrapAngle(ship.yaw + clamp(input.yaw, -1, 1) * TURN_RATE * dt);
  const pitch = clamp(
    ship.pitch + clamp(input.pitch, -1, 1) * PITCH_RATE * dt,
    -MAX_PITCH,
    MAX_PITCH,
  );

  // The lever: braking walks it back to zero, otherwise the player's input moves it.
  let throttle = ship.throttle;
  if (input.brake) {
    const step = BRAKE_RATE * dt;
    throttle = throttle > 0 ? Math.max(0, throttle - step) : Math.min(0, throttle + step);
  } else {
    throttle = clamp(
      throttle + clamp(input.throttle, -1, 1) * THROTTLE_RATE * dt,
      -REVERSE_LIMIT,
      1,
    );
  }

  const cap = maxSpeedAt(nearestAltitude(ship.position, bodies));
  const target = input.brake ? 0 : throttle * cap;
  let speed = easeSpeed(ship.speed, target, dt);
  if (input.brake && Math.abs(speed) < 0.05) speed = 0;

  const moved = add(ship.position, scale(forwardVector(yaw, pitch), speed * dt));
  const fixed = keepOutsideBodies(moved, bodies);
  // Touching a surface stops forward motion (you cannot fly through a planet), but you can still back away.
  if (fixed.touched && speed > 0) speed = 0;
  return {
    ship: { position: fixed.position, yaw, pitch, throttle, speed },
    touched: fixed.touched,
  };
}

/**
 * If the straight line from `from` to `goal` would pass through (or too close to) a body, returns a point to steer
 * for instead, off to the side of that body. Without this the autopilot would fly straight through the Sun on any
 * trip to the far side of the Solar System.
 */
export function waypointAround(
  from: Vec3,
  goal: Vec3,
  obstacles: readonly Body[],
  margin = 1.5,
): Vec3 {
  const path = sub(goal, from);
  const pathLengthSquared = dot(path, path);
  if (pathLengthSquared < 1e-9) return goal;

  let worst: { t: number; body: Body; closest: Vec3; inflated: number } | null = null;
  for (const body of obstacles) {
    const inflated = body.radius * CLEARANCE_FACTOR + CLEARANCE_MARGIN + margin;
    if (distance(from, body.position) < inflated) continue; // already inside: the push-out rule handles it
    const t = clamp(dot(sub(body.position, from), path) / pathLengthSquared, 0, 1);
    if (t <= 0 || t >= 1) continue; // the body is behind us, or beyond the goal
    const closest = add(from, scale(path, t));
    if (distance(closest, body.position) >= inflated) continue; // the line passes clear of it
    if (!worst || t < worst.t) worst = { t, body, closest, inflated };
  }
  if (!worst) return goal;

  // Go round the side the line already leans toward; if it is dead centre, pick the left of the path.
  let side = normalize(sub(worst.closest, worst.body.position));
  if (length(side) < 1e-6) {
    side = normalize(cross(path, vec(0, 1, 0)));
    if (length(side) < 1e-6) side = vec(1, 0, 0); // flying straight up or down
  }
  return add(worst.body.position, scale(side, worst.inflated * 1.35));
}

export interface AutopilotResult {
  ship: ShipState;
  arrived: boolean;
  touched: string | null;
}

/**
 * One step of the autopilot: turn toward the target, steer round anything in the way, speed up, and slow smoothly
 * so the ship stops at `arriveDistance` from the target's centre on the side it approached from.
 */
export function autopilotStep(
  ship: ShipState,
  target: Body,
  others: readonly Body[],
  dt: number,
  arriveDistance: number,
): AutopilotResult {
  // The stopping point: `arriveDistance` out from the target, toward where we are coming from.
  const fromTarget = sub(ship.position, target.position);
  const sideOfApproach = length(fromTarget) < 1e-6 ? vec(0, 0, 1) : normalize(fromTarget);
  const goal = add(target.position, scale(sideOfApproach, arriveDistance));
  const remaining = distance(ship.position, goal);

  if (remaining <= ARRIVE_TOLERANCE) {
    // Arrived: face the target and come to rest.
    const facing = headingToward(sub(target.position, ship.position));
    return {
      ship: {
        ...ship,
        yaw: facing.yaw,
        pitch: clamp(facing.pitch, -MAX_PITCH, MAX_PITCH),
        throttle: 0,
        speed: 0,
      },
      arrived: true,
      touched: null,
    };
  }

  const waypoint = waypointAround(ship.position, goal, others);
  const wanted = headingToward(sub(waypoint, ship.position));
  const yaw = approachAngle(ship.yaw, wanted.yaw, AUTOPILOT_TURN_RATE * dt);
  const pitch = approachAngle(
    ship.pitch,
    clamp(wanted.pitch, -MAX_PITCH, MAX_PITCH),
    AUTOPILOT_TURN_RATE * dt,
  );

  // Go fast when far, ease off as the goal gets close, and slow down while still turning toward it.
  // The wanted speed is proportional to the distance left, so the ship glides in like a ball rolling to a stop
  // instead of overshooting. (Easing toward that speed as well made it overshoot, which a test caught.)
  const alignment = clamp(
    dot(forwardVector(yaw, pitch), normalize(sub(waypoint, ship.position))),
    0.1,
    1,
  );
  const wantedSpeed = Math.min(MAX_SPEED, 0.3 + remaining * AUTOPILOT_APPROACH) * alignment;
  const speed = slewSpeed(ship.speed, wantedSpeed, AUTOPILOT_ACCELERATION * dt);

  const moved = add(ship.position, scale(forwardVector(yaw, pitch), speed * dt));
  const fixed = keepOutsideBodies(moved, others);
  return {
    ship: {
      position: fixed.position,
      yaw,
      pitch,
      throttle: clamp(speed / MAX_SPEED, 0, 1),
      speed: fixed.touched ? Math.min(speed, 0) : speed,
    },
    arrived: false,
    touched: fixed.touched,
  };
}
