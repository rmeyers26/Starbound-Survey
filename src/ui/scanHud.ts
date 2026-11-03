// The SCAN control, its status line, and the XP / rank bar.
// Controls only announce "start" and "stop" on the event bus; the scan controller decides what happens.
import type { EventBus, GameEvents } from '../game/events';
import { progressToNextRank } from '../game/ranks';
import { SCAN_BLOCK_MESSAGE } from '../game/scanner';
import type { Settings } from '../game/settings';
import { TIER_LABEL } from '../game/tiers';
import type { CelestialObject } from '../game/types';
import type { SaveRecord } from '../save/schema';
import { formatNumber } from './format';
import { el } from './dom';

const STATUS_CLEAR_MS = 4000;

/** Elements where pressing Space must keep its normal meaning (typing, buttons, tabs, menus). */
function spaceBelongsToControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('.scan-button')) return false; // the scan button handles Space itself
  if (document.querySelector('dialog[open]')) return true; // a modal is open: leave Space alone
  return (
    target.closest('input, select, textarea, button, a, [role="tab"], [role="button"]') !== null
  );
}

export function createScanHud(
  container: HTMLElement,
  bus: EventBus<GameEvents>,
  objects: CelestialObject[],
  getSettings: () => Settings,
): () => void {
  const nameOf = (id: string): string => objects.find((o) => o.id === id)?.name ?? id;

  const hud = el('div', 'scan-hud');
  const status = el('p', 'scan-status');
  status.id = 'scan-status';
  status.setAttribute('role', 'status'); // screen readers announce changes politely

  const ring = el('div', 'scan-ring');
  const button = el('button', 'scan-button');
  button.type = 'button';
  ring.append(button);
  hud.append(status, ring);
  container.append(hud);

  // Accessibility: the button's NAME is its visible text ("Hold to SCAN"), so voice control ("click
  // Hold to SCAN") works. The longer instructions are a hidden DESCRIPTION read after the name.
  const hint = el('span', 'visually-hidden');
  hint.id = 'scan-hint';
  hud.append(hint);
  button.setAttribute('aria-describedby', 'scan-hint scan-status');

  const setLabel = (): void => {
    const hold = getSettings().scanMode === 'hold';
    button.textContent = hold ? 'Hold to SCAN' : 'Tap to SCAN';
    hint.textContent = hold
      ? 'Scans the selected object. Press and hold this button, or hold the Space key, until the ring fills.'
      : 'Scans the selected object. Press this button once; press it again to cancel.';
  };
  setLabel();

  let clearTimer: number | undefined;
  const say = (message: string, stickyWhileScanning = false): void => {
    window.clearTimeout(clearTimer);
    status.textContent = message;
    if (!stickyWhileScanning)
      clearTimer = window.setTimeout(() => (status.textContent = ''), STATUS_CLEAR_MS);
  };
  const setProgress = (value: number): void => {
    ring.style.setProperty('--scan-progress', String(value));
    button.toggleAttribute('data-scanning', value > 0);
  };

  // ---- pressing the button ------------------------------------------------------------
  let pressed = false;
  const press = (): void => {
    if (pressed) return;
    pressed = true;
    bus.emit('scan:request', { action: 'start' });
  };
  const release = (): void => {
    if (!pressed) return;
    pressed = false;
    bus.emit('scan:request', { action: 'stop' });
  };

  button.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    button.setPointerCapture(e.pointerId); // keep the press even if the finger slides off the button
    press();
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  button.addEventListener('contextmenu', (e) => e.preventDefault()); // phones show a menu on long-press
  button.addEventListener('blur', release);
  button.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault(); // stop the browser turning the key press into a click
    if (!e.repeat) press();
  });
  button.addEventListener('keyup', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    release();
  });

  // Spec: "hold the SCAN button or Space to scan". Works from the 3D view without focusing the button.
  const onDocKeyDown = (e: KeyboardEvent): void => {
    if (e.code !== 'Space' || spaceBelongsToControl(e.target)) return;
    e.preventDefault(); // otherwise Space would scroll the page
    if (!e.repeat) press();
  };
  const onDocKeyUp = (e: KeyboardEvent): void => {
    if (e.code !== 'Space' || spaceBelongsToControl(e.target)) return;
    release();
  };
  document.addEventListener('keydown', onDocKeyDown);
  document.addEventListener('keyup', onDocKeyUp);

  // ---- reacting to the game ---------------------------------------------------------------
  const offs = [
    bus.on('scan:progress', ({ id, progress }) => {
      setProgress(progress);
      say(`Scanning ${nameOf(id)}…`, true);
    }),
    bus.on('scan:completed', ({ id, tier, xpAwarded }) => {
      setProgress(0);
      const reward = getSettings().practiceMode
        ? ' Practice scan: no XP.'
        : xpAwarded > 0
          ? ` +${xpAwarded} XP`
          : '';
      say(`${TIER_LABEL[tier] ?? 'Scan'} scan of ${nameOf(id)} complete.${reward}`);
    }),
    bus.on('scan:cancelled', () => {
      setProgress(0);
      say('Scan cancelled.');
    }),
    bus.on('scan:blocked', ({ reason }) => say(SCAN_BLOCK_MESSAGE[reason])),
    bus.on('settings:changed', setLabel),
  ];

  return () => {
    offs.forEach((off) => off());
    document.removeEventListener('keydown', onDocKeyDown);
    document.removeEventListener('keyup', onDocKeyUp);
    window.clearTimeout(clearTimer);
    hud.remove();
  };
}

/** Rank name, a progress bar toward the next rank, and the XP numbers. */
export function createXpBar(
  container: HTMLElement,
  bus: EventBus<GameEvents>,
  getRecord: () => SaveRecord,
  /** True in practice mode: the bar says so instead of showing XP. */
  isPractice: () => boolean = () => false,
): () => void {
  const bar = el('div', 'xp-bar');
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Rank and experience');
  const rank = el('span', 'xp-rank');
  const track = el('div', 'xp-track');
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-label', 'Progress to the next rank');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  const fill = el('div', 'xp-fill');
  track.append(fill);
  const text = el('span', 'xp-text');
  bar.append(rank, track, text);

  // Sits in the HUD's status column, under the "Not to scale" note.
  (container.querySelector('.hud-status') ?? container).append(bar);

  const render = (): void => {
    bar.classList.toggle('xp-bar--practice', isPractice());
    if (isPractice()) {
      // No XP is earned in practice mode, so show that plainly (a full bar and no numbers to chase).
      rank.textContent = 'Practice';
      fill.style.width = '100%';
      track.setAttribute('aria-valuenow', '100');
      text.textContent = 'Everything unlocked, no XP';
      return;
    }
    const { xp } = getRecord();
    const p = progressToNextRank(xp);
    rank.textContent = p.rank.name;
    const percent = Math.round(p.fraction * 100);
    fill.style.width = `${percent}%`;
    track.setAttribute('aria-valuenow', String(percent));
    text.textContent = p.next
      ? `${formatNumber(xp)} / ${formatNumber(p.next.xp)} XP`
      : `${formatNumber(xp)} XP (top rank)`;
  };
  render();

  const offs = [
    bus.on('xp:changed', render),
    bus.on('progress:changed', render),
    bus.on('settings:changed', render), // practice mode can be switched on or off
  ];
  return () => {
    offs.forEach((off) => off());
    bar.remove();
  };
}
