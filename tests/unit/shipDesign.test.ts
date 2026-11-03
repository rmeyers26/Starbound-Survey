// The spacecraft's proportions. The camera views are framed for a ship about this size, so these tests keep the
// design from silently growing or shrinking, and check the curves are smooth (no creases or spikes).
import { describe, expect, it } from 'vitest';
import {
  NAVIGATION_LIGHTS,
  NOSE_Z,
  SHIP_HEIGHT,
  SHIP_LENGTH,
  SHIP_SPAN,
  TAIL_Z,
  blink,
  bellProfile,
  dishProfile,
  finOutline,
  hullProfile,
  hullRadiusAt,
  wingOutline,
} from '../../src/engine/shipDesign';

describe('the fuselage profile', () => {
  const profile = hullProfile(40);

  it('runs from the tail to the nose, over the whole length of the ship', () => {
    expect(profile).toHaveLength(41);
    expect(profile[0].along).toBeCloseTo(-TAIL_Z);
    expect(profile[profile.length - 1].along).toBeCloseTo(-NOSE_Z);
    expect(profile[profile.length - 1].along - profile[0].along).toBeCloseTo(SHIP_LENGTH);
  });

  it('comes to a point at the nose, and has an open engine bay at the tail', () => {
    expect(profile[profile.length - 1].radius).toBeCloseTo(0, 6);
    expect(profile[0].radius).toBeGreaterThan(0.05);
  });

  it("always moves forward along the ship and is never negative or wider than the wings' root", () => {
    for (let i = 1; i < profile.length; i++)
      expect(profile[i].along).toBeGreaterThan(profile[i - 1].along);
    for (const p of profile) {
      expect(p.radius).toBeGreaterThanOrEqual(0);
      expect(p.radius).toBeLessThanOrEqual(0.16);
    }
  });

  it('is smooth: no step in the radius between neighbouring points is a spike or a crease', () => {
    for (let i = 1; i < profile.length; i++) {
      expect(Math.abs(profile[i].radius - profile[i - 1].radius)).toBeLessThan(0.03);
    }
    // And the swelling then narrowing has one widest part, about a fifth of the way from the middle toward the tail.
    const widest = profile.reduce((a, b) => (b.radius > a.radius ? b : a));
    expect(widest.radius).toBeGreaterThan(0.13);
    expect(widest.along).toBeLessThan(0.05);
    expect(widest.along).toBeGreaterThan(-0.2);
  });
});

describe('the other outlines', () => {
  it('the wing is a swept delta that fits inside the allowed span', () => {
    const wing = wingOutline();
    expect(wing.length).toBeGreaterThanOrEqual(4);
    const xs = wing.map(([x]) => x);
    expect(Math.max(...xs) * 2).toBeLessThanOrEqual(SHIP_SPAN + 1e-9);
    // Swept back: the tip is further toward the tail than the root's front edge.
    expect(wing[1][1]).toBeGreaterThan(wing[0][1]);
    // Every point lies between the nose and the tail.
    for (const [, z] of wing) {
      expect(z).toBeGreaterThan(NOSE_Z);
      expect(z).toBeLessThan(TAIL_Z);
    }
  });

  it('the tail fin stands up well above the hull (not a stub), no higher than the ship height allows, toward the tail', () => {
    const fin = finOutline();
    const top = Math.max(...fin.map(([, y]) => y));
    expect(top).toBeLessThanOrEqual(SHIP_HEIGHT);
    // The hull's top surface is at about 0.11 at its widest and lower further back; the fin must clear it clearly.
    expect(top).toBeGreaterThan(0.18);
    // Its root is sunk INTO the hull (below the surface there), so it does not float.
    for (const [z, y] of fin.filter(([, y]) => y < 0.1)) {
      expect(y).toBeLessThan(hullRadiusAt(-z) * 0.78);
    }
    for (const [z] of fin) expect(z).toBeGreaterThan(0);
    // Swept back: the top's front edge is further back than the root's front edge.
    expect(fin[1][0]).toBeGreaterThan(fin[0][0]);
  });

  it("hullRadiusAt gives the hull's radius anywhere along it, and 0 beyond the nose", () => {
    expect(hullRadiusAt(-0.1)).toBeCloseTo(0.14, 2); // the widest part
    expect(hullRadiusAt(-TAIL_Z)).toBeGreaterThan(0.08); // the engine bay
    expect(hullRadiusAt(-NOSE_Z)).toBeCloseTo(0, 6);
    expect(hullRadiusAt(-NOSE_Z + 0.5)).toBe(0);
    expect(hullRadiusAt(Number.NaN)).toBe(0);
    // Matches the profile at its own sample points.
    for (const p of hullProfile(40)) expect(hullRadiusAt(p.along)).toBeCloseTo(p.radius, 2);
  });

  it('the engine bell flares outward from the throat to the exit', () => {
    const bell = bellProfile();
    for (let i = 1; i < bell.length; i++) {
      expect(bell[i].radius).toBeGreaterThanOrEqual(bell[i - 1].radius);
      expect(bell[i].along).toBeLessThan(bell[i - 1].along);
    }
    expect(bell[bell.length - 1].radius).toBeGreaterThan(bell[0].radius * 1.8);
  });

  it('the dish is a parabola: flat at the centre, curving up toward the edge', () => {
    const dish = dishProfile(10, 0.05, 0.014);
    expect(dish[0]).toEqual({ radius: 0, along: 0 });
    expect(dish[dish.length - 1].radius).toBeCloseTo(0.05);
    expect(dish[dish.length - 1].along).toBeCloseTo(0.014);
    // Depth grows faster toward the edge than near the middle.
    expect(dish[10].along - dish[9].along).toBeGreaterThan(dish[2].along - dish[1].along);
  });
});

describe('the lights', () => {
  it('has a red one on the left, a green one on the right and a white one at the back', () => {
    const byName = Object.fromEntries(NAVIGATION_LIGHTS.map((l) => [l.name, l]));
    expect(byName.port.position[0]).toBeLessThan(0);
    expect(byName.starboard.position[0]).toBeGreaterThan(0);
    expect(byName.port.color).toBe(0xff2a2a);
    expect(byName.starboard.color).toBe(0x2aff5a);
    expect(byName.tail.color).toBe(0xffffff);
    // The two wingtip lights are mirror images.
    expect(byName.port.position[0]).toBeCloseTo(-byName.starboard.position[0]);
    expect(Math.abs(byName.port.position[0])).toBeLessThanOrEqual(SHIP_SPAN / 2);
  });

  it('blink is a brief bright flash and then a dim glow, repeating every period', () => {
    expect(blink(0, 1.6)).toBe(1);
    expect(blink(0.1, 1.6)).toBe(1);
    expect(blink(0.9, 1.6)).toBeLessThan(0.5);
    expect(blink(1.6, 1.6)).toBe(1); // starts again
    expect(blink(-0.1, 1.6)).toBeLessThan(0.5); // before zero still works (the phase wraps)
    // On for less than a fifth of the time.
    let on = 0;
    for (let t = 0; t < 16; t += 0.01) if (blink(t, 1.6) === 1) on += 1;
    expect(on / 1600).toBeLessThan(0.2);
    expect(on / 1600).toBeGreaterThan(0.1);
  });

  it('survives nonsense (NaN time, zero or negative period)', () => {
    expect(blink(Number.NaN, 1)).toBe(0);
    expect(blink(1, 0)).toBe(0);
    expect(blink(1, -2)).toBe(0);
  });
});
