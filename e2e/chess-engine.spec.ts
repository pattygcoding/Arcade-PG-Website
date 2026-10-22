import { expect, test, type Page } from '@playwright/test';

/**
 * Play the engine through the page, the way a visitor does.
 *
 * The board is drawn from the worker's snapshot, so every assertion here is about
 * what the page shows: 64 squares, a piece per square that has one, the marked
 * destinations of the piece that was picked up, the engine's reply, and the perft
 * panel's counts — which are the published totals for the starting position, so a
 * mismatch means the move generator regressed rather than the layout did.
 */

const SQUARE = (name: string) => `.chess-square[data-square="${name}"]`;
const STATUS = '.chess-status-line';

/** Waits for the first snapshot, which is what marks the engine as loaded. */
async function waitForBoard(page: Page): Promise<void> {
  await expect(page.locator('.chess-square')).toHaveCount(64);
  await expect(page.locator('.chess-piece')).toHaveCount(32);
  await expect(page.locator(STATUS)).not.toBeEmpty();
}

async function playMove(page: Page, from: string, to: string): Promise<void> {
  await page.locator(SQUARE(from)).click();
  await page.locator(SQUARE(to)).click();
}

/** The move list's two ply cells for a row: the number is its own span. */
const PLY = '.chess-moves li span:not(.is-number)';

/**
 * Waits for the engine's reply to land in the first row's second cell.
 *
 * Before any move the list shows its empty state, whose second cell is blank, so a
 * filled second cell means the search finished and the reply was played.  (The two
 * cells sit flush against each other in the row, so the row's own text is
 * `1.e4b6` and no whitespace can be relied on.)
 */
async function waitForReply(page: Page): Promise<void> {
  await expect(page.locator(PLY).nth(1)).not.toBeEmpty({ timeout: 30_000 });
}

test.describe('chess engine', () => {
  test('draws the opening position with the white pieces at the bottom', async ({ page }) => {
    await page.goto('/chess');
    await waitForBoard(page);

    // The first square of the grid is a8 and the last is h1: white at the bottom,
    // files running a-to-h left to right.
    const names = await page
      .locator('.chess-square')
      .evaluateAll((squares) => squares.map((square) => square.getAttribute('data-square')));
    expect(names[0]).toBe('a8');
    expect(names[7]).toBe('h8');
    expect(names[56]).toBe('a1');
    expect(names[63]).toBe('h1');

    // Both sides draw the same solid artwork; only the colour tells them apart.  The
    // trailing \uFE0E is the text-presentation selector, which keeps a platform from
    // substituting the colour emoji glyph for one that ignores `color`.
    await expect(page.locator('.chess-square[data-square="e1"] .chess-piece')).toHaveText(
      '\u265A\uFE0E',
    );
    await expect(page.locator('.chess-square[data-square="e1"] .chess-piece')).toHaveClass(
      /is-white/,
    );
    await expect(page.locator('.chess-square[data-square="e8"] .chess-piece')).toHaveText(
      '\u265A\uFE0E',
    );
    await expect(page.locator('.chess-square[data-square="e8"] .chess-piece')).toHaveClass(
      /is-black/,
    );
  });

  test('marks the legal destinations and plays a move the engine answers', async ({ page }) => {
    await page.goto('/chess');
    await waitForBoard(page);
    await expect(page.locator(STATUS)).toHaveText(/your move/i);

    // Picking the king's pawn up marks exactly its two pushes.
    await page.locator(SQUARE('e2')).click();
    await expect(page.locator(SQUARE('e2'))).toHaveClass(/is-selected/);
    await expect(page.locator('.chess-target')).toHaveCount(2);

    await page.locator(SQUARE('e4')).click();
    await waitForReply(page);

    // Two plies in the first row: the visitor's move in SAN, then the engine's.
    const plies = await page.locator(PLY).allTextContents();
    expect(plies[0]).toBe('e4');
    expect(plies[1]).not.toBe('');
    await expect(page.locator(STATUS)).toHaveText(/your move/i);

    // The engine reports what it searched, and the last move is highlighted.
    await expect(page.locator('.chess-stats dd').first()).toHaveText('White');
    await expect(page.locator('.chess-stats dd').nth(1)).not.toHaveText('—');
    await expect(page.locator('.chess-square.is-last').first()).toBeVisible();
  });

  test('counts the published perft totals in the browser', async ({ page }) => {
    await page.goto('/chess');
    await waitForBoard(page);

    await page.getByRole('button', { name: /perft/i }).click();

    // Five rows, each one matching the published count for its depth.
    await expect(page.locator('.chess-perft tbody tr')).toHaveCount(5, { timeout: 60_000 });
    await expect(page.locator('.chess-perft td.is-ok')).toHaveCount(5);
    await expect(page.locator('.chess-perft td.is-bad')).toHaveCount(0);
    await expect(page.locator('.chess-perft tbody tr').last()).toContainText('4,865,609');
  });
});
