import { describe, expect, it } from 'vitest';
import {
  WARP_FULL_TRAVEL,
  WARP_MIN_TRAVEL,
  bloomPlan,
  bloomSettings,
  readEffectsOverride,
  sunBrightness,
  warpStreakCount,
  warpStrength,
  withoutEffects,
} from '../../src/engine/effects';
import { LADDER, PROFILES, PROFILE_NAMES, toViewQuality } from '../../src/engine/profiles';

describe('effects per graphics profile (spec: High full bloom, Balanced reduced, Performance none)', () => {
  it('High has full bloom, Balanced reduced bloom, Performance no post-processing', () => {
    expect(PROFILES.high.bloom).toBe('full');
    expect(PROFILES.balanced.bloom).toBe('reduced');
    expect(PROFILES.performance.bloom).toBe('off');
  });

  it('a weaker profile never has MORE effects than a stronger one', () => {
    const rank = { off: 0, reduced: 1, full: 2 } as const;
    for (let i = 1; i < PROFILE_NAMES.length; i++) {
      const stronger = PROFILES[PROFILE_NAMES[i - 1]];
      const weaker = PROFILES[PROFILE_NAMES[i]];
      expect(rank[weaker.bloom]).toBeLessThanOrEqual(rank[stronger.bloom]);
      expect(Number(weaker.atmosphere)).toBeLessThanOrEqual(Number(stronger.atmosphere));
      expect(Number(weaker.warp)).toBeLessThanOrEqual(Number(stronger.warp));
    }
  });

  it('the view receives the effect settings of the level it is told to use', () => {
    for (const level of LADDER) {
      const q = toViewQuality(level);
      expect(q.bloom).toBe(PROFILES[level.profile].bloom);
      expect(q.atmosphere).toBe(PROFILES[level.profile].atmosphere);
      expect(q.warp).toBe(PROFILES[level.profile].warp);
    }
  });
});

describe('bloomSettings', () => {
  it('reduced bloom is dimmer and works at half size (about 4 times cheaper)', () => {
    const full = bloomSettings('full');
    const reduced = bloomSettings('reduced');
    expect(reduced.strength).toBeLessThan(full.strength);
    expect(full.resolutionScale).toBe(1);
    expect(reduced.resolutionScale).toBe(0.5);
  });

  it('the boosted Sun clears the glow threshold, an ordinary white surface does not', () => {
    const { threshold } = bloomSettings('full');
    const sunLuminance = 0.6 * sunBrightness('full'); // the Sun's colour is about 60% bright once boosted
    expect(sunLuminance).toBeGreaterThan(threshold);
    expect(1 * 1.0).toBeLessThan(threshold); // plain white, unboosted
  });

  it('with bloom off the Sun is not boosted (it would wash out to white)', () => {
    expect(sunBrightness('off')).toBe(1);
    expect(sunBrightness('reduced')).toBeGreaterThan(1);
  });
});

describe('warpStrength', () => {
  const far = WARP_FULL_TRAVEL + 50;

  it('is zero at takeoff and on arrival, and peaks in the middle', () => {
    expect(warpStrength(0, far, false)).toBe(0);
    expect(warpStrength(1, far, false)).toBe(0);
    expect(warpStrength(0.5, far, false)).toBeCloseTo(1, 6);
    expect(warpStrength(0.25, far, false)).toBeLessThan(warpStrength(0.5, far, false));
    expect(warpStrength(0.75, far, false)).toBeCloseTo(warpStrength(0.25, far, false), 6); // symmetric
  });

  it('short hops get no warp, and longer flights get more', () => {
    expect(warpStrength(0.5, WARP_MIN_TRAVEL - 1, false)).toBe(0);
    expect(warpStrength(0.5, 0, false)).toBe(0);
    const medium = warpStrength(0.5, (WARP_MIN_TRAVEL + WARP_FULL_TRAVEL) / 2, false);
    expect(medium).toBeGreaterThan(0);
    expect(medium).toBeLessThan(warpStrength(0.5, far, false));
  });

  it('is exactly zero with Reduce motion, whatever the flight', () => {
    for (const progress of [0.1, 0.5, 0.9]) expect(warpStrength(progress, far, true)).toBe(0);
  });

  it('always stays between 0 and 1, even for silly inputs', () => {
    for (const progress of [-1, 0.3, 2, NaN]) {
      for (const travel of [-50, 0, 80, 1e9, NaN]) {
        const value = warpStrength(progress, travel, false);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
        expect(Number.isNaN(value)).toBe(false);
      }
    }
  });

  it('draws no streaks when the profile turns warp off', () => {
    expect(warpStreakCount(false)).toBe(0);
    expect(warpStreakCount(true)).toBeGreaterThan(0);
  });
});

describe('bloomPlan (can this device do bloom?)', () => {
  it('skips bloom completely on a graphics card that cannot draw into a floating-point picture', () => {
    expect(bloomPlan('full', { canRenderToFloat: false, maxSamples: 8 })).toBeNull();
    expect(bloomPlan('reduced', { canRenderToFloat: false, maxSamples: 8 })).toBeNull();
  });

  it('uses the full settings when the card is capable', () => {
    const plan = bloomPlan('full', { canRenderToFloat: true, maxSamples: 8 })!;
    expect(plan.level).toBe('full');
    expect(plan.strength).toBe(bloomSettings('full').strength);
    expect(plan.msaaSamples).toBe(4);
  });

  it('never asks for more edge-smoothing than the card supports', () => {
    expect(bloomPlan('full', { canRenderToFloat: true, maxSamples: 2 })!.msaaSamples).toBe(2);
    expect(bloomPlan('full', { canRenderToFloat: true, maxSamples: 0 })!.msaaSamples).toBe(0);
  });
});

describe('the ?effects=off testing override', () => {
  it('only the exact word "off" turns effects off', () => {
    expect(readEffectsOverride('?effects=off')).toBe('off');
    expect(readEffectsOverride('?scanSeconds=0.3&effects=off')).toBe('off');
    expect(readEffectsOverride('')).toBeNull();
    expect(readEffectsOverride('?effects=on')).toBeNull();
    expect(readEffectsOverride('?effects=OFF')).toBeNull();
    expect(readEffectsOverride('?effects=')).toBeNull();
  });

  it('switches every effect off and changes nothing else', () => {
    const quality = { ...toViewQuality(LADDER[0]) };
    const stripped = withoutEffects(quality);
    expect(stripped.bloom).toBe('off');
    expect(stripped.atmosphere).toBe(false);
    expect(stripped.warp).toBe(false);
    expect(stripped.starCount).toBe(quality.starCount);
    expect(stripped.pixelRatioCap).toBe(quality.pixelRatioCap);
    expect(stripped.textureSize).toBe(quality.textureSize);
    expect(quality.bloom).toBe('full'); // the original is not modified
  });
});
