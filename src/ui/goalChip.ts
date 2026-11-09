// The "Goal" line in the corner of the screen: always names the next thing worth doing, so a new player is never
// left wondering what to do. When there is something to fly to, tapping it selects that object and flies there
// (the same as tapping its button in the row at the top). The rules for WHAT the goal is live in game/goals.ts.
import type { EventBus, GameEvents } from '../game/events';
import { nextGoal } from '../game/goals';
import type { CelestialObject } from '../game/types';
import type { SaveRecord } from '../save/schema';
import { el } from './dom';

export function createGoalChip(
  container: HTMLElement,
  objects: CelestialObject[],
  bus: EventBus<GameEvents>,
  getRecord: () => SaveRecord,
  /** True in practice mode: scans give no XP there, so there is no goal to chase and the line hides. */
  isPractice: () => boolean = () => false,
): () => void {
  const root = el('div', 'goal-chip');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Next goal');

  // Sits in the HUD's status column, under the rank and XP bar.
  (container.querySelector('.hud-status') ?? container).append(root);

  const render = (): void => {
    root.hidden = isPractice();
    if (root.hidden) return;
    const goal = nextGoal(getRecord(), objects);
    const target = goal.targetId ? objects.find((o) => o.id === goal.targetId) : undefined;
    // The label "Goal:" is part of the visible text so the screen reader says the same words as the screen shows.
    const visible = `Goal: ${goal.text}`;
    root.dataset.goalTarget = goal.targetId ?? '';
    if (target) {
      const button = el('button', 'goal-chip-button', visible);
      button.type = 'button';
      button.setAttribute('aria-label', `${visible} Select ${target.name} and fly there.`);
      button.addEventListener('click', () => {
        bus.emit('object:selected', { id: target.id });
        bus.emit('camera:focus', { id: target.id });
      });
      root.replaceChildren(button);
    } else {
      // Nothing to fly to (for example "you have scanned everything"): plain text, not a button that does nothing.
      root.replaceChildren(el('span', 'goal-chip-text', visible));
    }
  };
  render();

  const offs = [
    bus.on('progress:changed', render),
    bus.on('rank:up', render),
    bus.on('settings:changed', render), // practice mode can be switched on or off
  ];
  return () => {
    offs.forEach((off) => off());
    root.remove();
  };
}
