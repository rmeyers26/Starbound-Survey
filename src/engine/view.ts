// The contract every renderer (WebGL 3D now, Canvas 2D fallback in step 7) must follow.
// The rest of the game talks to this interface and never needs to know which one is running.
import type { EventBus, GameEvents } from '../game/events';
import type { CelestialObject } from '../game/types';
import type { CameraState } from './cameraRig';

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

/** Player-adjustable control settings (Settings screen). */
export interface ControlSettings {
  rotateSensitivity: number;
  zoomSensitivity: number;
  reducedMotion: boolean;
}

/** Everything needed to rebuild a view after a graphics failure (spec: "restore camera and scene state"). */
export interface ViewState {
  selectedId: string | null;
  focusId: string | null;
  simDays: number;
  camera: CameraState;
}

export interface ViewOptions {
  /** Element the view puts its canvas into. */
  host: HTMLElement;
  objects: CelestialObject[];
  quality: ViewQuality;
  bus: EventBus<GameEvents>;
  /** Present when rebuilding after a failure. */
  initialState?: ViewState;
}

export interface View {
  readonly kind: ViewKind;
  start(): void;
  dispose(): void;
  setQuality(quality: ViewQuality): void;
  setControlSettings(settings: ControlSettings): void;
  getState(): ViewState;
}
