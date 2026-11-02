import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { chip, openGame, openSettings } from './helpers';

// Spec: "text and controls meet WCAG AA contrast", labelled controls, keyboard reachable.
// axe-core is an automated checker. It finds many (not all) problems, so it complements manual checks.
const scan = async (page: import('@playwright/test').Page) => {
  // The info panel fades in over 0.25 s. axe measures colours at the moment it runs, so scanning
  // mid-fade sees blended, washed-out colours and reports a false contrast failure (this happened
  // on slower CI browsers). Wait until every animation and transition has finished first.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
};

test('main view has no accessibility violations', async ({ page }) => {
  await openGame(page);
  expect((await scan(page)).violations).toEqual([]);
});

test('info panel has no accessibility violations', async ({ page }) => {
  await openGame(page);
  await chip(page, 'earth').click();
  await expect(page.locator('.info-panel')).toBeVisible();
  expect((await scan(page)).violations).toEqual([]);
  await page.getByRole('tab', { name: 'Advanced data' }).click();
  expect((await scan(page)).violations).toEqual([]);
});

test('settings dialog has no accessibility violations', async ({ page }) => {
  await openGame(page);
  await openSettings(page);
  expect((await scan(page)).violations).toEqual([]);
});

test('the 2D fallback view has no accessibility violations', async ({ page }) => {
  await openGame(page, '?renderer=canvas2d');
  await chip(page, 'moon').click();
  expect((await scan(page)).violations).toEqual([]);
});
