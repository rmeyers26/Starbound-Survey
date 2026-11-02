// Surface images ("textures") for the 3D bodies, such as NASA's map of the Moon.
//
// How it works, in plain terms:
//  1. Image files live in `assets/textures/`, named like `moon-1k.jpg` and `moon-2k.jpg`
//     ("1k" = 1024 pixels wide, "2k" = 2048 pixels wide).
//  2. At BUILD time, Vite scans that folder (`import.meta.glob`) and gives us the final web address of
//     every file it finds. If the folder is empty, the list is empty and the game simply keeps its
//     flat-colour planets. No file is ever requested, so there are no 404 errors in the console.
//  3. At run time, the renderer asks for the best texture for the player's graphics profile.
import * as THREE from 'three';
import { log } from './log';

/** Texture widths we ship. Phones use the small one to save memory (spec: "medium textures"). */
export type TextureSize = 1024 | 2048;

const SIZE_SUFFIX: Record<TextureSize, string> = { 1024: '1k', 2048: '2k' };

/** Every texture found in `assets/textures/` at build time: { "../../assets/textures/moon-2k.jpg": "/assets/moon-2k-ab12.jpg" } */
const BUNDLED_TEXTURES = import.meta.glob('../../assets/textures/*.{jpg,jpeg,webp,png}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Turns "../../assets/textures/moon-2k.jpg" into "moon-2k". */
function baseName(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.[^.]+$/, '');
}

/**
 * Picks the web address of the best texture for a body.
 * Prefers the requested size; falls back to the other size; returns null if the body has no texture.
 *
 * `files` is a parameter (not hard-wired) so unit tests can pass in a pretend folder.
 */
export function pickTextureUrl(
  files: Record<string, string>,
  body: string,
  size: TextureSize,
): string | null {
  const byName = new Map(Object.entries(files).map(([path, url]) => [baseName(path), url]));
  const other: TextureSize = size === 2048 ? 1024 : 2048;
  return (
    byName.get(`${body}-${SIZE_SUFFIX[size]}`) ??
    byName.get(`${body}-${SIZE_SUFFIX[other]}`) ??
    null
  );
}

/** The texture address for a body using the real bundled files. */
export function textureUrlFor(body: string, size: TextureSize): string | null {
  return pickTextureUrl(BUNDLED_TEXTURES, body, size);
}

/**
 * Downloads an image and turns it into a GPU texture.
 * Returns null instead of throwing if anything goes wrong: a missing or broken picture must never
 * stop the game, which just keeps the flat colour.
 */
export async function loadTexture(
  url: string,
  maxAnisotropy: number,
): Promise<THREE.Texture | null> {
  try {
    const texture = await new THREE.TextureLoader().loadAsync(url);
    // The picture's colours are sRGB (what screens show). Telling Three.js stops it looking washed out.
    texture.colorSpace = THREE.SRGBColorSpace;
    // Anisotropic filtering keeps the surface sharp when seen at a slant. 4 is plenty on phones.
    texture.anisotropy = Math.min(4, maxAnisotropy);
    return texture;
  } catch (error) {
    log('Texture failed to load, keeping flat colour:', url, error);
    return null;
  }
}
