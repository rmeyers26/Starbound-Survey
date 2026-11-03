// The spacecraft's flight rules. These are pure functions, so we can "fly" thousands of frames in a few
// milliseconds and check the things that must always be true (never inside a planet, never flipping over...).
import { describe, expect, it } from 'vitest';
import {
  ANCHOR_RADII,
  ARRIVE_TOLERANCE,
  CLEARANCE_FACTOR,
  CLEARANCE_MARGIN,
  MAX_PITCH,
  MAX_SPEED,
  MIN_SPEED_CAP,
  NO_INPUT,
  REVERSE_LIMIT,
  TURN_RATE,
  anchorBody,
  approachAngle,
  autopilotStep,
  carryAlong,
  distance,
  forwardVector,
  headingToward,
  keepOutsideBodies,
  length,
  maxSpeedAt,
  nearestAltitude,
  spawnShip,
  steerByDrag,
  stepShip,
  vec,
  waypointAround,
  wrapAngle,
  type Body,
  type FlightInput,
  type ShipState,
} from '../../src/engine/flight';
import { focusDistance, scanRange } from '../../src/engine/scale';

const FRAME = 1 / 60;
const planet = (id: string, x: number, z: number, radius = 2): Body => ({
  id,
  position: vec(x, 0, z),
  radius,
});
const input = (partial: Partial<FlightInput>): FlightInput => ({ ...NO_INPUT, ...partial });

/** Flies a ship for `seconds` with the same input every frame. */
function fly(
  start: ShipState,
  flightInput: FlightInput,
  seconds: number,
  bodies: Body[] = [],
  frame = FRAME,
): ShipState {
  let ship = start;
  for (let t = 0; t < seconds; t += frame) ship = stepShip(ship, flightInput, frame, bodies).ship;
  return ship;
}

const atRest = (x = 0, y = 0, z = 0): ShipState => ({
  position: vec(x, y, z),
  yaw: 0,
  pitch: 0,
  throttle: 0,
  speed: 0,
});

describe('directions', () => {
  it('yaw 0 faces -Z, the way the default camera looks', () => {
    const f = forwardVector(0, 0);
    expect(f.x).toBeCloseTo(0);
    expect(f.y).toBeCloseTo(0);
    expect(f.z).toBeCloseTo(-1);
  });

  it('a positive yaw turns LEFT (toward -X when facing -Z), like the planets turn counter-clockwise', () => {
    const f = forwardVector(Math.PI / 2, 0);
    expect(f.x).toBeCloseTo(-1);
    expect(f.z).toBeCloseTo(0);
  });

  it('a positive pitch points the nose UP', () => {
    expect(forwardVector(0, Math.PI / 4).y).toBeGreaterThan(0.7);
  });

  it('the forward vector is always a unit vector', () => {
    for (const yaw of [-3, -1, 0, 0.5, 2.5]) {
      for (const pitch of [-1.4, -0.5, 0, 0.9, 1.4]) {
        expect(length(forwardVector(yaw, pitch))).toBeCloseTo(1, 9);
      }
    }
  });

  it('headingToward is the exact opposite of forwardVector', () => {
    for (const yaw of [-3, -1.2, 0, 0.7, 2.9]) {
      for (const pitch of [-1.3, -0.4, 0, 0.6, 1.3]) {
        const back = headingToward(forwardVector(yaw, pitch));
        expect(back.yaw).toBeCloseTo(yaw, 6);
        expect(back.pitch).toBeCloseTo(pitch, 6);
      }
    }
  });

  it('wrapAngle keeps any angle within one turn, and approachAngle takes the short way round', () => {
    expect(wrapAngle(Math.PI * 2 + 0.5)).toBeCloseTo(0.5);
    expect(wrapAngle(-Math.PI * 4 - 0.25)).toBeCloseTo(-0.25);
    // From 170 degrees to -170 degrees is a 20 degree turn through 180, not a 340 degree one.
    const from = (170 * Math.PI) / 180;
    const to = (-170 * Math.PI) / 180;
    const stepped = approachAngle(from, to, 0.1);
    expect(Math.abs(wrapAngle(stepped - from))).toBeCloseTo(0.1);
    expect(wrapAngle(stepped - from)).toBeGreaterThan(0); // turned the short (positive) way
  });
});

describe('spawning', () => {
  it('a new ship is at rest and faces what it was told to look at', () => {
    const ship = spawnShip(vec(10, 5, 20), vec(0, 0, 0));
    expect(ship.speed).toBe(0);
    expect(ship.throttle).toBe(0);
    const f = forwardVector(ship.yaw, ship.pitch);
    const toward = vec(-10, -5, -20);
    const l = length(toward);
    expect(f.x).toBeCloseTo(toward.x / l, 6);
    expect(f.y).toBeCloseTo(toward.y / l, 6);
    expect(f.z).toBeCloseTo(toward.z / l, 6);
  });

  it('spawning exactly on the look-at point does not produce NaN', () => {
    const ship = spawnShip(vec(1, 2, 3), vec(1, 2, 3));
    expect(Number.isFinite(ship.yaw) && Number.isFinite(ship.pitch)).toBe(true);
  });
});

describe('manual flight', () => {
  it('does nothing with no input', () => {
    const ship = fly(atRest(1, 2, 3), NO_INPUT, 3);
    expect(ship.position).toEqual(vec(1, 2, 3));
    expect(ship.speed).toBe(0);
  });

  it('raising the throttle makes the ship speed up and move along its heading', () => {
    const ship = fly(atRest(), input({ throttle: 1 }), 2);
    expect(ship.throttle).toBeGreaterThan(0.5);
    expect(ship.speed).toBeGreaterThan(5);
    expect(ship.position.z).toBeLessThan(-5); // yaw 0 faces -Z
    expect(Math.abs(ship.position.x)).toBeLessThan(1e-9);
  });

  it('never goes faster than the speed limit, however long full throttle is held', () => {
    const ship = fly(atRest(), input({ throttle: 1 }), 30);
    expect(ship.throttle).toBe(1);
    expect(ship.speed).toBeLessThanOrEqual(MAX_SPEED + 1e-9);
    expect(ship.speed).toBeGreaterThan(MAX_SPEED * 0.95);
  });

  it('holds its speed when the keys are released (the lever stays where you left it)', () => {
    const cruising = fly(atRest(), input({ throttle: 1 }), 1.5);
    const later = fly(cruising, NO_INPUT, 2);
    expect(later.throttle).toBeCloseTo(cruising.throttle, 9);
    expect(later.speed).toBeGreaterThan(cruising.speed * 0.9);
  });

  it('the brake brings the ship to a complete stop', () => {
    const cruising = fly(atRest(), input({ throttle: 1 }), 4);
    const stopped = fly(cruising, input({ brake: true }), 3);
    expect(stopped.speed).toBe(0);
    expect(stopped.throttle).toBe(0);
  });

  it('can reverse, but only slowly', () => {
    const ship = fly(atRest(), input({ throttle: -1 }), 5);
    expect(ship.throttle).toBeCloseTo(-REVERSE_LIMIT);
    expect(ship.position.z).toBeGreaterThan(0); // backwards from -Z is +Z
    expect(ship.speed).toBeGreaterThan(-MAX_SPEED * REVERSE_LIMIT - 1e-9);
  });

  it('steering left turns the nose left at the turn rate; steering right turns it right', () => {
    const left = fly(atRest(), input({ yaw: 1 }), 0.5);
    expect(left.yaw).toBeCloseTo(TURN_RATE * 0.5, 1);
    const right = fly(atRest(), input({ yaw: -1 }), 0.5);
    expect(right.yaw).toBeCloseTo(-TURN_RATE * 0.5, 1);
  });

  it('a ship that keeps turning never ends up with an enormous heading number', () => {
    const ship = fly(atRest(), input({ yaw: 1 }), 60);
    expect(Math.abs(ship.yaw)).toBeLessThanOrEqual(Math.PI);
  });

  it('the nose cannot go past straight up or down, so the ship can never flip over', () => {
    expect(fly(atRest(), input({ pitch: 1 }), 10).pitch).toBeCloseTo(MAX_PITCH);
    expect(fly(atRest(), input({ pitch: -1 }), 10).pitch).toBeCloseTo(-MAX_PITCH);
  });

  it('clamps silly input (a stuck key reporting 100) to the normal rates', () => {
    const silly = fly(atRest(), input({ yaw: 100 }), 0.5);
    const normal = fly(atRest(), input({ yaw: 1 }), 0.5);
    expect(silly.yaw).toBeCloseTo(normal.yaw, 9);
  });

  it('flies the same distance at 30 and at 144 frames per second (speed is per second, not per frame)', () => {
    const slow = fly(atRest(), input({ throttle: 1 }), 3, [], 1 / 30);
    const fast = fly(atRest(), input({ throttle: 1 }), 3, [], 1 / 144);
    expect(Math.abs(slow.position.z - fast.position.z)).toBeLessThan(slow.position.z * -0.03);
  });
});

describe('the speed limit near a planet', () => {
  it('shrinks as you get closer, within fixed bounds', () => {
    expect(maxSpeedAt(1000)).toBe(MAX_SPEED);
    expect(maxSpeedAt(0)).toBe(MIN_SPEED_CAP);
    expect(maxSpeedAt(Infinity)).toBe(MAX_SPEED);
    let last = 0;
    for (const altitude of [0, 1, 2, 5, 10, 20, 40, 80]) {
      const cap = maxSpeedAt(altitude);
      expect(cap).toBeGreaterThanOrEqual(last);
      expect(cap).toBeGreaterThanOrEqual(MIN_SPEED_CAP);
      expect(cap).toBeLessThanOrEqual(MAX_SPEED);
      last = cap;
    }
  });

  it('measures altitude from the surface, not the centre', () => {
    expect(nearestAltitude(vec(0, 0, 10), [planet('p', 0, 0, 2)])).toBeCloseTo(8);
    expect(nearestAltitude(vec(0, 0, 1), [planet('p', 0, 0, 2)])).toBe(0); // inside: never negative
    expect(nearestAltitude(vec(0, 0, 1), [])).toBe(Infinity);
  });

  it('holding full throttle straight at a planet NEVER puts the ship inside it, and it ends up almost stopped', () => {
    const bodies = [planet('earth', 0, -100, 2)];
    let ship = atRest();
    const minimum = 2 * CLEARANCE_FACTOR + CLEARANCE_MARGIN;
    for (let i = 0; i < 60 * 40; i++) {
      ship = stepShip(ship, input({ throttle: 1 }), FRAME, bodies).ship;
      expect(distance(ship.position, bodies[0].position)).toBeGreaterThanOrEqual(minimum - 1e-9);
    }
    expect(ship.speed).toBeLessThan(MIN_SPEED_CAP + 0.5);
  });

  it('even a ship thrown at a planet at top speed is stopped at its surface', () => {
    const bodies = [planet('p', 0, -5, 2)];
    const start = { ...atRest(), throttle: 1, speed: MAX_SPEED };
    const result = stepShip(start, NO_INPUT, 0.5, bodies); // half a second at 45 units/s: 22 units, straight through
    expect(result.touched).toBe('p');
    expect(distance(result.ship.position, bodies[0].position)).toBeGreaterThanOrEqual(
      2 * CLEARANCE_FACTOR + CLEARANCE_MARGIN - 1e-9,
    );
    expect(result.ship.speed).toBe(0);
  });

  it('keepOutsideBodies pushes a ship that is inside a body out along the line from its centre', () => {
    const fixed = keepOutsideBodies(vec(1, 0, 0), [planet('p', 0, 0, 2)]);
    expect(fixed.touched).toBe('p');
    expect(fixed.position.x).toBeCloseTo(2 * CLEARANCE_FACTOR + CLEARANCE_MARGIN);
    expect(keepOutsideBodies(vec(50, 0, 0), [planet('p', 0, 0, 2)]).touched).toBeNull();
    // Exactly at the centre: any direction is fine, but it must not be NaN.
    const centre = keepOutsideBodies(vec(0, 0, 0), [planet('p', 0, 0, 2)]);
    expect(Number.isFinite(centre.position.y)).toBe(true);
  });
});

describe('being carried along with a planet', () => {
  it('anchors to the nearest body when parked close, and to nothing in deep space', () => {
    const bodies = [planet('earth', 0, 0, 2), planet('moon', 12, 0, 0.5)];
    expect(anchorBody(vec(0, 0, 6), bodies)).toBe('earth');
    expect(anchorBody(vec(11, 0, 1), bodies)).toBe('moon');
    expect(anchorBody(vec(500, 0, 0), bodies)).toBeNull();
  });

  it('the anchor reaches ANCHOR_RADII radii out (plus 2 units) and no further', () => {
    const bodies = [planet('p', 0, 0, 2)];
    const edge = 2 + 2 * ANCHOR_RADII + 2;
    expect(anchorBody(vec(0, 0, edge - 0.1), bodies)).toBe('p');
    expect(anchorBody(vec(0, 0, edge + 0.1), bodies)).toBeNull();
  });

  it('a parked ship keeps its place beside a planet as the planet orbits (it is carried along)', () => {
    const before = [planet('mercury', 28, 0, 0.8)];
    const after = [planet('mercury', 28.2, -0.5, 0.8)];
    const carried = carryAlong(vec(28, 0, 4), before, after);
    expect(carried.x).toBeCloseTo(28.2);
    expect(carried.z).toBeCloseTo(3.5);
    // Relative to the planet the ship has not moved at all.
    expect(carried.x - after[0].position.x).toBeCloseTo(0);
    expect(carried.z - after[0].position.z).toBeCloseTo(4);
  });

  it('a ship in deep space is not carried by anything', () => {
    const before = [planet('mercury', 28, 0, 0.8)];
    const after = [planet('mercury', 30, 0, 0.8)];
    expect(carryAlong(vec(300, 0, 300), before, after)).toEqual(vec(300, 0, 300));
  });

  it('is within scanning range when the autopilot stops (so you can scan what you flew to)', () => {
    for (const radius of [0.1, 0.8, 2, 5, 8]) {
      expect(focusDistance(radius)).toBeLessThan(scanRange(radius));
    }
  });
});

describe('steering by dragging', () => {
  it('dragging right turns right, dragging down points the nose down', () => {
    const turned = steerByDrag(atRest(), 100, 0);
    expect(turned.yaw).toBeLessThan(0);
    const tilted = steerByDrag(atRest(), 0, 100);
    expect(tilted.pitch).toBeLessThan(0);
  });

  it('cannot tilt past the limit', () => {
    expect(steerByDrag(atRest(), 0, -100000).pitch).toBe(MAX_PITCH);
  });
});

describe('going round obstacles', () => {
  const sun: Body = { id: 'sun', position: vec(0, 0, 0), radius: 8 };

  it('returns the goal itself when nothing is in the way', () => {
    expect(waypointAround(vec(-50, 0, 30), vec(50, 0, 30), [sun])).toEqual(vec(50, 0, 30));
  });

  it('ignores a body that is behind the ship or beyond the goal', () => {
    expect(waypointAround(vec(20, 0, 0), vec(60, 0, 0), [sun])).toEqual(vec(60, 0, 0));
    expect(waypointAround(vec(-60, 0, 0), vec(-20, 0, 0), [sun])).toEqual(vec(-20, 0, 0));
  });

  it('steers to the side of the Sun when the straight line goes through it', () => {
    const goal = vec(60, 0, 0);
    const waypoint = waypointAround(vec(-60, 0, 0), goal, [sun]);
    expect(waypoint).not.toEqual(goal);
    // The waypoint is outside the Sun's clearance sphere, so heading for it can not hit the Sun.
    expect(length(waypoint)).toBeGreaterThan(8 * CLEARANCE_FACTOR + CLEARANCE_MARGIN);
  });

  it('copes with flying straight up or down through a body (no NaN)', () => {
    const waypoint = waypointAround(vec(0, -50, 0), vec(0, 50, 0), [sun]);
    expect(Number.isFinite(waypoint.x + waypoint.y + waypoint.z)).toBe(true);
  });

  it('copes with a goal at the same place as the ship', () => {
    expect(waypointAround(vec(1, 1, 1), vec(1, 1, 1), [sun])).toEqual(vec(1, 1, 1));
  });
});

describe('autopilot', () => {
  const DT = 1 / 60;
  const sun: Body = { id: 'sun', position: vec(0, 0, 0), radius: 8 };

  /** Runs the autopilot until it arrives (or a time limit passes) and reports what happened. */
  function autoFly(
    start: ShipState,
    targetAt: (t: number) => Body,
    others: (t: number) => Body[],
    arrive: number,
    limitSeconds = 40,
  ) {
    let ship = start;
    let t = 0;
    let closestToAnyOther = Infinity;
    let arrived = false;
    while (t < limitSeconds && !arrived) {
      const target = targetAt(t);
      const obstacles = others(t);
      const result = autopilotStep(ship, target, obstacles, DT, arrive);
      ship = result.ship;
      arrived = result.arrived;
      // The planets move on by one frame; a ship parked beside one is carried along (the game does this too).
      const before = [target, ...obstacles];
      const after = [targetAt(t + DT), ...others(t + DT)];
      ship = { ...ship, position: carryAlong(ship.position, before, after) };
      for (const o of obstacles) {
        closestToAnyOther = Math.min(
          closestToAnyOther,
          distance(ship.position, o.position) - o.radius,
        );
      }
      t += DT;
    }
    return { ship, arrived, seconds: t, closestToAnyOther };
  }

  it('flies to a planet and stops at the asked-for distance', () => {
    const earth = planet('earth', 0, -80, 2);
    const arrive = focusDistance(2);
    const result = autoFly(
      spawnShip(vec(0, 0, 30), vec(0, 0, -80)),
      () => earth,
      () => [],
      arrive,
    );
    expect(result.arrived).toBe(true);
    expect(distance(result.ship.position, earth.position)).toBeCloseTo(arrive, 0);
    expect(result.ship.speed).toBe(0);
    expect(result.seconds).toBeLessThan(15);
  });

  it('glides in without overshooting its stopping point, and arrives slowly (no sudden stop)', () => {
    const earth = planet('earth', 0, -90, 2);
    const arrive = focusDistance(2);
    let ship = spawnShip(vec(0, 0, 40), vec(0, 0, -90));
    let closest = Infinity;
    let speedBeforeArrival = Infinity;
    for (let step = 0; step < 60 * 30; step++) {
      const result = autopilotStep(ship, earth, [], DT, arrive);
      closest = Math.min(closest, distance(result.ship.position, earth.position));
      if (result.arrived) break;
      speedBeforeArrival = result.ship.speed;
      ship = result.ship;
    }
    expect(closest).toBeGreaterThan(arrive - 0.5); // never flew past the stopping point
    expect(speedBeforeArrival).toBeLessThan(3); // and was almost still when it stopped
  });

  it('ends within scanning range of what it flew to', () => {
    const mars = planet('mars', 40, 40, 1.4);
    const result = autoFly(
      spawnShip(vec(-30, 0, 10), vec(0, 0, 0)),
      () => mars,
      () => [],
      focusDistance(1.4),
    );
    expect(result.arrived).toBe(true);
    expect(distance(result.ship.position, mars.position)).toBeLessThanOrEqual(scanRange(1.4));
  });

  it('ends up facing the thing it flew to', () => {
    const target = planet('p', 0, -60, 2);
    const result = autoFly(
      spawnShip(vec(0, 0, 0), vec(50, 0, 50)), // starts facing the wrong way
      () => target,
      () => [],
      10,
    );
    // The ship curves while it turns, so it does not stop on the straight line; measure from where it did stop.
    const toward = headingToward(
      vec(
        target.position.x - result.ship.position.x,
        target.position.y - result.ship.position.y,
        target.position.z - result.ship.position.z,
      ),
    );
    expect(Math.abs(wrapAngle(result.ship.yaw - toward.yaw))).toBeLessThan(0.05);
  });

  it('does NOT fly through the Sun on a trip to the far side of the Solar System', () => {
    const farPlanet = planet('mars', 80, 0, 1.4);
    const result = autoFly(
      spawnShip(vec(-60, 0, 0), vec(80, 0, 0)), // straight through the Sun
      () => farPlanet,
      () => [sun],
      focusDistance(1.4),
      60,
    );
    expect(result.arrived).toBe(true);
    expect(result.closestToAnyOther).toBeGreaterThan(8 * 0.15 + CLEARANCE_MARGIN - 1e-9); // never touched it
    expect(result.closestToAnyOther).toBeGreaterThan(0);
  });

  it('keeps up with a planet that is moving (planets orbit at several units a second)', () => {
    const orbiting = (t: number): Body =>
      planet('mercury', 28 * Math.cos(t * 0.2), -28 * Math.sin(t * 0.2), 0.8);
    const result = autoFly(
      spawnShip(vec(60, 0, 0), vec(28, 0, 0)),
      orbiting,
      () => [sun],
      focusDistance(0.8),
      60,
    );
    expect(result.arrived).toBe(true);
  });

  it('is already there when started at the stopping point, and never produces NaN', () => {
    const target = planet('p', 0, 0, 2);
    const arrive = 10;
    const result = autopilotStep({ ...atRest(0, 0, arrive), speed: 3 }, target, [], DT, arrive);
    expect(result.arrived).toBe(true);
    expect(result.ship.speed).toBe(0);
    const onTop = autopilotStep(atRest(0, 0, 0), target, [], DT, arrive); // exactly at the target's centre
    expect(
      Number.isFinite(onTop.ship.position.x + onTop.ship.position.y + onTop.ship.position.z),
    ).toBe(true);
    expect(ARRIVE_TOLERANCE).toBeGreaterThan(0);
  });
});
