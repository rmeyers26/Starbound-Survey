// Surface pictures (Moon, Mars) must actually load, with no errors, and weaker devices must get the small ones.
import { expect, test } from '@playwright/test';
import { openGame, trackErrors } from './helpers';

const PICTURE = /\/assets\/(moon|mars)-(1k|2k)-[\w-]+\.jpg$/;

test('the Moon and Mars surface pictures load without errors', async ({ page }, testInfo) => {
  const errors = trackErrors(page);
  const loaded = new Map<string, string>(); // body -> address
  page.on('response', (r) => {
    const match = PICTURE.exec(r.url());
    if (match && r.status() === 200) loaded.set(match[1], r.url());
  });
  await openGame(page);
  // Pictures arrive after the game starts, one after the other.
  await expect.poll(() => [...loaded.keys()].sort()).toEqual(['mars', 'moon']);

  // Desktop starts on High (2k pictures). Phones start on Balanced (1k pictures, a quarter of the memory).
  const isPhone = testInfo.project.name.includes('mobile');
  for (const url of loaded.values()) expect(url).toMatch(isPhone ? /-1k-/ : /-2k-/);

  expect(errors).toEqual([]);
});

test('the game still works when the pictures are missing or broken', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Pretend every picture failed: the game must keep the flat-colour bodies and carry on.
  await page.route(PICTURE, (route) => route.abort());
  await openGame(page);
  await page.locator('button[data-object-id="moon"]').click();
  await expect(page.locator('.info-panel')).toBeVisible();
  expect(errors).toEqual([]);
});
