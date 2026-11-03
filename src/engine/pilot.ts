// The pilot's seat: everything about flying the spacecraft that is not drawing.
// It owns the ship's state, merges keyboard and on-screen-button input, runs the autopilot, and hands the 3D
// view a ship to draw. It uses only plain numbers (no Three.js and no browser), so it is unit tested directly.
import {
  MAX_PITCH,
  REVERSE_LIMIT,
  autopilotStep,
  carryAlong,
  clamp,
  keepOutsideBodies,
  distance,
  spawnShip,
  steerByDrag,
  stepShip,
  type Body,
  type FlightInput,
  type ShipState,
  type Vec3,
} from './flight';
import {
  MAX_VIEW_SCALE,
  MIN_VIEW_SCALE,
  isShipView,
  nextShipView,
  type ShipView,
} from './shipViews';
import type { ShipSnapshot } from './view';

export type Axis = 'yaw' | 'pitch' | 'throttle';

/** What each keyboard key does. Lower-case letters; arrows by their `KeyboardEvent.key` name. */
const KEY_AXES: Record<string, { axis: Axis; value: 1 | -1 }> = {
  w: { axis: 'throttle', value: 1 }, // faster
  s: { axis: 'throttle', value: -1 }, // slower / reverse
  a: { axis: 'yaw', value: 1 }, // turn left
  d: { axis: 'yaw', value: -1 }, // turn right
  arrowleft: { axis: 'yaw', value: 1 },
  arrowright: { axis: 'yaw', value: -1 },
  arrowup: { axis: 'pitch', value: 1 }, // nose up
  arrowdown: { axis: 'pitch', value: -1 }, // nose down
};
const BRAKE_KEY = 'x';

/** True for a key the pilot uses while flying. (The view also uses it to stop the page scrolling on arrows.) */
export function isFlightKey(key: string): boolean {
  const k = key.toLowerCase();
  return k in KEY_AXES || k === BRAKE_KEY;
}

export interface StepOutcome {
  /** Set on the step in which the autopilot finished. */
  arrivedId: string | null;
  /** The body the ship bumped into this step, if any. */
  touched: string | null;
}

export class PilotController {
  active = false;
  ship: ShipState = spawnShip({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
  view: ShipView = 'chase';
  /** Zoom for the chase and map views (1 = normal). */
  viewScale = 1;
  autopilotId: string | null = null;
  /** When true (Reduce motion) the autopilot jumps straight to its destination instead of flying. */
  reducedMotion = false;

  private readonly held = new Set<string>();
  private readonly buttons: Record<Axis, number> = { yaw: 0, pitch: 0, throttle: 0 };
  private braking = false;

  // ---- getting in and out ----

  /**
   * Sit down in the pilot's seat. The first time (or every time `from` is given) the ship appears where the
   * camera is, facing what it was looking at, so there is no jump when you start.
   */
  setActive(
    active: boolean,
    from?: { position: Vec3; lookAt: Vec3 },
    bodies: readonly Body[] = [],
  ): void {
    if (active && !this.active && from) {
      const spawned = spawnShip(from.position, from.lookAt);
      spawned.position = keepOutsideBodies(spawned.position, bodies).position;
      this.ship = spawned;
      this.view = 'chase';
      this.viewScale = 1;
    }
    this.active = active;
    this.autopilotId = null;
    this.releaseAllControls();
  }

  setView(view: unknown): boolean {
    if (!isShipView(view)) return false;
    this.view = view;
    return true;
  }

  cycleView(): ShipView {
    this.view = nextShipView(this.view);
    return this.view;
  }

  // ---- input ----

  /** An on-screen button was pressed (1 or -1) or released (0). Silly values are clamped. */
  setButton(axis: Axis, value: number): void {
    if (!(axis in this.buttons) || !Number.isFinite(value)) return;
    this.buttons[axis] = clamp(value, -1, 1);
    if (axis === 'throttle' && value !== 0) this.braking = false; // see setKey
  }

  /** A key went down or up. Returns true if it is a flight key (so the caller can stop the page reacting too). */
  setKey(key: string, down: boolean): boolean {
    const k = key.toLowerCase();
    if (!isFlightKey(k)) return false;
    if (k === BRAKE_KEY) {
      // Like the Stop button: one tap brings the ship all the way to a stop (it does not need to be held).
      if (down) this.brake();
      return true;
    }
    if (down) {
      this.held.add(k);
      // Asking for more or less speed takes over from a brake that is still stopping the ship.
      if (KEY_AXES[k]?.axis === 'throttle') this.braking = false;
    } else this.held.delete(k);
    return true;
  }

  /** Forget every held key and button (the window lost focus, or the pilot stood up). Prevents a "stuck key". */
  releaseAllControls(): void {
    this.held.clear();
    this.buttons.yaw = this.buttons.pitch = this.buttons.throttle = 0;
    this.braking = false;
  }

  /** Stop the ship (the on-screen Stop button). Held for the moment of the press only. */
  brake(): void {
    this.braking = true;
    this.autopilotId = null;
  }

  /** The combined request from keys and buttons right now, each axis between -1 and 1. */
  currentInput(): FlightInput {
    let yaw = this.buttons.yaw;
    let pitch = this.buttons.pitch;
    let throttle = this.buttons.throttle;
    for (const key of this.held) {
      const mapping = KEY_AXES[key];
      if (!mapping) continue;
      if (mapping.axis === 'yaw') yaw += mapping.value;
      else if (mapping.axis === 'pitch') pitch += mapping.value;
      else throttle += mapping.value;
    }
    return {
      yaw: clamp(yaw, -1, 1),
      pitch: clamp(pitch, -1, 1),
      throttle: clamp(throttle, -1, 1),
      brake: this.braking,
    };
  }

  /** Drag (mouse or finger) to steer. Taking the controls yourself cancels the autopilot. */
  drag(dxPixels: number, dyPixels: number): void {
    if (dxPixels === 0 && dyPixels === 0) return;
    this.autopilotId = null;
    this.ship = steerByDrag(this.ship, dxPixels, dyPixels);
  }

  /** Move the throttle lever directly (the mouse wheel). Positive raises it. */
  nudgeThrottle(delta: number): void {
    if (!Number.isFinite(delta) || delta === 0) return;
    this.autopilotId = null;
    this.ship = { ...this.ship, throttle: clamp(this.ship.throttle + delta, -REVERSE_LIMIT, 1) };
  }

  /** Zoom the chase and map views: factor < 1 = closer, > 1 = farther. */
  zoomView(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) return;
    this.viewScale = clamp(this.viewScale * factor, MIN_VIEW_SCALE, MAX_VIEW_SCALE);
  }

  // ---- autopilot ----

  startAutopilot(id: string): void {
    this.autopilotId = id;
    this.braking = false;
  }

  cancelAutopilot(): void {
    this.autopilotId = null;
  }

  // ---- one frame ----

  /**
   * Advances the ship by `dt` seconds.
   *   before / after: every visible body's position before and after the planets moved this frame
   *   arriveDistance: how far from a body's centre the autopilot should stop, for a given body
   */
  step(
    dt: number,
    before: readonly Body[],
    after: readonly Body[],
    arriveDistance: (body: Body) => number,
  ): StepOutcome {
    if (!this.active || !(dt > 0)) return { arrivedId: null, touched: null };

    // 1. A ship parked near a planet goes where the planet goes.
    this.ship = { ...this.ship, position: carryAlong(this.ship.position, before, after) };

    const input = this.currentInput();
    const manual = input.yaw !== 0 || input.pitch !== 0 || input.throttle !== 0 || input.brake;
    if (manual) this.autopilotId = null; // the pilot took the controls

    // 2. Autopilot, if it is on and its target is still there.
    if (this.autopilotId !== null) {
      const target = after.find((body) => body.id === this.autopilotId);
      if (!target) {
        this.autopilotId = null;
      } else {
        const stopAt = arriveDistance(target);
        const others = after.filter((body) => body.id !== target.id);
        if (this.reducedMotion) {
          // Reduce motion: no flight, just appear beside the destination, on the side we were on.
          return this.jumpBeside(target, stopAt);
        }
        const result = autopilotStep(this.ship, target, others, dt, stopAt);
        this.ship = result.ship;
        if (result.arrived) {
          this.autopilotId = null;
          return { arrivedId: target.id, touched: null };
        }
        return { arrivedId: null, touched: result.touched };
      }
    }

    // 3. Manual flight.
    const result = stepShip(this.ship, input, dt, after);
    this.ship = result.ship;
    // The Stop button only brakes for the frame(s) it is held; release it once the ship has stopped.
    if (this.braking && this.ship.speed === 0 && this.ship.throttle === 0) this.braking = false;
    return { arrivedId: null, touched: result.touched };
  }

  private jumpBeside(target: Body, stopAt: number): StepOutcome {
    const away = {
      x: this.ship.position.x - target.position.x,
      y: this.ship.position.y - target.position.y,
      z: this.ship.position.z - target.position.z,
    };
    const length = Math.hypot(away.x, away.y, away.z) || 1;
    const position = {
      x: target.position.x + (away.x / length) * stopAt,
      y: target.position.y + (away.y / length) * stopAt,
      z: target.position.z + (away.z / length) * stopAt,
    };
    // Turn to face the target.
    const toward = spawnShip(position, target.position);
    this.ship = { ...toward, pitch: clamp(toward.pitch, -MAX_PITCH, MAX_PITCH) };
    this.autopilotId = null;
    return { arrivedId: target.id, touched: null };
  }

  // ---- reporting ----

  /** Distance from the ship to a body's centre. */
  distanceTo(body: Body): number {
    return distance(this.ship.position, body.position);
  }

  snapshot(): ShipSnapshot {
    return {
      active: this.active,
      state: { ...this.ship, position: { ...this.ship.position } },
      view: this.view,
      autopilotId: this.autopilotId,
      viewScale: this.viewScale,
    };
  }

  restore(snapshot: ShipSnapshot): void {
    this.active = snapshot.active;
    this.ship = { ...snapshot.state, position: { ...snapshot.state.position } };
    this.view = isShipView(snapshot.view) ? snapshot.view : 'chase';
    this.autopilotId = snapshot.autopilotId;
    this.viewScale = clamp(snapshot.viewScale, MIN_VIEW_SCALE, MAX_VIEW_SCALE);
    this.releaseAllControls();
  }
}
