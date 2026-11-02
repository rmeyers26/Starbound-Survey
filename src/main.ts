// Entry point: the first file the browser runs.
import './style.css';
// `?url` gives us the file's web address instead of bundling its contents, so it is fetched at
// runtime. That lets us handle a failed load with a Retry button, as the spec requires.
import objectsUrl from '../data/objects.json?url';
import { log } from './engine/log';
import { WebGLView } from './engine/webglView';
import { loadObjects } from './game/dataLoader';
import { EventBus, type GameEvents } from './game/events';
import { showErrorScreen } from './ui/errorScreen';
import { createHud } from './ui/hud';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app container in index.html'); // fail loudly in development

async function start(container: HTMLElement): Promise<void> {
  container.textContent = 'Loading...';
  try {
    const objects = await loadObjects(objectsUrl);
    container.replaceChildren(); // remove the "Loading..." text
    const bus = new EventBus<GameEvents>();
    const view = new WebGLView({
      host: container,
      objects,
      bus,
      quality: { pixelRatioCap: 2, resolutionScale: 1, starCount: 2500 },
    });
    createHud(container, objects, bus);
    view.start();
  } catch (error) {
    log('Startup failed', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    showErrorScreen(container, message, () => void start(container));
  }
}

void start(app);
