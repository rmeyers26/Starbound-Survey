import { describe, it, expect } from 'vitest';
import { FrameStats } from '../../src/engine/frameStats';

describe('FrameStats', () => {
  it('starts at 0%', () => {
    expect(new FrameStats().slowPercent).toBe(0);
  });
  it('counts only frames over 50 ms (exactly 50 is fine)', () => {
    const s = new FrameStats();
    [16, 16, 50, 51, 120].forEach((ms) => s.record(ms));
    expect(s.frames).toBe(5);
    expect(s.slowPercent).toBeCloseTo(40); // 2 of 5
  });
  it('can be reset', () => {
    const s = new FrameStats();
    s.record(200);
    s.reset();
    expect(s.slowPercent).toBe(0);
    expect(s.frames).toBe(0);
  });
});
