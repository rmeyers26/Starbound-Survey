// The spacecraft: getting in, flying with the keyboard and the on-screen buttons, the four camera views, the
// autopilot, scanning from the ship, Reduce motion, the phone layout and accessibility.
//
// A note on timing: these tests wait for a CONDITION ("the speed is above 5") instead of a fixed number of
// seconds. A slow machine draws fewer frames per second, so a fixed wait that works on a fast machine fails on a
// slow one (that is exactly what happened to an earlier warp test in CI).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { chip, holdScan, openGame, trackErrors } from './helpers';

const root = (page: Page) => page.locator('.pilot');
const canvas = (page: Page) => page.locator('canvas.game-canvas');
const reading = async (page: Page, name: string): Promise<number> =>
  Number((await root(page).getAttribute(`data-${name}`)) ?? 'NaN');
const speed = (page: Page) => reading(page, 'speed');
const heading = (page: Page) => reading(page, 'heading');

/** How far the heading has turned from `before`, in degrees, taking the short way round (-180 to 180). */
const turnedFrom = async (page: Page, before: number): Promise<number> => {
  let delta = (await heading(page)) - before;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
};

async function enterShip(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Pilot ship' }).click();
  await expect(root(page)).toHaveAttribute('data-active', 'true');
  await expect(canvas(page)).toHaveAttribute('data-pilot', 'chase');
}

/** Holds a flight key until `reached` is true (or the test times out), then lets go. */
async function holdKeyUntil(
  page: Page,
  key: string,
  reached: () => Promise<boolean>,
): Promise<void> {
  await page.keyboard.down(key);
  try {
    await expect.poll(reached, { timeout: 20_000 }).toBe(true);
  } finally {
    await page.keyboard.up(key);
  }
}

const NAMED_VIEWS = [
  ['chase', 'Chase'],
  ['cockpit', 'Cockpit'],
  ['orbit', 'Orbit'],
  ['map', 'Map'],
] as const;

test.describe('spacecraft', () => {
  test('the Pilot button gets you in and out of the ship', async ({ page }) => {
    const errors = trackErrors(page);
    await openGame(page);
    const toggle = page.getByRole('button', { name: 'Pilot ship' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(canvas(page)).toHaveAttribute('data-pilot', 'off');
    await expect(page.locator('.pilot-body')).toBeHidden();

    await toggle.click();
    await expect(page.getByRole('button', { name: 'Leave ship' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(canvas(page)).toHaveAttribute('data-pilot', 'chase');
    await expect(page.locator('.pilot-body')).toBeVisible();

    await page.getByRole('button', { name: 'Leave ship' }).click();
    await expect(canvas(page)).toHaveAttribute('data-pilot', 'off');
    await expect(page.locator('.pilot-body')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('P gets in and out from the keyboard', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('p');
    await expect(canvas(page)).toHaveAttribute('data-pilot', 'chase');
    await page.keyboard.press('p');
    await expect(canvas(page)).toHaveAttribute('data-pilot', 'off');
  });

  test('W speeds the ship up, S slows it, and one tap of X brings it to a full stop', async ({
    page,
  }) => {
    await openGame(page);
    await enterShip(page);
    expect(await speed(page)).toBe(0);

    await holdKeyUntil(page, 'w', async () => (await speed(page)) > 8);
    // Letting go leaves the throttle where it was: the ship keeps cruising.
    await page.waitForTimeout(400);
    expect(await speed(page)).toBeGreaterThan(5);

    await page.keyboard.press('x'); // a quick tap, not a hold
    await expect.poll(() => speed(page), { timeout: 20_000 }).toBe(0);
    expect(await reading(page, 'throttle')).toBe(0);

    // Reverse: S below zero backs the ship up (negative speed), only slowly.
    await holdKeyUntil(page, 's', async () => (await speed(page)) < -1);
    expect(await speed(page)).toBeGreaterThan(-15);
  });

  test('A and the left arrow turn left, D and the right arrow turn right', async ({ page }) => {
    await openGame(page);
    await enterShip(page);

    let before = await heading(page);
    await holdKeyUntil(page, 'a', async () => (await turnedFrom(page, before)) > 25);
    expect(await turnedFrom(page, before)).toBeGreaterThan(25);

    before = await heading(page);
    await holdKeyUntil(page, 'd', async () => (await turnedFrom(page, before)) < -25);

    before = await heading(page);
    await holdKeyUntil(page, 'ArrowLeft', async () => (await turnedFrom(page, before)) > 25);
    before = await heading(page);
    await holdKeyUntil(page, 'ArrowRight', async () => (await turnedFrom(page, before)) < -25);
  });

  test('each camera view button picks its view, and V steps through them', async ({ page }) => {
    await openGame(page);
    await enterShip(page);
    for (const [view, label] of NAMED_VIEWS) {
      const button = page.getByRole('button', { name: label, exact: true });
      await button.click();
      await expect(canvas(page)).toHaveAttribute('data-pilot', view);
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      // Exactly one view is pressed at a time.
      await expect(page.locator('.pilot-view[aria-pressed="true"]')).toHaveCount(1);
    }
    // From Map, V wraps round to Chase, then goes on to Cockpit.
    await page.keyboard.press('v');
    await expect(canvas(page)).toHaveAttribute('data-pilot', 'chase');
    await page.keyboard.press('v');
    await expect(canvas(page)).toHaveAttribute('data-pilot', 'cockpit');
  });

  test('the views really look different (each draws a different picture)', async ({ page }) => {
    await openGame(page);
    await enterShip(page);
    const pictures = new Map<string, Buffer>();
    for (const [view, label] of NAMED_VIEWS) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await expect(canvas(page)).toHaveAttribute('data-pilot', view);
      await page.waitForTimeout(500); // a few frames in the new view
      pictures.set(view, await canvas(page).screenshot());
    }
    const views = [...pictures.keys()];
    for (let a = 0; a < views.length; a++) {
      for (let b = a + 1; b < views.length; b++) {
        expect(
          pictures.get(views[a])!.equals(pictures.get(views[b])!),
          `${views[a]} and ${views[b]} should not look identical`,
        ).toBe(false);
      }
    }
  });

  test('holding the on-screen Faster button speeds up, letting go keeps the speed, Stop stops', async ({
    page,
  }) => {
    await openGame(page);
    await enterShip(page);
    const faster = page.locator('.pilot-faster');
    const box = (await faster.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(faster).toHaveAttribute('data-held', 'true');
    await expect.poll(() => speed(page), { timeout: 20_000 }).toBeGreaterThan(8);
    await page.mouse.up();
    await expect(faster).not.toHaveAttribute('data-held', 'true');
    await page.waitForTimeout(400);
    expect(await speed(page)).toBeGreaterThan(5); // the lever stayed where it was left

    await page.locator('.pilot-stop').click();
    await expect.poll(() => speed(page), { timeout: 20_000 }).toBe(0);
  });

  test('holding the on-screen turn buttons turns the ship, and letting go stops turning', async ({
    page,
  }) => {
    await openGame(page);
    await enterShip(page);
    const before = await heading(page);
    const left = page.locator('.pilot-left');
    const box = (await left.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect.poll(() => turnedFrom(page, before), { timeout: 20_000 }).toBeGreaterThan(25);
    await page.mouse.up();
    await page.waitForTimeout(400);
    const settled = await heading(page);
    await page.waitForTimeout(600);
    expect(await heading(page)).toBe(settled); // no longer turning
  });

  test('keyboard: Enter on a turn button gives a short nudge (no mouse needed)', async ({
    page,
  }) => {
    await openGame(page);
    await enterShip(page);
    const before = await heading(page);
    await page.locator('.pilot-left').focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => turnedFrom(page, before), { timeout: 20_000 }).toBeGreaterThan(3);
  });

  test('the autopilot flies to the chosen planet and stops in scanning range', async ({ page }) => {
    test.slow();
    await openGame(page);
    await enterShip(page);
    await chip(page, 'mars').click(); // while piloting, an object button means "fly there"
    await expect(root(page)).toHaveAttribute('data-autopilot', 'mars');
    await expect(page.locator('.pilot-message')).toContainText('Arrived at Mars', {
      timeout: 40_000,
    });
    await expect(root(page)).toHaveAttribute('data-in-range', 'true');
    expect(await speed(page)).toBe(0);
    await expect(root(page)).toHaveAttribute('data-autopilot', '');
  });

  test('taking the controls yourself cancels the autopilot', async ({ page }) => {
    await openGame(page);
    await enterShip(page);
    await chip(page, 'mars').click();
    await expect(root(page)).toHaveAttribute('data-autopilot', 'mars');
    await page.keyboard.down('a');
    await expect(root(page)).toHaveAttribute('data-autopilot', '');
    await page.keyboard.up('a');
  });

  test('the Cancel flight button stops the autopilot', async ({ page }) => {
    await openGame(page);
    await enterShip(page);
    await chip(page, 'mars').click();
    await page.getByRole('button', { name: /Cancel flight/ }).click();
    await expect(root(page)).toHaveAttribute('data-autopilot', '');
    await expect(page.getByRole('button', { name: /fly to Mars/i })).toBeVisible();
  });

  test('scanning measures from the SHIP: far away is "too far", and after the autopilot it works', async ({
    page,
  }) => {
    test.slow();
    await openGame(page, '?scanSeconds=0.3');
    await enterShip(page);
    // Use the Map view: its camera sits 100 units above the ship, so a camera-based distance would be wrong.
    await page.getByRole('button', { name: 'Map', exact: true }).click();

    // Far away: start the autopilot, cancel it at once, and try to scan.
    await chip(page, 'mars').click();
    await page.getByRole('button', { name: /Cancel flight/ }).click();
    await holdScan(page, 600);
    await expect(page.locator('.scan-status')).toHaveText('Move closer to scan.');

    // Now fly there properly and scan.
    await page.getByRole('button', { name: /fly to Mars/i }).click();
    await expect(page.locator('.pilot-message')).toContainText('Arrived at Mars', {
      timeout: 40_000,
    });
    await holdScan(page, 900);
    await expect(page.locator('.scan-status')).toContainText('Basic scan of Mars complete', {
      timeout: 15_000,
    });
  });

  test('with Reduce motion on, the autopilot jumps straight to the destination', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openGame(page);
    await enterShip(page);
    await chip(page, 'mars').click();
    await expect(page.locator('.pilot-message')).toContainText('Arrived at Mars', {
      timeout: 10_000,
    });
    await expect(root(page)).toHaveAttribute('data-in-range', 'true');
  });

  test('leaving the ship brings back the normal camera and buttons', async ({ page }) => {
    await openGame(page);
    await enterShip(page);
    await page.getByRole('button', { name: 'Leave ship' }).click();
    await expect(canvas(page)).toHaveAttribute('data-pilot', 'off');
    await chip(page, 'earth').click(); // an object button selects and focuses again, no autopilot
    await expect(page.locator('.info-panel')).toBeVisible();
    await expect(root(page)).toHaveAttribute('data-autopilot', '');
    await expect(page.locator('.hud-controls')).toBeVisible();
  });

  test('Escape leaves the ship', async ({ page }) => {
    await openGame(page);
    await enterShip(page);
    await canvas(page).focus();
    await page.keyboard.press('Escape');
    await expect(canvas(page)).toHaveAttribute('data-pilot', 'off');
  });

  test('flight keys do nothing while the Settings window is open', async ({ page, isMobile }) => {
    test.skip(isMobile, 'on a phone the Settings button is hidden while piloting');
    await openGame(page);
    await enterShip(page);
    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.locator('dialog.settings-dialog')).toBeVisible();
    await page.keyboard.down('w');
    await page.waitForTimeout(800);
    await page.keyboard.up('w');
    expect(await speed(page)).toBe(0);
    expect(await reading(page, 'throttle')).toBe(0);
  });

  test('with the simplified 2D chart there is no ship, and the button says why', async ({
    page,
  }) => {
    await openGame(page, '?renderer=canvas2d');
    const toggle = page.getByRole('button', { name: 'Pilot ship' });
    await expect(toggle).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText('Piloting needs 3D graphics.')).toBeVisible();
    await toggle.click({ force: true }); // aria-disabled buttons are "not enabled" to Playwright, so force it
    await page.keyboard.press('p');
    await expect(root(page)).toHaveAttribute('data-active', 'false');
    await expect(page.locator('.pilot-body')).toBeHidden();
  });

  test('the controls have no accessibility violations (flying, and with an object selected)', async ({
    page,
  }) => {
    await openGame(page);
    await enterShip(page);
    await chip(page, 'earth').click();
    await expect(page.locator('.info-panel')).toBeVisible();
    // Wait for every fade and transition to finish, so axe does not measure half-blended colours.
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('spacecraft on a phone-sized screen', () => {
  test.use({ viewport: { width: 390, height: 664 } });
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'the phone layout only applies on the phone projects');
  });

  const overlap = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ): boolean =>
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

  test('the controls fit: nothing overlaps the top buttons or the SCAN button, and the page does not slide sideways', async ({
    page,
  }) => {
    await openGame(page);
    await enterShip(page);
    // The zoom / Overview / Logbook / Settings rows step aside while flying, and come back afterwards.
    await expect(page.locator('.hud-controls')).toBeHidden();
    const body = (await page.locator('.pilot-body').boundingBox())!;
    const top = (await page.locator('.hud-top').boundingBox())!;
    const scan = (await page.locator('.scan-ring').boundingBox())!;
    expect(overlap(body, top), 'steering pad over the top buttons').toBe(false);
    expect(overlap(body, scan), 'steering pad over the SCAN button').toBe(false);
    const bar = (await page.locator('.pilot-bar').boundingBox())!;
    expect(overlap(bar, scan), 'Pilot bar over the SCAN button').toBe(false);
    // Every control is at least 44 pixels (the spec's minimum for a finger).
    for (const selector of [
      '.pilot-up',
      '.pilot-left',
      '.pilot-right',
      '.pilot-down',
      '.pilot-faster',
      '.pilot-slower',
      '.pilot-stop',
    ]) {
      const box = (await page.locator(selector).boundingBox())!;
      expect(box.width, selector).toBeGreaterThanOrEqual(44);
      expect(box.height, selector).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );

    await page.getByRole('button', { name: 'Leave ship' }).click();
    await expect(page.locator('.hud-controls')).toBeVisible();
  });

  test('with the info sheet open the steering pad steps aside, but the autopilot stays', async ({
    page,
  }) => {
    await openGame(page);
    await enterShip(page);
    await chip(page, 'earth').click();
    await expect(page.locator('.info-panel')).toBeVisible();
    await expect(page.locator('.pilot-body')).toBeHidden();
    const bar = (await page.locator('.pilot-bar').boundingBox())!;
    const sheet = (await page.locator('.info-panel').boundingBox())!;
    expect(overlap(bar, sheet), 'Pilot bar over the info sheet').toBe(false);
    await expect(page.getByRole('button', { name: /Cancel flight/ })).toBeVisible();
    // Closing the sheet brings the steering pad back.
    await page.locator('.info-close').click();
    await expect(page.locator('.pilot-body')).toBeVisible();
  });
});
