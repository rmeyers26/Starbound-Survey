import { expect, test } from '@playwright/test';
import { chip, openForScanning, openGame, openSettings, scanObject, trackErrors } from './helpers';

test('loads the 3D scene with no errors', async ({ page }) => {
  const errors = trackErrors(page);
  await openGame(page);
  await expect(page.getByText('Not to scale')).toBeVisible(); // honesty rule: scale is disclosed
  expect(errors).toEqual([]);
});

test('selecting an object shows its facts; measurements are earned by scanning', async ({
  page,
}) => {
  await openForScanning(page);
  await chip(page, 'moon').click();

  const panel = page.locator('.info-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'The Moon' })).toBeVisible();
  await expect(panel.locator('.badge')).toHaveText('Simulation'); // every visual is labelled
  await expect(panel.getByText('natural satellite')).toBeVisible(); // Quick facts tab

  // Before scanning: the Advanced tab is locked.
  await panel.getByRole('tab', { name: 'Advanced data' }).click();
  await expect(panel.getByText('Scan this object to reveal its measurements')).toBeVisible();
  await expect(panel.getByText('384,400 km')).toHaveCount(0);

  // After a scan: real values from the JSON file appear, with their source.
  await scanObject(page, 'moon'); // selecting again resets the panel to its Quick facts tab
  await panel.getByRole('tab', { name: 'Advanced data' }).click();
  await expect(panel.getByText('384,400 km')).toBeVisible();
  await expect(panel.getByText('Source: NASA Moon Fact Sheet')).toBeVisible();
});

test('tabs can be switched with the keyboard', async ({ page }) => {
  await openGame(page);
  await chip(page, 'earth').click();
  const quick = page.getByRole('tab', { name: 'Quick facts' });
  await quick.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Advanced data' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('clicking an object in the 3D view selects it', async ({ page }) => {
  await openGame(page);
  // The camera starts centred on the Sun, so the middle of the canvas is the Sun.
  await page.locator('canvas.game-canvas').click();
  await expect(page.locator('.info-title')).toHaveText('The Sun');
  await expect(chip(page, 'sun')).toHaveAttribute('aria-pressed', 'true');
});

test('Escape clears the selection and the close button works', async ({ page }) => {
  await openGame(page);
  await chip(page, 'earth').click();
  await expect(page.locator('.info-panel')).toBeVisible();
  await page.locator('canvas.game-canvas').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('.info-panel')).toBeHidden();
  await expect(chip(page, 'earth')).toHaveAttribute('aria-pressed', 'false');

  await chip(page, 'moon').click();
  await page.getByRole('button', { name: 'Close information panel' }).click();
  await expect(page.locator('.info-panel')).toBeHidden();
});

test('camera buttons work without errors', async ({ page }) => {
  const errors = trackErrors(page);
  await openGame(page);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await chip(page, 'moon').click();
  await page.getByRole('button', { name: /Back to overview/ }).click();
  await expect(chip(page, 'moon')).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('settings open, change graphics quality, and survive a reload', async ({ page }) => {
  await openGame(page);
  await openSettings(page);
  await page.getByLabel('Graphics quality').selectOption('performance');
  await page.getByLabel('Show frame rate').check();
  await page.keyboard.press('Escape'); // native <dialog> closes with Escape
  await expect(page.locator('dialog.settings-dialog')).toBeHidden();
  await expect(page.locator('.fps-readout')).toBeVisible();
  await expect(page.locator('.fps-readout')).toContainText('Performance', { timeout: 10_000 });

  await page.reload();
  await openSettings(page);
  await expect(page.getByLabel('Graphics quality')).toHaveValue('performance');
});

test('a real touch tap on the 3D view selects an object', async ({ browser }) => {
  // A touch-enabled phone context: taps arrive as touch events, not mouse clicks.
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 412, height: 800 },
  });
  const page = await context.newPage();
  await openGame(page);
  await page.touchscreen.tap(206, 400); // middle of the screen = the Sun at the start
  await expect(page.locator('.info-title')).toHaveText('The Sun');
  await context.close();
});
