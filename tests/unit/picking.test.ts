import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { hitRadius, pickObject } from '../../src/engine/picking';

const cam = new THREE.Vector3(0, 0, 100);
const rayAt = (x: number, y = 0) =>
  new THREE.Ray(cam.clone(), new THREE.Vector3(x, y, -100).normalize());
const sphere = (id: string, x: number, radius: number) => ({
  id,
  center: new THREE.Vector3(x, 0, 0),
  radius,
});

describe('picking', () => {
  it('hits an object under the ray', () => {
    expect(pickObject(rayAt(0), cam, [sphere('sun', 0, 8)])).toBe('sun');
  });
  it('returns null when nothing is under the ray', () => {
    expect(pickObject(rayAt(0, 80), cam, [sphere('sun', 0, 8)])).toBeNull();
  });
  it('a tiny far-away object still gets a finger-sized hit area', () => {
    const tiny = sphere('moon', 0, 0.1);
    expect(hitRadius(0.1, 200)).toBeGreaterThan(5);
    // Aim 3 units off-centre: a bare 0.1 sphere would miss, the padded hit area catches it.
    expect(pickObject(rayAt(1.5), cam, [tiny])).toBe('moon');
  });
  it('picks the nearer-to-centre object when hit areas overlap', () => {
    const a = sphere('earth', 0, 2);
    const b = sphere('moon', 5, 0.5);
    expect(pickObject(rayAt(4.6), cam, [a, b])).toBe('moon');
    expect(pickObject(rayAt(0.4), cam, [a, b])).toBe('earth');
  });
});
