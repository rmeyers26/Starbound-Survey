// The Moon's surface picture must actually load, with no errors, and weaker devices must get the small one.
import { expect, test } from '@playwright/test';
import { openGame, trackErrors } from './helpers';

test('the Moon surface texture loads without errors', async ({ page }, testInfo) => {
  const errors = trackErrors(page);
  // Start listening BEFORE opening the page, so the request cannot slip past us.
  const response = page.waitForResponse((r) => /\/assets\/moon-(1k|2k)-[\w-]+\.jpg$/.test(r.url()));
  await openGame(page);
  const loaded = await response;
  expect(loaded.status()).toBe(200);
  expect(loaded.headers()['content-type']).toContain('image/jpeg');

  // Desktop starts on High (2k picture). Phones start on Balanced (1k picture, a quarter of the memory).
  const isPhone = testInfo.project.name.includes('mobile');
  expect(loaded.url()).toMatch(isPhone ? /moon-1k-/ : /moon-2k-/);

  expect(errors).toEqual([]);
});

test('the game still works when the picture is missing or broken', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Pretend the picture failed: the game must keep its flat-colour Moon and carry on.
  await page.route(/\/assets\/moon-(1k|2k)-.*\.jpg$/, (route) => route.abort());
  await openGame(page);
  await page.locator('button[data-object-id="moon"]').click();
  await expect(page.locator('.info-panel')).toBeVisible();
  expect(errors).toEqual([]);
});
