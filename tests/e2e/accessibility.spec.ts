import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { chip, openForScanning, openGame, openSettings, scanObject, setPractice } from './helpers';

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
  await page.getByRole('tab', { name: 'Advanced data' }).click(); // locked view
  expect((await scan(page)).violations).toEqual([]);
});

test('scanning HUD, unlocked data and the Logbook have no accessibility violations', async ({
  page,
}) => {
  await openForScanning(page);
  await scanObject(page, 'moon');
  await page.getByRole('tab', { name: 'Advanced data' }).click();
  expect((await scan(page)).violations).toEqual([]);
  await page.getByRole('button', { name: /Open the Logbook/ }).click();
  await expect(page.locator('dialog.logbook-dialog')).toBeVisible();
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

test("the Sun's Layers tab (hidden and revealed layers) has no accessibility violations", async ({
  page,
}) => {
  await openForScanning(page);
  await scanObject(page, 'sun'); // a basic scan: some layers revealed, some still hidden
  await page.getByRole('tab', { name: 'Layers' }).click();
  await expect(page.locator('svg.layers-diagram')).toBeVisible();
  expect((await scan(page)).violations).toEqual([]);
  await setPractice(page, true); // every scan level: all seven layers revealed
  await scanObject(page, 'sun');
  await scanObject(page, 'sun');
  await page.getByRole('tab', { name: 'Layers' }).click();
  expect((await scan(page)).violations).toEqual([]);
});

test('the Missions screen (objectives, then the question and a wrong answer) has no accessibility violations', async ({
  page,
}) => {
  await openForScanning(page);
  await page.getByRole('button', { name: 'Open the Missions list' }).click();
  expect((await scan(page)).violations).toEqual([]); // objectives still to do
  await page.getByRole('button', { name: 'Close', exact: true }).last().click();

  await scanObject(page, 'sun');
  await scanObject(page, 'moon');
  await page.getByRole('button', { name: 'Open the Missions list' }).click();
  expect((await scan(page)).violations).toEqual([]); // the question is open
  await page.locator('.mission-choice[data-choice="0"]').click(); // a wrong answer shows its explanation
  await expect(page.getByText('Not quite, and that costs nothing.')).toBeVisible();
  expect((await scan(page)).violations).toEqual([]);
  await page.locator('.mission-choice[data-choice="1"]').click(); // the right answer completes it
  await expect(page.getByText('Mission complete!')).toBeVisible();
  expect((await scan(page)).violations).toEqual([]);
});
