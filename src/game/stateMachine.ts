// The game is always in exactly ONE state (spec: "Game state machine"). That makes impossible
// situations, like scanning while a menu is open, impossible by construction: code asks the machine
// what is allowed instead of juggling many true/false flags.
import { log } from '../engine/log';
import type { EventBus, GameEvents } from './events';

export type GameState =
  | 'BOOT'
  | 'TITLE'
  | 'TUTORIAL'
  | 'EXPLORE'
  | 'MAP'
  | 'MISSIONS'
  | 'LOGBOOK'
  | 'OBSERVATORY'
  | 'SHIP'
  | 'WARPING';

/** The spec's transition table: from each state, where can we go? */
export const TRANSITIONS: Record<GameState, readonly GameState[]> = {
  BOOT: ['TITLE'],
  TITLE: ['TUTORIAL', 'EXPLORE'],
  TUTORIAL: ['EXPLORE'],
  EXPLORE: ['MAP', 'MISSIONS', 'LOGBOOK', 'OBSERVATORY', 'SHIP', 'WARPING'],
  MAP: ['EXPLORE'],
  MISSIONS: ['EXPLORE'],
  LOGBOOK: ['EXPLORE'],
  OBSERVATORY: ['EXPLORE'],
  SHIP: ['EXPLORE'],
  WARPING: ['EXPLORE'],
};

export const canTransition = (from: GameState, to: GameState): boolean =>
  TRANSITIONS[from].includes(to);

export class GameStateMachine {
  private current: GameState = 'BOOT';
  private readonly bus: EventBus<GameEvents>;

  constructor(bus: EventBus<GameEvents>) {
    this.bus = bus;
  }

  get state(): GameState {
    return this.current;
  }

  /** Moves to `to` if the table allows it. Returns false (and changes nothing) otherwise. */
  transition(to: GameState): boolean {
    if (!canTransition(this.current, to)) {
      log(`Ignored illegal state change ${this.current} -> ${to}`);
      return false;
    }
    const from = this.current;
    this.current = to;
    this.bus.emit('state:changed', { from, to });
    return true;
  }
}
