// The 3D renderer: draws the Sun, Earth, Moon and a star field with Three.js (WebGL2).
import * as THREE from 'three';
import { log } from './log';
import { orbitPosition } from './orbits';
import { SIM_DAYS_PER_SECOND, VISUALS } from './scale';
import type { View, ViewOptions, ViewQuality } from './view';

/** Radius of the sphere the stars sit on (far beyond the planets). */
const STAR_SPHERE_RADIUS = 1500;
const MAX_STARS = 4000;

/** Small seeded random generator, so the star field looks identical on every load. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns the orbital period (days) stored in the JSON data, or throws if it is missing. */
function periodDaysOf(options: ViewOptions, id: string): number {
  const object = options.objects.find((o) => o.id === id);
  const value = object?.data.orbitalPeriod?.value;
  if (typeof value !== 'number') throw new Error(`"${id}" has no numeric orbitalPeriod in data`);
  return value;
}

export class WebGLView implements View {
  readonly kind = 'webgl2' as const;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 4000);
  private readonly meshes = new Map<string, THREE.Mesh>();
  private readonly stars: THREE.Points;
  private readonly resizeObserver: ResizeObserver;
  private quality: ViewQuality;
  private simDays = 0;
  private lastTime = 0;
  private running = false;

  private readonly options: ViewOptions;

  constructor(options: ViewOptions) {
    this.options = options;
    this.quality = options.quality;

    // Creating the renderer throws if WebGL2 is unavailable. The caller (step 7) handles that.
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.domElement.className = 'game-canvas';
    options.host.append(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x02030a);
    this.buildLights();
    this.buildBodies();
    this.stars = this.buildStars();
    this.scene.add(this.stars);

    this.camera.position.set(0, 55, 130);
    this.camera.lookAt(0, 0, 0);

    // Keep the canvas sized to its container, including when a phone rotates.
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(options.host);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.setQuality(this.quality);
  }

  start(): void {
    this.running = true;
    this.resume();
    log('WebGL view started');
  }

  dispose(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    // Free GPU memory held by geometries, materials and the renderer itself.
    this.scene.traverse((node) => {
      if (
        node instanceof THREE.Mesh ||
        node instanceof THREE.Points ||
        node instanceof THREE.Line
      ) {
        node.geometry.dispose();
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((m) => m.dispose());
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  setQuality(quality: ViewQuality): void {
    this.quality = quality;
    // Cap the pixel ratio (spec: phones at 3x are wasteful), then apply dynamic resolution.
    const ratio =
      Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap) * quality.resolutionScale;
    this.renderer.setPixelRatio(ratio);
    this.stars.geometry.setDrawRange(0, Math.min(quality.starCount, MAX_STARS));
    this.resize();
  }

  // ---- scene construction -------------------------------------------------------------

  private buildLights(): void {
    // The Sun is the light source. decay = 0 means light does not fade with distance.
    this.scene.add(new THREE.PointLight(0xffffff, 6, 0, 0));
    this.scene.add(new THREE.AmbientLight(0x404868, 0.8)); // faint fill so the night side is visible
  }

  private buildBodies(): void {
    for (const [id, spec] of Object.entries(VISUALS)) {
      const isSun = id === 'sun';
      const geometry = new THREE.SphereGeometry(spec.radius, 48, 32);
      // The Sun glows by itself (Basic material ignores lights); planets are lit by the Sun.
      const material = isSun
        ? new THREE.MeshBasicMaterial({ color: spec.color })
        : new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.9 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.objectId = id; // lets picking (step 4) map a mesh back to its data
      this.meshes.set(id, mesh);
      this.scene.add(mesh);
    }
    this.scene.add(this.buildGlow(VISUALS.sun.radius * 1.5));
    this.scene.add(this.buildOrbitLine(VISUALS.earth.orbit!.radius));
    this.updatePositions();
  }

  /** A soft halo around the Sun. Purely decorative (labelled as such in the spec). */
  private buildGlow(radius: number): THREE.Mesh {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffa530,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending, // adds light instead of covering what is behind
      side: THREE.BackSide,
      depthWrite: false,
    });
    return new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), material);
  }

  private buildOrbitLine(radius: number): THREE.LineLoop {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color: 0x3a4a78 }));
  }

  /** All stars live in ONE Points object = one draw call (spec: efficient star rendering). */
  private buildStars(): THREE.Points {
    const random = mulberry32(1948);
    const positions = new Float32Array(MAX_STARS * 3);
    for (let i = 0; i < MAX_STARS; i++) {
      // Uniform random point on a sphere.
      const u = random() * 2 - 1;
      const theta = random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      positions[i * 3] = Math.cos(theta) * r * STAR_SPHERE_RADIUS;
      positions[i * 3 + 1] = u * STAR_SPHERE_RADIUS;
      positions[i * 3 + 2] = Math.sin(theta) * r * STAR_SPHERE_RADIUS;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.2,
      sizeAttenuation: false,
    });
    return new THREE.Points(geometry, material);
  }

  // ---- per-frame work -------------------------------------------------------------------

  private updatePositions(): void {
    const earthPeriod = periodDaysOf(this.options, 'earth');
    const moonPeriod = periodDaysOf(this.options, 'moon');
    const earthOrbit = VISUALS.earth.orbit!;
    const moonOrbit = VISUALS.moon.orbit!;

    const earth = orbitPosition(earthOrbit.radius, earthPeriod, this.simDays);
    const moonOffset = orbitPosition(moonOrbit.radius, moonPeriod, this.simDays);
    this.meshes.get('sun')!.position.set(0, 0, 0);
    this.meshes.get('earth')!.position.set(earth.x, 0, earth.z);
    this.meshes.get('moon')!.position.set(earth.x + moonOffset.x, 0, earth.z + moonOffset.z);
  }

  private readonly frame = (): void => {
    const now = performance.now();
    // Clamp the time step so a stalled tab does not make the planets jump.
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.simDays += dt * SIM_DAYS_PER_SECOND;
    this.updatePositions();
    this.renderer.render(this.scene, this.camera);
  };

  private resume(): void {
    this.lastTime = performance.now();
    this.renderer.setAnimationLoop(this.frame);
  }

  /** Spec: pause rendering when the tab is hidden, to save battery. */
  private readonly onVisibilityChange = (): void => {
    if (!this.running) return;
    if (document.hidden) this.renderer.setAnimationLoop(null);
    else this.resume();
  };

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.options.host;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false); // false: CSS controls the canvas size, not JavaScript
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
