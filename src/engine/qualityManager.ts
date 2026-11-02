// Watches the frame rate and moves up/down the quality ladder (spec: "Adaptive step-down rule").
// Pure logic: it is fed frame times and never touches the DOM or timers, so it is fully unit tested.
import { LADDER, PROFILES, type Level } from './profiles';

export interface QualityOptions {
  /** Seconds the frame rate must stay under target before stepping down. Spec: 3. */
  downSeconds?: number;
  /** Seconds it must stay healthy before stepping back up. Longer than down, to avoid flicker. */
  upSeconds?: number;
  /** Length of one measuring window in milliseconds. */
  windowMs?: number;
}

export interface WindowResult {
  /** Average frames per second over the window that just ended. */
  fps: number;
  /** The new level if this window caused a change, otherwise null. */
  changedTo: Level | null;
}

const FLICKER_WINDOW_S = 30; // a step-down this soon after a step-up counts as "flicker"
const MAX_BACKOFF = 8;

export class QualityManager {
  private index: number;
  private ceiling: number; // the best level we may climb back to
  private adaptive = true;

  private readonly downSeconds: number;
  private readonly upSeconds: number;
  private readonly windowMs: number;

  private windowFrames = 0;
  private windowTime = 0;
  private belowSeconds = 0;
  private healthySeconds = 0;
  private clock = 0; // total seconds measured so far
  private lastStepUpAt = -Infinity;
  private backoff = 1; // multiplies upSeconds after flicker

  constructor(startIndex: number, options: QualityOptions = {}) {
    this.index = this.ceiling = startIndex;
    this.downSeconds = options.downSeconds ?? 3;
    this.upSeconds = options.upSeconds ?? 10;
    this.windowMs = options.windowMs ?? 1000;
  }

  get level(): Level {
    return LADDER[this.index];
  }

  get levelIndex(): number {
    return this.index;
  }

  /** Automatic mode: start at `index` and never climb above it. */
  setAuto(index: number): void {
    this.index = this.ceiling = index;
    this.adaptive = true;
    this.resetCounters();
    this.backoff = 1;
  }

  /** Manual mode (player chose a profile): stay exactly at `index`. */
  setManual(index: number): void {
    this.index = this.ceiling = index;
    this.adaptive = false;
    this.resetCounters();
  }

  /** Feed one frame's duration. Returns a result only when a measuring window ends. */
  recordFrame(frameMs: number): WindowResult | null {
    this.windowFrames += 1;
    this.windowTime += frameMs;
    if (this.windowTime < this.windowMs) return null;

    const seconds = this.windowTime / 1000;
    const fps = this.windowFrames / seconds;
    this.windowFrames = 0;
    this.windowTime = 0;
    this.clock += seconds;

    const changedTo = this.adaptive ? this.evaluate(fps, seconds) : null;
    return { fps, changedTo };
  }

  private evaluate(fps: number, seconds: number): Level | null {
    const target = PROFILES[this.level.profile].stepDownBelowFps;

    if (fps < target) {
      this.belowSeconds += seconds;
      this.healthySeconds = 0;
      if (this.belowSeconds >= this.downSeconds && this.index < LADDER.length - 1) {
        // Stepping down soon after stepping up means we are oscillating: wait longer next time.
        this.backoff =
          this.clock - this.lastStepUpAt < FLICKER_WINDOW_S
            ? Math.min(this.backoff * 2, MAX_BACKOFF)
            : 1;
        this.index += 1;
        this.resetCounters();
        return this.level;
      }
      return null;
    }

    this.belowSeconds = 0;
    this.healthySeconds += seconds;
    if (this.index > this.ceiling && this.healthySeconds >= this.upSeconds * this.backoff) {
      this.index -= 1;
      this.lastStepUpAt = this.clock;
      this.resetCounters();
      return this.level;
    }
    return null;
  }

  private resetCounters(): void {
    this.belowSeconds = 0;
    this.healthySeconds = 0;
  }
}
