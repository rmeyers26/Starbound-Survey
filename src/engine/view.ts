// The contract every renderer (WebGL 3D now, Canvas 2D fallback in step 7) must follow.
// The rest of the game talks to this interface and never needs to know which one is running.
import type { CelestialObject } from '../game/types';

export type ViewKind = 'webgl2' | 'canvas2d';

/** Settings the quality manager (step 6) changes while the game runs. */
export interface ViewQuality {
  /** Highest device-pixel-ratio to render at. Phones report 3, which is wasteful. */
  pixelRatioCap: number;
  /** 1 = full resolution; 0.7 = render at 70% and let the browser scale up. */
  resolutionScale: number;
  /** How many background stars to draw. */
  starCount: number;
}

export interface ViewOptions {
  /** Element the view puts its canvas into. */
  host: HTMLElement;
  objects: CelestialObject[];
  quality: ViewQuality;
}

export interface View {
  readonly kind: ViewKind;
  start(): void;
  dispose(): void;
  setQuality(quality: ViewQuality): void;
}
