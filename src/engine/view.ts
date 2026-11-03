// The contract every renderer (WebGL 3D now, Canvas 2D fallback in step 7) must follow.
// The rest of the game talks to this interface and never needs to know which one is running.
import type { EventBus, GameEvents } from '../game/events';
import type { CelestialObject } from '../game/types';
import type { CameraState } from './cameraRig';
import type { BloomLevel } from './effects';

export type ViewKind = 'webgl2' | 'canvas2d';

/** Settings the quality manager (step 6) changes while the game runs. */
export interface ViewQuality {
  /** Highest device-pixel-ratio to render at. Phones report 3, which is wasteful. */
  pixelRatioCap: number;
  /** 1 = full resolution; 0.7 = render at 70% and let the browser scale up. */
  resolutionScale: number;
  /** How many background stars to draw. */
  starCount: number;
  /** Width in pixels of the surface images to load (smaller on weaker devices to save memory). */
  textureSize: 1024 | 2048;
  /** Glow around the Sun and other very bright things ('off' skips the post-processing code entirely). */
  bloom: BloomLevel;
  /** Thin glowing haze around planets that have an atmosphere. */
  atmosphere: boolean;
  /** Streaks shown while flying a long way. */
  warp: boolean;
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
  /** Called every frame with the real time since the last frame, in milliseconds. */
  onFrame?: (frameMs: number) => void;
  /** Called when the GPU is lost mid-session, so the ViewHost can rebuild or fall back. */
  onContextLost?: () => void;
  /** Present when rebuilding after a failure. */
  initialState?: ViewState;
  /** Regions the player has unlocked right now; bodies elsewhere are neither drawn nor pickable. */
  unlockedRegions: string[];
}

export interface View {
  readonly kind: ViewKind;
  start(): void;
  dispose(): void;
  setQuality(quality: ViewQuality): void;
  setControlSettings(settings: ControlSettings): void;
  /** The player unlocked (or lost) regions: show or hide bodies and re-frame the overview. */
  setUnlockedRegions(regions: string[]): void;
  getState(): ViewState;
  /**
   * Distance from the ship (camera) to an object in scene units, or null when it cannot be known.
   * The scanner uses this for its range check.
   */
  distanceTo(id: string): number | null;
}
