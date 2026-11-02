import { describe, it, expect, vi } from 'vitest';
import { EventBus, type GameEvents } from '../../src/game/events';
import {
  GameStateMachine,
  TRANSITIONS,
  canTransition,
  type GameState,
} from '../../src/game/stateMachine';

const make = () => {
  const bus = new EventBus<GameEvents>();
  const heard = vi.fn();
  bus.on('state:changed', heard);
  return { machine: new GameStateMachine(bus), heard };
};

describe('GameStateMachine', () => {
  it('starts in BOOT and follows BOOT -> TITLE -> EXPLORE', () => {
    const { machine } = make();
    expect(machine.state).toBe('BOOT');
    expect(machine.transition('TITLE')).toBe(true);
    expect(machine.transition('EXPLORE')).toBe(true);
    expect(machine.state).toBe('EXPLORE');
  });
  it('refuses illegal moves and stays where it was', () => {
    const { machine, heard } = make();
    expect(machine.transition('EXPLORE')).toBe(false); // cannot skip TITLE
    expect(machine.state).toBe('BOOT');
    expect(heard).not.toHaveBeenCalled();
  });
  it('announces every real change with from and to', () => {
    const { machine, heard } = make();
    machine.transition('TITLE');
    expect(heard).toHaveBeenCalledWith({ from: 'BOOT', to: 'TITLE' });
  });
  it('screens can only go back to EXPLORE, never straight to each other', () => {
    const { machine } = make();
    machine.transition('TITLE');
    machine.transition('EXPLORE');
    expect(machine.transition('LOGBOOK')).toBe(true);
    expect(machine.transition('SHIP')).toBe(false); // must close the Logbook first
    expect(machine.transition('EXPLORE')).toBe(true);
  });
});

describe('transition table (spec)', () => {
  it('matches the spec: every screen returns only to EXPLORE', () => {
    const screens: GameState[] = ['MAP', 'MISSIONS', 'LOGBOOK', 'OBSERVATORY', 'SHIP', 'WARPING'];
    for (const s of screens) expect(TRANSITIONS[s]).toEqual(['EXPLORE']);
    expect(canTransition('EXPLORE', 'WARPING')).toBe(true);
    expect(canTransition('TUTORIAL', 'EXPLORE')).toBe(true);
    expect(canTransition('TITLE', 'MAP')).toBe(false);
  });
});
