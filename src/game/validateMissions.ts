// Checks the raw missions JSON and turns it into trusted, typed Mission values, the same way validateObjects does
// for objects. If anything is wrong it throws ONE error listing ALL the problems.
//
// The most important checks are about whether a mission can actually be FINISHED:
//   - every object it asks you to scan must exist;
//   - and must be in a region the player has unlocked by the time they reach the mission's rank.
// (A mission needing Jupiter at the Cadet rank could never be completed.)
import { MISSION_REWARD_RANGE, type Mission } from './missions';
import { RANKS, regionsUnlockedAt } from './ranks';
import type { CelestialObject } from './types';
import { DataValidationError } from './validateObjects';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

const MIN_CHOICES = 2;
const MAX_CHOICES = 5;

export function validateMissions(raw: unknown, objects: CelestialObject[]): Mission[] {
  const problems: string[] = [];
  if (!isRecord(raw) || !Array.isArray(raw.missions)) {
    throw new DataValidationError(['the file must be an object with a "missions" list']);
  }

  const seen = new Set<string>();
  const missions: Mission[] = [];

  raw.missions.forEach((entry, index) => {
    const at = `missions[${index}]`;
    if (!isRecord(entry)) {
      problems.push(`${at}: must be an object`);
      return;
    }
    const where = isNonEmptyString(entry.id) ? `mission "${entry.id}"` : at;

    if (!isNonEmptyString(entry.id)) problems.push(`${at}.id: must be a non-empty string`);
    else if (seen.has(entry.id)) problems.push(`${where}: duplicate id`);
    else seen.add(entry.id);

    for (const field of ['title', 'summary', 'source'] as const) {
      if (!isNonEmptyString(entry[field]))
        problems.push(`${where}.${field}: must be a non-empty string`);
    }

    // The rank, and which regions that rank has unlocked.
    const rankIndex = RANKS.findIndex((r) => r.name === entry.requiredRank);
    if (rankIndex < 0) {
      problems.push(`${where}.requiredRank: "${String(entry.requiredRank)}" is not a rank name`);
    }
    const reachable = rankIndex >= 0 ? new Set(regionsUnlockedAt(rankIndex)) : new Set<string>();

    // Objectives: objects that exist, and that the player can reach at this rank.
    const scan = entry.scan;
    if (!Array.isArray(scan) || scan.length === 0 || !scan.every(isNonEmptyString)) {
      problems.push(`${where}.scan: must be a non-empty list of object ids`);
    } else {
      if (new Set(scan).size !== scan.length) problems.push(`${where}.scan: lists an object twice`);
      for (const id of scan) {
        const object = objects.find((o) => o.id === id);
        if (!object) problems.push(`${where}.scan: "${id}" is not an object in the data`);
        else if (rankIndex >= 0 && !reachable.has(object.region)) {
          problems.push(
            `${where}.scan: "${id}" is in the ${object.region} region, which is not unlocked at rank ${String(entry.requiredRank)}, so the mission could never be finished`,
          );
        }
      }
    }

    // The final question.
    const q = entry.question;
    if (!isRecord(q)) {
      problems.push(`${where}.question: must be an object`);
    } else {
      if (!isNonEmptyString(q.prompt))
        problems.push(`${where}.question.prompt: must be a non-empty string`);
      if (!isNonEmptyString(q.explanation)) {
        problems.push(`${where}.question.explanation: must be a non-empty string`);
      }
      const choices = q.choices;
      if (
        !Array.isArray(choices) ||
        choices.length < MIN_CHOICES ||
        choices.length > MAX_CHOICES ||
        !choices.every(isNonEmptyString)
      ) {
        problems.push(
          `${where}.question.choices: must be ${MIN_CHOICES} to ${MAX_CHOICES} non-empty strings`,
        );
      } else {
        if (new Set(choices).size !== choices.length) {
          problems.push(`${where}.question.choices: two choices are identical`);
        }
        if (
          !Number.isInteger(q.answer) ||
          (q.answer as number) < 0 ||
          (q.answer as number) >= choices.length
        ) {
          problems.push(
            `${where}.question.answer: must be the position (from 0) of one of the choices`,
          );
        }
      }
    }

    const reward = entry.rewardXp;
    if (
      !Number.isInteger(reward) ||
      (reward as number) < MISSION_REWARD_RANGE.min ||
      (reward as number) > MISSION_REWARD_RANGE.max
    ) {
      problems.push(
        `${where}.rewardXp: must be a whole number from ${MISSION_REWARD_RANGE.min} to ${MISSION_REWARD_RANGE.max}`,
      );
    }

    missions.push(entry as unknown as Mission);
  });

  if (problems.length > 0) throw new DataValidationError(problems);
  return missions;
}
