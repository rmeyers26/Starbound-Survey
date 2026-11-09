// The Missions screen: each mission's objectives (a checklist worked out from what you have scanned) and, once
// everything is scanned, its final question. It is a native <dialog> and a game STATE (MISSIONS): opening it
// moves the state machine there, which also stops scanning while it is open (same as the Logbook).
//
// Feedback ("Not quite..." / "Correct! +65 XP") appears INSIDE this screen, not as a toast: toasts share two places
// on the screen and would push the rank-up message off.
import type { EventBus, GameEvents } from '../game/events';
import type { MissionController } from '../game/missionController';
import { missionStatus, objectiveProgress, wrongAttempts, type Mission } from '../game/missions';
import type { GameStateMachine } from '../game/stateMachine';
import type { CelestialObject } from '../game/types';
import type { SaveRecord } from '../save/schema';
import { el } from './dom';

export function createMissionsPanel(
  container: HTMLElement,
  missions: Mission[],
  objects: CelestialObject[],
  bus: EventBus<GameEvents>,
  machine: GameStateMachine,
  /** The REAL saved record: missions never use the practice overlay. */
  getRecord: () => SaveRecord,
  controller: MissionController,
  isPractice: () => boolean,
): () => void {
  const dialog = el('dialog', 'app-dialog missions-dialog');
  dialog.setAttribute('aria-labelledby', 'missions-title');
  const body = el('div', 'settings-body');
  const title = el('h2', 'settings-title', 'Missions');
  title.id = 'missions-title';
  const summary = el('p', 'logbook-summary');
  const list = el('ul', 'mission-list');
  const close = el('button', 'hud-button settings-close', 'Close');
  close.type = 'button';
  body.append(title, summary, list, close);
  dialog.append(body);
  container.append(dialog);

  /** What the player was last told about each mission's question (screen only, never saved). */
  const lastResult = new Map<string, { correct: boolean; xp: number }>();
  /** After answering, move keyboard and screen-reader focus to the result so it is read out. */
  let focusResultOf: string | null = null;

  function renderObjectives(mission: Mission, record: SaveRecord): HTMLElement {
    const ul = el('ul', 'mission-objectives');
    for (const p of objectiveProgress(mission, record, objects)) {
      const item = el(
        'li',
        p.done ? 'mission-objective mission-objective--done' : 'mission-objective',
      );
      item.dataset.objectiveId = p.id;
      item.append(
        `${p.done ? '✓' : '☐'} Scan ${p.name}`,
        el('span', 'visually-hidden', p.done ? ' (done)' : ' (not done yet)'),
      );
      ul.append(item);
    }
    return ul;
  }

  function renderQuestion(mission: Mission, record: SaveRecord): HTMLElement {
    const box = el('div', 'mission-question');
    const prompt = el('p', 'mission-prompt', mission.question.prompt);
    prompt.id = `mission-prompt-${mission.id}`;
    const choices = el('div', 'mission-choices');
    choices.setAttribute('role', 'group');
    choices.setAttribute('aria-labelledby', prompt.id);
    mission.question.choices.forEach((text, index) => {
      const button = el('button', 'hud-button mission-choice', text);
      button.type = 'button';
      button.dataset.choice = String(index);
      button.addEventListener('click', () => {
        const outcome = controller.answer(mission.id, index);
        if (!outcome) return;
        lastResult.set(mission.id, { correct: outcome.correct, xp: outcome.xpAwarded });
        focusResultOf = mission.id;
        render();
      });
      choices.append(button);
    });
    box.append(prompt, choices);

    // A wrong answer shows the explanation and costs nothing; the player can try again for a smaller reward.
    const wrong = wrongAttempts(record, mission.id);
    if (wrong > 0) {
      const result = el(
        'p',
        'mission-result mission-result--wrong',
        `Not quite, and that costs nothing. ${mission.question.explanation} Try again.`,
      );
      result.setAttribute('role', 'status');
      result.tabIndex = -1;
      result.dataset.resultFor = mission.id;
      box.append(result);
    }
    return box;
  }

  function renderMission(mission: Mission, record: SaveRecord): HTMLElement {
    const status = missionStatus(mission, record);
    const item = el('li', `mission mission--${status}`);
    item.dataset.missionId = mission.id;
    item.dataset.status = status;
    item.append(el('h3', undefined, mission.title), el('p', 'logbook-meta', mission.summary));

    if (status === 'locked') {
      item.append(
        el('p', undefined, `Reach the rank of ${mission.requiredRank} to start this mission.`),
      );
    } else if (status === 'objectives') {
      item.append(
        renderObjectives(mission, record),
        el(
          'p',
          'logbook-meta',
          'Select each object, fly close, and hold SCAN. The question opens when all are scanned.',
        ),
      );
    } else if (status === 'question') {
      item.append(renderObjectives(mission, record), renderQuestion(mission, record));
    } else {
      const last = lastResult.get(mission.id);
      const done = el(
        'p',
        'mission-result mission-result--correct',
        last?.correct ? `★ Mission complete! You earned ${last.xp} XP.` : '★ Mission complete.',
      );
      done.setAttribute('role', 'status');
      done.tabIndex = -1;
      done.dataset.resultFor = mission.id;
      item.append(
        done,
        el('p', undefined, mission.question.explanation),
        el('p', 'logbook-meta', `Source: ${mission.source}`),
      );
    }
    return item;
  }

  function render(): void {
    list.replaceChildren();
    if (isPractice()) {
      // Practice never changes saved progress, so missions (which award XP) are paused rather than half working.
      summary.textContent =
        'Practice mode is on, so missions are paused: practice never changes your saved progress. Turn it off in Settings to continue.';
      return;
    }
    const record = getRecord();
    const finished = missions.filter((m) => missionStatus(m, record) === 'complete').length;
    summary.textContent = `${finished} of ${missions.length} missions complete.`;
    for (const mission of missions) list.append(renderMission(mission, record));

    if (focusResultOf) {
      const result = list.querySelector<HTMLElement>(`[data-result-for="${focusResultOf}"]`);
      result?.focus();
      focusResultOf = null;
    }
  }

  close.addEventListener('click', () => dialog.close());
  // Closing (button or Escape key) always returns the game to EXPLORE.
  dialog.addEventListener('close', () => {
    if (machine.state === 'MISSIONS') machine.transition('EXPLORE');
  });

  const offOpen = bus.on('missions:open', () => {
    if (machine.state === 'EXPLORE') machine.transition('MISSIONS');
  });
  const offState = bus.on('state:changed', ({ to }) => {
    if (to === 'MISSIONS') {
      render();
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  });
  const offProgress = bus.on('progress:changed', () => dialog.open && render());

  return () => {
    offOpen();
    offState();
    offProgress();
    dialog.remove();
  };
}
