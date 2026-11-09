// The Logbook: every object you have discovered by scanning (spec: "Discovered objects, the encyclopedia").
// It is a native <dialog> and a game STATE: opening it moves the state machine to LOGBOOK, which is
// what stops scanning while it is open.
import type { EventBus, GameEvents } from '../game/events';
import { ACHIEVEMENTS, earnedAchievementIds } from '../game/goals';
import type { GameStateMachine } from '../game/stateMachine';
import { TIER_LABEL } from '../game/tiers';
import type { CelestialObject } from '../game/types';
import { unlockedObjects } from '../game/regions';
import type { SaveRecord } from '../save/schema';
import { el } from './dom';
import { regionName, typeLabel } from './format';

export function createLogbook(
  container: HTMLElement,
  objects: CelestialObject[],
  bus: EventBus<GameEvents>,
  machine: GameStateMachine,
  getRecord: () => SaveRecord,
  /** The real saved record: achievements count only real scans, never practice ones. */
  getRealRecord: () => SaveRecord = getRecord,
): () => void {
  const dialog = el('dialog', 'app-dialog logbook-dialog');
  dialog.setAttribute('aria-labelledby', 'logbook-title');
  const body = el('div', 'settings-body');
  const title = el('h2', 'settings-title', 'Logbook');
  title.id = 'logbook-title';
  const summary = el('p', 'logbook-summary');
  const achievementsTitle = el('h3', 'logbook-subtitle', 'Achievements');
  const achievementsSummary = el('p', 'logbook-meta');
  const achievementList = el('ul', 'achievement-list');
  achievementList.setAttribute('aria-label', 'Achievements');
  const list = el('ul', 'logbook-list');
  const close = el('button', 'hud-button settings-close', 'Close');
  close.type = 'button';
  body.append(title, summary, achievementsTitle, achievementsSummary, achievementList, list, close);
  dialog.append(body);
  container.append(dialog);

  function render(): void {
    const record = getRecord();
    // Only objects in unlocked regions are listed, so the total never counts things you cannot reach yet.
    const available = unlockedObjects(objects, record);
    const found = available.filter((o) => (record.scannedObjects[o.id] ?? 0) > 0);
    const lockedCount = objects.length - available.length;
    summary.textContent =
      `Discovered ${found.length} of ${available.length} objects.` +
      (lockedCount > 0 ? ' More objects unlock as you rank up.' : '');

    // Achievements: earned ones show their name, the others still show how to earn them.
    const earned = earnedAchievementIds(getRealRecord(), objects);
    achievementsSummary.textContent = `${earned.size} of ${ACHIEVEMENTS.length} earned.`;
    achievementList.replaceChildren();
    for (const achievement of ACHIEVEMENTS) {
      const done = earned.has(achievement.id);
      const item = el('li', done ? 'achievement achievement--earned' : 'achievement');
      item.dataset.achievementId = achievement.id;
      item.append(
        el('strong', undefined, `${done ? '★ ' : '☆ '}${achievement.title}`),
        el('span', 'visually-hidden', done ? ' (earned)' : ' (not yet earned)'),
        el('span', 'logbook-meta', ` ${achievement.hint}`),
      );
      achievementList.append(item);
    }

    list.replaceChildren();
    for (const object of available) {
      const tier = record.scannedObjects[object.id] ?? 0;
      const item = el('li', 'logbook-entry');
      item.append(el('h3', undefined, object.name));
      if (tier === 0) {
        item.append(
          el('p', 'logbook-meta', 'Not scanned yet. Select it, fly close, and hold SCAN.'),
        );
      } else {
        item.append(
          el(
            'p',
            'logbook-meta',
            `${typeLabel(object.type)} · ${regionName(object.region)} · ${TIER_LABEL[tier]} scan`,
          ),
          el('p', undefined, object.quick),
        );
        const view = el('button', 'hud-button', `View ${object.name} in space`);
        view.type = 'button';
        view.addEventListener('click', () => {
          dialog.close(); // 'close' handler below returns the game to EXPLORE
          bus.emit('object:selected', { id: object.id });
          bus.emit('camera:focus', { id: object.id });
        });
        item.append(view);
      }
      list.append(item);
    }
  }

  close.addEventListener('click', () => dialog.close());
  // Closing (button, Escape key, or "View in space") always returns the game to EXPLORE.
  dialog.addEventListener('close', () => {
    if (machine.state === 'LOGBOOK') machine.transition('EXPLORE');
  });

  const offState = bus.on('state:changed', ({ to }) => {
    if (to === 'LOGBOOK') {
      render();
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  });
  const offProgress = bus.on('progress:changed', () => dialog.open && render());

  return () => {
    offState();
    offProgress();
    dialog.remove();
  };
}
