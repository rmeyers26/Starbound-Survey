// Guided missions (spec: "Guided Missions"): a few objectives, then a final question that uses what you found.
//
// This file holds the TYPES and the PURE RULES: no screen code, no storage, no timers, so every rule is easy to
// test. Nothing here needs a new field in the save file:
//   - Whether an objective is done is WORKED OUT from what you have scanned (like achievements).
//   - The save's existing `missions` slot (a map of mission id -> text) stores only two things:
//       'wrong:N'   you have answered the question wrongly N times (so a retry earns less XP)
//       'complete'  the mission is finished (and its XP has been awarded)
import type { SaveRecord } from '../save/schema';
import { rankIndexByName } from './ranks';
import { awardXp, type XpAward } from './scoring';
import type { CelestialObject } from './types';

export const XP_QUIZ_FIRST_TRY = 15; // spec: "Quiz correct, first try"
export const XP_QUIZ_RETRY = 5; // spec: "Quiz correct, retry"
/** The spec's range for a finished mission. */
export const MISSION_REWARD_RANGE = { min: 50, max: 150 } as const;

export interface MissionQuestion {
  prompt: string;
  choices: string[];
  /** Index (counting from 0) of the correct choice. */
  answer: number;
  /** Shown after any answer, right or wrong. Teaches the idea. */
  explanation: string;
}

export interface Mission {
  id: string;
  title: string;
  /** One or two sentences for the Missions list. */
  summary: string;
  /** The rank (name, as in ranks.ts) needed to start it. */
  requiredRank: string;
  /** Object ids the player must scan (any tier) before the question opens. */
  scan: string[];
  question: MissionQuestion;
  /** XP for finishing (on top of the quiz XP). The spec allows 50 to 150. */
  rewardXp: number;
  /** Where the facts come from, shown to the player. */
  source: string;
}

/** Where a mission stands for this player. */
export type MissionStatus =
  | 'locked' // the rank is too low
  | 'objectives' // scanning still to do
  | 'question' // all scanned: the final question is open
  | 'complete';

export function missionStatus(mission: Mission, record: SaveRecord): MissionStatus {
  if (record.missions[mission.id] === 'complete') return 'complete';
  if (rankIndexByName(record.rank) < rankIndexByName(mission.requiredRank)) return 'locked';
  const allScanned = mission.scan.every((id) => (record.scannedObjects[id] ?? 0) > 0);
  return allScanned ? 'question' : 'objectives';
}

export interface ObjectiveProgress {
  id: string;
  name: string;
  done: boolean;
}

/** One line per object to scan, saying whether it is done. */
export function objectiveProgress(
  mission: Mission,
  record: SaveRecord,
  objects: CelestialObject[],
): ObjectiveProgress[] {
  return mission.scan.map((id) => ({
    id,
    name: objects.find((o) => o.id === id)?.name ?? id,
    done: (record.scannedObjects[id] ?? 0) > 0,
  }));
}

/** How many wrong answers this player has given so far (0 if none). */
export function wrongAttempts(record: SaveRecord, missionId: string): number {
  const state = record.missions[missionId] ?? '';
  const match = /^wrong:(\d+)$/.exec(state);
  return match ? Number(match[1]) : 0;
}

export interface AnswerOutcome extends XpAward {
  /** False when the answer was not accepted at all (the question is not open). */
  accepted: boolean;
  correct: boolean;
  /** Mission XP plus quiz XP when correct, otherwise 0. */
  xpAwarded: number;
}

/**
 * Applies an answer to the save and reports what changed. Does not mutate the input.
 *  - Only accepted while the question is open (all objectives scanned, not yet complete).
 *  - A wrong answer costs nothing: it is just counted, so a later correct answer earns the smaller retry XP.
 *  - A correct answer completes the mission and awards XP (which can rank the player up).
 * With `awardProgress` false nothing is saved or awarded (used for practice mode, which keeps progress untouched).
 */
export function answerMission(
  record: SaveRecord,
  mission: Mission,
  choice: number,
  awardProgress = true,
): AnswerOutcome {
  const unchanged = { record, rankedUpTo: null, newRegions: [] };
  if (!awardProgress || missionStatus(mission, record) !== 'question') {
    return { ...unchanged, accepted: false, correct: false, xpAwarded: 0 };
  }
  const attempts = wrongAttempts(record, mission.id);
  if (choice !== mission.question.answer) {
    const next = {
      ...record,
      missions: { ...record.missions, [mission.id]: `wrong:${attempts + 1}` },
    };
    return {
      record: next,
      rankedUpTo: null,
      newRegions: [],
      accepted: true,
      correct: false,
      xpAwarded: 0,
    };
  }
  const xpAwarded = mission.rewardXp + (attempts === 0 ? XP_QUIZ_FIRST_TRY : XP_QUIZ_RETRY);
  const finished = { ...record, missions: { ...record.missions, [mission.id]: 'complete' } };
  const award = awardXp(finished, xpAwarded);
  return { ...award, accepted: true, correct: true, xpAwarded };
}

/** The missions the player can work on right now (rank reached, not finished), in list order. */
export function activeMissions(missions: Mission[], record: SaveRecord): Mission[] {
  return missions.filter((m) => {
    const status = missionStatus(m, record);
    return status === 'objectives' || status === 'question';
  });
}
