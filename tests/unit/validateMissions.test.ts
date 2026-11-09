import { describe, expect, it } from 'vitest';
import missionData from '../../data/missions.json';
import objectData from '../../data/objects.json';
import { DataValidationError, validateObjects } from '../../src/game/validateObjects';
import { validateMissions } from '../../src/game/validateMissions';

const objects = validateObjects(objectData);

/** A good mission to copy and break one thing at a time. */
const good = () => structuredClone(missionData.missions[0]);
const file = (...missions: unknown[]) => ({ missions });
const problemsOf = (raw: unknown): string[] => {
  try {
    validateMissions(raw, objects);
  } catch (error) {
    if (error instanceof DataValidationError) return error.problems;
    throw error;
  }
  return [];
};

describe('the real missions file', () => {
  it('is valid, and has the Moon mission', () => {
    const missions = validateMissions(missionData, objects);
    expect(missions.length).toBeGreaterThan(0);
    const moon = missions.find((m) => m.id === 'moon-light');
    expect(moon?.title).toBe("Where does the Moon's light come from?");
    expect(moon?.scan).toEqual(['sun', 'moon']);
  });

  it('every mission can be finished: its question has a right answer among the choices', () => {
    for (const m of validateMissions(missionData, objects)) {
      expect(m.question.choices[m.question.answer], m.id).toBeTruthy();
    }
  });
});

describe('validateMissions rejects a mission that could not work', () => {
  it('accepts a good mission (so the failures below are about the one thing broken)', () => {
    expect(problemsOf(file(good()))).toEqual([]);
  });

  it('needs a "missions" list', () => {
    expect(problemsOf({})).toEqual(['the file must be an object with a "missions" list']);
    expect(problemsOf([])).toEqual(['the file must be an object with a "missions" list']);
  });

  it('rejects an objective that names an object that does not exist', () => {
    const m = good();
    m.scan = ['sun', 'vulcan'];
    expect(problemsOf(file(m)).join('\n')).toContain('"vulcan" is not an object in the data');
  });

  it('rejects a mission that needs an object the player cannot reach at that rank (it could never be finished)', () => {
    const m = good();
    m.scan = ['jupiter']; // the outer region only opens at Navigator, but this mission starts at Cadet
    expect(problemsOf(file(m)).join('\n')).toContain('could never be finished');
    m.requiredRank = 'Navigator'; // at Navigator the outer region is open, so it is fine
    expect(problemsOf(file(m))).toEqual([]);
  });

  it('rejects a rank name that does not exist', () => {
    const m = good();
    m.requiredRank = 'Admiral';
    expect(problemsOf(file(m)).join('\n')).toContain('"Admiral" is not a rank name');
  });

  it('rejects an empty or repeated objective list', () => {
    const empty = good();
    empty.scan = [];
    expect(problemsOf(file(empty)).join('\n')).toContain('scan: must be a non-empty list');
    const twice = good();
    twice.scan = ['moon', 'moon'];
    expect(problemsOf(file(twice)).join('\n')).toContain('lists an object twice');
  });

  it('rejects an answer position that points at no choice', () => {
    for (const answer of [-1, 4, 1.5]) {
      const m = good();
      m.question.answer = answer;
      expect(problemsOf(file(m)).join('\n'), `answer ${answer}`).toContain('question.answer');
    }
  });

  it('rejects too few, too many, empty or repeated choices', () => {
    const one = good();
    one.question.choices = ['only one'];
    expect(problemsOf(file(one)).join('\n')).toContain('question.choices: must be 2 to 5');
    const many = good();
    many.question.choices = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(problemsOf(file(many)).join('\n')).toContain('question.choices: must be 2 to 5');
    const blank = good();
    blank.question.choices = ['a', ' '];
    expect(problemsOf(file(blank)).join('\n')).toContain('question.choices: must be 2 to 5');
    const same = good();
    same.question.choices = ['a', 'a'];
    expect(problemsOf(file(same)).join('\n')).toContain('two choices are identical');
  });

  it("rejects a reward outside the spec's 50 to 150", () => {
    for (const rewardXp of [0, 49, 151, 60.5]) {
      const m = good();
      m.rewardXp = rewardXp;
      expect(problemsOf(file(m)).join('\n'), `reward ${rewardXp}`).toContain('rewardXp');
    }
  });

  it('rejects a missing title, summary, source, prompt or explanation', () => {
    for (const field of ['title', 'summary', 'source']) {
      const m = good() as Record<string, unknown>;
      m[field] = '';
      expect(problemsOf(file(m)).join('\n'), field).toContain(
        `${field}: must be a non-empty string`,
      );
    }
    const noPrompt = good();
    noPrompt.question.prompt = '';
    expect(problemsOf(file(noPrompt)).join('\n')).toContain('question.prompt');
    const noExplanation = good();
    noExplanation.question.explanation = '';
    expect(problemsOf(file(noExplanation)).join('\n')).toContain('question.explanation');
  });

  it('rejects two missions with the same id', () => {
    expect(problemsOf(file(good(), good())).join('\n')).toContain('duplicate id');
  });

  it('reports ALL the problems at once, not just the first', () => {
    const m = good();
    m.scan = ['vulcan'];
    m.rewardXp = 1;
    m.requiredRank = 'Admiral';
    expect(problemsOf(file(m)).length).toBeGreaterThanOrEqual(3);
  });
});
