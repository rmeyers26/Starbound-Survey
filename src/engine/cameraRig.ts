// The orbit camera (spec: "orbit and fly-to ... much easier to control than free flight").
// The camera always looks at `target` from a given distance; the player rotates around it,
// zooms in and out, or asks it to fly to a new target with easing.
import * as THREE from 'three';
import { clamp, easeInOutCubic, lerp } from './easing';

export interface CameraState {
  yaw: number; // rotation around the vertical axis (radians)
  pitch: number; // up/down angle (radians)
  distance: number; // how far the camera is from the target
}

export const OVERVIEW_DISTANCE = 240; // far enough to frame the asteroid belt (Ceres)
export const OVERVIEW_MIN_DISTANCE = 12;
export const MAX_DISTANCE = 700; // must exceed the overview distance once Neptune is unlocked
export const FLY_DURATION_S = 2.5; // spec: 2 to 4 seconds
const MAX_PITCH = Math.PI / 2 - 0.05; // stop just short of straight up/down (avoids a flip)
const ROTATE_RADIANS_PER_PIXEL = 0.005;

export class CameraRig {
  yaw = 0;
  pitch = 0.4;
  distance = OVERVIEW_DISTANCE;
  minDistance = OVERVIEW_MIN_DISTANCE;
  /** The point the camera looks at. Updated every frame from the followed object. */
  readonly target = new THREE.Vector3();
  /** Multipliers from Settings (1 = default). */
  sensitivity = { rotate: 1, zoom: 1 };
  /** When true, fly-to jumps instantly (spec: Reduce motion). */
  reducedMotion = false;

  private fly: {
    elapsed: number;
    duration: number;
    fromTarget: THREE.Vector3;
    fromDistance: number;
    toDistance: number;
  } | null = null;

  get isFlying(): boolean {
    return this.fly !== null;
  }

  getState(): CameraState {
    return { yaw: this.yaw, pitch: this.pitch, distance: this.distance };
  }

  setState(state: CameraState): void {
    this.yaw = state.yaw;
    this.pitch = clamp(state.pitch, -MAX_PITCH, MAX_PITCH);
    this.distance = clamp(state.distance, this.minDistance, MAX_DISTANCE);
  }

  /** Rotate by a screen drag measured in pixels. */
  rotate(dxPixels: number, dyPixels: number): void {
    const k = ROTATE_RADIANS_PER_PIXEL * this.sensitivity.rotate;
    this.yaw -= dxPixels * k;
    this.pitch = clamp(this.pitch + dyPixels * k, -MAX_PITCH, MAX_PITCH);
  }

  /** factor < 1 = closer, > 1 = farther. Ignored mid-flight so the two motions don't fight. */
  zoomBy(factor: number): void {
    if (this.fly) return;
    // Sensitivity scales the zoom *strength*: raising factor to a power keeps it symmetric.
    const adjusted = Math.pow(factor, this.sensitivity.zoom);
    this.distance = clamp(this.distance * adjusted, this.minDistance, MAX_DISTANCE);
  }

  /** The closest allowed distance depends on how big the focused object is. */
  setMinDistance(min: number): void {
    this.minDistance = min;
    if (!this.fly) this.distance = clamp(this.distance, this.minDistance, MAX_DISTANCE);
  }

  /**
   * Start a smooth flight to `toDistance`; the target itself is followed in `update`.
   * `newMinDistance` is the closest allowed distance for the NEW focus. It is applied now but
   * the current distance is not clamped, so flying out of a close-up doesn't snap.
   */
  flyTo(toDistance: number, newMinDistance: number, durationSeconds = FLY_DURATION_S): void {
    this.minDistance = newMinDistance;
    const duration = this.reducedMotion ? 0 : durationSeconds;
    this.fly = {
      elapsed: 0,
      duration,
      fromTarget: this.target.clone(),
      fromDistance: this.distance,
      toDistance: clamp(toDistance, this.minDistance, MAX_DISTANCE),
    };
  }

  /**
   * Advance by `dt` seconds. `followPosition` is where the focused object is RIGHT NOW (it moves
   * because it orbits), so the camera stays glued to it.
   */
  update(dt: number, followPosition: THREE.Vector3): void {
    if (!this.fly) {
      this.target.copy(followPosition);
      return;
    }
    const f = this.fly;
    f.elapsed += dt;
    const done = f.duration <= 0 || f.elapsed >= f.duration;
    const s = done ? 1 : easeInOutCubic(f.elapsed / f.duration);
    this.target.lerpVectors(f.fromTarget, followPosition, s);
    // Interpolate distance on a log scale so a long zoom feels even, not "all at the end".
    this.distance = Math.exp(lerp(Math.log(f.fromDistance), Math.log(f.toDistance), s));
    if (done) {
      this.distance = f.toDistance;
      this.fly = null;
    }
  }

  applyTo(camera: THREE.PerspectiveCamera): void {
    const cosPitch = Math.cos(this.pitch);
    camera.position.set(
      this.target.x + this.distance * Math.sin(this.yaw) * cosPitch,
      this.target.y + this.distance * Math.sin(this.pitch),
      this.target.z + this.distance * Math.cos(this.yaw) * cosPitch,
    );
    camera.lookAt(this.target);
  }
}
