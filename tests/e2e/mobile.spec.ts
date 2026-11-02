import { expect, test } from '@playwright/test';
import { chip, openGame, openSettings } from './helpers';

// These rules come from the spec's "Touch-first navigation" and "Responsive layout" sections.
// They run on every project, so phone-sized screens are checked as well as desktops.

test('the page never scrolls sideways', async ({ page }) => {
  await openGame(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the viewport covers notches (viewport-fit=cover)', async ({ page }) => {
  await openGame(page);
  const content = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(content).toContain('viewport-fit=cover');
});

test('touch-action is none on the game canvas only (menus must still scroll)', async ({ page }) => {
  await openGame(page);
  const canvas = await page
    .locator('canvas.game-canvas')
    .evaluate((el) => getComputedStyle(el).touchAction);
  const body = await page.evaluate(() => getComputedStyle(document.body).touchAction);
  expect(canvas).toBe('none');
  expect(body).not.toBe('none');
});

test('every button is at least 44 x 44 CSS pixels', async ({ page }) => {
  await openGame(page);
  await chip(page, 'earth').click();
  await page.getByRole('tab', { name: 'Advanced data' }).click();

  const tooSmall = async (selector: string): Promise<string[]> =>
    page.locator(selector).evaluateAll((buttons) =>
      buttons
        .filter((b) => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.width < 43.5 || r.height < 43.5);
        })
        .map(
          (b) =>
            `${b.textContent?.trim() || b.getAttribute('aria-label')} (${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)})`,
        ),
    );

  expect(await tooSmall('.hud button')).toEqual([]);
  expect(await tooSmall('.scan-hud button')).toEqual([]);
  expect(await tooSmall('.info-panel button')).toEqual([]);

  await openSettings(page);
  expect(await tooSmall('.settings-dialog button')).toEqual([]);
  // Checkboxes are small, but their whole row is the tap target.
  const rows = await page
    .locator('.setting-row')
    .evaluateAll((r) => r.map((e) => e.getBoundingClientRect().height));
  expect(Math.min(...rows)).toBeGreaterThanOrEqual(43.5);
});

test('the info panel is a bottom sheet on phones and a side panel on wide screens', async ({
  page,
}) => {
  await openGame(page);
  await chip(page, 'moon').click();
  const panel = page.locator('.info-panel');
  await expect(panel).toBeVisible();
  const view = page.viewportSize()!;
  const box = (await panel.boundingBox())!;
  if (view.width <= 700) {
    expect(Math.abs(box.y + box.height - view.height)).toBeLessThan(4); // touches the bottom
    expect(box.width).toBeGreaterThan(view.width - 4); // full width
    await expect(page.locator('.sheet-handle')).toBeVisible();
  } else {
    expect(box.x).toBeLessThan(40); // sits at the side
    expect(box.width).toBeLessThan(view.width / 2);
    await expect(page.locator('.sheet-handle')).toBeHidden();
  }
});

test('the bottom-sheet handle can be toggled', async ({ page }) => {
  await openGame(page);
  const phone = (page.viewportSize()?.width ?? 1000) <= 700;
  test.skip(!phone, 'the handle only exists on phone-width screens');
  await chip(page, 'moon').click();
  const handle = page.locator('.sheet-handle');
  await expect(handle).toHaveAttribute('aria-expanded', 'false');
  await handle.focus();
  await page.keyboard.press('Enter'); // keyboard alternative to swiping
  await expect(handle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Enter');
  await expect(handle).toHaveAttribute('aria-expanded', 'false');
});

test('no on-screen button is ever covered by the info panel', async ({ page }) => {
  await openGame(page);
  await chip(page, 'moon').click();
  await expect(page.locator('.info-panel')).toBeVisible();
  // For every visible HUD button, the element actually at its centre point must be that button.
  const covered = await page.locator('.hud button, .scan-hud button').evaluateAll((buttons) =>
    buttons
      .filter((b) => {
        const r = b.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false; // hidden on purpose
        // The row of object buttons scrolls sideways, so some sit outside the screen on purpose.
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        if (cx < 0 || cx > window.innerWidth || cy < 0 || cy > window.innerHeight) return false;
        const top = document.elementFromPoint(cx, cy);
        return !(top === b || b.contains(top));
      })
      .map((b) => b.textContent?.trim() || b.getAttribute('aria-label')),
  );
  expect(covered).toEqual([]);
});

test('tapping the last object button never shifts the controls sideways', async ({ page }) => {
  await openGame(page);
  // Ceres is the last of ten buttons, so it starts scrolled out of view. Bringing it into view used to nudge
  // the whole game sideways and push "The Sun" and the camera buttons off the left edge.
  await chip(page, 'ceres').click();
  await expect(page.locator('.info-panel')).toBeVisible();
  const pushedOffScreen = await page
    .locator('.hud-top, .hud-controls button')
    .evaluateAll((els) =>
      els
        .filter((el) => el.getBoundingClientRect().x < 0)
        .map((el) => el.className || el.textContent),
    );
  expect(pushedOffScreen).toEqual([]);
  const hudTopWidth = await page
    .locator('.hud-top')
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(hudTopWidth).toBeLessThanOrEqual(page.viewportSize()!.width);
});
