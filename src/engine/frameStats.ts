// Counts how many frames were "slow" (spec target: fewer than 5% of frames over 50 ms).
// Shown in the on-screen readout so a real-phone test can read the number straight off the screen.
export const SLOW_FRAME_MS = 50;

export class FrameStats {
  private total = 0;
  private slow = 0;

  record(frameMs: number): void {
    this.total += 1;
    if (frameMs > SLOW_FRAME_MS) this.slow += 1;
  }

  /** Percentage (0 to 100) of frames so far that took longer than 50 ms. */
  get slowPercent(): number {
    return this.total === 0 ? 0 : (this.slow / this.total) * 100;
  }

  get frames(): number {
    return this.total;
  }

  reset(): void {
    this.total = 0;
    this.slow = 0;
  }
}
