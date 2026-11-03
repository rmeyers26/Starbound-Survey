// The 3D renderer: draws the Sun, planets, Moon and a star field with Three.js (WebGL2).
import * as THREE from 'three';
import type { GameEvents } from '../game/events';
import { CameraRig, OVERVIEW_MIN_DISTANCE } from './cameraRig';
import { attachInput } from './inputController';
import { log } from './log';
import { hitRadius, pickObject, type PickCandidate } from './picking';
import { bearing, coRotationYawDelta, faceTowards } from './orientation';
import { BELT_PERIOD_DAYS, MAX_BELT_ROCKS, beltRockCount, generateBelt } from './belt';
import { createAtmosphere } from './atmosphere';
import type { Body } from './flight';
import { PilotController, isFlightKey } from './pilot';
import { createShipModel, type ShipModel } from './shipModel';
import { shotAt } from './cinematic';
import { TAIL_MAX_LENGTH, cometPath, tailLength } from './comet';
import { createComa, createTail, setGlowStrength } from './cometGlow';
import { DEFAULT_FOV, cameraPoseFor, shipModelScale } from './shipViews';
import type { BloomPipeline } from './bloomPipeline';
import {
  bloomPlan,
  cruiseWarp,
  sunBrightness,
  warpStreakCount,
  warpStrength,
  type BloomLevel,
} from './effects';
import { mulberry32 } from './random';
import { visibleBodyIds } from '../game/regions';
import {
  SIM_DAYS_PER_SECOND,
  VISUALS,
  closestDistance,
  focusDistance,
  overviewDistanceFor,
  reachFromSun,
  scanRange,
} from './scale';
import { cometElementsOf, cometMoment, computePositions } from './solarSystem';
import { loadTexture, textureUrlFor } from './textures';
import type {
  ControlSettings,
  PilotStatus,
  View,
  ViewOptions,
  ViewQuality,
  ViewState,
} from './view';
import { WarpStreaks } from './warpEffect';

/** Radius of the sphere the stars sit on (far beyond the planets). */
const STAR_SPHERE_RADIUS = 1500;
const MAX_STARS = 4000;

/** What the 3D view keeps for a comet besides its nucleus. */
interface CometVisual {
  coma: THREE.Mesh;
  /** The coma's size at its normal scale, in scene units. */
  comaRadius: number;
  ion: THREE.Mesh;
  dust: THREE.Mesh;
  path: THREE.Line;
  perihelionAu: number;
  /** Where the nucleus was last frame, to find which way it is moving. */
  previous: THREE.Vector3 | null;
}

export class WebGLView implements View {
  readonly kind = 'webgl2' as const;

  private readonly options: ViewOptions;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 4000);
  private readonly rig = new CameraRig();
  private readonly meshes = new Map<string, THREE.Mesh>();
  /** One orbit ring per body that circles the Sun, so a ring can be hidden with its body. */
  private readonly orbitLines = new Map<string, THREE.LineLoop>();
  /** Bodies the player may see right now (their region is unlocked). */
  private visibleIds = new Set<string>();
  /** Camera distance that frames everything currently visible. */
  private overviewDistance = overviewDistanceFor(0);
  private readonly stars: THREE.Points;
  private readonly belt: THREE.Points;
  /** Glowing hazes around worlds with air, so they can be switched off as a group by the quality level. */
  private readonly atmospheres: THREE.Mesh[] = [];
  /** The Sun's material, whose brightness is boosted while bloom is on (see `sunBrightness`). */
  private sunMaterial: THREE.MeshBasicMaterial | null = null;
  /** The bloom pipeline, once its code has downloaded (null = bloom off or not ready yet). */
  private bloomPipeline: BloomPipeline | null = null;
  private bloomWanted: BloomLevel = 'off';
  private readonly warp = new WarpStreaks(warpStreakCount(true));
  /** How far the camera's target moves in the current flight, used to decide how strong the warp is. */
  private warpTravel = 0;
  /** The last strength written to the canvas's data-warp attribute (so it is only written when it changes). */
  private warpLabel = '';
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
  /** Last frame's bearing from the focused body to the body it orbits (null = not tracking). */
  private lockBearing: number | null = null;
  /** The spacecraft: its flight rules live in PilotController; this class only draws it and moves the camera. */
  private readonly pilot = new PilotController();
  /** Built the first time you step into the ship (its textures and reflections are not worth loading before). */
  private shipModel: ShipModel | null = null;
  /** The orbit camera used for the spacecraft's "Orbit" view (separate, so leaving the ship does not disturb it). */
  private readonly shipRig = new CameraRig();
  /** True for one frame after the camera view changes, so the camera jumps there instead of gliding. */
  private snapPilotCamera = true;
  private pilotStatusClock = 0;
  /** The comet's glow, tails and path (the comet itself is an ordinary body in `meshes`). */
  private readonly comets = new Map<string, CometVisual>();
  /** Seconds spent in the cinematic view, which decides which shot is on (restarts each time you choose it). */
  private cinematicClock = 0;
  /** The last shot number written to the canvas's data-shot attribute. */
  private shotLabel = '';
  private lastPilotStatus = '';

  constructor(options: ViewOptions) {
    this.options = options;
    this.quality = options.quality;
    this.visibleIds = visibleBodyIds(options.objects, options.unlockedRegions);
    this.overviewDistance = overviewDistanceFor(reachFromSun(this.visibleIds));

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
      '3D view of the Solar System. Arrow keys rotate, plus and minus zoom, Enter focuses the selected object, Escape returns to the overview.',
    );
    options.host.append(canvas);
    // If the GPU resets (common on phones when the app is backgrounded), tell the ViewHost so it
    // can rebuild or fall back. preventDefault() says "we will deal with it" to the browser.
    canvas.addEventListener('webglcontextlost', this.onContextLost);

    this.scene.background = new THREE.Color(0x02030a);
    this.scene.add(this.camera); // the warp streaks are the camera's children, so the camera must be in the scene
    this.camera.add(this.warp.object);
    this.buildLights();
    // The belt must exist before the bodies are built, because showing or hiding bodies also shows or hides it.
    this.belt = this.buildBelt();
    this.scene.add(this.belt);
    this.buildBodies();
    this.stars = this.buildStars();
    this.scene.add(this.stars);
    this.selectionRing = this.buildSelectionRing();
    this.scene.add(this.selectionRing);
    this.restoreState(options.initialState);
    this.updateCanvasLabels(); // report "pilot off" (and describe the controls) from the very first frame
    this.connectInput(canvas);
    this.connectPilotKeys();
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
    this.shipModel?.dispose();
    this.shipModel = null;
    this.bloomPipeline?.dispose();
    this.bloomPipeline = null;
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
    this.belt.geometry.setDrawRange(0, beltRockCount(quality.starCount));
    for (const haze of this.atmospheres) haze.visible = quality.atmosphere;
    this.resize();
    void this.setBloom(quality.bloom);
  }

  setControlSettings(settings: ControlSettings): void {
    this.rig.sensitivity = { rotate: settings.rotateSensitivity, zoom: settings.zoomSensitivity };
    this.rig.reducedMotion = settings.reducedMotion;
    this.shipRig.sensitivity = this.rig.sensitivity;
    this.shipRig.reducedMotion = settings.reducedMotion;
    this.pilot.reducedMotion = settings.reducedMotion;
  }

  getState(): ViewState {
    return {
      selectedId: this.selectedId,
      focusId: this.focusId,
      simDays: this.simDays,
      camera: this.rig.getState(),
      ship: this.pilot.snapshot(),
    };
  }

  /** Distance to an object for the scanner: from the SHIP while piloting, otherwise from the camera. */
  distanceTo(id: string): number | null {
    const mesh = this.meshes.get(id);
    if (!mesh) return null;
    if (this.pilot.active) return this.pilot.distanceTo(this.bodyOf(id, mesh));
    return this.camera.position.distanceTo(mesh.position);
  }

  /**
   * Turns bloom on, off or changes its strength. The post-processing code is a separate download, fetched the
   * first time it is needed, so this is asynchronous. If the download fails the game simply runs without bloom.
   */
  private async setBloom(level: BloomLevel): Promise<void> {
    this.bloomWanted = level;
    if (level === 'off') {
      this.bloomPipeline?.dispose();
      this.bloomPipeline = null;
      this.applySunBrightness('off');
      return;
    }
    // Ask the graphics card what it can do. If it cannot draw into a floating-point picture, skip bloom.
    const plan = bloomPlan(level, {
      canRenderToFloat:
        this.renderer.extensions.has('EXT_color_buffer_float') ||
        this.renderer.extensions.has('EXT_color_buffer_half_float'),
      maxSamples: this.renderer.capabilities.maxSamples,
    });
    if (!plan) {
      log('This graphics card cannot do bloom; continuing without it');
      return;
    }
    const settings = plan;
    if (!this.bloomPipeline) {
      try {
        const { createBloomPipeline } = await import('./bloomPipeline');
        // While the code downloaded, the view may have been closed or the level changed to "off".
        if (this.disposed || this.bloomWanted === 'off') return;
        if (!this.bloomPipeline) {
          this.bloomPipeline = createBloomPipeline(
            this.renderer,
            this.scene,
            this.camera,
            settings,
          );
        }
      } catch (error) {
        log('Bloom could not start, continuing without it:', error);
        return;
      }
    }
    this.bloomPipeline.configure(settings);
    this.resize(); // gives the new pipeline its size
    this.applySunBrightness(this.bloomWanted);
  }

  /** Boosts the Sun above "white" while bloom is on so it glows, and returns it to normal when off. */
  private applySunBrightness(level: BloomLevel): void {
    this.sunMaterial?.color.set(VISUALS.sun.color).multiplyScalar(sunBrightness(level));
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
        ? (this.sunMaterial = new THREE.MeshBasicMaterial({ color: spec.color }))
        : new THREE.MeshStandardMaterial({ color: spec.color, roughness: 1, metalness: 0 }); // matte, like real rock and dust
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.objectId = id;
      if (spec.rings) mesh.add(this.buildRings(spec.radius, spec.rings));
      if (spec.atmosphere) {
        const haze = createAtmosphere(spec.radius, spec.atmosphere);
        this.atmospheres.push(haze);
        mesh.add(haze);
      }
      if (spec.startLongitudeDeg !== undefined) {
        // The centre of a sphere's picture faces +X and longitude grows toward -Z, so turning by
        // (-90 degrees - longitude) brings that longitude round to face +Z, where the camera starts.
        mesh.rotation.y = -Math.PI / 2 - (spec.startLongitudeDeg * Math.PI) / 180;
      }
      this.meshes.set(id, mesh);
      this.scene.add(mesh);
      if (spec.comet) this.comets.set(id, this.buildComet(id, mesh));
    }
    this.scene.add(this.buildGlow(VISUALS.sun.radius * 1.5));
    // One ring for every body that circles the Sun. (Moons are skipped: a ring around a moving
    // planet would have to move with it.)
    for (const [id, spec] of Object.entries(VISUALS)) {
      if (spec.orbit?.parentId !== 'sun') continue;
      const line = this.buildOrbitLine(spec.orbit.radius);
      this.orbitLines.set(id, line);
      this.scene.add(line);
    }
    this.applyVisibility();
    this.updatePositions();
  }

  /** Flat rings around a planet (Saturn). Decorative, drawn as a see-through disc with a hole. */
  private buildRings(
    planetRadius: number,
    rings: NonNullable<(typeof VISUALS)[string]['rings']>,
  ): THREE.Mesh {
    const geometry = new THREE.RingGeometry(
      planetRadius * rings.inner,
      planetRadius * rings.outer,
      96,
    );
    const material = new THREE.MeshStandardMaterial({
      color: rings.color,
      side: THREE.DoubleSide, // visible from above and below
      transparent: true,
      opacity: rings.opacity,
      roughness: 1,
      depthWrite: false, // see-through parts must not hide what is behind them
    });
    const mesh = new THREE.Mesh(geometry, material);
    // A RingGeometry stands upright by default: lay it flat, then tilt it like the real planet's axis.
    mesh.rotation.x = -Math.PI / 2 + (rings.tiltDeg * Math.PI) / 180;
    return mesh;
  }

  /** Shows only the bodies (and their orbit rings) whose region the player has unlocked. */
  private applyVisibility(): void {
    for (const [id, mesh] of this.meshes) mesh.visible = this.visibleIds.has(id);
    for (const [id, line] of this.orbitLines) line.visible = this.visibleIds.has(id);
    this.belt.visible = this.visibleIds.has('ceres'); // the belt belongs to the inner region, with Ceres
  }

  setUnlockedRegions(regions: string[]): void {
    this.visibleIds = visibleBodyIds(this.options.objects, regions);
    this.applyVisibility();
    this.overviewDistance = overviewDistanceFor(reachFromSun(this.visibleIds));
    // If you are looking at the whole system, widen the view to take in the newly unlocked planets.
    if (this.focusId === null) {
      this.warpTravel = 0; // widening the view is not a journey
      this.rig.flyTo(this.overviewDistance, OVERVIEW_MIN_DISTANCE);
    }
  }

  /**
   * The comet's look: a faint glow round the nucleus (the coma), two tails that point AWAY from the Sun (a blue,
   * straight one of gas and a paler, wider one of dust), and its path drawn as a thin line. All decorative: the real
   * brightness and tail length depend on how active the comet is, which the game does not know.
   */
  private buildComet(id: string, nucleus: THREE.Mesh): CometVisual {
    (nucleus.material as THREE.MeshStandardMaterial).transparent = true; // it fades in and out as the replay loops
    const comaRadius = VISUALS[id].radius * 6;
    const coma = createComa(comaRadius);
    nucleus.add(coma);
    const ion = createTail(0x6fb4ff);
    const dust = createTail(0xffe2b0);
    nucleus.add(ion, dust);

    const elements = cometElementsOf(this.options.objects, id);
    const windowAu = VISUALS[id].comet!.windowAu;
    const path = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        cometPath(elements, windowAu, 160).map((p) => new THREE.Vector3(p.x, p.y, p.z)),
      ),
      new THREE.LineBasicMaterial({ color: 0x5f86c8, transparent: true, opacity: 0.55 }),
    );
    this.scene.add(path);
    return {
      coma,
      comaRadius,
      ion,
      dust,
      path,
      perihelionAu: elements.perihelionAu,
      previous: null,
    };
  }

  /** When the canvas's data-comet value was last written (it is only refreshed a few times a second). */
  private cometLabelAt = 0;
  private readonly cometAway = new THREE.Vector3();
  private readonly cometDust = new THREE.Vector3();
  private readonly cometForward = new THREE.Vector3(0, 0, 1);

  /** Fades the comet with its replay, and points and sizes its tails: away from the Sun, longer when closer to it. */
  private updateComets(): void {
    for (const [id, comet] of this.comets) {
      const nucleus = this.meshes.get(id);
      if (!nucleus) continue;
      const moment = cometMoment(this.options.objects, id, this.simDays);
      const inRegion = this.visibleIds.has(id);
      nucleus.visible = inRegion && moment.fade > 0.01;
      comet.path.visible = inRegion;
      (nucleus.material as THREE.MeshStandardMaterial).opacity = moment.fade;

      // Which way the comet is moving, to bend the dust tail back along its path. (A jump means the replay looped.)
      const velocity = this.cometDust.set(0, 0, 0);
      if (comet.previous && comet.previous.distanceTo(nucleus.position) < 5) {
        velocity.copy(nucleus.position).sub(comet.previous);
      }
      comet.previous = (comet.previous ?? new THREE.Vector3()).copy(nucleus.position);

      // A tail points directly away from the Sun, which is at the centre.
      const away = this.cometAway.copy(nucleus.position);
      if (away.lengthSq() < 1e-9) away.set(1, 0, 0);
      away.normalize();
      const trueLength = tailLength(moment.rAu, comet.perihelionAu) * moment.fade;
      const warmth = trueLength / TAIL_MAX_LENGTH;
      // Seen from far away (the whole-system overview) the comet would be a speck, so its glow and tail are drawn a
      // little bigger the further the camera is, up to a limit. Decorative only.
      const cameraDistance = this.camera.position.distanceTo(nucleus.position);
      const length = trueLength * THREE.MathUtils.clamp(cameraDistance / 60, 1, 2.5);
      comet.coma.scale.setScalar(Math.max(1, (cameraDistance * 0.012) / comet.comaRadius));

      comet.ion.visible = length > 0.05;
      comet.ion.quaternion.setFromUnitVectors(this.cometForward, away);
      comet.ion.scale.set(length * 0.08, length * 0.08, length);
      setGlowStrength(comet.ion, 1.2 * moment.fade);

      // The dust tail trails behind the comet's motion as well as away from the Sun, so it curves.
      const dustDirection =
        velocity.lengthSq() > 1e-12 ? velocity.normalize().multiplyScalar(-0.45).add(away) : away;
      comet.dust.visible = length > 0.05;
      comet.dust.quaternion.setFromUnitVectors(this.cometForward, dustDirection.normalize());
      comet.dust.scale.set(length * 0.16, length * 0.16, length * 0.75);
      setGlowStrength(comet.dust, 0.9 * moment.fade);

      setGlowStrength(comet.coma, 0.55 * moment.fade * (0.25 + 0.75 * warmth));

      // A read-only status for automated tests: "fade height tailLength" (the comet moves every frame, so this is
      // refreshed only a few times a second). Looking at coloured pixels to find a faint tail is unreliable.
      const now = performance.now();
      if (now - this.cometLabelAt > 200) {
        this.cometLabelAt = now;
        this.renderer.domElement.dataset.comet = `${moment.fade.toFixed(2)} ${moment.y.toFixed(1)} ${length.toFixed(1)}`;
      }
    }
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

  /** The asteroid belt: every rock in ONE Points object (one draw call), turned slowly each frame. */
  private buildBelt(): THREE.Points {
    const rocks = generateBelt(MAX_BELT_ROCKS);
    const positions = new Float32Array(rocks.length * 3);
    rocks.forEach((rock, i) => {
      positions[i * 3] = Math.cos(rock.angle) * rock.radius;
      positions[i * 3 + 1] = rock.height;
      positions[i * 3 + 2] = -Math.sin(rock.angle) * rock.radius; // same direction as the planets
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0x9a9388,
      size: 1.8,
      sizeAttenuation: false, // always a small dot on screen, however far away
      transparent: true,
      opacity: 0.8,
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
      if (spec.nightGlow) {
        // Reuse the same picture as a very dim self-light so the night side is not pure black.
        material.emissive.set(0xffffff);
        material.emissiveMap = texture;
        material.emissiveIntensity = spec.nightGlow;
      }
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
        onDrag: (dx, dy) => this.dragView(dx, dy),
        onPinch: (ratio) => this.zoomView(1 / ratio), // fingers apart (ratio > 1) = zoom in
        onTap: (x, y) => bus.emit('object:selected', { id: objectAt(x, y) }),
        onDoubleTap: (x, y) => {
          const id = objectAt(x, y);
          if (!id) return;
          bus.emit('object:selected', { id });
          bus.emit('camera:focus', { id });
        },
        onWheelZoom: (factor) => this.wheel(factor),
        onKeyZoom: (factor) => this.zoomView(factor),
        // While piloting, the arrow keys steer the ship (see `onWindowKey`) rather than turning the camera.
        onKeyRotate: (dx, dy) => {
          if (!this.pilot.active) this.rig.rotate(dx, dy);
        },
        onFocusKey: focusSelected,
        onEscapeKey: () => {
          bus.emit('object:selected', { id: null });
          bus.emit('camera:focus', { id: null });
        },
      }),
    );
  }

  /**
   * Flight keys are listened for on the whole window (not just the canvas) so they keep working after you click a
   * button. P gets in and out of the ship; while piloting: W/S speed, A/D or left/right arrows turn, up/down arrows
   * tilt the nose, X stops, V changes the camera view. Keys are ignored while typing or while a dialog is open.
   */
  private connectPilotKeys(): void {
    const { bus } = this.options;
    const isTyping = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector('dialog[open]')) return; // Settings or the Logbook is open
      const key = e.key.toLowerCase();
      if (key === 'p') {
        if (!e.repeat) bus.emit('pilot:set', { active: !this.pilot.active });
        return;
      }
      if (!this.pilot.active) return;
      if (key === 'v') {
        if (!e.repeat) this.setPilotView(this.pilot.cycleView());
        return;
      }
      if (isFlightKey(e.key) && this.pilot.setKey(e.key, true)) e.preventDefault(); // arrows must not scroll
    };
    // Letting go is always honoured, even if focus moved meanwhile, so a key can never get "stuck down".
    const onKeyUp = (e: KeyboardEvent): void => {
      if (isFlightKey(e.key)) this.pilot.setKey(e.key, false);
    };
    const onBlur = (): void => this.pilot.releaseAllControls();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    this.cleanups.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    });
  }

  private connectBus(): void {
    const { bus } = this.options;
    const on = <K extends keyof GameEvents>(name: K, fn: (p: GameEvents[K]) => void): void => {
      this.cleanups.push(bus.on(name, fn));
    };
    on('object:selected', ({ id }) => {
      this.selectedId = id;
      if (this.pilot.active) this.emitPilotStatus(true); // the distance readout is about the selection
    });
    // While piloting, "go to this object" means "autopilot there", and "overview" means "leave the ship".
    on('camera:focus', ({ id }) => (this.pilot.active ? this.pilotFocus(id) : this.focusOn(id)));
    on('camera:zoom', ({ factor }) => this.zoomView(factor));
    on('pilot:set', ({ active }) => this.setPilotActive(active));
    on('pilot:view', ({ view }) => this.setPilotView(view));
    on('pilot:input', ({ axis, value }) => this.pilot.setButton(axis, value));
    on('pilot:brake', () => {
      if (this.pilot.active) this.pilot.brake();
    });
    on('pilot:autopilot', ({ id }) => {
      if (!this.pilot.active) return;
      if (id === null) this.pilot.cancelAutopilot();
      else if (this.visibleIds.has(id) && this.meshes.has(id)) this.pilot.startAutopilot(id);
      this.emitPilotStatus(true);
    });
  }

  // ---- the spacecraft ---------------------------------------------------------------------

  /** Mouse or finger drag: swings the camera round the ship (Orbit view), steers the ship, or turns the normal camera. */
  private dragView(dx: number, dy: number): void {
    if (!this.pilot.active) this.rig.rotate(dx, dy);
    else if (this.pilot.view === 'orbit') this.shipRig.rotate(dx, dy);
    else this.pilot.drag(dx, dy);
  }

  /** Zoom buttons, + and -, and pinching. */
  private zoomView(factor: number): void {
    if (!this.pilot.active) this.rig.zoomBy(factor);
    else if (this.pilot.view === 'orbit') this.shipRig.zoomBy(factor);
    else this.pilot.zoomView(factor);
  }

  /** The mouse wheel: zooms the normal camera, but works the throttle lever while piloting (spec: "scroll or W/S to move"). */
  private wheel(factor: number): void {
    if (!this.pilot.active) this.rig.zoomBy(factor);
    else if (this.pilot.view === 'orbit') this.shipRig.zoomBy(factor);
    else this.pilot.nudgeThrottle(-Math.log(factor) * 0.8); // scroll up (factor < 1) = faster
  }

  private pilotFocus(id: string | null): void {
    if (id === null) this.setPilotActive(false);
    else if (this.visibleIds.has(id) && this.meshes.has(id)) {
      this.pilot.startAutopilot(id);
      this.emitPilotStatus(true);
    }
  }

  private setPilotView(view: unknown): void {
    if (!this.pilot.setView(view)) return;
    this.snapPilotCamera = true; // jump to the new view instead of sliding there
    this.updateCanvasLabels();
    this.emitPilotStatus(true);
  }

  private setPilotActive(active: boolean): void {
    if (active === this.pilot.active) return;
    if (active) {
      // The ship appears where the camera is, facing what it was looking at, so starting causes no jump.
      this.pilot.setActive(
        true,
        { position: this.camera.position, lookAt: this.rig.target },
        this.pilotBodies(),
      );
      this.startShipRig();
      this.snapPilotCamera = true;
    } else {
      // Hand the camera back to the normal orbit camera from where the pilot view was, then fly out to the overview.
      const offset = this.camera.position.clone().sub(this.shipPositionVector());
      const dist = Math.max(offset.length(), 0.001);
      this.pilot.setActive(false);
      this.camera.up.set(0, 1, 0);
      this.setFov(DEFAULT_FOV);
      this.cinematicClock = 0;
      this.updateShotLabel();
      if (this.shipModel) this.shipModel.group.visible = false;
      this.rig.setMinDistance(OVERVIEW_MIN_DISTANCE);
      this.rig.setState({
        yaw: Math.atan2(offset.x, offset.z),
        pitch: Math.asin(THREE.MathUtils.clamp(offset.y / dist, -1, 1)),
        distance: dist,
      });
      this.rig.target.copy(this.shipPositionVector());
      this.focusOn(null);
    }
    this.updateViewOffset();
    this.updateCanvasLabels();
    this.emitPilotStatus(true);
  }

  /** Points the Orbit view's camera at the ship from behind. */
  private startShipRig(): void {
    this.shipRig.setMinDistance(1.2);
    this.shipRig.setState({ yaw: this.pilot.ship.yaw, pitch: 0.35, distance: 6 });
  }

  private shipPositionVector(): THREE.Vector3 {
    const p = this.pilot.ship.position;
    return this.shipPosition.set(p.x, p.y, p.z);
  }
  private readonly shipPosition = new THREE.Vector3();
  private readonly cameraGoal = new THREE.Vector3();

  /** Every body the ship can see, as plain numbers for the flight rules. */
  private pilotBodies(): Body[] {
    const bodies: Body[] = [];
    for (const [id, mesh] of this.meshes) {
      if (this.visibleIds.has(id)) bodies.push(this.bodyOf(id, mesh));
    }
    return bodies;
  }

  private bodyOf(id: string, mesh: THREE.Mesh): Body {
    const { x, y, z } = mesh.position;
    return { id, position: { x, y, z }, radius: VISUALS[id].radius };
  }

  /** Puts the camera where the chosen view wants it. */
  private applyPilotCamera(dt: number): void {
    const { ship, view, viewScale } = this.pilot;
    let fov = DEFAULT_FOV;
    if (view === 'orbit') {
      this.camera.up.set(0, 1, 0);
      this.shipRig.update(dt, this.shipPositionVector());
      this.shipRig.applyTo(this.camera);
    } else {
      const pose = cameraPoseFor(
        view,
        ship,
        viewScale,
        this.cinematicClock,
        this.pilot.reducedMotion,
      );
      this.cameraGoal.set(pose.position.x, pose.position.y, pose.position.z);
      // The chase camera trails the ship a little, which gives a feeling of speed. Everything else is exact.
      if (view === 'chase' && !this.snapPilotCamera && !this.pilot.reducedMotion) {
        this.camera.position.lerp(this.cameraGoal, 1 - Math.exp(-12 * dt));
      } else {
        this.camera.position.copy(this.cameraGoal);
      }
      this.camera.up.set(pose.up.x, pose.up.y, pose.up.z);
      this.camera.lookAt(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);
      fov = pose.fov ?? DEFAULT_FOV;
    }
    this.setFov(fov);
    this.updateShotLabel();
    this.snapPilotCamera = false;
  }

  /** Changes the lens angle (the cinematic view uses a narrower, film-like one). */
  private setFov(fov: number): void {
    if (this.camera.fov === fov) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  /** A read-only status for automated tests: which cinematic shot is on (1 to 4; 0 = held still by Reduce motion). */
  private updateShotLabel(): void {
    let label = '';
    if (this.pilot.active && this.pilot.view === 'cinematic') {
      label = this.pilot.reducedMotion ? '0' : String(shotAt(this.cinematicClock).index + 1);
    }
    if (label === this.shotLabel) return;
    this.shotLabel = label;
    if (label === '') delete this.renderer.domElement.dataset.shot;
    else this.renderer.domElement.dataset.shot = label;
  }

  /** Moves and turns the 3D ship to match the flight rules. The cockpit view hides it (you are inside). */
  private updateShipModel(): void {
    const { ship, view } = this.pilot;
    const shipModel = this.ensureShipModel();
    const model = shipModel.group;
    model.visible = view !== 'cockpit';
    model.position.set(ship.position.x, ship.position.y, ship.position.z);
    model.rotation.set(ship.pitch, ship.yaw, 0, 'YXZ'); // turn left/right first, then tilt the nose
    model.scale.setScalar(shipModelScale(view, this.camera.position.distanceTo(model.position)));
    shipModel.setThrottle(ship.throttle);
    shipModel.update(performance.now() / 1000); // makes the navigation lights blink
  }

  /** Builds the 3D ship the first time it is needed, and adds it to the scene. */
  private ensureShipModel(): ShipModel {
    if (!this.shipModel) {
      const started = performance.now();
      this.shipModel = createShipModel(this.renderer);
      // Visible in the browser's performance tools (and to tests) as "spacecraft-model-build".
      performance.measure('spacecraft-model-build', { start: started, end: performance.now() });
      this.shipModel.group.visible = false;
      this.scene.add(this.shipModel.group);
    }
    return this.shipModel;
  }

  /** Tells the controls what to show. Sent at most five times a second, and only when something visible changed. */
  private emitPilotStatus(force = false): void {
    const mesh = this.selectedId ? this.meshes.get(this.selectedId) : undefined;
    const target =
      mesh && this.selectedId && this.visibleIds.has(this.selectedId)
        ? this.bodyOf(this.selectedId, mesh)
        : null;
    const targetDistance = target ? this.pilot.distanceTo(target) : null;
    const status: PilotStatus = {
      active: this.pilot.active,
      view: this.pilot.view,
      throttle: this.pilot.ship.throttle,
      speed: this.pilot.ship.speed,
      autopilotId: this.pilot.autopilotId,
      headingDeg: Math.round((((this.pilot.ship.yaw * 180) / Math.PI) % 360) + 360) % 360,
      targetDistance,
      inScanRange:
        target !== null && targetDistance !== null && targetDistance <= scanRange(target.radius),
    };
    // Compare rounded values so a tiny change does not cause a message every frame.
    const label = [
      status.active,
      status.view,
      status.throttle.toFixed(2),
      status.speed.toFixed(1),
      status.autopilotId,
      status.headingDeg,
      targetDistance === null ? '-' : targetDistance.toFixed(1),
      status.inScanRange,
    ].join('|');
    if (label === this.lastPilotStatus && !force) return;
    this.lastPilotStatus = label;
    this.options.bus.emit('pilot:status', status);
  }

  /** The canvas's accessible description and the read-only status attribute used by automated tests. */
  private updateCanvasLabels(): void {
    const canvas = this.renderer.domElement;
    canvas.dataset.pilot = this.pilot.active ? this.pilot.view : 'off';
    canvas.setAttribute(
      'aria-label',
      this.pilot.active
        ? 'Spacecraft view. W and S change speed, A and D or the left and right arrows turn, the up and down arrows tilt the nose, X stops, V changes the camera view, Escape leaves the ship.'
        : '3D view of the Solar System. Arrow keys rotate, plus and minus zoom, Enter focuses the selected object, Escape returns to the overview. P takes the controls of the spacecraft.',
    );
  }

  private pickCandidates(): PickCandidate[] {
    return [...this.meshes.entries()]
      .filter(([id]) => this.visibleIds.has(id)) // a locked body cannot be tapped
      .map(([id, mesh]) => ({
        id,
        center: mesh.position,
        radius: VISUALS[id].radius,
      }));
  }

  /** Fly the camera to an object (or back to the overview when id is null). */
  private focusOn(id: string | null): void {
    if (id !== null && !this.meshes.has(id)) return;
    this.focusId = id;
    this.lockBearing = null; // start tracking afresh, so switching focus never makes the camera jump
    if (id === null) {
      this.rig.flyTo(this.overviewDistance, OVERVIEW_MIN_DISTANCE);
    } else {
      const radius = VISUALS[id].radius;
      this.rig.flyTo(focusDistance(radius), closestDistance(radius));
    }
    // How far the camera's target must travel decides how strong the warp streaks are (short hops get none).
    this.warpTravel = this.rig.target.distanceTo(this.followedPosition());
  }

  /** Puts a rebuilt view back exactly where the old one was. */
  private restoreState(state: ViewState | undefined): void {
    if (!state) {
      this.rig.setState({ yaw: 0, pitch: 0.4, distance: this.overviewDistance });
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
    if (state.ship) {
      this.pilot.restore(state.ship);
      if (this.pilot.active) this.startShipRig();
      this.updateViewOffset();
      this.updateCanvasLabels();
    }
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
      mesh.position.set(p.x, p.y ?? 0, p.z); // only a comet has a height
      // The Moon keeps its near side toward Earth, just as the real Moon does.
      const orbit = VISUALS[id].orbit;
      if (VISUALS[id].tidallyLocked && orbit) {
        const parent = this.meshes.get(orbit.parentId);
        if (parent) mesh.rotation.y = faceTowards(mesh.position, parent.position);
      }
    }
  }

  /**
   * While focused on a body that orbits something (a planet around the Sun, the Moon around Earth), turn the
   * camera along with its orbit. Without this, a camera that follows a planet but never turns sees the
   * Sun swing all the way round it, and sees the Moon spin once per orbit. With it, the thing being
   * orbited stays put on screen, the lit side of the body stays the same, and only the stars drift.
   * See `coRotationYawDelta`. Focusing the Sun (which orbits nothing) leaves the camera alone.
   */
  private coRotateCameraWithOrbit(): void {
    const spec = this.focusId ? VISUALS[this.focusId] : undefined;
    const body = this.focusId ? this.meshes.get(this.focusId) : undefined;
    const parent = spec?.orbit ? this.meshes.get(spec.orbit.parentId) : undefined;
    if (!body || !parent) {
      this.lockBearing = null;
      return;
    }
    const now = bearing(body.position, parent.position);
    if (this.lockBearing !== null) this.rig.yaw += coRotationYawDelta(this.lockBearing, now);
    this.lockBearing = now;
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
    const piloting = this.pilot.active;
    const bodiesBefore = piloting ? this.pilotBodies() : []; // where everything was, so a parked ship can go with it
    this.updatePositions();
    this.updateComets();
    // The whole belt turns together, the same way the planets go round (counter-clockwise from above).
    this.belt.rotation.y = (this.simDays / BELT_PERIOD_DAYS) * Math.PI * 2;
    if (piloting) {
      const outcome = this.pilot.step(dt, bodiesBefore, this.pilotBodies(), (body) =>
        focusDistance(body.radius),
      );
      if (outcome.arrivedId) {
        this.options.bus.emit('pilot:arrived', { id: outcome.arrivedId });
        this.emitPilotStatus(true);
      }
      this.cinematicClock = this.pilot.view === 'cinematic' ? this.cinematicClock + dt : 0;
      this.applyPilotCamera(dt);
      this.updateShipModel();
      this.pilotStatusClock += dt;
      if (this.pilotStatusClock >= 0.2) {
        this.pilotStatusClock = 0;
        this.emitPilotStatus();
      }
    } else {
      this.coRotateCameraWithOrbit();
      this.rig.update(dt, this.followedPosition());
      this.rig.applyTo(this.camera);
    }
    // The stars are infinitely far away: they travel with the camera, so flying never gets you any nearer to one.
    this.stars.position.copy(this.camera.position);
    this.updateSelectionRing();
    // Warp streaks: strong in the middle of a long flight, none otherwise (and never with Reduce motion).
    // While piloting, the streaks follow the ship's speed instead (a sense of speed in empty space).
    const progress = this.rig.flightProgress;
    let warpAmount = 0;
    if (this.quality.warp) {
      warpAmount = piloting
        ? cruiseWarp(this.pilot.ship.speed, this.pilot.reducedMotion)
        : progress !== null
          ? warpStrength(progress, this.warpTravel, this.rig.reducedMotion)
          : 0;
    }
    this.warp.update(warpAmount, now / 1000);
    // A read-only status for automated tests ("data-warp" on the canvas, 0.00 to 1.00). Counting coloured pixels
    // to check the streaks is unreliable between browsers, so tests read the strength itself.
    const warpLabel = warpAmount.toFixed(2);
    if (warpLabel !== this.warpLabel) {
      this.warpLabel = warpLabel;
      this.renderer.domElement.dataset.warp = warpLabel;
    }
    // With bloom on, draw through the glow pipeline; otherwise straight to the screen.
    if (this.bloomPipeline) this.bloomPipeline.render();
    else this.renderer.render(this.scene, this.camera);
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
    this.updateViewOffset(w, h);
    this.bloomPipeline?.setSize(w, h, this.renderer.getPixelRatio());
  }

  /**
   * On a portrait phone the steering controls cover the lower half of the screen, which is exactly where the chase
   * camera draws the ship. While piloting there, slide the whole picture up (a camera "view offset") so the ship
   * sits above the controls. Taps still land on the right objects, because picking uses the same camera.
   */
  private updateViewOffset(
    w = this.options.host.clientWidth,
    h = this.options.host.clientHeight,
  ): void {
    const lift = this.pilot.active && w <= 700 && h > w ? 0.3 : 0;
    if (lift > 0) this.camera.setViewOffset(w, h, 0, h * lift, w, h);
    else if (this.camera.view?.enabled) this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }
}
