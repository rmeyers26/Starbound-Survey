// The four spacecraft camera views, and the speed-based warp streaks.
import { describe, expect, it } from 'vitest';
import { CRUISE_WARP_FULL, CRUISE_WARP_START, cruiseWarp } from '../../src/engine/effects';
import { forwardVector, length, vec } from '../../src/engine/flight';
import {
  CHASE_BACK,
  MAP_HEIGHT,
  MAX_VIEW_SCALE,
  MIN_VIEW_SCALE,
  SHIP_VIEWS,
  SHIP_VIEW_LABELS,
  cameraPoseFor,
  isShipView,
  nextShipView,
  shipModelScale,
  type ShipView,
} from '../../src/engine/shipViews';

const ship = { position: vec(10, 2, -30), yaw: 0.8, pitch: 0.2 };
const dot = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  a.x * b.x + a.y * b.y + a.z * b.z;
const minus = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  vec(a.x - b.x, a.y - b.y, a.z - b.z);

describe('choosing a view', () => {
  it('there are five views, each with a label', () => {
    expect([...SHIP_VIEWS]).toEqual(['chase', 'cockpit', 'orbit', 'map', 'cinematic']);
    for (const view of SHIP_VIEWS) expect(SHIP_VIEW_LABELS[view].length).toBeGreaterThan(0);
  });

  it('the V key cycles through every view and comes back to the start', () => {
    const seen = [];
    let view: ShipView = SHIP_VIEWS[0];
    for (let i = 0; i < SHIP_VIEWS.length; i++) {
      seen.push(view);
      view = nextShipView(view);
    }
    expect(seen).toEqual([...SHIP_VIEWS]);
    expect(view).toBe(SHIP_VIEWS[0]);
  });

  it('only real view names are accepted (so a bad value from outside is ignored)', () => {
    expect(isShipView('chase')).toBe(true);
    expect(isShipView('sideways')).toBe(false);
    expect(isShipView(undefined)).toBe(false);
    expect(isShipView(3)).toBe(false);
  });
});

describe('camera poses', () => {
  const forward = forwardVector(ship.yaw, ship.pitch);

  it('chase sits BEHIND the ship (and a little above) and looks ahead of it', () => {
    const pose = cameraPoseFor('chase', ship);
    const fromShip = minus(pose.position, ship.position);
    expect(dot(fromShip, forward)).toBeLessThan(0); // behind
    expect(pose.position.y).toBeGreaterThan(ship.position.y - CHASE_BACK * forward.y);
    expect(dot(minus(pose.lookAt, ship.position), forward)).toBeGreaterThan(0); // looks ahead
  });

  it("cockpit is at the ship's nose, in front of its centre", () => {
    const pose = cameraPoseFor('cockpit', ship);
    expect(dot(minus(pose.position, ship.position), forward)).toBeGreaterThan(0);
    expect(length(minus(pose.position, ship.position))).toBeLessThan(1);
  });

  it('map is straight above the ship, looking down at it, with the heading pointing up the screen', () => {
    const pose = cameraPoseFor('map', ship);
    expect(pose.position.x).toBeCloseTo(ship.position.x);
    expect(pose.position.z).toBeCloseTo(ship.position.z);
    expect(pose.position.y).toBeCloseTo(ship.position.y + MAP_HEIGHT);
    expect(pose.lookAt).toEqual(ship.position);
    expect(length(pose.up)).toBeCloseTo(1);
    expect(pose.up.y).toBeCloseTo(0);
    // The screen's "up" is the ship's heading flattened onto the plane.
    const flat = Math.hypot(forward.x, forward.z);
    expect(pose.up.x).toBeCloseTo(forward.x / flat);
    expect(pose.up.z).toBeCloseTo(forward.z / flat);
  });

  it('map still works when the nose points straight up (no heading to follow, so it picks one)', () => {
    const pose = cameraPoseFor('map', { ...ship, pitch: Math.PI / 2 });
    expect(Number.isFinite(pose.up.x + pose.up.y + pose.up.z)).toBe(true);
    expect(length(pose.up)).toBeCloseTo(1);
  });

  it('zooming scales the chase and map distances, within limits', () => {
    const near = length(minus(cameraPoseFor('chase', ship, 0.5).position, ship.position));
    const normal = length(minus(cameraPoseFor('chase', ship, 1).position, ship.position));
    const far = length(minus(cameraPoseFor('chase', ship, 3).position, ship.position));
    expect(near).toBeLessThan(normal);
    expect(normal).toBeLessThan(far);
    const tooFar = length(minus(cameraPoseFor('map', ship, 1000).position, ship.position));
    expect(tooFar).toBeCloseTo(MAP_HEIGHT * MAX_VIEW_SCALE);
    const tooNear = length(minus(cameraPoseFor('map', ship, 0).position, ship.position));
    expect(tooNear).toBeCloseTo(MAP_HEIGHT * MIN_VIEW_SCALE);
  });
});

describe('the ship model size', () => {
  it('is life-size up close and in the cockpit, and grows with distance so it is not a speck on the map', () => {
    expect(shipModelScale('chase', 3)).toBe(1);
    expect(shipModelScale('cockpit', 500)).toBe(1);
    expect(shipModelScale('map', MAP_HEIGHT)).toBeGreaterThan(3);
    expect(shipModelScale('orbit', 120)).toBeGreaterThan(shipModelScale('orbit', 30));
    expect(shipModelScale('map', Number.NaN)).toBe(1);
  });
});

describe('warp streaks while piloting', () => {
  it('none when slow, full when fast, and smooth in between', () => {
    expect(cruiseWarp(0, false)).toBe(0);
    expect(cruiseWarp(CRUISE_WARP_START, false)).toBe(0);
    expect(cruiseWarp(CRUISE_WARP_FULL, false)).toBe(1);
    expect(cruiseWarp(1000, false)).toBe(1);
    const middle = cruiseWarp((CRUISE_WARP_START + CRUISE_WARP_FULL) / 2, false);
    expect(middle).toBeGreaterThan(0.4);
    expect(middle).toBeLessThan(0.6);
  });

  it('none in reverse, none with Reduce motion, and never NaN', () => {
    expect(cruiseWarp(-30, false)).toBe(0);
    expect(cruiseWarp(45, true)).toBe(0);
    expect(cruiseWarp(Number.NaN, false)).toBe(0);
    expect(cruiseWarp(Number.POSITIVE_INFINITY, false)).toBe(0);
  });
});
