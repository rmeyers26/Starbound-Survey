// The info panel: shows the selected object's Quick facts and Advanced data.
// Desktop: a panel at the side. Phones: a bottom sheet (CSS media query decides which).
// It listens to the event bus; it never talks to the 3D view directly.
import type { EventBus, GameEvents } from '../game/events';
import { firstRankForTier } from '../game/ranks';
import { TIER_LABEL, splitByTier } from '../game/tiers';
import { VISUALS } from '../engine/scale';
import type { CelestialObject } from '../game/types';
import type { SaveRecord } from '../save/schema';
import {
  IMAGE_TYPE_DESCRIPTION,
  IMAGE_TYPE_LABEL,
  formatMeasurement,
  regionName,
  typeLabel,
} from './format';
import { el } from './dom';
import { speedNote } from './format';
import { sheetAction } from './sheetGesture';

type TabName = 'quick' | 'advanced';

export function createInfoPanel(
  container: HTMLElement,
  objects: CelestialObject[],
  bus: EventBus<GameEvents>,
  getRecord: () => SaveRecord,
): () => void {
  const byId = new Map(objects.map((o) => [o.id, o]));

  const panel = el('aside', 'info-panel');
  panel.setAttribute('aria-label', 'Object information');
  panel.hidden = true;

  // Handle (phones only; hidden by CSS on desktop). Tap or swipe it to expand/collapse.
  const handle = el('button', 'sheet-handle');
  handle.type = 'button';
  handle.setAttribute('aria-label', 'Expand or collapse details');
  handle.setAttribute('aria-expanded', 'false');
  handle.append(el('span', 'sheet-handle-bar'));

  const header = el('header', 'info-header');
  const title = el('h2', 'info-title');
  title.id = 'info-title';
  const badge = el('span', 'badge');
  const close = el('button', 'info-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close information panel');
  header.append(title, badge, close);

  const tablist = el('div', 'tabs');
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Information level');
  const tabs: Record<TabName, HTMLButtonElement> = {
    quick: el('button', 'tab', 'Quick facts'),
    advanced: el('button', 'tab', 'Advanced data'),
  };
  const panes: Record<TabName, HTMLElement> = {
    quick: el('div', 'pane'),
    advanced: el('div', 'pane'),
  };
  for (const name of ['quick', 'advanced'] as const) {
    const tab = tabs[name];
    tab.type = 'button';
    tab.id = `tab-${name}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `pane-${name}`);
    panes[name].id = `pane-${name}`;
    panes[name].setAttribute('role', 'tabpanel');
    panes[name].setAttribute('aria-labelledby', `tab-${name}`);
    tablist.append(tab);
  }

  const SCALE_NOTE =
    'Sizes and distances in the 3D view are compressed so everything fits. The values here are real.';
  const scaleNote = el('p', 'scale-note', SCALE_NOTE);
  panel.append(handle, header, tablist, panes.quick, panes.advanced, scaleNote);

  // A hidden live region: screen readers announce changes politely without moving focus.
  const live = el('div', 'visually-hidden');
  live.setAttribute('aria-live', 'polite');
  container.append(panel, live);

  function showTab(name: TabName, moveFocus = false): void {
    for (const key of ['quick', 'advanced'] as const) {
      const active = key === name;
      tabs[key].setAttribute('aria-selected', String(active));
      tabs[key].tabIndex = active ? 0 : -1; // only the active tab is in the Tab key order
      panes[key].hidden = !active;
    }
    if (moveFocus) tabs[name].focus();
  }

  function setExpanded(expanded: boolean): void {
    panel.classList.toggle('expanded', expanded);
    handle.setAttribute('aria-expanded', String(expanded));
    container.classList.toggle('sheet-expanded', expanded); // lets CSS hide the camera buttons
  }

  function render(object: CelestialObject): void {
    title.textContent = object.name;
    badge.textContent = IMAGE_TYPE_LABEL[object.imageType];
    badge.title = IMAGE_TYPE_DESCRIPTION[object.imageType];
    // If this orbit is drawn at a different speed from the real one, say so (honest science).
    const real = object.data.orbitalPeriod?.value;
    const shown = VISUALS[object.id]?.visualPeriodDays;
    const speed = typeof real === 'number' && shown !== undefined ? speedNote(real, shown) : null;
    scaleNote.textContent = speed ? `${SCALE_NOTE} ${speed}` : SCALE_NOTE;

    panes.quick.replaceChildren(
      el('p', 'quick-text', object.quick),
      el('p', 'meta', `${typeLabel(object.type)} · ${regionName(object.region)}`),
    );

    renderAdvanced(object);
  }

  /** Advanced tab: only the measurements this object's scans have revealed (spec: layered results). */
  function renderAdvanced(object: CelestialObject): void {
    const tier = getRecord().scannedObjects[object.id] ?? 0;
    const { unlocked, locked } = splitByTier(object, tier);

    if (tier === 0) {
      panes.advanced.replaceChildren(
        el(
          'p',
          'locked-note',
          'Scan this object to reveal its measurements. Fly close, then hold SCAN.',
        ),
      );
      return;
    }

    const list = el('dl', 'data-list');
    for (const measurement of unlocked) {
      const row = el('div', 'data-row');
      row.append(
        el('dt', undefined, measurement.label),
        el('dd', undefined, formatMeasurement(measurement)),
      );
      list.append(row);
    }
    panes.advanced.replaceChildren(list);
    if (locked.length > 0) {
      const next = tier + 1;
      panes.advanced.append(
        el(
          'p',
          'locked-note',
          `${locked.length} more measurement${locked.length === 1 ? '' : 's'} locked. A ${TIER_LABEL[next]} scan unlocks at the ${firstRankForTier(next).name} rank.`,
        ),
      );
    }
    panes.advanced.append(el('p', 'source', `Source: ${object.source}`));
  }

  let currentId: string | null = null;

  function open(object: CelestialObject): void {
    currentId = object.id;
    render(object);
    showTab('quick');
    setExpanded(false);
    panel.hidden = false;
    container.classList.add('panel-open'); // lets CSS keep the SCAN button above the phone sheet
    live.textContent = `Selected ${object.name}`;
  }

  function hide(): void {
    currentId = null;
    container.classList.remove('panel-open');
    panel.hidden = true;
    setExpanded(false);
    live.textContent = 'Selection cleared';
  }

  // ---- wiring -------------------------------------------------------------------------

  const unsubscribe = bus.on('object:selected', ({ id }) => {
    const object = id ? byId.get(id) : undefined;
    if (object) open(object);
    else hide();
  });

  // A finished scan unlocks data: refresh the open panel so it appears immediately.
  const offProgress = bus.on('progress:changed', () => {
    const object = currentId ? byId.get(currentId) : undefined;
    if (object) renderAdvanced(object);
  });

  close.addEventListener('click', () => bus.emit('object:selected', { id: null }));

  for (const name of ['quick', 'advanced'] as const) {
    tabs[name].addEventListener('click', () => showTab(name));
  }
  // Arrow keys move between tabs (standard accessible tab behaviour).
  tablist.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      showTab(e.key === 'ArrowRight' ? 'advanced' : 'quick', true);
      e.preventDefault();
    }
  });

  // Handle: tap toggles; swiping up expands (and shows Advanced data); swiping down collapses.
  let startY: number | null = null;
  handle.addEventListener('pointerdown', (e) => {
    startY = e.clientY;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointerup', (e) => {
    if (startY === null) return;
    const action = sheetAction(e.clientY - startY);
    startY = null;
    if (action === 'toggle') setExpanded(!panel.classList.contains('expanded'));
    else if (action === 'expand') setExpanded(true);
    else if (action === 'collapse') setExpanded(false);
  });
  handle.addEventListener('pointercancel', () => {
    startY = null;
  });
  // Keyboard users press Enter/Space on the handle: that fires `click` with no pointer events.
  handle.addEventListener('click', (e) => {
    if (e.detail === 0) setExpanded(!panel.classList.contains('expanded'));
  });

  return () => {
    unsubscribe();
    offProgress();
    panel.remove();
    live.remove();
  };
}
