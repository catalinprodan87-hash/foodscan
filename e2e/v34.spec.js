import { test, expect, enterBarcode, NUTELLA } from './fixtures.js';

test('several photos of one product: read, sorted by what they show, ingredients merged and analysed', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('./');
  await page.locator('.set-pick + input[type=file], .scan-card input[type=file][multiple]').first()
    .setInputFiles(['bench/ocr/images/tomato-flat.png', 'tests/corpus/own/ro-06-ketchup.jpg']);
  await expect(page.locator('.set-item')).toHaveCount(2);
  await expect(page.locator('.set-done')).toHaveCount(2, { timeout: 200_000 });
  // The ketchup back label holds the ingredients and the nutrition table.
  await expect(page.locator('.set-item').nth(1).locator('.chip-btn.active')).toContainText(['Ingrediente', 'Nutriție']);
  const text = page.locator('#set-ingr-text');
  await expect(text).toHaveValue(/tomate/);
  await page.click('.review-card .btn.primary');
  await expect(page.locator('.verdict')).toBeVisible();
});

test('"Adaugă poze" on a result: the photo is read, kept as a thumbnail and its texts stored with the barcode', async ({ page, api }) => {
  test.setTimeout(240_000);
  api.set({ food: NUTELLA });
  await page.goto('./');
  await enterBarcode(page, NUTELLA.code);
  await expect(page.locator('.verdict')).toBeVisible();
  await page.locator('.add-photos input[type=file]').setInputFiles('tests/corpus/own/ro-01-ulei-floarea-soarelui.jpg');
  await expect(page.locator('.set-done')).toHaveCount(1, { timeout: 200_000 });
  await expect(page.locator('.set-item .chip-btn.active')).toContainText(['Nutriție']);
  // No new ingredients in this photo: the product's own stay.
  await expect(page.locator('#set-ingr-text')).toHaveValue(/Zahăr, ulei de palmier/);
  await page.click('.review-card .btn.primary');
  await expect(page.locator('.verdict')).toBeVisible();
  await expect(page.locator('.photo-strip img')).toHaveCount(1);
  const rec = await page.evaluate((code) => JSON.parse(localStorage.getItem('ingrediscan:savedIngredients'))[code], NUTELLA.code);
  expect(rec.texts.nutrition).toMatch(/kcal/i);
});
