import { describe, expect, it } from 'vitest';
import missionData from '../../data/missions.json';
import objectData from '../../data/objects.json';
import {
  XP_QUIZ_FIRST_TRY,
  XP_QUIZ_RETRY,
  activeMissions,
  answerMission,
  missionStatus,
  objectiveProgress,
  wrongAttempts,
  type Mission,
} from '../../src/game/missions';
import { RANKS } from '../../src/game/ranks';
import { applyScan, awardXp } from '../../src/game/scoring';
import { validateMissions } from '../../src/game/validateMissions';
import { validateObjects } from '../../src/game/validateObjects';
import { createEmptySave, type SaveRecord } from '../../src/save/schema';

const objects = validateObjects(objectData);
const missions = validateMissions(missionData, objects);
const moon = missions.find((m) => m.id === 'moon-light')!;
const RIGHT = moon.question.answer;
const WRONG = (RIGHT + 1) % moon.question.choices.length;

const fresh = (): SaveRecord => ({
  ...createEmptySave(new Date('2026-01-01T00:00:00.000Z')),
  unlockedRegions: ['inner'],
});
/** A save that has scanned the Sun and the Moon, so the question is open. */
const readyForQuestion = (): SaveRecord => {
  let record = fresh();
  for (const id of moon.scan) record = applyScan(record, id, 1).record;
  return record;
};

describe('awardXp (shared by scans and missions)', () => {
  it('adds XP and leaves everything else alone when no threshold is crossed', () => {
    const before = fresh();
    const { record, rankedUpTo, newRegions } = awardXp(before, 10);
    expect(record.xp).toBe(10);
    expect(record.rank).toBe('Cadet');
    expect(rankedUpTo).toBeNull();
    expect(newRegions).toEqual([]);
  });

  it('ranks the player up and opens the new regions when a threshold is crossed', () => {
    const { record, rankedUpTo, newRegions } = awardXp(fresh(), RANKS[1].xp);
    expect(rankedUpTo).toBe('Navigator');
    expect(record.rank).toBe('Navigator');
    expect(newRegions).toContain('outer');
    expect(record.unlockedRegions).toContain('outer');
  });

  it('does not change the save it was given', () => {
    const before = fresh();
    const copy = structuredClone(before);
    awardXp(before, 500);
    expect(before).toEqual(copy);
  });
});

describe('missionStatus and objectiveProgress', () => {
  it('starts with scanning to do', () => {
    expect(missionStatus(moon, fresh())).toBe('objectives');
  });

  it('stays on scanning until BOTH objects are scanned', () => {
    const sunOnly = applyScan(fresh(), 'sun', 1).record;
    expect(missionStatus(moon, sunOnly)).toBe('objectives');
    const progress = objectiveProgress(moon, sunOnly, objects);
    expect(progress.map((p) => [p.id, p.name, p.done])).toEqual([
      ['sun', 'The Sun', true],
      ['moon', 'The Moon', false],
    ]);
  });

  it('opens the question once everything is scanned', () => {
    expect(missionStatus(moon, readyForQuestion())).toBe('question');
  });

  it('is complete once the save says so', () => {
    const done = { ...readyForQuestion(), missions: { 'moon-light': 'complete' } };
    expect(missionStatus(moon, done)).toBe('complete');
  });

  it('is locked below the required rank', () => {
    const harder: Mission = { ...moon, requiredRank: 'Navigator' };
    expect(missionStatus(harder, readyForQuestion())).toBe('locked');
    expect(missionStatus(harder, { ...readyForQuestion(), rank: 'Navigator' })).toBe('question');
  });
});

describe('answerMission', () => {
  it('a correct first answer completes the mission and awards mission plus first-try XP', () => {
    const out = answerMission(readyForQuestion(), moon, RIGHT);
    expect(out.accepted).toBe(true);
    expect(out.correct).toBe(true);
    expect(out.xpAwarded).toBe(moon.rewardXp + XP_QUIZ_FIRST_TRY);
    expect(out.record.missions['moon-light']).toBe('complete');
    expect(out.record.xp).toBe(readyForQuestion().xp + moon.rewardXp + XP_QUIZ_FIRST_TRY);
  });

  it('a wrong answer costs nothing and is only counted', () => {
    const before = readyForQuestion();
    const out = answerMission(before, moon, WRONG);
    expect(out.accepted).toBe(true);
    expect(out.correct).toBe(false);
    expect(out.xpAwarded).toBe(0);
    expect(out.record.xp).toBe(before.xp);
    expect(wrongAttempts(out.record, 'moon-light')).toBe(1);
    expect(missionStatus(moon, out.record)).toBe('question'); // still open: try again
  });

  it('a correct answer after a wrong one earns the smaller retry XP', () => {
    const afterWrong = answerMission(readyForQuestion(), moon, WRONG).record;
    const out = answerMission(afterWrong, moon, RIGHT);
    expect(out.xpAwarded).toBe(moon.rewardXp + XP_QUIZ_RETRY);
    expect(out.record.missions['moon-light']).toBe('complete');
  });

  it('counts every wrong answer', () => {
    let record = readyForQuestion();
    for (let i = 0; i < 3; i++) record = answerMission(record, moon, WRONG).record;
    expect(wrongAttempts(record, 'moon-light')).toBe(3);
  });

  it('is not accepted before the objectives are scanned (no skipping the scanning)', () => {
    const out = answerMission(fresh(), moon, RIGHT);
    expect(out.accepted).toBe(false);
    expect(out.xpAwarded).toBe(0);
    expect(out.record).toEqual(fresh());
  });

  it('cannot be answered again once complete (no earning the reward twice)', () => {
    const done = answerMission(readyForQuestion(), moon, RIGHT).record;
    const again = answerMission(done, moon, RIGHT);
    expect(again.accepted).toBe(false);
    expect(again.xpAwarded).toBe(0);
    expect(again.record.xp).toBe(done.xp);
  });

  it('changes nothing in practice mode (awardProgress false)', () => {
    const before = readyForQuestion();
    const out = answerMission(before, moon, RIGHT, false);
    expect(out.accepted).toBe(false);
    expect(out.record).toBe(before);
  });

  it('can rank the player up, opening the next region, just like a scan', () => {
    const nearly = { ...readyForQuestion(), xp: RANKS[1].xp - 1 };
    const out = answerMission(nearly, moon, RIGHT);
    expect(out.rankedUpTo).toBe('Navigator');
    expect(out.newRegions).toContain('outer');
    expect(out.record.unlockedRegions).toContain('outer');
  });

  it('does not change the save it was given', () => {
    const before = readyForQuestion();
    const copy = structuredClone(before);
    answerMission(before, moon, WRONG);
    answerMission(before, moon, RIGHT);
    expect(before).toEqual(copy);
  });
});

describe('activeMissions', () => {
  it('lists the missions you can work on, and drops finished ones', () => {
    expect(activeMissions(missions, fresh()).map((m) => m.id)).toContain('moon-light');
    const done = answerMission(readyForQuestion(), moon, RIGHT).record;
    expect(activeMissions(missions, done).map((m) => m.id)).not.toContain('moon-light');
  });
});
