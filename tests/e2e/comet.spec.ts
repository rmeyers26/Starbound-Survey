// Comet C/2026 A2 (Bok): its button, what its info panel says is known and what is marked missing, the replayed flyby
// (a tail that grows near the Sun, a path tilted far out of the planets' plane), the 2D chart, and flying to it.
//
// A note on timing: the comet is replayed on a loop, and these tests wait for a CONDITION ("the tail is long
// enough") instead of a fixed number of seconds, so a slow machine does not fail them.
import { expect, test, type Page } from '@playwright/test';
import { chip, openForScanning, openGame, scanObject, setPractice, trackErrors } from './helpers';

const canvas = (page: Page) => page.locator('canvas.game-canvas');

/** The comet's status from the canvas: how visible it is, its height above the planets' plane, and its tail length. */
async function cometState(page: Page): Promise<{ fade: number; height: number; tail: number }> {
  const text = (await canvas(page).getAttribute('data-comet')) ?? '0 0 0';
  const [fade, height, tail] = text.split(' ').map(Number);
  return { fade, height, tail };
}

test.describe('comet C/2026 A2 (Bok)', () => {
  test('is a button among the inner objects, unlocked from the start, right after Ceres', async ({
    page,
  }) => {
    await openGame(page);
    const comet = chip(page, 'c2026a2');
    await expect(comet).toHaveText('C/2026 A2 (Bok)');
    await expect(comet).toHaveAttribute('aria-disabled', 'false');
    const ids = await page
      .locator('.hud-objects button')
      .evaluateAll((buttons) => buttons.map((b) => (b as HTMLElement).dataset.objectId));
    expect(ids.indexOf('c2026a2')).toBe(ids.indexOf('ceres') + 1);
  });

  test('says what is known, and plainly marks everything else "Not yet checked"', async ({
    page,
  }) => {
    test.slow();
    const errors = trackErrors(page);
    await openForScanning(page);
    await setPractice(page, true); // practice mode makes every scan level available (one more level per scan)
    await scanObject(page, 'c2026a2');
    await page.getByRole('tab', { name: 'Advanced data' }).click();
    const panel = page.locator('.info-panel');

    // A first (basic) scan shows just the checked basics, and says the rest is still locked.
    await expect(panel).toContainText('1.94 AU');
    await expect(panel).toContainText('82 degrees');
    await expect(panel).toContainText('6 more measurements locked');

    // Two deeper scans reveal everything else.
    await scanObject(page, 'c2026a2');
    await scanObject(page, 'c2026a2');
    await page.getByRole('tab', { name: 'Advanced data' }).click(); // selecting again shows Quick facts first
    await expect(panel).not.toContainText('measurements locked');
    await expect(panel).toContainText('0.998'); // the orbit's shape, 0.99761492, to three decimals

    // Everything not checked is said to be missing, never invented.
    const text = (await panel.innerText()) ?? '';
    expect((text.match(/Not yet checked/g) ?? []).length).toBeGreaterThanOrEqual(4);
    await expect(panel).toContainText('drawn as 0 degrees for now');

    // The source says where each number came from, and that it has not been checked against JPL yet.
    await expect(panel).toContainText('LESIA');
    await expect(panel).toContainText('NOT yet checked against NASA/JPL');
    expect(errors).toEqual([]);
  });

  test('has a tail from the first moment it appears (never a bare ball)', async ({ page }) => {
    const errors = trackErrors(page);
    await openGame(page);
    // The replay starts when the page loads. As soon as the comet is clearly visible (still fading in), it already has
    // a real tail. (An earlier version only grew one near the Sun, so the start of every loop looked like a moon.)
    await expect
      .poll(async () => (await cometState(page)).fade, { timeout: 30_000 })
      .toBeGreaterThan(0.3);
    expect((await cometState(page)).tail).toBeGreaterThan(2);
    expect(errors).toEqual([]);
  });

  test("grows a longer tail as it nears the Sun, on a path far out of the planets' plane", async ({
    page,
  }) => {
    test.slow();
    const errors = trackErrors(page);
    await openGame(page);
    // Wait until the comet is well inside the Solar System, where the tail is much longer than at the start.
    // (The number is the tail as DRAWN, which is up to 2.5 times the real length when the camera is far away.)
    await expect
      .poll(async () => (await cometState(page)).tail, { timeout: 100_000 })
      .toBeGreaterThan(30);
    const state = await cometState(page);
    expect(state.fade).toBeGreaterThan(0.9);
    // Its orbit is tilted 82 degrees, so it is far above or below the flat plane the planets move in.
    expect(Math.abs(state.height)).toBeGreaterThan(20);
    expect(errors).toEqual([]);
  });

  test('can be selected on the simplified 2D chart too (no 3D, no tail, but it is there and fades)', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await openGame(page, '?renderer=canvas2d');
    await chip(page, 'c2026a2').click();
    await expect(page.locator('.info-panel')).toBeVisible();
    await expect(page.locator('.info-title')).toHaveText('C/2026 A2 (Bok)');
    expect(errors).toEqual([]);
  });

  test('the autopilot can fly to it, even though it moves', async ({ page }) => {
    test.slow();
    await openGame(page);
    await page.getByRole('button', { name: 'Pilot ship' }).click();
    await chip(page, 'c2026a2').click(); // while piloting, an object button means "fly there"
    await expect(page.locator('.pilot-message')).toContainText('Arrived at C/2026 A2 (Bok)', {
      timeout: 90_000,
    });
    await expect(page.locator('.pilot')).toHaveAttribute('data-in-range', 'true');
  });
});
