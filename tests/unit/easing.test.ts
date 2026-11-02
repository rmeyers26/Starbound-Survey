import { describe, it, expect } from 'vitest';
import { clamp, easeInOutCubic, lerp } from '../../src/engine/easing';

describe('easing', () => {
  it('clamp limits values', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
  it('lerp blends linearly', () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
  });
  it('easeInOutCubic starts at 0, ends at 1, is 0.5 in the middle', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
  });
  it('starts slowly: a quarter of the time covers less than a quarter of the distance', () => {
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
  });
  it('never leaves 0..1 even for out-of-range input', () => {
    expect(easeInOutCubic(-3)).toBe(0);
    expect(easeInOutCubic(9)).toBe(1);
  });
});
