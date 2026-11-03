// The words and numbers the spacecraft controls show.
import { describe, expect, it } from 'vitest';
import { MAX_SPEED } from '../../src/engine/flight';
import { describeSpeed, describeTarget, speedFraction } from '../../src/ui/pilotPanel';

describe('describeSpeed', () => {
  it('shows speed with one decimal and the throttle as a percentage', () => {
    expect(describeSpeed({ speed: 12.34, throttle: 0.27 })).toBe('Speed 12.3 u/s (27%)');
    expect(describeSpeed({ speed: 45, throttle: 1 })).toBe('Speed 45.0 u/s (100%)');
  });

  it('says zero when the ship is effectively still (no "-0.0" flicker)', () => {
    expect(describeSpeed({ speed: 0.01, throttle: 0 })).toBe('Speed 0.0 u/s (0%)');
    expect(describeSpeed({ speed: -0.04, throttle: 0 })).toBe('Speed 0.0 u/s (0%)');
  });

  it('says "reverse" when backing up', () => {
    expect(describeSpeed({ speed: -3.2, throttle: -0.3 })).toBe('Speed -3.2 u/s (30% reverse)');
  });
});

describe('describeTarget', () => {
  it('names the selected object and how far away it is', () => {
    expect(describeTarget({ targetDistance: 34.12, inScanRange: false }, 'Mars')).toBe(
      'Mars: 34.1 u away',
    );
  });

  it('says when it is close enough to scan', () => {
    expect(describeTarget({ targetDistance: 6, inScanRange: true }, 'Mars')).toBe(
      'Mars: 6.0 u away, in scan range',
    );
  });

  it('says nothing when nothing is selected', () => {
    expect(describeTarget({ targetDistance: null, inScanRange: false }, null)).toBeNull();
    expect(describeTarget({ targetDistance: 5, inScanRange: true }, null)).toBeNull();
  });
});

describe('speedFraction (how full the speed bar is)', () => {
  it('runs from empty to full, in either direction, and never leaves 0 to 1', () => {
    expect(speedFraction(0)).toBe(0);
    expect(speedFraction(MAX_SPEED / 2)).toBeCloseTo(0.5);
    expect(speedFraction(MAX_SPEED)).toBe(1);
    expect(speedFraction(MAX_SPEED * 3)).toBe(1);
    expect(speedFraction(-MAX_SPEED / 4)).toBeCloseTo(0.25);
  });

  it('is empty for nonsense instead of NaN', () => {
    expect(speedFraction(Number.NaN)).toBe(0);
    expect(speedFraction(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
