// Warp streaks: thin lines that rush past the camera during a long flight. DECORATIVE, and switched off by
// Reduce motion and by the Performance profile (spec: "adaptive particle counts: warp streaks scale with the
// profile"). The strength comes from `warpStrength` in effects.ts, which is tested.
import * as THREE from 'three';
import { mulberry32 } from './random';

const FIELD_DEPTH = 55; // how far ahead of the camera the streaks start
const NEAR = 2; // closest a streak gets to the camera

export class WarpStreaks {
  /** Add this to the CAMERA (not the scene) so the streaks stay in front of it. */
  readonly object: THREE.LineSegments;
  private readonly positions: Float32Array;
  private readonly baseX: Float32Array;
  private readonly baseY: Float32Array;
  private readonly phase: Float32Array;
  private readonly speed: Float32Array;
  private readonly material: THREE.LineBasicMaterial;
  private readonly count: number;

  constructor(count: number) {
    this.count = count;
    const random = mulberry32(777);
    this.positions = new Float32Array(count * 6); // 2 ends x 3 numbers per streak
    this.baseX = new Float32Array(count);
    this.baseY = new Float32Array(count);
    this.phase = new Float32Array(count);
    this.speed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Spread around the view but leave the middle clear, so the destination stays visible.
      const angle = random() * Math.PI * 2;
      const radius = 2.5 + random() * 11;
      this.baseX[i] = Math.cos(angle) * radius;
      this.baseY[i] = Math.sin(angle) * radius;
      this.phase[i] = random();
      this.speed[i] = 0.7 + random() * 0.6;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.LineBasicMaterial({
      color: 0x9fc4ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: false, // always drawn on top of the scene
      depthWrite: false,
    });
    this.object = new THREE.LineSegments(geometry, this.material);
    this.object.frustumCulled = false; // its points move every frame, so a fixed bounding box would be wrong
    this.object.renderOrder = 1000;
    this.object.visible = false;
  }

  /** `strength` is 0 to 1; `seconds` is any steadily increasing clock. */
  update(strength: number, seconds: number): void {
    const show = strength > 0.01;
    this.object.visible = show;
    if (!show) return;
    this.material.opacity = Math.min(1, strength * 1.2);
    for (let i = 0; i < this.count; i++) {
      // Each streak slides toward the camera, then jumps back to the far end (the "% 1" does the wrapping).
      const along = (this.phase[i] + seconds * 0.9 * this.speed[i]) % 1;
      const z = -NEAR - along * FIELD_DEPTH;
      const length = strength * 14 * (0.5 + 0.5 * this.speed[i]);
      const k = i * 6;
      this.positions[k] = this.baseX[i];
      this.positions[k + 1] = this.baseY[i];
      this.positions[k + 2] = z;
      this.positions[k + 3] = this.baseX[i];
      this.positions[k + 4] = this.baseY[i];
      this.positions[k + 5] = z - length; // the tail trails behind, away from the camera
    }
    this.object.geometry.attributes.position.needsUpdate = true;
  }
}
