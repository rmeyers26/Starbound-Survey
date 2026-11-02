// A small on-screen frame-rate readout, for testing on real phones (spec: testing log needs FPS).
// Shown only when the "Show FPS" setting is on.
import type { EventBus, GameEvents } from '../game/events';
import { PROFILES } from '../engine/profiles';
import { el } from './dom';

export function createFpsReadout(
  container: HTMLElement,
  bus: EventBus<GameEvents>,
  initiallyVisible: boolean,
): () => void {
  const box = el('div', 'fps-readout');
  box.hidden = !initiallyVisible;
  box.setAttribute('aria-hidden', 'true'); // decorative debug info: keep screen readers quiet
  container.append(box);

  const offSample = bus.on('quality:sample', ({ fps, profile, resolutionScale, renderer }) => {
    box.textContent = `${Math.round(fps)} fps · ${PROFILES[profile].label} ${Math.round(resolutionScale * 100)}% · ${renderer}`;
  });
  const offSettings = bus.on('settings:changed', ({ settings }) => {
    box.hidden = !settings.showFps;
  });

  return () => {
    offSample();
    offSettings();
    box.remove();
  };
}
