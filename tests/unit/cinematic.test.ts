// The cinematic camera: four shots that cut and sweep round the ship, built from pure functions so we can "film"
// thousands of frames in a few milliseconds and check the things that must always be true.
import { describe, expect, it } from 'vitest';
import {
  CINEMATIC_FOV,
  CINEMATIC_LOOP_SECONDS,
  SHOTS,
  cinematicPose,
  shotAt,
} from '../../src/engine/cinematic';
import { distance, length, vec, type Vec3 } from '../../src/engine/flight';
import { SHIP_VIEW_LABELS, cameraPoseFor } from '../../src/engine/shipViews';

const ship = { position: vec(10, 2, -30), yaw: 0, pitch: 0 };
const minus = (a: Vec3, b: Vec3): Vec3 => vec(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const angleBetween = (a: Vec3, b: Vec3): number =>
  Math.acos(Math.min(1, Math.max(-1, dot(a, b) / (length(a) * length(b))))) * (180 / Math.PI);

/** Start time of each shot, in seconds. */
const starts = SHOTS.map((_, i) => SHOTS.slice(0, i).reduce((sum, s) => sum + s.seconds, 0));

describe('the sequence of shots', () => {
  it('has four shots, each lasting several seconds, and a loop as long as them all', () => {
    expect(SHOTS.map((s) => s.name)).toEqual(['flyby', 'side track', 'head on', 'overhead']);
    for (const shot of SHOTS) expect(shot.seconds).toBeGreaterThanOrEqual(4);
    expect(CINEMATIC_LOOP_SECONDS).toBeCloseTo(SHOTS.reduce((sum, s) => sum + s.seconds, 0));
  });

  it('plays the shots in order, each at its own time, and then starts again', () => {
    for (let i = 0; i < SHOTS.length; i++) {
      expect(shotAt(starts[i] + 0.01).index).toBe(i);
      expect(shotAt(starts[i] + SHOTS[i].seconds - 0.01).index).toBe(i);
      expect(shotAt(CINEMATIC_LOOP_SECONDS + starts[i] + 0.01).index).toBe(i); // second time round
    }
  });

  it('progress runs from 0 to 1 through a shot', () => {
    expect(shotAt(0).progress).toBe(0);
    expect(shotAt(SHOTS[0].seconds / 2).progress).toBeCloseTo(0.5);
    expect(shotAt(SHOTS[0].seconds - 0.001).progress).toBeCloseTo(1, 2);
  });

  it('starts at the beginning for nonsense times (negative, NaN, infinite)', () => {
    for (const bad of [-5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(shotAt(bad)).toEqual({ index: 0, progress: 0 });
    }
  });
});

describe('every shot looks right', () => {
  const times: number[] = [];
  for (let t = 0; t < CINEMATIC_LOOP_SECONDS; t += 0.25) times.push(t);

  it('keeps the camera a filming distance from the ship: close enough to see it, never inside it', () => {
    for (const t of times) {
      const d = distance(cinematicPose(ship, t).position, ship.position);
      expect(d, `at ${t}s`).toBeGreaterThan(1.5);
      expect(d, `at ${t}s`).toBeLessThan(7);
    }
  });

  it('always keeps the ship in the picture (the camera looks within 15 degrees of it)', () => {
    for (const t of times) {
      const pose = cinematicPose(ship, t);
      const toLookAt = minus(pose.lookAt, pose.position);
      const toShip = minus(ship.position, pose.position);
      expect(angleBetween(toLookAt, toShip), `at ${t}s`).toBeLessThan(15);
    }
  });

  it('never rolls: "up" on the screen is always up in the world', () => {
    for (const t of times) expect(cinematicPose(ship, t).up).toEqual(vec(0, 1, 0));
  });

  it('uses a narrower, film-like lens than the normal camera', () => {
    expect(CINEMATIC_FOV).toBeLessThan(50);
    expect(cinematicPose(ship, 3).fov).toBe(CINEMATIC_FOV);
  });

  it('moves smoothly inside a shot (no jumps), and only jumps at a cut between shots', () => {
    const STEP = 1 / 60;
    let cuts = 0;
    let previous = cinematicPose(ship, 0).position;
    for (let t = STEP; t < CINEMATIC_LOOP_SECONDS * 2; t += STEP) {
      const now = cinematicPose(ship, t).position;
      const jump = distance(now, previous);
      const justCut = starts.some((s) => Math.abs((t % CINEMATIC_LOOP_SECONDS) - s) < STEP * 1.5);
      if (jump > 0.15) {
        expect(justCut, `unexpected jump of ${jump.toFixed(2)} at ${t.toFixed(2)}s`).toBe(true);
        cuts += 1;
      }
      previous = now;
    }
    // Four shots, two times round: the camera really does cut (every shot starts somewhere new).
    expect(cuts).toBeGreaterThanOrEqual(6);
  });

  it('works with the ship pitched steeply up or down, with no NaN', () => {
    for (const pitch of [-1.4, -0.7, 0, 0.7, 1.4]) {
      for (const t of times) {
        const pose = cinematicPose({ ...ship, pitch, yaw: 0.9 }, t);
        const sum = pose.position.x + pose.position.y + pose.position.z + pose.lookAt.x;
        expect(Number.isFinite(sum), `pitch ${pitch} at ${t}s`).toBe(true);
      }
    }
  });
});

describe('the camera crew turns with the ship', () => {
  it('turning the ship leaves the framing the same: same distance and same view direction relative to the nose', () => {
    for (const t of [1, 8, 14, 20]) {
      const a = cinematicPose({ ...ship, yaw: 0 }, t);
      const b = cinematicPose({ ...ship, yaw: 1.3 }, t);
      expect(distance(b.position, ship.position)).toBeCloseTo(
        distance(a.position, ship.position),
        9,
      );
      expect(distance(b.lookAt, ship.position)).toBeCloseTo(distance(a.lookAt, ship.position), 9);
      expect(b.position.y).toBeCloseTo(a.position.y, 9); // the same height above the ship
    }
  });

  it('the flyby starts BEHIND the ship and ends in FRONT of it', () => {
    const start = cinematicPose(ship, 0.01).position;
    const end = cinematicPose(ship, SHOTS[0].seconds - 0.01).position;
    // The ship faces -Z (yaw 0), so "behind" is +Z of it and "in front" is -Z of it.
    expect(start.z).toBeGreaterThan(ship.position.z);
    expect(end.z).toBeLessThan(ship.position.z);
  });

  it('the head-on shot is in front of the ship and looks back at it', () => {
    const pose = cinematicPose(ship, starts[2] + 1);
    expect(pose.position.z).toBeLessThan(ship.position.z); // ahead of a ship that faces -Z
    expect(pose.lookAt).toEqual(ship.position);
  });

  it('the overhead shot is above the ship', () => {
    expect(cinematicPose(ship, starts[3] + 1).position.y).toBeGreaterThan(ship.position.y + 2);
  });
});

describe('Reduce motion', () => {
  it('holds one still angle: the camera neither moves nor cuts', () => {
    const first = cinematicPose(ship, 0, true);
    for (const t of [1, 7.5, 13.2, 20, 100]) expect(cinematicPose(ship, t, true)).toEqual(first);
  });

  it('the still angle is still a good one (a filming distance, ship in view)', () => {
    const pose = cinematicPose(ship, 0, true);
    expect(distance(pose.position, ship.position)).toBeGreaterThan(1.5);
    expect(distance(pose.position, ship.position)).toBeLessThan(7);
  });

  it('a ship that moves still drags the still camera along with it', () => {
    const moved = { ...ship, position: vec(50, 2, -30) };
    const a = cinematicPose(ship, 0, true).position;
    const b = cinematicPose(moved, 0, true).position;
    expect(b.x - a.x).toBeCloseTo(40);
  });
});

describe('the cinematic view in the view list', () => {
  it('has a name for its button', () => {
    expect(SHIP_VIEW_LABELS.cinematic).toBe('Cinematic');
  });

  it('is available through cameraPoseFor, and changes with time (but not for Reduce motion)', () => {
    const early = cameraPoseFor('cinematic', ship, 1, 0.5);
    const later = cameraPoseFor('cinematic', ship, 1, 3.5);
    expect(later.position).not.toEqual(early.position);
    expect(cameraPoseFor('cinematic', ship, 1, 0.5, true)).toEqual(
      cameraPoseFor('cinematic', ship, 1, 3.5, true),
    );
  });
});
