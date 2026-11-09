// Applies a mission answer to the save and announces what happened. The rules themselves are in missions.ts
// (pure, unit tested); this file is the small glue between those rules, the save and the event bus.
import { log } from '../engine/log';
import type { SaveRecord } from '../save/schema';
import type { EventBus, GameEvents } from './events';
import { answerMission, type AnswerOutcome, type Mission } from './missions';

export interface MissionControllerDeps {
  bus: EventBus<GameEvents>;
  missions: Mission[];
  /** The REAL saved record (missions never read or write the practice overlay). */
  getRecord(): SaveRecord;
  /** Applies a change to the save (runs the function immediately, then stores it). */
  commit(change: (record: SaveRecord) => SaveRecord): Promise<void>;
  /** True in practice mode: missions are paused there, because practice never changes saved progress. */
  isPractice?(): boolean;
}

export interface MissionController {
  /** Answers a mission's question. Returns what happened, or null if the answer was not accepted. */
  answer(missionId: string, choice: number): AnswerOutcome | null;
}

export function createMissionController(deps: MissionControllerDeps): MissionController {
  const { bus } = deps;

  return {
    answer(missionId, choice) {
      if (deps.isPractice?.()) return null;
      const mission = deps.missions.find((m) => m.id === missionId);
      if (!mission) return null;
      // Check first, so a refused answer does not even touch the save.
      if (!answerMission(deps.getRecord(), mission, choice).accepted) return null;

      let outcome: AnswerOutcome | null = null;
      deps
        .commit((record) => {
          outcome = answerMission(record, mission, choice);
          return outcome.record;
        })
        .catch((error) => log('Saving the mission answer failed', error));
      if (!outcome) return null;
      const done = outcome as AnswerOutcome;

      // ORDER MATTERS (see app.ts): the answer first, then the XP, then any rank-up (the biggest moment, so the
      // newest message), then the general "progress changed".
      bus.emit('mission:answered', {
        id: missionId,
        correct: done.correct,
        xpAwarded: done.xpAwarded,
      });
      if (done.xpAwarded > 0) {
        bus.emit('xp:changed', {
          xp: done.record.xp,
          delta: done.xpAwarded,
          rank: done.record.rank,
        });
      }
      if (done.rankedUpTo) {
        bus.emit('rank:up', { rank: done.rankedUpTo, newRegions: done.newRegions });
      }
      bus.emit('progress:changed', { record: deps.getRecord() });
      return done;
    },
  };
}
