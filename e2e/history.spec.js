import { test, expect, pasteIngredients, tab } from './fixtures.js';

test('history lists analyses; open, delete and undo', async ({ page }) => {
  await page.goto('./');
  await pasteIngredients(page, 'apă, zahăr, E129');
  await page.click('text=Verificare nouă');
  await pasteIngredients(page, 'Aqua, Parfum, Glycerin, Methylparaben');

  await tab(page, 1).click();
  const rows = page.locator('.history-row');
  await expect(rows).toHaveCount(2);

  await rows.first().locator('.history-open').click();
  await expect(page.locator('.verdict')).toBeVisible();
  await tab(page, 1).click(); // back to the list

  await rows.first().locator('.history-delete').click();
  await expect(rows).toHaveCount(1);
  await page.click('.toast button');
  await expect(rows).toHaveCount(2);
});
