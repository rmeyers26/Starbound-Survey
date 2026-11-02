// Owns the current renderer and implements the same View interface, so the rest of the game never
// has to know which renderer is running (or that it changed).
//
// Fallback chain (spec: "Renderer startup sequence"):
//   WebGL2 -> (fails) -> Canvas 2D
//   GPU lost mid-session -> rebuild WebGL once with the camera/scene state restored;
//   a second loss -> fall back to Canvas 2D.
// (WebGPU is deliberately not implemented in the prototype; see the plan.)
import { Canvas2DView } from '../fallback/canvasView';
import type { EventBus, GameEvents } from '../game/events';
import type { CelestialObject } from '../game/types';
import { log } from './log';
import type { ControlSettings, View, ViewKind, ViewOptions, ViewQuality, ViewState } from './view';
import { WebGLView } from './webglView';

/** Why a renderer was (re)built. */
export type RendererReason = 'initial' | 'forced' | 'fallback' | 'recovered';

export interface ViewFactories {
  createWebGL(options: ViewOptions): View;
  createCanvas(options: ViewOptions): View;
}

export const defaultFactories: ViewFactories = {
  createWebGL: (options) => new WebGLView(options),
  createCanvas: (options) => new Canvas2DView(options),
};

export interface ViewHostOptions {
  host: HTMLElement;
  objects: CelestialObject[];
  bus: EventBus<GameEvents>;
  /** Called whenever a (re)built view needs the latest quality. */
  getQuality: () => ViewQuality;
  onFrame?: (frameMs: number) => void;
  onRendererChanged?: (kind: ViewKind, reason: RendererReason) => void;
  /** True when the URL says `?renderer=canvas2d` (a testing override). */
  forceCanvas?: boolean;
  factories?: ViewFactories;
}

/** Reads the `?renderer=` testing override from a URL query string. */
export function readRendererOverride(search: string): ViewKind | null {
  const value = new URLSearchParams(search).get('renderer');
  return value === 'canvas2d' || value === 'webgl2' ? value : null;
}

export class ViewHost implements View {
  private current: View;
  private lostCount = 0;
  private disposed = false;
  private started = false;
  private lastControls: ControlSettings | null = null;
  private readonly options: ViewHostOptions;
  private readonly factories: ViewFactories;

  constructor(options: ViewHostOptions) {
    this.options = options;
    this.factories = options.factories ?? defaultFactories;
    this.current = this.build(
      undefined,
      !options.forceCanvas,
      options.forceCanvas ? 'forced' : 'initial',
    );
  }

  get kind(): ViewKind {
    return this.current.kind;
  }

  start(): void {
    this.started = true;
    this.current.start();
  }

  dispose(): void {
    this.disposed = true;
    this.current.dispose();
  }

  setQuality(quality: ViewQuality): void {
    this.current.setQuality(quality);
  }

  setControlSettings(settings: ControlSettings): void {
    this.lastControls = settings; // remembered so a rebuilt view gets the same settings
    this.current.setControlSettings(settings);
  }

  getState(): ViewState {
    return this.current.getState();
  }

  distanceTo(id: string): number | null {
    return this.current.distanceTo(id);
  }

  /** Builds a view; if WebGL was wanted but throws, falls back to Canvas 2D. */
  private build(state: ViewState | undefined, tryWebGL: boolean, reason: RendererReason): View {
    const viewOptions: ViewOptions = {
      host: this.options.host,
      objects: this.options.objects,
      bus: this.options.bus,
      quality: this.options.getQuality(),
      onFrame: this.options.onFrame,
      onContextLost: () => this.handleContextLost(),
      initialState: state,
    };

    if (tryWebGL) {
      try {
        const view = this.factories.createWebGL(viewOptions);
        this.options.onRendererChanged?.(view.kind, reason);
        return view;
      } catch (error) {
        log('WebGL2 unavailable, using Canvas 2D', error);
        reason = 'fallback';
      }
    }
    const view = this.factories.createCanvas(viewOptions);
    this.options.onRendererChanged?.(view.kind, reason);
    return view;
  }

  /** The GPU was lost: rebuild once, and on a repeat fall back one level (spec). */
  private handleContextLost(): void {
    if (this.disposed) return;
    const state = this.current.getState();
    this.current.dispose();
    this.lostCount += 1;
    const retryWebGL = this.lostCount <= 1;
    this.current = this.build(state, retryWebGL, retryWebGL ? 'recovered' : 'fallback');
    if (this.lastControls) this.current.setControlSettings(this.lastControls);
    if (this.started) this.current.start();
  }
}
