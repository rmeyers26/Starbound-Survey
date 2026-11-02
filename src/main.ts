// Entry point: the first file the browser runs.
// For now it only proves the toolchain works; later steps add the 3D scene.
import './style.css';
import { log } from './engine/log';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  // Fail loudly during development if index.html is missing the container.
  throw new Error('Missing #app container in index.html');
}

app.textContent = 'Starbound Survey: prototype starting up...';
log('App started');
