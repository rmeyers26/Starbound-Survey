import { describe, expect, it } from 'vitest';
import { pickTextureUrl, textureUrlFor } from '../../src/engine/textures';

// A pretend `assets/textures/` folder (the real one may be empty).
const files = {
  '../../assets/textures/moon-1k.jpg': '/assets/moon-1k-aaa.jpg',
  '../../assets/textures/moon-2k.jpg': '/assets/moon-2k-bbb.jpg',
  '../../assets/textures/earth-1k.webp': '/assets/earth-1k-ccc.webp',
};

describe('pickTextureUrl', () => {
  it('returns the requested size when it exists', () => {
    expect(pickTextureUrl(files, 'moon', 2048)).toBe('/assets/moon-2k-bbb.jpg');
    expect(pickTextureUrl(files, 'moon', 1024)).toBe('/assets/moon-1k-aaa.jpg');
  });

  it('falls back to the other size when the requested one is missing', () => {
    expect(pickTextureUrl(files, 'earth', 2048)).toBe('/assets/earth-1k-ccc.webp');
  });

  it('returns null for a body with no texture, so the game keeps its flat colour', () => {
    expect(pickTextureUrl(files, 'sun', 1024)).toBeNull();
  });

  it('does not confuse bodies whose names start the same way', () => {
    expect(
      pickTextureUrl({ '../../assets/textures/moonlet-1k.jpg': '/x.jpg' }, 'moon', 1024),
    ).toBeNull();
  });

  it('returns null for an empty folder', () => {
    expect(pickTextureUrl({}, 'moon', 1024)).toBeNull();
  });
});

describe('textureUrlFor (the real assets folder)', () => {
  it('never throws, whether or not images have been added yet', () => {
    expect(() => textureUrlFor('moon', 1024)).not.toThrow();
  });
});
