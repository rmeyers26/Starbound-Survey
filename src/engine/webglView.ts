// The 3D renderer: draws the Sun, Earth, Moon and a star field with Three.js (WebGL2).
import * as THREE from 'three';
import type { GameEvents } from '../game/events';
import { CameraRig, OVERVIEW_DISTANCE, OVERVIEW_MIN_DISTANCE } from './cameraRig';
import { attachInput } from './inputController';
import { log } from './log';
import { hitRadius, pickObject, type PickCandidate } from './picking';
import { faceTowards } from './orientation';
import { mulberry32 } from './random';
import { SIM_DAYS_PER_SECOND, VISUALS, closestDistance, focusDistance } from './scale';
import { computePositions } from './solarSystem';
import { loadTexture, textureUrlFor } from './textures';
import type { ControlSettings, View, ViewOptions, ViewQuality, ViewState } from './view';

/** Radius of the sphere the stars sit on (far beyond the planets). */
const STAR_SPHERE_RADIUS = 1500;
const MAX_STARS = 4000;

export class WebGLView implements View {
  readonly kind = 'webgl2' as const;

  private readonly options: ViewOptions;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 4000);
  private readonly rig = new CameraRig();
  private readonly meshes = new Map<string, THREE.Mesh>();
  private readonly stars: THREE.Points;
  private readonly selectionRing: THREE.Mesh;
  private readonly raycaster = new THREE.Raycaster();
  private readonly resizeObserver: ResizeObserver;
  private readonly cleanups: Array<() => void> = [];
  private readonly followPosition = new THREE.Vector3();
  private quality: ViewQuality;
  private simDays = 0;
  private lastTime = 0;
  private running = false;
  private selectedId: string | null = null;
  private focusId: string | null = null;

  constructor(options: ViewOptions) {
    this.options = options;
    this.quality = options.quality;

    // Creating the renderer throws if WebGL2 is unavailable. The caller (step 7) handles that.
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    const canvas = this.renderer.domElement;
    canvas.className = 'game-canvas';
    canvas.tabIndex = 0; // lets the keyboard focus the 3D view
    canvas.setAttribute('role', 'application');
    canvas.setAttribute(
      'aria-label',
      '3D view of the Sun, Earth and Moon. Arrow keys rotate, plus and minus zoom, Enter focuses the selected object, Escape returns to the overview.',
    );
    options.host.append(canvas);
    // If the GPU resets (common on phones when the app is backgrounded), tell the ViewHost so it
    // can rebuild or fall back. preventDefault() says "we will deal with it" to the browser.
    canvas.addEventListener('webglcontextlost', this.onContextLost);

    this.scene.background = new THREE.Color(0x02030a);
    this.buildLights();
    this.buildBodies();
    this.stars = this.buildStars();
    this.scene.add(this.stars);
    this.selectionRing = this.buildSelectionRing();
    this.scene.add(this.selectionRing);

    this.restoreState(options.initialState);
    this.connectInput(canvas);
    this.connectBus();

    // Keep the canvas sized to its container, including when a phone rotates.
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(options.host);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.setQuality(this.quality);
    void this.loadSurfaceTextures();
  }

  private disposed = false;

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    if (this.disposed) return;
    log('WebGL context lost');
    this.renderer.setAnimationLoop(null);
    this.options.onContextLost?.();
  };

  start(): void {
    this.running = true;
    this.resume();
    log('WebGL view started');
  }

  dispose(): void {
    this.disposed = true;
    this.running = false;
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.cleanups.forEach((fn) => fn());
    // Free GPU memory held by geometries, materials and the renderer itself.
    this.scene.traverse((node) => {
      if (
        node instanceof THREE.Mesh ||
        node instanceof THREE.Points ||
        node instanceof THREE.Line
      ) {
        node.geometry.dispose();
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((m) => {
          // A material's picture (texture) lives on the GPU separately and must be freed too.
          if ('map' in m && m.map instanceof THREE.Texture) m.map.dispose();
          m.dispose();
        });
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

  setControlSettings(settings: ControlSettings): void {
    this.rig.sensitivity = { rotate: settings.rotateSensitivity, zoom: settings.zoomSensitivity };
    this.rig.reducedMotion = settings.reducedMotion;
  }

  getState(): ViewState {
    return {
      selectedId: this.selectedId,
      focusId: this.focusId,
      simDays: this.simDays,
      camera: this.rig.getState(),
    };
  }

  distanceTo(id: string): number | null {
    const mesh = this.meshes.get(id);
    return mesh ? this.camera.position.distanceTo(mesh.position) : null;
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
        : new THREE.MeshStandardMaterial({ color: spec.color, roughness: 1, metalness: 0 }); // matte, like real rock and dust
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.objectId = id;
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

  /** A flat ring that always faces the camera and marks the selected object. */
  private buildSelectionRing(): THREE.Mesh {
    const material = new THREE.MeshBasicMaterial({
      color: 0x7fd4ff,
      side: THREE.DoubleSide,
      depthTest: false, // draw on top, even if the object is behind something
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 64), material);
    ring.renderOrder = 10;
    ring.visible = false;
    return ring;
  }

  /**
   * Loads surface pictures (e.g. NASA's Moon map) in the background. The game is already running with
   * flat colours; each body switches to its picture the moment the picture arrives. If there is no
   * picture, or it fails to load, nothing changes.
   */
  private async loadSurfaceTextures(): Promise<void> {
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    for (const [id, spec] of Object.entries(VISUALS)) {
      if (!spec.texture) continue;
      const url = textureUrlFor(spec.texture, this.quality.textureSize);
      if (!url) continue;
      const texture = await loadTexture(url, maxAnisotropy);
      const mesh = this.meshes.get(id);
      if (this.disposed || !texture || !mesh) {
        texture?.dispose(); // the view was closed while the picture downloaded
        continue;
      }
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.map = texture;
      material.color.set(0xffffff); // colour multiplies the picture, so white leaves it unchanged
      material.needsUpdate = true; // tell Three.js to rebuild the shader to use the new picture
      log('Texture applied to', id);
    }
  }

  // ---- input and events ---------------------------------------------------------------

  private connectInput(canvas: HTMLElement): void {
    const { bus } = this.options;
    const objectAt = (x: number, y: number): string | null => {
      const w = this.options.host.clientWidth;
      const h = this.options.host.clientHeight;
      if (w === 0 || h === 0) return null;
      // Convert pixels to "normalised device coordinates" (-1..1, with Y pointing up).
      this.raycaster.setFromCamera(
        new THREE.Vector2((x / w) * 2 - 1, -(y / h) * 2 + 1),
        this.camera,
      );
      return pickObject(this.raycaster.ray, this.camera.position, this.pickCandidates());
    };
    const focusSelected = (): void => {
      if (this.selectedId) bus.emit('camera:focus', { id: this.selectedId });
    };

    this.cleanups.push(
      attachInput(canvas, {
        onDrag: (dx, dy) => this.rig.rotate(dx, dy),
        onPinch: (ratio) => this.rig.zoomBy(1 / ratio), // fingers apart (ratio > 1) = zoom in
        onTap: (x, y) => bus.emit('object:selected', { id: objectAt(x, y) }),
        onDoubleTap: (x, y) => {
          const id = objectAt(x, y);
          if (!id) return;
          bus.emit('object:selected', { id });
          bus.emit('camera:focus', { id });
        },
        onWheelZoom: (factor) => this.rig.zoomBy(factor),
        onKeyZoom: (factor) => this.rig.zoomBy(factor),
        onKeyRotate: (dx, dy) => this.rig.rotate(dx, dy),
        onFocusKey: focusSelected,
        onEscapeKey: () => {
          bus.emit('object:selected', { id: null });
          bus.emit('camera:focus', { id: null });
        },
      }),
    );
  }

  private connectBus(): void {
    const { bus } = this.options;
    const on = <K extends keyof GameEvents>(name: K, fn: (p: GameEvents[K]) => void): void => {
      this.cleanups.push(bus.on(name, fn));
    };
    on('object:selected', ({ id }) => {
      this.selectedId = id;
    });
    on('camera:focus', ({ id }) => this.focusOn(id));
    on('camera:zoom', ({ factor }) => this.rig.zoomBy(factor));
  }

  private pickCandidates(): PickCandidate[] {
    return [...this.meshes.entries()].map(([id, mesh]) => ({
      id,
      center: mesh.position,
      radius: VISUALS[id].radius,
    }));
  }

  /** Fly the camera to an object (or back to the overview when id is null). */
  private focusOn(id: string | null): void {
    if (id !== null && !this.meshes.has(id)) return;
    this.focusId = id;
    if (id === null) {
      this.rig.flyTo(OVERVIEW_DISTANCE, OVERVIEW_MIN_DISTANCE);
    } else {
      const radius = VISUALS[id].radius;
      this.rig.flyTo(focusDistance(radius), closestDistance(radius));
    }
  }

  /** Puts a rebuilt view back exactly where the old one was. */
  private restoreState(state: ViewState | undefined): void {
    if (!state) {
      this.rig.setState({ yaw: 0, pitch: 0.4, distance: OVERVIEW_DISTANCE });
      this.rig.target.set(0, 0, 0);
      return;
    }
    this.simDays = state.simDays;
    this.selectedId = state.selectedId;
    this.focusId = state.focusId;
    this.updatePositions();
    const radius = state.focusId ? VISUALS[state.focusId]?.radius : undefined;
    this.rig.setMinDistance(radius ? closestDistance(radius) : OVERVIEW_MIN_DISTANCE);
    this.rig.setState(state.camera);
    this.rig.target.copy(this.followedPosition());
  }

  private followedPosition(): THREE.Vector3 {
    const mesh = this.focusId ? this.meshes.get(this.focusId) : undefined;
    return mesh ? this.followPosition.copy(mesh.position) : this.followPosition.set(0, 0, 0);
  }

  // ---- per-frame work -------------------------------------------------------------------

  private updatePositions(): void {
    for (const [id, p] of computePositions(this.options.objects, this.simDays)) {
      const mesh = this.meshes.get(id);
      if (!mesh) continue;
      mesh.position.set(p.x, 0, p.z);
      // The Moon keeps its near side toward Earth, just as the real Moon does.
      const orbit = VISUALS[id].orbit;
      if (VISUALS[id].tidallyLocked && orbit) {
        const parent = this.meshes.get(orbit.parentId);
        if (parent) mesh.rotation.y = faceTowards(mesh.position, parent.position);
      }
    }
  }

  private updateSelectionRing(): void {
    const mesh = this.selectedId ? this.meshes.get(this.selectedId) : undefined;
    this.selectionRing.visible = mesh !== undefined;
    if (!mesh || !this.selectedId) return;
    const distance = this.camera.position.distanceTo(mesh.position);
    const radius = hitRadius(VISUALS[this.selectedId].radius * 1.25, distance);
    this.selectionRing.position.copy(mesh.position);
    this.selectionRing.scale.setScalar(radius);
    this.selectionRing.quaternion.copy(this.camera.quaternion); // face the camera
  }

  private readonly frame = (): void => {
    const now = performance.now();
    const frameMs = now - this.lastTime;
    this.lastTime = now;
    this.options.onFrame?.(frameMs); // the quality manager measures real frame times
    // Clamp the time step so a stalled tab does not make the planets jump.
    const dt = Math.min(frameMs / 1000, 0.1);
    this.simDays += dt * SIM_DAYS_PER_SECOND;
    this.updatePositions();
    this.rig.update(dt, this.followedPosition());
    this.rig.applyTo(this.camera);
    this.updateSelectionRing();
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
