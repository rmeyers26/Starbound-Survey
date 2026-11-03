// The spacecraft's surface "photographs": hull plating with panel lines, rivets and markings, solar cells, and crinkled
// gold foil. They are DRAWN with the browser's canvas (no image files to download), and the hull drawing is also used as
// a "bump map": a picture that tells the lighting where the surface is raised or sunken, so panel seams and rivets
// catch the light like real ones.
//
// Without a browser (the unit tests) there is no canvas, so a plain flat texture is returned instead.
import * as THREE from 'three';
import { mulberry32 } from './random';

const hasCanvas = (): boolean => typeof document !== 'undefined';

function flatTexture(r: number, g: number, b: number): THREE.Texture {
  const texture = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

function canvasTexture(canvas: HTMLCanvasElement, colour: boolean): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  if (colour) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function newCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext('2d')!];
}

export interface HullTextures {
  /** The colour: pale plating, panel lines, rivets, soot at the tail, stripes and markings. */
  map: THREE.Texture;
  /** The bumps: panel seams are sunken, rivets are raised. */
  bump: THREE.Texture;
}

const WIDTH = 1024;
const HEIGHT = 512;

/**
 * Lays out the panels: the x positions of the vertical seams and the y positions of the horizontal ones, in uneven
 * widths (real hulls are made of panels of different sizes). Seeded, so the ship looks the same every time.
 */
export function panelGrid(
  width: number,
  height: number,
  seed = 5,
): { columns: number[]; rows: number[] } {
  const random = mulberry32(seed);
  const cuts = (length: number, low: number, high: number): number[] => {
    const out = [0];
    while (out[out.length - 1] < length - low)
      out.push(out[out.length - 1] + low + random() * (high - low));
    out[out.length - 1] = length; // the last panel ends exactly at the edge, so the texture repeats cleanly
    return out;
  };
  return { columns: cuts(width, 70, 150), rows: cuts(height, 44, 96) };
}

export function createHullTextures(): HullTextures {
  if (!hasCanvas()) return { map: flatTexture(215, 219, 224), bump: flatTexture(255, 255, 255) };
  const random = mulberry32(21);
  const { columns, rows } = panelGrid(WIDTH, HEIGHT);
  const [colourCanvas, c] = newCanvas(WIDTH, HEIGHT);
  const [bumpCanvas, b] = newCanvas(WIDTH, HEIGHT);

  // Base: pale grey-white, a little darker toward the tail (the bottom of the picture).
  const base = c.createLinearGradient(0, 0, 0, HEIGHT);
  base.addColorStop(0, '#e9ecef');
  base.addColorStop(1, '#c9ced4');
  c.fillStyle = base;
  c.fillRect(0, 0, WIDTH, HEIGHT);
  b.fillStyle = '#ffffff';
  b.fillRect(0, 0, WIDTH, HEIGHT);

  // Each panel gets its own slight tone, so the plating does not look painted on in one go.
  for (let i = 0; i < columns.length - 1; i++) {
    for (let j = 0; j < rows.length - 1; j++) {
      const shade = (random() - 0.5) * 0.14;
      c.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(20,25,35,${-shade})`;
      c.fillRect(columns[i], rows[j], columns[i + 1] - columns[i], rows[j + 1] - rows[j]);
    }
  }

  // Seams: a dark line with a pale line beside it (a sunken groove catching the light), and rivets along the edges.
  const seam = (x0: number, y0: number, x1: number, y1: number): void => {
    c.strokeStyle = 'rgba(70,78,90,0.85)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.45)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x0 + 2, y0 + 2);
    c.lineTo(x1 + 2, y1 + 2);
    c.stroke();
    b.strokeStyle = '#303030'; // sunken
    b.lineWidth = 4;
    b.beginPath();
    b.moveTo(x0, y0);
    b.lineTo(x1, y1);
    b.stroke();
  };
  for (const x of columns.slice(1, -1)) seam(x, 0, x, HEIGHT);
  for (const y of rows.slice(1, -1)) seam(0, y, WIDTH, y);
  const rivet = (x: number, y: number): void => {
    c.fillStyle = 'rgba(120,128,140,0.9)';
    c.beginPath();
    c.arc(x, y, 1.6, 0, Math.PI * 2);
    c.fill();
    b.fillStyle = '#ffffff';
    b.beginPath();
    b.arc(x, y, 2.2, 0, Math.PI * 2);
    b.fill();
  };
  for (const x of columns.slice(1, -1)) for (let y = 8; y < HEIGHT; y += 18) rivet(x + 6, y);
  for (const y of rows.slice(1, -1)) for (let x = 8; x < WIDTH; x += 18) rivet(x, y + 6);

  // Dark nose cone (the radar dome) at the top of the picture, which is the nose end.
  const nose = c.createLinearGradient(0, 0, 0, HEIGHT * 0.16);
  nose.addColorStop(0, '#2e3238');
  nose.addColorStop(1, 'rgba(46,50,56,0)');
  c.fillStyle = nose;
  c.fillRect(0, 0, WIDTH, HEIGHT * 0.16);

  // An orange band and a thin dark line round the widest part (about 62% of the way down from the nose).
  c.fillStyle = '#e8672a';
  c.fillRect(0, HEIGHT * 0.6, WIDTH, HEIGHT * 0.045);
  c.fillStyle = '#23272d';
  c.fillRect(0, HEIGHT * 0.6 + HEIGHT * 0.045, WIDTH, 3);

  // Markings on the side that faces the camera in the chase view: the name and a number.
  c.fillStyle = 'rgba(35,40,48,0.92)';
  c.font = 'bold 34px sans-serif';
  c.textBaseline = 'middle';
  c.fillText('STARBOUND', WIDTH * 0.1, HEIGHT * 0.36);
  c.font = 'bold 22px sans-serif';
  c.fillText('SB-01', WIDTH * 0.1, HEIGHT * 0.46);
  c.fillStyle = '#e8672a';
  c.fillRect(WIDTH * 0.1, HEIGHT * 0.5, 140, 5);

  // Soot and scorching toward the engine end (the bottom), and a few scuffs.
  const soot = c.createLinearGradient(0, HEIGHT * 0.7, 0, HEIGHT);
  soot.addColorStop(0, 'rgba(40,34,30,0)');
  soot.addColorStop(1, 'rgba(40,34,30,0.55)');
  c.fillStyle = soot;
  c.fillRect(0, HEIGHT * 0.7, WIDTH, HEIGHT * 0.3);
  for (let i = 0; i < 70; i++) {
    c.fillStyle = `rgba(60,55,50,${0.04 + random() * 0.07})`;
    c.beginPath();
    c.ellipse(
      random() * WIDTH,
      random() * HEIGHT,
      4 + random() * 20,
      1 + random() * 3,
      random() * Math.PI,
      0,
      Math.PI * 2,
    );
    c.fill();
  }

  return { map: canvasTexture(colourCanvas, true), bump: canvasTexture(bumpCanvas, false) };
}

/** Solar panel cells: a deep blue grid with silver lines. */
export function createSolarTexture(): THREE.Texture {
  if (!hasCanvas()) return flatTexture(20, 40, 110);
  const random = mulberry32(8);
  const [canvas, c] = newCanvas(512, 256);
  const cellsAcross = 16;
  const cellsDown = 8;
  const w = 512 / cellsAcross;
  const h = 256 / cellsDown;
  for (let i = 0; i < cellsAcross; i++) {
    for (let j = 0; j < cellsDown; j++) {
      const lift = random() * 18;
      const cell = c.createLinearGradient(i * w, j * h, (i + 1) * w, (j + 1) * h);
      cell.addColorStop(0, `rgb(${14 + lift},${30 + lift},${96 + lift * 2})`);
      cell.addColorStop(1, `rgb(${8 + lift},${20 + lift},${70 + lift * 2})`);
      c.fillStyle = cell;
      c.fillRect(i * w, j * h, w, h);
      // Fine busbars on each cell.
      c.strokeStyle = 'rgba(120,150,210,0.35)';
      c.lineWidth = 1;
      for (let k = 1; k < 4; k++) {
        c.beginPath();
        c.moveTo(i * w + (k * w) / 4, j * h);
        c.lineTo(i * w + (k * w) / 4, (j + 1) * h);
        c.stroke();
      }
    }
  }
  c.strokeStyle = 'rgba(190,200,225,0.9)';
  c.lineWidth = 2;
  for (let i = 0; i <= cellsAcross; i++) {
    c.beginPath();
    c.moveTo(i * w, 0);
    c.lineTo(i * w, 256);
    c.stroke();
  }
  for (let j = 0; j <= cellsDown; j++) {
    c.beginPath();
    c.moveTo(0, j * h);
    c.lineTo(512, j * h);
    c.stroke();
  }
  return canvasTexture(canvas, true);
}

/** The crumpled look of gold thermal foil, as a bump map (crinkles catch the light at odd angles). */
export function createFoilBump(): THREE.Texture {
  if (!hasCanvas()) return flatTexture(128, 128, 128);
  const random = mulberry32(3);
  const [canvas, c] = newCanvas(256, 256);
  c.fillStyle = '#808080';
  c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 700; i++) {
    const grey = 60 + Math.floor(random() * 140);
    c.fillStyle = `rgba(${grey},${grey},${grey},0.7)`;
    const x = random() * 256;
    const y = random() * 256;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + (random() - 0.5) * 40, y + (random() - 0.5) * 40);
    c.lineTo(x + (random() - 0.5) * 40, y + (random() - 0.5) * 40);
    c.closePath();
    c.fill();
  }
  return canvasTexture(canvas, false);
}
