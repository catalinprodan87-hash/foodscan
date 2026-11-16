import { test, expect, enterBarcode, tab } from './fixtures.js';

const KETCHUP = {
  code: '5949065033583', product_name: 'Ketchup dulce', quantity: '550 g',
  ingredients_text_ro: 'apă, zahăr 21,2%, pastă de tomate 15,2%, oțet, amidon modificat din porumb, sare, aromă naturală',
  nutriments: { 'energy-kj_100g': 511, 'energy-kcal_100g': 120, fat_100g: 0.1, 'saturated-fat_100g': 0, carbohydrates_100g: 28.9, sugars_100g: 26, fiber_100g: 0.3, proteins_100g: 0.8, salt_100g: 2.3 },
};

test('no Nutri-Score in the database: the app computes it from the values, marked as such; category and values can be corrected', async ({ page, api }) => {
  api.set({ food: KETCHUP });
  await page.goto('./');
  await enterBarcode(page, KETCHUP.code);
  const card = page.locator('.nutrition-card');
  await expect(card).toContainText('Din baza de date');
  await expect(card.locator('.nutri-table')).toContainText('28,9 g');
  await expect(page.locator('.score-tile').nth(1)).toContainText('E');
  await expect(page.locator('.tile-computed')).toContainText('calculat de aplicație');
  await expect(card.locator('.nutri-computed')).toContainText('Nutri-Score E calculat de aplicație');
  await expect(card.locator('.nutri-computed')).toContainText('15,2%');

  // One tap: it is a drink (it is not, but the grade follows the category).
  await card.locator('.chip-btn', { hasText: 'Băutură' }).click();
  await expect(card.locator('.chip-btn.active')).toHaveText('Băutură');

  // Correct the salt: the grade is computed again and kept for the barcode.
  await card.locator('.chip-btn', { hasText: 'Aliment' }).click();
  await card.locator('text=Corectează valorile').click();
  await card.locator('.nutri-field', { hasText: 'Sare' }).locator('input').fill('0,1');
  await card.locator('.nutri-field', { hasText: 'din care zaharuri' }).locator('input').fill('3');
  await card.locator('.nutri-edit button[type=submit]').click();
  await expect(card).toContainText('Introduse sau corectate de tine');
  await expect(card.locator('.nutri-computed')).toContainText('Nutri-Score B'); // 1 point (energy) → B
  await tab(page, 0).click();
  await enterBarcode(page, KETCHUP.code);
  await expect(page.locator('.nutrition-card')).toContainText('Introduse sau corectate de tine');
});

test('inconsistent values are flagged and no grade is computed from them', async ({ page, api }) => {
  api.set({ food: { ...KETCHUP, nutriments: { ...KETCHUP.nutriments, sugars_100g: 40 } } }); // sugars > carbohydrates
  await page.goto('./');
  await enterBarcode(page, KETCHUP.code);
  await expect(page.locator('.nutri-problems')).toContainText('Zaharurile sunt mai multe decât glucidele');
  await expect(page.locator('.nutri-computed')).toHaveCount(0);
  await expect(page.locator('.tile-computed')).toHaveCount(0);
});
