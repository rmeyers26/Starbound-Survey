// Visual effects (spec: bloom, atmosphere, warp, each tied to the graphics profile and to Reduce motion).
// These tests measure real pixels, so the thresholds come from measured numbers, with generous margins:
//   brightness of a ring around the Sun (0 to 255):   High about 95, Balanced about 74, Performance about 10
// Warp streaks are checked through the strength the view reports (data-warp), not through pixel colours.
import { expect, test, type Page } from '@playwright/test';
import { openGame, openSettings, trackErrors } from './helpers';

const BLOOM_CHUNK = /bloomPipeline-[\w-]+\.js/;

/** The pixels of a screenshot of part of the page, as RGBA numbers. */
async function pixelsOf(page: Page, clip: { x: number; y: number; width: number; height: number }) {
  const png = await page.screenshot({ clip });
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    return Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data);
  }, png.toString('base64'));
}

/** Average brightness of a ring around the Sun (outside the Sun and its orange halo). The Sun is mid-screen. */
async function ringBrightnessAroundSun(page: Page): Promise<number> {
  const size = page.viewportSize()!;
  const half = 70;
  const data = await pixelsOf(page, {
    x: size.width / 2 - half,
    y: size.height / 2 - half,
    width: half * 2,
    height: half * 2,
  });
  let sum = 0;
  let count = 0;
  for (let y = 0; y < half * 2; y++) {
    for (let x = 0; x < half * 2; x++) {
      const distance = Math.hypot(x - half, y - half);
      if (distance < 32 || distance > 66) continue;
      const i = (y * half * 2 + x) * 4;
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
      count++;
    }
  }
  return sum / count;
}

async function chooseQuality(page: Page, profile: 'high' | 'balanced' | 'performance') {
  await openSettings(page);
  await page.getByLabel('Graphics quality').selectOption(profile);
  await page.getByRole('button', { name: 'Close' }).last().click();
  await page.waitForTimeout(1500); // let the effect switch on or off
}

/**
 * Watches the warp strength the 3D view reports (the `data-warp` attribute on the canvas, 0 to 1) for a few
 * seconds and returns the highest value seen. Reading the strength itself is exact and the same in every
 * browser; counting streak-coloured pixels was not (it differed between Chromium and WebKit).
 */
async function highestWarp(page: Page, seconds = 8): Promise<number> {
  let highest = 0;
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    const value = await page.locator('canvas.game-canvas').getAttribute('data-warp');
    highest = Math.max(highest, Number(value ?? 0));
    await page.waitForTimeout(100);
  }
  return highest;
}

/**
 * Waits until the warp has fully ended (the canvas reports 0.00).
 * A flight's length is measured in animation frames, and a slow test machine draws fewer of them per
 * second, so a fixed number of seconds is a guess. Waiting for the finish line itself is not.
 */
async function expectWarpEnded(page: Page): Promise<void> {
  await expect(page.locator('canvas.game-canvas')).toHaveAttribute('data-warp', '0.00', {
    timeout: 45_000,
  });
}

// A small window keeps the software-rendered 3D light enough for slow test machines (a real GPU would not care).
const SMALL_WINDOW = { width: 800, height: 480 };

test.describe('bloom (glow around the Sun)', () => {
  test.beforeEach(() => {
    test.slow(); // software-rendered 3D with effects on is slow on test machines; a real GPU is not
  });
  test.use({ viewport: SMALL_WINDOW });
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'pixel measurements use the desktop layout');
  });

  test('is strongest on High, weaker on Balanced, and gone on Performance (and comes back)', async ({
    page,
  }) => {
    await openGame(page, '?effects=on');
    await chooseQuality(page, 'high');
    const high = await ringBrightnessAroundSun(page);
    await chooseQuality(page, 'balanced');
    const balanced = await ringBrightnessAroundSun(page);
    await chooseQuality(page, 'performance');
    const performance = await ringBrightnessAroundSun(page);
    expect(high).toBeGreaterThan(balanced + 8);
    expect(balanced).toBeGreaterThan(performance + 20);
    expect(performance).toBeLessThan(35); // just stars, orbit lines and the Sun's own halo

    // Switching back works: nothing is left over from the first time.
    await chooseQuality(page, 'high');
    expect(Math.abs((await ringBrightnessAroundSun(page)) - high)).toBeLessThan(10);
  });
});

test.describe('warp streaks (long flights)', () => {
  test.use({ viewport: SMALL_WINDOW });
  test.beforeEach(() => {
    test.slow(); // software-rendered 3D with effects on is slow on test machines; a real GPU is not
  });

  test('are strong mid-flight on a long trip, and gone once you arrive', async ({ page }) => {
    await openGame(page, '?effects=on');
    await chooseQuality(page, 'high');
    await page.locator('button[data-object-id="ceres"]').click(); // the Sun to Ceres: a long trip
    expect(await highestWarp(page)).toBeGreaterThan(0.5);
    await expectWarpEnded(page);
  });

  test('do not appear on a short hop (Earth to its Moon)', async ({ page }) => {
    await openGame(page, '?effects=on');
    await chooseQuality(page, 'high');
    await page.locator('button[data-object-id="earth"]').click();
    await highestWarp(page, 3); // the long trip to Earth is under way...
    await expectWarpEnded(page); // ...and wait for it to truly finish, however slow the machine
    await page.locator('button[data-object-id="moon"]').click(); // about 6 units: far too short for a warp
    expect(await highestWarp(page, 5)).toBe(0);
    await expect(page.locator('canvas.game-canvas')).toHaveAttribute('data-warp', '0.00'); // reported, and zero
  });

  test('do not appear with Reduce motion on (the flight is instant)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openGame(page, '?effects=on');
    await chooseQuality(page, 'high');
    await page.locator('button[data-object-id="ceres"]').click();
    expect(await highestWarp(page, 4)).toBe(0);
    await expect(page.locator('canvas.game-canvas')).toHaveAttribute('data-warp', '0.00'); // reported, and zero
  });

  test('do not appear on the Performance profile', async ({ page }) => {
    await openGame(page, '?effects=on');
    await chooseQuality(page, 'performance');
    await page.locator('button[data-object-id="ceres"]').click();
    expect(await highestWarp(page, 4)).toBe(0);
    await expect(page.locator('canvas.game-canvas')).toHaveAttribute('data-warp', '0.00'); // reported, and zero
  });
});

test.describe('effects and the download', () => {
  test('High and Balanced download the bloom code and run without errors', async ({ page }) => {
    const errors = trackErrors(page);
    const download = page.waitForResponse((r) => BLOOM_CHUNK.test(r.url()) && r.status() === 200);
    await openGame(page, '?effects=on'); // desktops start on High, phones on Balanced: both use bloom
    await download;
    await page.locator('button[data-object-id="ceres"]').click(); // a warp flight
    await page.waitForTimeout(1500);
    await page.locator('button[data-object-id="earth"]').click(); // a planet with an atmosphere
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });

  test('Performance never downloads the bloom code', async ({ page }) => {
    await openGame(page, '?effects=on');
    await chooseQuality(page, 'performance'); // the choice is saved on this device
    const requested: string[] = [];
    page.on('request', (r) => {
      if (BLOOM_CHUNK.test(r.url())) requested.push(r.url());
    });
    await page.reload();
    await openGame(page, '?effects=on');
    await page.waitForTimeout(1500);
    expect(requested).toEqual([]);
  });
});
