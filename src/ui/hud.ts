// The on-screen controls: object buttons and camera buttons.
// They are plain <button>s, which gives us keyboard and screen-reader support for free, and they
// are the button alternatives to the touch gestures (spec rule). They only talk to the event bus.
import type { EventBus, GameEvents } from '../game/events';
import type { GameStateMachine } from '../game/stateMachine';
import { isObjectUnlocked } from '../game/regions';
import type { CelestialObject } from '../game/types';
import type { SaveRecord } from '../save/schema';

function makeButton(label: string, className: string, ariaLabel?: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  if (ariaLabel) button.setAttribute('aria-label', ariaLabel);
  return button;
}

export function createHud(
  container: HTMLElement,
  objects: CelestialObject[],
  bus: EventBus<GameEvents>,
  machine: GameStateMachine,
  getRecord: () => SaveRecord,
): () => void {
  const hud = document.createElement('div');
  hud.className = 'hud';

  // Row of object buttons (select AND fly there). Also the accessible way to pick tiny objects.
  const nav = document.createElement('nav');
  nav.className = 'hud-objects';
  nav.setAttribute('aria-label', 'Objects');
  const chips = new Map<string, HTMLButtonElement>();
  for (const object of objects) {
    const chip = makeButton(object.name, 'hud-button');
    chip.dataset.objectId = object.id;
    chip.setAttribute('aria-pressed', 'false');
    chip.addEventListener('click', () => {
      // A locked object cannot be selected: tell the player why instead of silently doing nothing.
      if (!isObjectUnlocked(object, getRecord())) {
        bus.emit('object:locked', { id: object.id });
        return;
      }
      bus.emit('object:selected', { id: object.id });
      bus.emit('camera:focus', { id: object.id });
    });
    chips.set(object.id, chip);
    nav.append(chip);
  }

  const controls = document.createElement('div');
  controls.className = 'hud-controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Camera controls');
  const zoomIn = makeButton('+', 'hud-button hud-round', 'Zoom in');
  const zoomOut = makeButton('−', 'hud-button hud-round', 'Zoom out');
  const overview = makeButton('Overview', 'hud-button', 'Back to overview of the whole system');
  zoomIn.addEventListener('click', () => bus.emit('camera:zoom', { factor: 0.7 }));
  zoomOut.addEventListener('click', () => bus.emit('camera:zoom', { factor: 1.4 }));
  overview.addEventListener('click', () => {
    bus.emit('object:selected', { id: null });
    bus.emit('camera:focus', { id: null });
  });
  const settingsButton = makeButton('Settings', 'hud-button', 'Open settings');
  settingsButton.addEventListener('click', () => bus.emit('settings:open', undefined));
  const logbookButton = makeButton(
    'Logbook',
    'hud-button',
    'Open the Logbook of discovered objects',
  );
  logbookButton.addEventListener('click', () => machine.transition('LOGBOOK'));
  controls.append(zoomIn, zoomOut, overview, logbookButton, settingsButton);

  // Honesty rule (spec): the HUD says when the view is not to scale.
  const note = document.createElement('p');
  note.className = 'hud-note';
  note.textContent = 'Not to scale';
  note.title =
    'Sizes and distances are compressed for playability. True values are in the info panel.';

  const top = document.createElement('div');
  top.className = 'hud-top';
  // Status column: the scale note now, and the rank / XP bar added below it by createXpBar.
  const statusColumn = document.createElement('div');
  statusColumn.className = 'hud-status';
  statusColumn.append(note);
  top.append(nav, statusColumn);

  hud.append(top, controls);
  container.append(hud);

  // Grey out the buttons of regions that are not unlocked yet. We use `aria-disabled` (not `disabled`) so a
  // screen reader or keyboard user can still reach the button and hear WHY it does nothing.
  function refreshLocks(): void {
    const record = getRecord();
    for (const object of objects) {
      const chip = chips.get(object.id);
      if (!chip) continue;
      const locked = !isObjectUnlocked(object, record);
      chip.classList.toggle('locked', locked);
      chip.setAttribute('aria-disabled', String(locked));
      chip.replaceChildren(object.name);
      if (locked) {
        const hidden = document.createElement('span');
        hidden.className = 'visually-hidden';
        hidden.textContent = ' (locked)';
        chip.append(hidden);
      }
    }
  }
  refreshLocks();
  const offRank = bus.on('rank:up', refreshLocks);
  const offProgress = bus.on('progress:changed', refreshLocks);

  // Keep the "pressed" look of the buttons in sync with the real selection.
  const unsubscribe = bus.on('object:selected', ({ id }) => {
    for (const [chipId, chip] of chips) chip.setAttribute('aria-pressed', String(chipId === id));
  });

  return () => {
    unsubscribe();
    offRank();
    offProgress();
    hud.remove();
  };
}
