// The info panel: shows the selected object's Quick facts and Advanced data.
// Desktop: a panel at the side. Phones: a bottom sheet (CSS media query decides which).
// It listens to the event bus; it never talks to the 3D view directly.
import type { EventBus, GameEvents } from '../game/events';
import type { CelestialObject } from '../game/types';
import {
  IMAGE_TYPE_DESCRIPTION,
  IMAGE_TYPE_LABEL,
  formatMeasurement,
  regionName,
  typeLabel,
} from './format';
import { sheetAction } from './sheetGesture';

type TabName = 'quick' | 'advanced';

/** Small helper: create an element with optional class and text. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // textContent (not innerHTML) = no HTML injection
  return node;
}

export function createInfoPanel(
  container: HTMLElement,
  objects: CelestialObject[],
  bus: EventBus<GameEvents>,
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

  const scaleNote = el(
    'p',
    'scale-note',
    'Sizes and distances in the 3D view are compressed so everything fits. The values here are real.',
  );
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

    panes.quick.replaceChildren(
      el('p', 'quick-text', object.quick),
      el('p', 'meta', `${typeLabel(object.type)} · ${regionName(object.region)}`),
    );

    const list = el('dl', 'data-list');
    for (const measurement of Object.values(object.data)) {
      const row = el('div', 'data-row');
      row.append(
        el('dt', undefined, measurement.label),
        el('dd', undefined, formatMeasurement(measurement)),
      );
      list.append(row);
    }
    panes.advanced.replaceChildren(list, el('p', 'source', `Source: ${object.source}`));
  }

  function open(object: CelestialObject): void {
    render(object);
    showTab('quick');
    setExpanded(false);
    panel.hidden = false;
    live.textContent = `Selected ${object.name}`;
  }

  function hide(): void {
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
    panel.remove();
    live.remove();
  };
}
