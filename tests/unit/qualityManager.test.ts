import { describe, it, expect } from 'vitest';
import { LADDER, ladderIndexFor, defaultProfileFor } from '../../src/engine/profiles';
import { QualityManager } from '../../src/engine/qualityManager';

/**
 * Feed `seconds` of frames at a steady `fps`; returns every level change that happened.
 * Tests use frame rates whose frame time is an exact number of milliseconds (25 fps = 40 ms,
 * 100 fps = 10 ms), because sums like 60 x 16.666... ms drift by a hair in floating point.
 */
function feed(manager: QualityManager, fps: number, seconds: number) {
  const changes: string[] = [];
  const frameMs = 1000 / fps;
  for (let i = 0; i < fps * seconds; i++) {
    const result = manager.recordFrame(frameMs);
    if (result?.changedTo)
      changes.push(`${result.changedTo.profile}@${result.changedTo.resolutionScale}`);
  }
  return changes;
}

const HIGH = ladderIndexFor('high');
const BALANCED = ladderIndexFor('balanced');

describe('ladder', () => {
  it('lists resolution steps before the next profile, best quality first', () => {
    expect(LADDER[0]).toEqual({ profile: 'high', resolutionScale: 1 });
    expect(LADDER[1]).toEqual({ profile: 'high', resolutionScale: 0.85 });
    expect(LADDER[2]).toEqual({ profile: 'high', resolutionScale: 0.7 });
    expect(LADDER[3]).toEqual({ profile: 'balanced', resolutionScale: 1 });
  });
});

describe('device defaults', () => {
  it('phones start on balanced, desktops on high, very low memory on performance', () => {
    expect(defaultProfileFor({ coarsePointer: true })).toBe('balanced');
    expect(defaultProfileFor({ coarsePointer: false })).toBe('high');
    expect(defaultProfileFor({ coarsePointer: true, deviceMemoryGb: 2 })).toBe('performance');
  });
});

describe('QualityManager step down', () => {
  it('does nothing while the frame rate is healthy', () => {
    const m = new QualityManager(HIGH);
    expect(feed(m, 100, 30)).toEqual([]);
  });
  it('steps down only after 3 seconds below target', () => {
    const m = new QualityManager(HIGH);
    expect(feed(m, 25, 2)).toEqual([]);
    expect(feed(m, 25, 1)).toEqual(['high@0.85']);
  });
  it('a healthy second resets the countdown', () => {
    const m = new QualityManager(HIGH);
    feed(m, 25, 2);
    feed(m, 100, 1);
    expect(feed(m, 25, 2)).toEqual([]);
  });
  it('lowers resolution first, then moves to the next profile', () => {
    const m = new QualityManager(HIGH);
    expect(feed(m, 20, 12)).toEqual(['high@0.85', 'high@0.7', 'balanced@1', 'balanced@0.85']);
  });
  it('stops at the bottom of the ladder', () => {
    const m = new QualityManager(HIGH);
    feed(m, 5, 120);
    expect(m.levelIndex).toBe(LADDER.length - 1);
  });
});

describe('QualityManager step up', () => {
  it('needs a longer stable period than stepping down, then recovers one level', () => {
    const m = new QualityManager(HIGH);
    feed(m, 25, 3); // -> high@0.85
    expect(feed(m, 100, 9)).toEqual([]); // 9 s is not enough
    expect(feed(m, 100, 1)).toEqual(['high@1']);
  });
  it('never climbs above the starting level', () => {
    const m = new QualityManager(BALANCED);
    expect(feed(m, 200, 60)).toEqual([]);
    expect(m.levelIndex).toBe(BALANCED);
  });
  it('waits longer after flicker (step up then quickly down again)', () => {
    const m = new QualityManager(HIGH);
    feed(m, 25, 3); // down
    feed(m, 100, 10); // up
    feed(m, 25, 3); // quickly down again: flicker detected, wait doubles to 20 s
    expect(feed(m, 100, 10)).toEqual([]); // the old 10 s is no longer enough
    expect(feed(m, 100, 10)).toEqual(['high@1']);
  });
});

describe('QualityManager modes', () => {
  it('manual mode never changes level', () => {
    const m = new QualityManager(HIGH);
    m.setManual(BALANCED);
    expect(feed(m, 5, 60)).toEqual([]);
    expect(m.levelIndex).toBe(BALANCED);
  });
  it('still reports fps in manual mode', () => {
    const m = new QualityManager(HIGH);
    m.setManual(HIGH);
    const result = m.recordFrame(1000);
    expect(result?.fps).toBe(1);
  });
  it('switching back to auto resets the ceiling', () => {
    const m = new QualityManager(HIGH);
    m.setManual(BALANCED);
    m.setAuto(HIGH);
    expect(m.levelIndex).toBe(HIGH);
  });
});
