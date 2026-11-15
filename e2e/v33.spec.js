import { test, expect, enterBarcode, tab, NUTELLA } from './fixtures.js';

test('edit the database ingredients: re-analysed in place, remembered for the barcode, back to the original', async ({ page, api }) => {
  api.set({ food: NUTELLA });
  await page.goto('./');
  await enterBarcode(page, NUTELLA.code);
  await expect(page.locator('.verdict')).toBeVisible();
  await expect(page.locator('.additive-list, #additives')).not.toContainText('E171');

  await page.click('text=Editează ingredientele');
  const box = page.locator('#edit-ingr-text');
  await expect(box).toHaveValue(/Zahăr, ulei de palmier/);
  await box.fill(`${await box.inputValue()} Colorant: E171.`);
  await page.click('text=Re-analizează');
  await expect(page.locator('.edited-note')).toContainText('editate de tine');
  await expect(page.locator('.ingredients-text')).toContainText('E171');

  // Next scan of the same barcode: the edited text, even though the database has its own.
  await tab(page, 0).click();
  await enterBarcode(page, NUTELLA.code);
  await expect(page.locator('.edited-note')).toBeVisible();
  await expect(page.locator('.ingredients-text')).toContainText('E171');

  await page.click('text=Revino la textul original');
  await expect(page.locator('.edited-note')).toHaveCount(0);
  await expect(page.locator('.ingredients-text')).not.toContainText('E171');
});

test('a photo completes the database ingredients', async ({ page, api }) => {
  test.setTimeout(150_000);
  api.set({ food: NUTELLA });
  await page.goto('./');
  await enterBarcode(page, NUTELLA.code);
  await expect(page.locator('.edit-ingredients')).toContainText('Ingredientele din bază sunt greșite');
  await page.locator('.edit-ingredients input[type=file]').nth(1).setInputFiles('bench/ocr/images/tomato-flat.png'); // "Completează din poză"
  await expect(page.locator('.crop-box img')).toBeVisible();
  await page.click('text=Sari peste, citește toată poza');
  await expect(page.locator('#ocr-text')).toBeVisible({ timeout: 120_000 });
  await page.click('.review-card button[type=submit]');
  await expect(page.locator('.edited-note')).toContainText('dintr-o poză');
  await expect(page.locator('.ingredients-text')).toContainText('Zahăr, ulei de palmier');
  await expect(page.locator('.ingredients-text')).toContainText('tomate');
});

test('your own text from before is kept, but the database\'s Romanian list wins when it appears', async ({ page, context, api }) => {
  await context.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('ingrediscan:savedIngredients', JSON.stringify({
      3017620422003: { barcode: '3017620422003', text: 'zahăr, E129', productType: 'food', source: 'paste', date: '2026-01-01T00:00:00.000Z' },
    }));
  });
  api.set({ food: NUTELLA }); // the database has a Romanian list now
  await page.goto('./');
  await enterBarcode(page, NUTELLA.code);
  await expect(page.locator('.ingredients-text')).toContainText('Zahăr, ulei de palmier');
  await expect(page.locator('.saved-note')).toHaveCount(0);
});

test('before migrating, an automatic copy is kept and can be downloaded from About', async ({ page, context }) => {
  await context.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.removeItem('ingrediscan:flag:migrated33');
    localStorage.setItem('ingrediscan:savedIngredients', JSON.stringify({
      5940000000004: { barcode: '5940000000004', text: 'apă, sare', productType: 'food', source: 'photo', date: '2026-01-01T00:00:00.000Z' },
    }));
  });
  await page.goto('./');
  await tab(page, 3).click();
  const card = page.locator('.auto-backup');
  await expect(card).toContainText('Copie automată');
  const [download] = await Promise.all([page.waitForEvent('download'), card.locator('button').first().click()]);
  expect(download.suggestedFilename()).toMatch(/^ingrediscan-backup-auto-/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ingrediscan:savedIngredients')));
  expect(saved['5940000000004']).toMatchObject({ text: 'apă, sare', v: 2, explicit: false });
  await card.locator('button.danger').click();
  await expect(page.locator('.auto-backup')).toHaveCount(0);
});
