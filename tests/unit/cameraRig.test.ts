import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraRig, FLY_DURATION_S, MAX_DISTANCE } from '../../src/engine/cameraRig';

const origin = new THREE.Vector3(0, 0, 0);

describe('CameraRig', () => {
  it('dragging right turns the camera, dragging down tilts it', () => {
    const rig = new CameraRig();
    const before = rig.getState();
    rig.rotate(100, 0);
    expect(rig.yaw).not.toBe(before.yaw);
    rig.rotate(0, 50);
    expect(rig.pitch).toBeGreaterThan(before.pitch);
  });
  it('never tilts past straight up or down', () => {
    const rig = new CameraRig();
    rig.rotate(0, 1e6);
    expect(rig.pitch).toBeLessThan(Math.PI / 2);
    rig.rotate(0, -2e6);
    expect(rig.pitch).toBeGreaterThan(-Math.PI / 2);
  });
  it('zoom respects the min and max distance', () => {
    const rig = new CameraRig();
    rig.zoomBy(1e-6);
    expect(rig.distance).toBe(rig.minDistance);
    rig.zoomBy(1e9);
    expect(rig.distance).toBe(MAX_DISTANCE);
  });
  it('flyTo reaches its distance exactly after the duration and then stops flying', () => {
    const rig = new CameraRig();
    rig.flyTo(20, 5);
    expect(rig.isFlying).toBe(true);
    rig.update(FLY_DURATION_S / 2, origin);
    expect(rig.distance).toBeLessThan(150);
    expect(rig.distance).toBeGreaterThan(20);
    rig.update(FLY_DURATION_S, origin);
    expect(rig.distance).toBe(20);
    expect(rig.isFlying).toBe(false);
  });
  it('the target glides to a moving object and then stays glued to it', () => {
    const rig = new CameraRig();
    rig.flyTo(20, 5);
    rig.update(FLY_DURATION_S + 1, new THREE.Vector3(60, 0, 0));
    expect(rig.target.x).toBe(60);
    rig.update(0.016, new THREE.Vector3(62, 0, 1));
    expect(rig.target.x).toBe(62);
  });
  it('reduced motion jumps instantly', () => {
    const rig = new CameraRig();
    rig.reducedMotion = true;
    rig.flyTo(20, 5);
    rig.update(0.016, new THREE.Vector3(10, 0, 0));
    expect(rig.isFlying).toBe(false);
    expect(rig.distance).toBe(20);
    expect(rig.target.x).toBe(10);
  });
  it('ignores zoom while flying', () => {
    const rig = new CameraRig();
    rig.flyTo(20, 5);
    const d = rig.distance;
    rig.zoomBy(0.5);
    expect(rig.distance).toBe(d);
  });
  it('flyTo clamps its destination to the new minimum distance', () => {
    const rig = new CameraRig();
    rig.flyTo(1, 3, 0.5);
    rig.update(1, origin);
    expect(rig.distance).toBe(3);
  });
  it('applyTo places the camera at `distance` from the target', () => {
    const rig = new CameraRig();
    const cam = new THREE.PerspectiveCamera();
    rig.update(0, new THREE.Vector3(5, 0, 5));
    rig.applyTo(cam);
    expect(cam.position.distanceTo(rig.target)).toBeCloseTo(rig.distance);
  });
});
