// The "Your progress" block inside Settings: progress summary, storage status, export / import.
import type { EventBus, GameEvents } from '../game/events';
import { countInspected } from '../game/progress';
import { unlockedObjects } from '../game/regions';
import type { CelestialObject } from '../game/types';
import type { SaveService } from '../save/saveService';
import { SaveError } from '../save/schema';
import { el } from './dom';
import type { Toaster } from './toast';

/** Starts a file download in the browser from text. */
function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = el('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke later: revoking immediately can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function createSaveSection(
  service: SaveService,
  objects: CelestialObject[],
  bus: EventBus<GameEvents>,
  toaster: Toaster,
): { element: HTMLElement; dispose: () => void } {
  const section = el('section', 'settings-section');
  section.append(el('h3', undefined, 'Your progress'));

  const summary = el('p');
  summary.id = 'progress-summary';
  const storage = el('p');
  storage.id = 'storage-status';

  const buttons = el('div', 'settings-buttons');
  const exportButton = el('button', 'hud-button', 'Export backup');
  exportButton.type = 'button';
  const importButton = el('button', 'hud-button', 'Import backup');
  importButton.type = 'button';
  const fileInput = el('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.hidden = true;
  fileInput.setAttribute('aria-label', 'Choose a backup file to import');
  buttons.append(exportButton, importButton, fileInput);
  section.append(summary, storage, buttons);

  const nameOf = new Map(objects.map((o) => [o.id, o.name]));

  function refresh(): void {
    const record = service.current;
    const ids = unlockedObjects(objects, record).map((o) => o.id); // locked objects are not counted
    const seen = ids.filter((id) => (record.inspectedObjects[id] ?? 0) > 0);
    summary.textContent =
      `Objects inspected: ${countInspected(record, ids)} of ${ids.length}` +
      (seen.length > 0 ? ` (${seen.map((id) => nameOf.get(id)).join(', ')})` : '');
  }

  function setStorageText(persisted: boolean | null): void {
    if (!service.durable) {
      storage.textContent =
        'This browser cannot keep saved data (private browsing?). Progress is lost when you close the tab. Export a backup to keep it.';
    } else if (persisted === false) {
      storage.textContent =
        'Saved on this device. The browser may clear it if the device is low on space or unused for a long time, so export a backup now and then. Adding the game to your Home Screen helps.';
    } else {
      storage.textContent = 'Saved on this device.';
    }
  }

  exportButton.addEventListener('click', () => {
    const day = new Date().toISOString().slice(0, 10);
    downloadText(`starbound-survey-backup-${day}.json`, service.exportJson());
    toaster.show('Backup file saved. Keep it somewhere safe.');
  });
  importButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = ''; // so choosing the same file again still triggers `change`
    if (!file) return;
    try {
      const record = await service.importJson(await file.text());
      bus.emit('progress:changed', { record });
      toaster.show('Backup restored.');
    } catch (error) {
      const reason = error instanceof SaveError ? error.message : 'Unknown error';
      toaster.show(`Could not restore that file. Your current progress is unchanged. (${reason})`, {
        durationMs: 12_000,
      });
    }
  });

  refresh();
  setStorageText(null);
  void service.requestPersistence().then((persisted) => setStorageText(persisted));

  const offProgress = bus.on('progress:changed', refresh);
  const offOpen = bus.on('settings:open', refresh);
  return {
    element: section,
    dispose: () => {
      offProgress();
      offOpen();
    },
  };
}
