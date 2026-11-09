import { expect, test, type Page } from '@playwright/test';
import { chip, openForScanning, scanObject, setPractice, trackErrors, xpText } from './helpers';

// The Goal line and the achievements: a new player always knows what to do next, and is told when they do well.

const goalChip = (page: Page) => page.locator('.goal-chip');

test.describe('goal line', () => {
  test('a new player is welcomed and told how to scan; tapping the goal flies to Earth', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await openForScanning(page);
    await expect(goalChip(page)).toContainText('Welcome, Cadet!');
    await expect(goalChip(page)).toContainText('hold SCAN');

    await goalChip(page).getByRole('button').click();
    await expect(chip(page, 'earth')).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
  });

  test('after a scan the goal moves on to the next object, and the old advice is gone', async ({
    page,
  }) => {
    await openForScanning(page);
    await scanObject(page, 'earth');
    await expect(goalChip(page)).toContainText('Scan The Sun (+20 XP)');
    await expect(goalChip(page)).not.toContainText('Welcome');
    // The goal is a real button naming where it goes, so a screen reader user can act on it too.
    await expect(goalChip(page).getByRole('button')).toHaveAccessibleName(
      /Select The Sun and fly there/,
    );
  });

  test('it never covers a button: the object row, the camera controls or the SCAN button', async ({
    page,
  }) => {
    await openForScanning(page);
    const goal = (await goalChip(page).boundingBox())!;
    const others = page.locator('.hud-objects, .hud-controls button, .scan-button');
    const count = await others.count();
    expect(count).toBeGreaterThan(5);
    for (let i = 0; i < count; i++) {
      const box = await others.nth(i).boundingBox();
      if (!box) continue;
      const overlaps =
        goal.x < box.x + box.width &&
        box.x < goal.x + goal.width &&
        goal.y < box.y + box.height &&
        box.y < goal.y + goal.height;
      expect(overlaps, `goal line overlaps element ${i}`).toBe(false);
    }
  });

  test('practice mode hides it (scans give no XP there, so there is nothing to chase)', async ({
    page,
  }) => {
    await openForScanning(page);
    await expect(goalChip(page)).toBeVisible();
    await setPractice(page, true);
    await expect(goalChip(page)).toBeHidden();
    await setPractice(page, false);
    await expect(goalChip(page)).toBeVisible();
  });
});

test.describe('achievements', () => {
  test('the first scan earns First Light, with a message', async ({ page }) => {
    await openForScanning(page);
    await scanObject(page, 'moon');
    await expect(page.getByText('Achievement earned: First Light.')).toBeVisible();
  });

  test('a later scan that earns nothing new does not congratulate again', async ({ page }) => {
    await openForScanning(page);
    await scanObject(page, 'moon');
    await expect(page.getByText('Achievement earned: First Light.')).toBeVisible();
    // Mars is a real second scan (the XP proves it), but it completes no achievement: Home Sweet Home needs Earth.
    await scanObject(page, 'mars');
    await expect(xpText(page)).toHaveText('40 / 200 XP');
    await expect(page.getByText('Achievement earned:')).toHaveCount(1);
  });

  test('the Logbook lists them all, shows which are earned, and says how to earn the rest', async ({
    page,
  }) => {
    await openForScanning(page);
    await page.getByRole('button', { name: 'Open the Logbook of discovered objects' }).click();
    await expect(page.getByText('0 of 10 earned.')).toBeVisible();
    await expect(page.locator('.achievement')).toHaveCount(10);
    await expect(page.locator('.achievement--earned')).toHaveCount(0);
    await expect(page.getByText('Scan comet C/2026 A2 (Bok).')).toBeVisible(); // a locked one still says how to get it
    await page.getByRole('button', { name: 'Close', exact: true }).last().click();

    await scanObject(page, 'moon');
    await page.getByRole('button', { name: 'Open the Logbook of discovered objects' }).click();
    await expect(page.getByText('1 of 10 earned.')).toBeVisible();
    await expect(page.locator('.achievement--earned')).toHaveCount(1);
    await expect(page.locator('.achievement--earned')).toContainText('First Light');
  });

  test('practice scans never earn an achievement', async ({ page }) => {
    await openForScanning(page);
    await setPractice(page, true);
    await scanObject(page, 'moon');
    await expect(page.getByText('Achievement earned:')).toHaveCount(0);
    await setPractice(page, false);
    await page.getByRole('button', { name: 'Open the Logbook of discovered objects' }).click();
    await expect(page.getByText('0 of 10 earned.')).toBeVisible();
  });
});
