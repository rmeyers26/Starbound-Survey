// The spacecraft controls: a Pilot button, the four camera views, a steering pad, throttle buttons, the autopilot
// and a readout. Like every other control they only talk to the event bus; the 3D view does the flying.
//
// Hold-to-steer: a button sends "pressed" (1 or -1) when you press it and "released" (0) when you let go, so the
// ship turns for exactly as long as you hold. Keyboard users get the same from the real keys (W A S D, arrows)
// and a short nudge when they activate a button with Enter or Space.
import type { EventBus, GameEvents } from '../game/events';
import type { CelestialObject } from '../game/types';
import { MAX_SPEED } from '../engine/flight';
import { SHIP_VIEWS, SHIP_VIEW_LABELS, type ShipView } from '../engine/shipViews';
import type { PilotStatus } from '../engine/view';
import { el } from './dom';

/** "Speed 12.3 u/s (27% throttle)". Scene units ("u") are the game's made-up distance, not kilometres. */
export function describeSpeed(status: Pick<PilotStatus, 'speed' | 'throttle'>): string {
  const speed = Math.abs(status.speed) < 0.05 ? 0 : status.speed;
  const percent = Math.round(status.throttle * 100);
  const reverse = status.throttle < -0.005 ? ' reverse' : '';
  return `Speed ${speed.toFixed(1)} u/s (${Math.abs(percent)}%${reverse})`;
}

/** "Mars: 34.1 u away" or "Mars: 6.0 u away, in scan range"; null when nothing is selected. */
export function describeTarget(
  status: Pick<PilotStatus, 'targetDistance' | 'inScanRange'>,
  selectedName: string | null,
): string | null {
  if (status.targetDistance === null || selectedName === null) return null;
  const range = status.inScanRange ? ', in scan range' : '';
  return `${selectedName}: ${status.targetDistance.toFixed(1)} u away${range}`;
}

/** How full the speed bar is (0 to 1) for a speed. Exported so the bar and the tests agree. */
export function speedFraction(speed: number): number {
  if (!Number.isFinite(speed)) return 0;
  return Math.min(1, Math.max(0, Math.abs(speed) / MAX_SPEED));
}

const HINT =
  'Keys: W and S speed, A and D (or the left and right arrows) turn, up and down arrows tilt the nose, X stop, V changes view, P leaves the ship.';

export function createPilotPanel(
  container: HTMLElement,
  bus: EventBus<GameEvents>,
  objects: CelestialObject[],
  canPilot: () => boolean,
): () => void {
  const nameOf = (id: string | null): string | null =>
    id === null ? null : (objects.find((o) => o.id === id)?.name ?? id);

  let status: PilotStatus | null = null;
  let selectedId: string | null = null;
  let active = false;
  const timers = new Set<number>();

  const root = el('section', 'pilot');
  root.setAttribute('aria-label', 'Spacecraft');
  root.dataset.active = 'false';

  // ---- the slim bar that is always on screen: the toggle, and (while piloting) the autopilot ----
  const bar = el('div', 'pilot-bar');
  const toggle = el('button', 'hud-button pilot-toggle', 'Pilot ship');
  toggle.type = 'button';
  toggle.setAttribute('aria-pressed', 'false');
  toggle.setAttribute('aria-describedby', 'pilot-hint');
  const unavailable = el('p', 'pilot-unavailable', 'Piloting needs 3D graphics.');
  unavailable.hidden = true;
  toggle.addEventListener('click', () => {
    if (!canPilot()) return;
    bus.emit('pilot:set', { active: !active });
  });

  // ---- shown while piloting ----
  const body = el('div', 'pilot-body');
  body.hidden = true;

  // Camera views: one button each, exactly one pressed.
  const views = el('div', 'pilot-views');
  views.setAttribute('role', 'group');
  views.setAttribute('aria-label', 'Camera view');
  const viewButtons = new Map<ShipView, HTMLButtonElement>();
  for (const view of SHIP_VIEWS) {
    const button = el('button', 'hud-button pilot-view', SHIP_VIEW_LABELS[view]);
    button.type = 'button';
    button.dataset.view = view;
    button.setAttribute('aria-pressed', String(view === 'chase'));
    button.addEventListener('click', () => bus.emit('pilot:view', { view }));
    viewButtons.set(view, button);
    views.append(button);
  }

  /**
   * Makes a button that is "held": pressing sends `value`, releasing sends 0. Keyboard activation (Enter or Space)
   * sends a short nudge instead, because a key press has no "held" for a button.
   */
  const holdButton = (
    label: string,
    ariaLabel: string,
    axis: 'yaw' | 'pitch' | 'throttle',
    value: 1 | -1,
    className = '',
  ): HTMLButtonElement => {
    const button = el('button', `hud-button pilot-hold ${className}`.trim(), label);
    button.type = 'button';
    button.setAttribute('aria-label', ariaLabel);
    button.dataset.axis = axis;
    button.dataset.value = String(value);
    const press = (): void => {
      button.dataset.held = 'true';
      bus.emit('pilot:input', { axis, value });
    };
    const release = (): void => {
      if (button.dataset.held !== 'true') return;
      delete button.dataset.held;
      bus.emit('pilot:input', { axis, value: 0 });
    };
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault(); // no text selection, no long-press menu
      button.setPointerCapture?.(e.pointerId); // keep hearing the release even if the finger slides off
      press();
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('click', (e) => {
      if (e.detail !== 0) return; // a real pointer press already handled it; detail 0 = keyboard
      bus.emit('pilot:input', { axis, value });
      const id = window.setTimeout(() => {
        timers.delete(id);
        bus.emit('pilot:input', { axis, value: 0 });
      }, 250);
      timers.add(id);
    });
    return button;
  };

  // Steering pad: a plus shape. Up and down tilt the nose, left and right turn; the middle stops the ship.
  const pad = el('div', 'pilot-pad');
  pad.setAttribute('role', 'group');
  pad.setAttribute('aria-label', 'Steering');
  const nose = holdButton('▲', 'Nose up', 'pitch', 1, 'pilot-up');
  const left = holdButton('◀', 'Turn left', 'yaw', 1, 'pilot-left');
  const stop = el('button', 'hud-button pilot-stop', 'Stop');
  stop.type = 'button';
  stop.setAttribute('aria-label', 'Stop the ship');
  stop.addEventListener('click', () => bus.emit('pilot:brake', undefined));
  const right = holdButton('▶', 'Turn right', 'yaw', -1, 'pilot-right');
  const down = holdButton('▼', 'Nose down', 'pitch', -1, 'pilot-down');
  pad.append(nose, left, stop, right, down);

  // Throttle: faster above, slower below, with a bar showing the current speed between them.
  const throttle = el('div', 'pilot-throttle');
  throttle.setAttribute('role', 'group');
  throttle.setAttribute('aria-label', 'Speed');
  const faster = holdButton('+', 'Faster', 'throttle', 1, 'pilot-faster');
  const slower = holdButton('−', 'Slower, or reverse', 'throttle', -1, 'pilot-slower');
  const meter = el('div', 'pilot-meter');
  meter.setAttribute('aria-hidden', 'true'); // the numbers below say the same thing in words
  const fill = el('div', 'pilot-meter-fill');
  meter.append(fill);
  throttle.append(faster, meter, slower);

  const row = el('div', 'pilot-row');
  row.append(pad, throttle);

  // Autopilot: fly to whatever is selected. It lives in the bar, so it is still there when the controls are hidden.
  const autopilot = el('button', 'hud-button pilot-autopilot', 'Autopilot');
  autopilot.type = 'button';
  autopilot.hidden = true;
  autopilot.addEventListener('click', () => {
    if (autopilot.getAttribute('aria-disabled') === 'true') {
      setMessage('Select an object first, then press Autopilot to fly there.');
      return;
    }
    if (status?.autopilotId) bus.emit('pilot:autopilot', { id: null });
    else if (selectedId) bus.emit('pilot:autopilot', { id: selectedId });
  });

  const numbers = el('p', 'pilot-numbers');
  const targetLine = el('p', 'pilot-target');
  const message = el('p', 'pilot-message');
  message.setAttribute('role', 'status'); // announced politely; the numbers are deliberately not
  const hint = el('p', 'visually-hidden', HINT);
  hint.id = 'pilot-hint';

  body.append(views, row, numbers, targetLine, message);
  bar.append(toggle, autopilot);
  root.append(bar, unavailable, body, hint);
  container.append(root);

  /** One line of news (arrival, autopilot, advice). While there is one, it replaces the distance line. */
  const setMessage = (text: string): void => {
    message.textContent = text;
    targetLine.hidden = text !== '';
  };

  // ---- keeping the controls in step with the game ----
  const refreshToggle = (): void => {
    const available = canPilot();
    toggle.setAttribute('aria-pressed', String(active));
    toggle.setAttribute('aria-disabled', String(!available));
    toggle.classList.toggle('locked', !available);
    toggle.textContent = active ? 'Leave ship' : 'Pilot ship';
    unavailable.hidden = available;
    body.hidden = !active;
    autopilot.hidden = !active;
    root.dataset.active = String(active);
    // Lets the stylesheet tidy the screen while flying (on phones it hides the top rows of buttons).
    container.classList.toggle('piloting', active);
  };

  const refresh = (): void => {
    refreshToggle();
    if (!status) return;
    for (const [view, button] of viewButtons) {
      button.setAttribute('aria-pressed', String(view === status.view));
    }
    numbers.textContent = describeSpeed(status);
    fill.style.height = `${Math.round(speedFraction(status.speed) * 100)}%`;
    const selectedName = nameOf(selectedId);
    targetLine.textContent = describeTarget(status, selectedName) ?? '';
    // Autopilot button: what it will do right now. Short visible text; the full sentence is the accessible name
    // (and contains the visible words, so voice control works: "click Fly to Mars").
    const flyingTo = nameOf(status.autopilotId);
    const hasTarget = selectedId !== null;
    if (flyingTo) {
      autopilot.textContent = 'Cancel flight';
      autopilot.setAttribute('aria-label', `Cancel flight to ${flyingTo} (autopilot)`);
    } else if (selectedName) {
      autopilot.textContent = `Fly to ${selectedName}`;
      autopilot.setAttribute('aria-label', `Autopilot: fly to ${selectedName}`);
    } else {
      autopilot.textContent = 'Autopilot';
      autopilot.setAttribute('aria-label', 'Autopilot (select an object first)');
    }
    autopilot.setAttribute('aria-disabled', String(!flyingTo && !hasTarget));
    autopilot.setAttribute('aria-pressed', String(flyingTo !== null));
    // Plain-number status for automated tests (not shown to players).
    root.dataset.speed = status.speed.toFixed(1);
    root.dataset.throttle = status.throttle.toFixed(2);
    root.dataset.targetDistance =
      status.targetDistance === null ? '' : status.targetDistance.toFixed(1);
    root.dataset.inRange = String(status.inScanRange);
    root.dataset.autopilot = status.autopilotId ?? '';
    root.dataset.heading = String(status.headingDeg);
  };

  const offStatus = bus.on('pilot:status', (next) => {
    const wasActive = active;
    status = next;
    active = next.active;
    if (wasActive && !active) setMessage('');
    refresh();
  });
  const offSelected = bus.on('object:selected', ({ id }) => {
    selectedId = id;
    setMessage(''); // news about the old selection is out of date
    if (active) refresh();
  });
  const offArrived = bus.on('pilot:arrived', ({ id }) => {
    const name = nameOf(id) ?? 'the destination';
    setMessage(`Arrived at ${name}. Hold SCAN to scan it.`);
  });
  const offRenderer = bus.on('renderer:changed', refreshToggle);
  const offAutopilot = bus.on('pilot:autopilot', ({ id }) => {
    setMessage(id ? `Flying to ${nameOf(id)}…` : 'Autopilot off.');
  });

  // Escape inside the controls leaves the ship (the canvas handles Escape when it has focus).
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && active) {
      e.preventDefault();
      bus.emit('pilot:set', { active: false });
    }
  });
  refreshToggle();

  return () => {
    offStatus();
    offSelected();
    offArrived();
    offRenderer();
    offAutopilot();
    timers.forEach((id) => window.clearTimeout(id));
    container.classList.remove('piloting');
    root.remove();
  };
}
