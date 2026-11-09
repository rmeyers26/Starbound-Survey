import { describe, expect, it } from 'vitest';
import missionData from '../../data/missions.json';
import objectData from '../../data/objects.json';
import { EventBus, type GameEvents } from '../../src/game/events';
import { createMissionController } from '../../src/game/missionController';
import { XP_QUIZ_FIRST_TRY } from '../../src/game/missions';
import { RANKS } from '../../src/game/ranks';
import { applyScan } from '../../src/game/scoring';
import { validateMissions } from '../../src/game/validateMissions';
import { validateObjects } from '../../src/game/validateObjects';
import { createEmptySave, type SaveRecord } from '../../src/save/schema';

const objects = validateObjects(objectData);
const missions = validateMissions(missionData, objects);
const moon = missions.find((m) => m.id === 'moon-light')!;
const RIGHT = moon.question.answer;
const WRONG = (RIGHT + 1) % moon.question.choices.length;

/** A save that has scanned everything the Moon mission asks for, so its question is open. */
function readyRecord(extra: Partial<SaveRecord> = {}): SaveRecord {
  let record: SaveRecord = {
    ...createEmptySave(new Date('2026-01-01T00:00:00.000Z')),
    unlockedRegions: ['inner'],
  };
  for (const id of moon.scan) record = applyScan(record, id, 1).record;
  return { ...record, ...extra };
}

function setup(options: { record?: SaveRecord; practice?: boolean } = {}) {
  const bus = new EventBus<GameEvents>();
  let record = options.record ?? readyRecord();
  let saves = 0;
  const events: Array<[string, unknown]> = [];
  for (const name of ['mission:answered', 'xp:changed', 'rank:up', 'progress:changed'] as const) {
    bus.on(name, (payload) => events.push([name, payload]));
  }
  const controller = createMissionController({
    bus,
    missions,
    getRecord: () => record,
    commit: (change) => {
      saves++;
      record = change(record);
      return Promise.resolve();
    },
    isPractice: () => options.practice ?? false,
  });
  return {
    controller,
    events,
    names: () => events.map(([n]) => n),
    record: () => record,
    saves: () => saves,
  };
}

describe('mission controller', () => {
  it('a correct answer saves, awards XP, and announces in order: answer, XP, progress', () => {
    const t = setup();
    const out = t.controller.answer('moon-light', RIGHT);
    expect(out?.correct).toBe(true);
    expect(t.record().missions['moon-light']).toBe('complete');
    expect(t.names()).toEqual(['mission:answered', 'xp:changed', 'progress:changed']);
    expect(t.events[0][1]).toEqual({
      id: 'moon-light',
      correct: true,
      xpAwarded: moon.rewardXp + XP_QUIZ_FIRST_TRY,
    });
  });

  it('a wrong answer is saved as an attempt, awards nothing, and announces no XP', () => {
    const t = setup();
    const out = t.controller.answer('moon-light', WRONG);
    expect(out?.correct).toBe(false);
    expect(t.record().missions['moon-light']).toBe('wrong:1');
    expect(t.names()).toEqual(['mission:answered', 'progress:changed']);
  });

  it('announces a rank-up AFTER the answer and XP, so the rank-up is the newest message', () => {
    const t = setup({ record: readyRecord({ xp: RANKS[1].xp - 1 }) });
    t.controller.answer('moon-light', RIGHT);
    expect(t.names()).toEqual(['mission:answered', 'xp:changed', 'rank:up', 'progress:changed']);
    expect(t.events[2][1]).toMatchObject({ rank: 'Navigator' });
  });

  it('does nothing, and does not touch the save, when the question is not open yet', () => {
    const t = setup({ record: { ...createEmptySave(new Date()), unlockedRegions: ['inner'] } });
    expect(t.controller.answer('moon-light', RIGHT)).toBeNull();
    expect(t.saves()).toBe(0);
    expect(t.events).toEqual([]);
  });

  it('does nothing in practice mode (practice never changes saved progress)', () => {
    const t = setup({ practice: true });
    expect(t.controller.answer('moon-light', RIGHT)).toBeNull();
    expect(t.saves()).toBe(0);
    expect(t.events).toEqual([]);
  });

  it('ignores an unknown mission id', () => {
    const t = setup();
    expect(t.controller.answer('no-such-mission', 0)).toBeNull();
    expect(t.saves()).toBe(0);
  });

  it('refuses a second answer once the mission is complete (no reward twice)', () => {
    const t = setup();
    t.controller.answer('moon-light', RIGHT);
    const xpAfterFirst = t.record().xp;
    expect(t.controller.answer('moon-light', RIGHT)).toBeNull();
    expect(t.record().xp).toBe(xpAfterFirst);
    expect(t.saves()).toBe(1);
  });
});
