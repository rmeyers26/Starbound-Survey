// The Settings screen, built on the native <dialog> element: it traps keyboard focus and closes
// with Escape for free, which is better than anything hand-made.
import { PROFILES } from '../engine/profiles';
import type { EventBus, GameEvents } from '../game/events';
import {
  PROFILE_CHOICES,
  SCAN_MODES,
  type ScanMode,
  SENSITIVITY_MAX,
  SENSITIVITY_MIN,
  type ProfileChoice,
  type SettingsStore,
} from '../game/settings';
import { el } from './dom';

const PROFILE_LABEL: Record<ProfileChoice, string> = {
  auto: 'Auto (recommended)',
  high: PROFILES.high.label,
  balanced: PROFILES.balanced.label,
  performance: PROFILES.performance.label,
};

/** A labelled form row: <label> wrapping text + control, so clicking the text focuses the control. */
function row(labelText: string, control: HTMLElement, hint?: string): HTMLLabelElement {
  const label = el('label', 'setting-row');
  label.append(el('span', 'setting-label', labelText), control);
  if (hint) label.append(el('span', 'setting-hint', hint));
  return label;
}

export function createSettingsPanel(
  container: HTMLElement,
  store: SettingsStore,
  bus: EventBus<GameEvents>,
  /** Extra sections (e.g. save/export) appended below the basic settings. */
  extraSections: HTMLElement[] = [],
): () => void {
  const dialog = el('dialog', 'app-dialog settings-dialog');
  dialog.setAttribute('aria-labelledby', 'settings-title');
  const form = el('div', 'settings-body');
  form.append(el('h2', 'settings-title', 'Settings'));
  form.querySelector('h2')!.id = 'settings-title';

  const s = store.get();

  const profile = el('select');
  for (const choice of PROFILE_CHOICES) {
    const option = el('option', undefined, PROFILE_LABEL[choice]);
    option.value = choice;
    profile.append(option);
  }
  profile.value = s.profile;
  profile.addEventListener('change', () =>
    store.update({ profile: profile.value as ProfileChoice }),
  );

  const scanMode = el('select');
  const SCAN_MODE_LABEL: Record<ScanMode, string> = {
    hold: 'Hold the button (default)',
    tap: 'Tap once (no holding)',
  };
  for (const mode of SCAN_MODES) {
    const option = el('option', undefined, SCAN_MODE_LABEL[mode]);
    option.value = mode;
    scanMode.append(option);
  }
  scanMode.value = s.scanMode;
  scanMode.addEventListener('change', () => store.update({ scanMode: scanMode.value as ScanMode }));

  const showFps = el('input');
  showFps.type = 'checkbox';
  showFps.checked = s.showFps;
  showFps.addEventListener('change', () => store.update({ showFps: showFps.checked }));

  const slider = (value: number, onInput: (v: number) => void): HTMLInputElement => {
    const input = el('input');
    input.type = 'range';
    input.min = String(SENSITIVITY_MIN);
    input.max = String(SENSITIVITY_MAX);
    input.step = '0.25';
    input.value = String(value);
    input.addEventListener('input', () => onInput(Number(input.value)));
    return input;
  };
  const rotate = slider(s.rotateSensitivity, (v) => store.update({ rotateSensitivity: v }));
  const zoom = slider(s.zoomSensitivity, (v) => store.update({ zoomSensitivity: v }));

  const reduced = el('input');
  reduced.type = 'checkbox';
  reduced.checked = s.reducedMotion;
  reduced.addEventListener('change', () => store.update({ reducedMotion: reduced.checked }));

  form.append(
    row(
      'Graphics quality',
      profile,
      'Auto picks a level for your device and lowers it if the game runs slowly.',
    ),
    row('Scan control', scanMode, 'Tap once is easier if holding a button is hard.'),
    row('Show frame rate', showFps),
    row('Rotation speed', rotate),
    row('Zoom speed', zoom),
    row(
      'Reduce motion',
      reduced,
      'Camera flights jump instead of gliding. Starts from your device setting.',
    ),
    ...extraSections,
  );

  const close = el('button', 'hud-button settings-close', 'Close');
  close.type = 'button';
  close.addEventListener('click', () => dialog.close());
  form.append(close);

  dialog.append(form);
  container.append(dialog);

  const offOpen = bus.on('settings:open', () => {
    // Re-sync the controls with the store (settings may have been changed elsewhere).
    const now = store.get();
    profile.value = now.profile;
    showFps.checked = now.showFps;
    scanMode.value = now.scanMode;
    rotate.value = String(now.rotateSensitivity);
    zoom.value = String(now.zoomSensitivity);
    reduced.checked = now.reducedMotion;
    if (!dialog.open) dialog.showModal();
  });

  return () => {
    offOpen();
    dialog.remove();
  };
}
