// The last-resort renderer: a flat, top-down "star chart" drawn with the Canvas 2D API.
// Used when WebGL2 is unavailable or keeps failing (spec: "Missions and data still work").
// It listens to the same events as the 3D view, so selection, the info panel and the buttons work.
import type { GameEvents } from '../game/events';
import { clamp } from '../engine/easing';
import { attachInput } from '../engine/inputController';
import { log } from '../engine/log';
import { mulberry32 } from '../engine/random';
import { SIM_DAYS_PER_SECOND, VISUALS, focusDistance, reachFromSun } from '../engine/scale';
import { BELT_PERIOD_DAYS, MAX_BELT_ROCKS, beltRockCount, generateBelt } from '../engine/belt';
import { visibleBodyIds } from '../game/regions';
import { computePositions, type BodyPosition } from '../engine/solarSystem';
import type { ControlSettings, View, ViewOptions, ViewQuality, ViewState } from '../engine/view';

const STAR_COUNT_MAX = 4000;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 40;
const MIN_HIT_PX = 22; // finger-sized tap target (about 44 px across)

/** Pixels per scene unit at zoom 1, chosen so the outermost VISIBLE orbit fits on screen. */
function baseScale(width: number, height: number, reach: number): number {
  // 60 px of margin keeps the outermost ring clear of the button row.
  return (Math.min(width, height) / 2 - 60) / (reach + 2);
}

export class Canvas2DView implements View {
  readonly kind = 'canvas2d' as const;

  private readonly options: ViewOptions;
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly stars: Float32Array; // pairs of 0..1 coordinates
  private readonly cleanups: Array<() => void> = [];
  private readonly resizeObserver: ResizeObserver;

  private quality: ViewQuality;
  private controls: ControlSettings = {
    rotateSensitivity: 1,
    zoomSensitivity: 1,
    reducedMotion: false,
  };
  private positions = new Map<string, BodyPosition>();
  /** Bodies the player may see (their region is unlocked), and how far out they reach. */
  private visibleIds: Set<string>;
  private readonly belt = generateBelt(MAX_BELT_ROCKS);
  private reach: number;
  private simDays = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;

  private selectedId: string | null = null;
  private focusId: string | null = null;
  private zoom = 1;
  private zoomTarget = 1;
  private center = { x: 0, z: 0 };
  private pan = { x: 0, z: 0 }; // dragging the chart moves this offset (in scene units)

  constructor(options: ViewOptions) {
    this.options = options;
    this.quality = options.quality;
    this.visibleIds = visibleBodyIds(options.objects, options.unlockedRegions);
    this.reach = reachFromSun(this.visibleIds);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;

    this.canvas.className = 'game-canvas';
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'application');
    this.canvas.setAttribute(
      'aria-label',
      'Simplified 2D star chart of the Solar System. Arrow keys move the chart, plus and minus zoom, Enter focuses the selected object, Escape returns to the overview.',
    );
    options.host.append(this.canvas);

    const random = mulberry32(1948);
    this.stars = new Float32Array(STAR_COUNT_MAX * 2).map(() => random());

    if (options.initialState) {
      this.simDays = options.initialState.simDays;
      this.selectedId = options.initialState.selectedId;
      this.focusId = options.initialState.focusId;
      this.snapToFocus();
    }

    this.connectInput();
    this.connectBus();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(options.host);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.resize();
  }

  start(): void {
    this.running = true;
    this.resume();
    log('Canvas 2D view started');
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.cleanups.forEach((fn) => fn());
    this.canvas.remove();
  }

  setQuality(quality: ViewQuality): void {
    this.quality = quality;
    this.resize();
  }

  setControlSettings(settings: ControlSettings): void {
    this.controls = settings;
  }

  getState(): ViewState {
    // This view has no 3D camera, so it reports a neutral one.
    return {
      selectedId: this.selectedId,
      focusId: this.focusId,
      simDays: this.simDays,
      camera: { yaw: 0, pitch: 0.4, distance: 150 },
    };
  }

  /**
   * The 2D chart has no camera, so "distance" is an approximation that matches the 3D view: an object
   * you have flown to (and not zoomed out from) is at its focus distance; zooming out scales it up;
   * anything not focused is out of reach (null).
   */
  distanceTo(id: string): number | null {
    const spec = VISUALS[id];
    if (!spec || this.focusId !== id) return null;
    const settled = Math.abs(Math.log(this.zoom) - Math.log(this.zoomTarget)) < 0.1;
    if (!settled) return null;
    const { width, height } = this.cssSize();
    const focusZoom = clamp(20 / (spec.radius * baseScale(width, height, this.reach)), 1, MAX_ZOOM);
    return focusDistance(spec.radius) * (focusZoom / this.zoomTarget);
  }

  // ---- input and events ---------------------------------------------------------------

  private connectInput(): void {
    const { bus } = this.options;
    this.cleanups.push(
      attachInput(this.canvas, {
        onDrag: (dx, dy) => this.panBy(dx, dy),
        onPinch: (ratio) => this.zoomIn(ratio),
        onTap: (x, y) => bus.emit('object:selected', { id: this.objectAt(x, y) }),
        onDoubleTap: (x, y) => {
          const id = this.objectAt(x, y);
          if (!id) return;
          bus.emit('object:selected', { id });
          bus.emit('camera:focus', { id });
        },
        onWheelZoom: (factor) => this.zoomIn(1 / factor),
        onKeyZoom: (factor) => this.zoomIn(1 / factor),
        onKeyRotate: (dx, dy) => this.panBy(-dx, -dy),
        onFocusKey: () => {
          if (this.selectedId) bus.emit('camera:focus', { id: this.selectedId });
        },
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
    on('camera:zoom', ({ factor }) => this.zoomIn(1 / factor));
  }

  /** ratio > 1 zooms in. Sensitivity strengthens or weakens the effect. */
  private zoomIn(ratio: number): void {
    const adjusted = Math.pow(ratio, this.controls.zoomSensitivity);
    this.zoomTarget = clamp(this.zoomTarget * adjusted, MIN_ZOOM, MAX_ZOOM);
  }

  private panBy(dxPixels: number, dyPixels: number): void {
    const scale = this.scale();
    const k = this.controls.rotateSensitivity / scale;
    this.pan.x -= dxPixels * k;
    this.pan.z -= dyPixels * k;
  }

  setUnlockedRegions(regions: string[]): void {
    this.visibleIds = visibleBodyIds(this.options.objects, regions);
    this.reach = reachFromSun(this.visibleIds);
    this.positions = this.visiblePositions();
  }

  /** Where every VISIBLE body is right now (locked bodies are left out, so they are never drawn or tapped). */
  private visiblePositions(): Map<string, BodyPosition> {
    const all = computePositions(this.options.objects, this.simDays);
    return new Map([...all].filter(([id]) => this.visibleIds.has(id)));
  }

  private focusOn(id: string | null): void {
    if (id !== null && !VISUALS[id]) return;
    this.focusId = id;
    this.pan = { x: 0, z: 0 };
    const w = this.cssSize().width;
    const h = this.cssSize().height;
    // Pick a zoom that makes the focused body roughly 40 px across (radius 20 px).
    this.zoomTarget = id
      ? clamp(20 / (VISUALS[id].radius * baseScale(w, h, this.reach)), 1, MAX_ZOOM)
      : 1;
    if (this.controls.reducedMotion) this.snapToFocus();
  }

  private snapToFocus(): void {
    this.positions = this.visiblePositions();
    const target = this.focusId ? this.positions.get(this.focusId) : undefined;
    this.center = { x: target?.x ?? 0, z: target?.z ?? 0 };
    this.zoom = this.zoomTarget;
  }

  /** Which body is at this pixel? Uses a hit area never smaller than a finger. */
  private objectAt(px: number, py: number): string | null {
    const { width, height } = this.cssSize();
    const s = this.scale();
    let best: { id: string; score: number } | null = null;
    for (const [id, p] of this.positions) {
      const sx = width / 2 + (p.x - this.center.x - this.pan.x) * s;
      const sy = height / 2 + (p.z - this.center.z - this.pan.z) * s;
      const hit = Math.max(VISUALS[id].radius * s, MIN_HIT_PX);
      const miss = Math.hypot(px - sx, py - sy);
      if (miss > hit) continue;
      const score = miss / hit;
      if (!best || score < best.score) best = { id, score };
    }
    return best?.id ?? null;
  }

  // ---- drawing --------------------------------------------------------------------------

  private cssSize(): { width: number; height: number } {
    return { width: this.options.host.clientWidth, height: this.options.host.clientHeight };
  }

  private scale(): number {
    const { width, height } = this.cssSize();
    return baseScale(width, height, this.reach) * this.zoom;
  }

  private resize(): void {
    const { width, height } = this.cssSize();
    if (width === 0 || height === 0) return;
    const ratio =
      Math.min(window.devicePixelRatio || 1, this.quality.pixelRatioCap) *
      this.quality.resolutionScale;
    this.canvas.width = Math.max(1, Math.round(width * ratio));
    this.canvas.height = Math.max(1, Math.round(height * ratio));
    // From now on we draw in CSS pixels; the transform scales up to real pixels.
    this.ctx.setTransform(this.canvas.width / width, 0, 0, this.canvas.height / height, 0, 0);
  }

  private readonly frame = (): void => {
    if (!this.running) return;
    const now = performance.now();
    const frameMs = now - this.lastTime;
    this.lastTime = now;
    this.options.onFrame?.(frameMs);
    const dt = Math.min(frameMs / 1000, 0.1);

    this.simDays += dt * SIM_DAYS_PER_SECOND;
    this.positions = this.visiblePositions();
    this.glideCamera(dt);
    this.draw();
    this.rafId = requestAnimationFrame(this.frame);
  };

  /** Eases the chart toward its focus target (instant with Reduce motion). */
  private glideCamera(dt: number): void {
    const focus = this.focusId ? this.positions.get(this.focusId) : undefined;
    const goal = { x: focus?.x ?? 0, z: focus?.z ?? 0 };
    const t = this.controls.reducedMotion ? 1 : 1 - Math.exp(-6 * dt);
    this.center.x += (goal.x - this.center.x) * t;
    this.center.z += (goal.z - this.center.z) * t;
    // Log-space blend so zooming feels even at every scale.
    this.zoom = Math.exp(
      Math.log(this.zoom) + (Math.log(this.zoomTarget) - Math.log(this.zoom)) * t,
    );
  }

  private draw(): void {
    const { width, height } = this.cssSize();
    if (width === 0 || height === 0) return;
    const ctx = this.ctx;
    const s = this.scale();
    const toScreen = (p: BodyPosition): [number, number] => [
      width / 2 + (p.x - this.center.x - this.pan.x) * s,
      height / 2 + (p.z - this.center.z - this.pan.z) * s,
    ];

    ctx.fillStyle = '#02030a';
    ctx.fillRect(0, 0, width, height);

    // Stars: one tiny square each. `starCount` shrinks on weaker profiles.
    ctx.fillStyle = '#ffffff';
    // The 3D view spreads stars over a whole sphere, but here they all land on a small flat screen,
    // so only a fraction is drawn to get a similar density.
    const count = Math.round(Math.min(this.quality.starCount, STAR_COUNT_MAX) / 8);
    for (let i = 0; i < count; i++) {
      ctx.fillRect(this.stars[i * 2] * width, this.stars[i * 2 + 1] * height, 1.5, 1.5);
    }

    // The asteroid belt: faint dots turning slowly with the rest of the system (only when the inner region is shown).
    const sun = this.positions.get('sun');
    if (this.positions.has('ceres') && sun) {
      const turn = (this.simDays / BELT_PERIOD_DAYS) * Math.PI * 2;
      const [bx, by] = toScreen(sun);
      ctx.fillStyle = 'rgba(170, 163, 150, 0.85)';
      const dots = Math.round(beltRockCount(this.quality.starCount) / 3);
      for (let i = 0; i < dots; i++) {
        const rock = this.belt[i];
        const angle = rock.angle + turn;
        ctx.fillRect(
          bx + Math.cos(angle) * rock.radius * s,
          by - Math.sin(angle) * rock.radius * s, // up on screen is -z, and planets travel x to -z
          2,
          2,
        );
      }
    }

    // Orbit rings: one circle per body, centred on the body it circles (planets: the Sun; the Moon: Earth).
    ctx.strokeStyle = '#3a4a78';
    ctx.lineWidth = 1;
    for (const [id, spec] of Object.entries(VISUALS)) {
      const parent = spec.orbit ? this.positions.get(spec.orbit.parentId) : undefined;
      if (!spec.orbit || !parent || !this.positions.has(id)) continue; // no ring for a locked body
      const [cx, cy] = toScreen(parent);
      ctx.beginPath();
      ctx.arc(cx, cy, spec.orbit.radius * s, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Bodies, labels and the selection ring.
    ctx.font = '13px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (const [id, p] of this.positions) {
      const fade = p.fade ?? 1; // a replayed comet fades in and out so its jump back to the start is not seen
      if (fade < 0.02) continue;
      ctx.globalAlpha = fade;
      const [x, y] = toScreen(p);
      const radius = Math.max(VISUALS[id].radius * s, id === 'sun' ? 7 : 3.5);
      ctx.fillStyle = `#${VISUALS[id].color.toString(16).padStart(6, '0')}`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#b8c4e8';
      const name = this.options.objects.find((o) => o.id === id)?.name ?? id;
      ctx.fillText(name, x + radius + 6, y);

      if (id === this.selectedId) {
        ctx.strokeStyle = '#7fd4ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(radius + 6, 14), 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }
    ctx.globalAlpha = 1;
  }

  private resume(): void {
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  private readonly onVisibilityChange = (): void => {
    if (!this.running) return;
    if (document.hidden) cancelAnimationFrame(this.rafId);
    else this.resume();
  };
}
