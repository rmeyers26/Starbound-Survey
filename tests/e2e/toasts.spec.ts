// Notifications ("toasts") must never bury the game's own buttons, even on a small iPhone with the info sheet open.
// CI found this: on an iPhone-sized screen, practice mode's on/off messages stacked up over the Settings button.
import { expect, test } from '@playwright/test';
import { chip, openForScanning, openSettings, setPractice } from './helpers';

// The screen size Playwright's iPhone 13 has (390 x 664 CSS pixels): the tightest layout we test.
test.use({ viewport: { width: 390, height: 664 } });

test('no more than two notifications at once, and the Settings button stays usable', async ({
  page,
}) => {
  await openForScanning(page);
  await setPractice(page, true);
  await chip(page, 'jupiter').click(); // opens the bottom sheet, which lifts the notifications up the screen
  await expect(page.locator('.info-panel')).toBeVisible();

  for (let round = 0; round < 3; round++) {
    // Each switch shows a message. Before the fix, five or more piled up and covered Settings.
    await setPractice(page, round % 2 === 1);
    await setPractice(page, round % 2 === 0);
    expect(await page.locator('.toast').count()).toBeLessThanOrEqual(2);
  }
  // A plain, normal tap (no force) still opens Settings: the button is not buried.
  await openSettings(page);
  await expect(page.locator('dialog.settings-dialog')).toBeVisible();
});

test('the newest message is the one that stays', async ({ page }) => {
  await openForScanning(page);
  await setPractice(page, true);
  await setPractice(page, false);
  await setPractice(page, true);
  await expect(page.getByText('Practice mode on: everything is unlocked')).toBeVisible();
  expect(await page.locator('.toast').count()).toBeLessThanOrEqual(2);
});

test('a tap on the text of a notification passes through to the button underneath', async ({
  page,
}) => {
  await openForScanning(page);
  const pointerEvents = await page.evaluate(() => {
    // Build a toast the way the game does, then ask the browser whether its text can receive taps.
    const region = document.querySelector('.toast-region')!;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = '<span class="toast-text">x</span><button class="toast-dismiss">×</button>';
    region.append(toast);
    const result = {
      text: getComputedStyle(toast.querySelector('.toast-text')!).pointerEvents,
      body: getComputedStyle(toast).pointerEvents,
      button: getComputedStyle(toast.querySelector('button')!).pointerEvents,
    };
    toast.remove();
    return result;
  });
  expect(pointerEvents).toEqual({ text: 'none', body: 'none', button: 'auto' });
});
