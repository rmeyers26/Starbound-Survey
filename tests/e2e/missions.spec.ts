import { expect, test, type Page } from '@playwright/test';
import { openForScanning, openGame, scanObject, setPractice, trackErrors, xpText } from './helpers';

// Guided missions: the Moon mission asks you to scan the Sun and the Moon, then answer
// "Where does the Moon's light come from?". The right answer is the second choice (position 1).

const missionsButton = (page: Page) => page.getByRole('button', { name: 'Open the Missions list' });
const dialog = (page: Page) => page.locator('dialog.missions-dialog');
const choice = (page: Page, index: number) =>
  page.locator(`.mission-choice[data-choice="${index}"]`);
const RIGHT = 1;
const WRONG = 0;

/** Scans the two things the Moon mission asks for. */
async function scanMissionObjects(page: Page): Promise<void> {
  await scanObject(page, 'sun');
  await scanObject(page, 'moon');
}

test.describe('the Moon mission', () => {
  test('shows its objectives, and keeps the question closed until both are scanned', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await openForScanning(page);
    await missionsButton(page).click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByText('0 of 1 missions complete.')).toBeVisible();
    await expect(
      dialog(page).getByText("Where does the Moon's light come from?").first(),
    ).toBeVisible();
    await expect(dialog(page).locator('.mission-objective')).toHaveText([
      /Scan The Sun/,
      /Scan The Moon/,
    ]);
    await expect(dialog(page).locator('.mission-objective--done')).toHaveCount(0);
    await expect(page.locator('.mission-choice')).toHaveCount(0); // no question yet
    await dialog(page).getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog(page)).toBeHidden();

    await scanObject(page, 'sun'); // one of the two: the question must still be closed
    await missionsButton(page).click();
    await expect(dialog(page).locator('.mission-objective--done')).toHaveCount(1);
    await expect(page.locator('.mission-choice')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('the Goal line leads you through it, then opens the question', async ({ page }) => {
    await openForScanning(page);
    await scanObject(page, 'earth'); // the welcome step
    await expect(page.locator('.goal-chip')).toContainText('Mission: scan The Sun and The Moon.');
    await scanObject(page, 'sun');
    await expect(page.locator('.goal-chip')).toContainText('Mission: scan The Moon.');
    await scanObject(page, 'moon');
    await expect(page.locator('.goal-chip')).toContainText('Mission ready: answer its question.');
    await page.locator('.goal-chip').getByRole('button').click();
    await expect(dialog(page)).toBeVisible();
    await expect(page.locator('.mission-choice')).toHaveCount(4);
  });

  test('a correct first answer completes it: 50 + 15 XP, on top of the two scans', async ({
    page,
  }) => {
    await openForScanning(page);
    await scanMissionObjects(page);
    await expect(xpText(page)).toHaveText('40 / 200 XP');
    await missionsButton(page).click();
    await choice(page, RIGHT).click();
    await expect(dialog(page).getByText('Mission complete! You earned 65 XP.')).toBeVisible();
    await expect(dialog(page).getByText('1 of 1 missions complete.')).toBeVisible();
    await expect(page.locator('.mission-choice')).toHaveCount(0); // the question is gone: no second reward
    await expect(xpText(page)).toHaveText('105 / 200 XP');
  });

  test('a wrong answer costs nothing, shows the explanation, and a retry earns the smaller reward', async ({
    page,
  }) => {
    await openForScanning(page);
    await scanMissionObjects(page);
    await missionsButton(page).click();
    await choice(page, WRONG).click();
    await expect(dialog(page).getByText('Not quite, and that costs nothing.')).toBeVisible();
    await expect(dialog(page).getByText('It shines by reflecting sunlight')).toBeVisible();
    await expect(xpText(page)).toHaveText('40 / 200 XP'); // no XP, and no penalty
    await expect(page.locator('.mission-choice')).toHaveCount(4); // still open: try again

    await choice(page, RIGHT).click();
    await expect(dialog(page).getByText('Mission complete! You earned 55 XP.')).toBeVisible();
    await expect(xpText(page)).toHaveText('95 / 200 XP');
  });

  test('is still complete after a reload (and cannot be done twice)', async ({ page }) => {
    await openForScanning(page);
    await scanMissionObjects(page);
    await missionsButton(page).click();
    await choice(page, RIGHT).click();
    await expect(xpText(page)).toHaveText('105 / 200 XP');

    await page.reload();
    await openGame(page);
    await expect(xpText(page)).toHaveText('105 / 200 XP');
    await missionsButton(page).click();
    await expect(dialog(page).getByText('1 of 1 missions complete.')).toBeVisible();
    await expect(page.locator('.mission-choice')).toHaveCount(0);
    await expect(dialog(page).getByText(/Source:/)).toBeVisible();
  });

  test('practice mode pauses missions (practice never changes saved progress)', async ({
    page,
  }) => {
    await openForScanning(page);
    await setPractice(page, true);
    await missionsButton(page).click();
    await expect(dialog(page).getByText(/missions are paused/)).toBeVisible();
    await expect(page.locator('.mission')).toHaveCount(0);
  });

  test('every answer button is at least 44 x 44 CSS pixels, and none is cut off the screen', async ({
    page,
  }) => {
    await openForScanning(page);
    await scanMissionObjects(page);
    await missionsButton(page).click();
    const buttons = page.locator('.mission-choice');
    await expect(buttons).toHaveCount(4);
    const viewport = page.viewportSize()!;
    for (let i = 0; i < 4; i++) {
      const box = (await buttons.nth(i).boundingBox())!;
      expect(box.height, `choice ${i} height`).toBeGreaterThanOrEqual(43.5);
      expect(box.width, `choice ${i} width`).toBeGreaterThanOrEqual(43.5);
      expect(box.x, `choice ${i} left edge`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `choice ${i} right edge`).toBeLessThanOrEqual(viewport.width);
    }
    // The Missions button on the main screen is large enough too.
    await dialog(page).getByRole('button', { name: 'Close', exact: true }).click();
    const missionsBox = (await missionsButton(page).boundingBox())!;
    expect(missionsBox.height).toBeGreaterThanOrEqual(43.5);
  });
});
