// The pilot's seat: keys, on-screen buttons, taking over from the autopilot, and saving/restoring the ship.
import { describe, expect, it } from 'vitest';
import { distance, vec, type Body } from '../../src/engine/flight';
import { PilotController, isFlightKey } from '../../src/engine/pilot';
import { MAX_VIEW_SCALE, MIN_VIEW_SCALE } from '../../src/engine/shipViews';

const DT = 1 / 60;
const body = (id: string, x: number, z: number, radius = 2): Body => ({
  id,
  position: vec(x, 0, z),
  radius,
});
const stopAt = (b: Body): number => Math.max(b.radius * 5, 3);

/** A pilot already sitting in the seat, 50 units in front of the origin. */
function seated(): PilotController {
  const pilot = new PilotController();
  pilot.setActive(true, { position: vec(0, 0, 50), lookAt: vec(0, 0, 0) });
  return pilot;
}

/** Runs the pilot for `seconds` with planets standing still. */
function run(pilot: PilotController, seconds: number, bodies: Body[] = []) {
  let arrivedId: string | null = null;
  for (let t = 0; t < seconds; t += DT) {
    const outcome = pilot.step(DT, bodies, bodies, stopAt);
    arrivedId = outcome.arrivedId ?? arrivedId;
  }
  return arrivedId;
}

describe('getting in', () => {
  it('the ship appears where the camera was, at rest, facing what the camera looked at', () => {
    const pilot = seated();
    expect(pilot.active).toBe(true);
    expect(pilot.ship.position).toEqual(vec(0, 0, 50));
    expect(pilot.ship.speed).toBe(0);
    expect(pilot.view).toBe('chase');
    // Facing -Z (toward the origin).
    expect(pilot.ship.yaw).toBeCloseTo(0);
  });

  it('never appears inside a planet', () => {
    const pilot = new PilotController();
    const earth = body('earth', 0, 0, 2);
    pilot.setActive(true, { position: vec(0, 0, 0.5), lookAt: vec(0, 0, -10) }, [earth]);
    expect(distance(pilot.ship.position, earth.position)).toBeGreaterThan(2);
  });

  it('does nothing when told to do nothing: a step while not piloting leaves everything alone', () => {
    const pilot = new PilotController();
    const before = { ...pilot.ship };
    pilot.step(DT, [], [], stopAt);
    expect(pilot.ship).toEqual(before);
  });
});

describe('keyboard', () => {
  it('knows the flight keys and ignores the rest', () => {
    for (const key of [
      'w',
      'W',
      's',
      'a',
      'd',
      'x',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
    ]) {
      expect(isFlightKey(key), key).toBe(true);
    }
    for (const key of ['q', ' ', 'Enter', 'Escape', 'Tab', '1']) {
      expect(isFlightKey(key), key).toBe(false);
    }
  });

  it('W raises the throttle and the ship moves; releasing W leaves the lever where it is', () => {
    const pilot = seated();
    expect(pilot.setKey('w', true)).toBe(true);
    run(pilot, 1);
    pilot.setKey('w', false);
    const lever = pilot.ship.throttle;
    expect(lever).toBeGreaterThan(0.4);
    expect(pilot.ship.position.z).toBeLessThan(50);
    run(pilot, 1);
    expect(pilot.ship.throttle).toBeCloseTo(lever, 9);
  });

  it('A turns left, D turns right, and pressing both cancels out', () => {
    const left = seated();
    left.setKey('a', true);
    run(left, 0.5);
    expect(left.ship.yaw).toBeGreaterThan(0.5);
    const right = seated();
    right.setKey('ArrowRight', true);
    run(right, 0.5);
    expect(right.ship.yaw).toBeLessThan(-0.5);
    const both = seated();
    both.setKey('a', true);
    both.setKey('d', true);
    run(both, 0.5);
    expect(both.ship.yaw).toBeCloseTo(0, 9);
  });

  it('the up arrow lifts the nose, the down arrow lowers it', () => {
    const up = seated();
    up.setKey('ArrowUp', true);
    run(up, 0.5);
    expect(up.ship.pitch).toBeGreaterThan(0.3);
    const down = seated();
    down.setKey('ArrowDown', true);
    run(down, 0.5);
    expect(down.ship.pitch).toBeLessThan(-0.3);
  });

  it('X brakes to a stop', () => {
    const pilot = seated();
    pilot.setKey('w', true);
    run(pilot, 2);
    pilot.setKey('w', false);
    pilot.setKey('x', true);
    run(pilot, 3);
    expect(pilot.ship.speed).toBe(0);
    expect(pilot.ship.throttle).toBe(0);
  });

  it('one quick TAP of X brakes all the way to a stop (it does not need to be held)', () => {
    const pilot = seated();
    pilot.setKey('w', true);
    run(pilot, 2);
    pilot.setKey('w', false);
    pilot.setKey('x', true);
    pilot.setKey('x', false); // let go straight away
    run(pilot, 3);
    expect(pilot.ship.speed).toBe(0);
    expect(pilot.ship.throttle).toBe(0);
  });

  it('asking for more speed takes over from a brake that is still stopping the ship', () => {
    const pilot = seated();
    pilot.setKey('w', true);
    run(pilot, 2);
    pilot.setKey('w', false);
    pilot.setKey('x', true);
    run(pilot, 0.1); // braking has begun
    pilot.setKey('w', true);
    run(pilot, 1.5);
    expect(pilot.ship.throttle).toBeGreaterThan(0.5);
  });

  it('releasing everything stops a "stuck key" (for example when the window loses focus)', () => {
    const pilot = seated();
    pilot.setKey('a', true);
    pilot.setButton('throttle', 1);
    pilot.releaseAllControls();
    expect(pilot.currentInput()).toEqual({ yaw: 0, pitch: 0, throttle: 0, brake: false });
  });
});

describe('on-screen buttons', () => {
  it('hold to steer, release to stop; values are clamped and junk is ignored', () => {
    const pilot = seated();
    pilot.setButton('yaw', 1);
    expect(pilot.currentInput().yaw).toBe(1);
    pilot.setButton('yaw', 0);
    expect(pilot.currentInput().yaw).toBe(0);
    pilot.setButton('pitch', 50);
    expect(pilot.currentInput().pitch).toBe(1);
    pilot.setButton('pitch', Number.NaN);
    expect(pilot.currentInput().pitch).toBe(1); // NaN changed nothing
    pilot.setButton('nonsense' as never, 1);
    expect(pilot.currentInput().throttle).toBe(0);
  });

  it('keys and buttons add together but never exceed full', () => {
    const pilot = seated();
    pilot.setButton('yaw', 1);
    pilot.setKey('a', true);
    expect(pilot.currentInput().yaw).toBe(1);
  });

  it('the Stop button brakes the ship and then lets go by itself', () => {
    const pilot = seated();
    pilot.setButton('throttle', 1);
    run(pilot, 2);
    pilot.setButton('throttle', 0);
    pilot.brake();
    run(pilot, 3);
    expect(pilot.ship.speed).toBe(0);
    expect(pilot.currentInput().brake).toBe(false); // released: the ship can be flown again
    pilot.setButton('throttle', 1);
    run(pilot, 1);
    expect(pilot.ship.speed).toBeGreaterThan(1);
  });
});

describe('mouse and touch', () => {
  it('dragging steers the ship and cancels the autopilot', () => {
    const pilot = seated();
    pilot.startAutopilot('mars');
    pilot.drag(100, 0);
    expect(pilot.ship.yaw).toBeLessThan(0);
    expect(pilot.autopilotId).toBeNull();
  });

  it('a drag of zero does not cancel the autopilot', () => {
    const pilot = seated();
    pilot.startAutopilot('mars');
    pilot.drag(0, 0);
    expect(pilot.autopilotId).toBe('mars');
  });

  it('the wheel moves the throttle lever within its limits', () => {
    const pilot = seated();
    pilot.nudgeThrottle(5);
    expect(pilot.ship.throttle).toBe(1);
    pilot.nudgeThrottle(-50);
    expect(pilot.ship.throttle).toBeCloseTo(-0.3);
    pilot.nudgeThrottle(Number.NaN);
    expect(pilot.ship.throttle).toBeCloseTo(-0.3);
  });

  it('zooming the view stays within its limits and ignores nonsense', () => {
    const pilot = seated();
    pilot.zoomView(1e6);
    expect(pilot.viewScale).toBe(MAX_VIEW_SCALE);
    pilot.zoomView(1e-9);
    expect(pilot.viewScale).toBe(MIN_VIEW_SCALE);
    pilot.zoomView(Number.NaN);
    pilot.zoomView(-3);
    expect(pilot.viewScale).toBe(MIN_VIEW_SCALE);
  });
});

describe('views', () => {
  it('can be chosen by name, rejects names that do not exist, and cycles', () => {
    const pilot = seated();
    expect(pilot.setView('map')).toBe(true);
    expect(pilot.view).toBe('map');
    expect(pilot.setView('periscope')).toBe(false);
    expect(pilot.view).toBe('map');
    expect(pilot.cycleView()).toBe('cinematic'); // the view after Map
    expect(pilot.cycleView()).toBe('chase'); // and then it wraps round to the start
  });
});

describe('autopilot', () => {
  const mars = body('mars', 30, -40, 1.4);

  it('flies to the planet, stops beside it, and reports the arrival once', () => {
    const pilot = seated();
    pilot.startAutopilot('mars');
    const arrived = run(pilot, 30, [mars]);
    expect(arrived).toBe('mars');
    expect(pilot.autopilotId).toBeNull();
    expect(distance(pilot.ship.position, mars.position)).toBeCloseTo(stopAt(mars), 0);
    expect(pilot.ship.speed).toBe(0);
  });

  it('is cancelled the moment the pilot touches a steering key', () => {
    const pilot = seated();
    pilot.startAutopilot('mars');
    run(pilot, 0.5, [mars]);
    expect(pilot.autopilotId).toBe('mars');
    pilot.setKey('a', true);
    run(pilot, 0.1, [mars]);
    expect(pilot.autopilotId).toBeNull();
  });

  it('gives up cleanly if its destination disappears (the region was locked again)', () => {
    const pilot = seated();
    pilot.startAutopilot('neptune');
    run(pilot, 0.2, [mars]);
    expect(pilot.autopilotId).toBeNull();
  });

  it('with Reduce motion on, jumps straight to the destination instead of flying', () => {
    const pilot = seated();
    pilot.reducedMotion = true;
    pilot.startAutopilot('mars');
    const outcome = pilot.step(DT, [mars], [mars], stopAt);
    expect(outcome.arrivedId).toBe('mars');
    expect(distance(pilot.ship.position, mars.position)).toBeCloseTo(stopAt(mars), 6);
    expect(pilot.ship.speed).toBe(0);
    expect(pilot.autopilotId).toBeNull();
  });

  it('a parked ship is carried along with an orbiting planet', () => {
    const pilot = seated();
    pilot.startAutopilot('mars');
    run(pilot, 30, [mars]);
    const offset = vec(
      pilot.ship.position.x - mars.position.x,
      pilot.ship.position.y - mars.position.y,
      pilot.ship.position.z - mars.position.z,
    );
    // Mars drifts 3 units sideways over one second; the parked ship goes with it.
    const before = [mars];
    const after = [{ ...mars, position: vec(33, 0, -40) }];
    for (let i = 0; i < 1; i++) pilot.step(DT, before, after, stopAt);
    const moved = vec(
      pilot.ship.position.x - after[0].position.x,
      pilot.ship.position.y - after[0].position.y,
      pilot.ship.position.z - after[0].position.z,
    );
    expect(moved.x).toBeCloseTo(offset.x, 1);
    expect(moved.z).toBeCloseTo(offset.z, 1);
  });
});

describe('saving and restoring the ship (for a graphics reset)', () => {
  it('a restored pilot has the same ship, view, zoom and autopilot', () => {
    const pilot = seated();
    pilot.setView('map');
    pilot.zoomView(2);
    pilot.setKey('w', true);
    run(pilot, 1);
    pilot.startAutopilot('mars');
    const snapshot = pilot.snapshot();

    const copy = new PilotController();
    copy.restore(snapshot);
    expect(copy.active).toBe(true);
    expect(copy.ship).toEqual(pilot.ship);
    expect(copy.view).toBe('map');
    expect(copy.viewScale).toBeCloseTo(2);
    expect(copy.autopilotId).toBe('mars');
    expect(copy.currentInput().throttle).toBe(0); // held keys are NOT carried over: no stuck keys
  });

  it('a snapshot is a copy: flying on does not change it', () => {
    const pilot = seated();
    const snapshot = pilot.snapshot();
    pilot.setKey('w', true);
    run(pilot, 1);
    expect(snapshot.state.position).toEqual(vec(0, 0, 50));
  });

  it('a damaged snapshot (unknown view, silly zoom) falls back to safe values', () => {
    const copy = new PilotController();
    copy.restore({
      active: true,
      state: { position: vec(1, 2, 3), yaw: 0, pitch: 0, throttle: 0, speed: 0 },
      view: 'banana' as never,
      autopilotId: null,
      viewScale: 9999,
    });
    expect(copy.view).toBe('chase');
    expect(copy.viewScale).toBe(MAX_VIEW_SCALE);
  });
});
