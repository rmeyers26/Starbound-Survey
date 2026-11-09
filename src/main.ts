// Entry point: the first file the browser runs.
import './style.css';
// `?url` gives us the file's web address instead of bundling its contents, so it is fetched at
// runtime. That lets us handle a failed load with a Retry button, as the spec requires.
import missionsUrl from '../data/missions.json?url';
import objectsUrl from '../data/objects.json?url';
import { startApp } from './app';
import { log } from './engine/log';
import { loadMissions, loadObjects } from './game/dataLoader';
import type { Mission } from './game/missions';
import { showErrorScreen } from './ui/errorScreen';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app container in index.html'); // fail loudly in development

async function start(container: HTMLElement): Promise<void> {
  container.textContent = 'Loading...';
  try {
    const objects = await loadObjects(objectsUrl);
    // The game works without missions, so a problem with the missions file is logged, not fatal. (A test checks
    // that the real file is valid, so this only happens if the file could not be fetched.)
    const missions: Mission[] = await loadMissions(missionsUrl, objects).catch((error) => {
      log('Missions could not be loaded; continuing without them', error);
      return [];
    });
    container.replaceChildren(); // remove the "Loading..." text
    await startApp(container, objects, missions);
  } catch (error) {
    log('Startup failed', error);
    container.replaceChildren();
    const message = error instanceof Error ? error.message : 'Unknown error';
    showErrorScreen(container, message, () => void start(container));
  }
}

void start(app);
