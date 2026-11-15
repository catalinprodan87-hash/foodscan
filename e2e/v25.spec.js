import { test, expect, pasteIngredients, tab, enterBarcode, NUTELLA } from './fixtures.js';

test('allergens are shown as information; watched ones get ⚠; the verdict does not change', async ({ page }) => {
  await page.goto('./');
  const text = 'Ingrediente: zahăr, unt de cacao, lapte praf integral, făină de grâu. Poate conține urme de arahide.';
  await pasteIngredients(page, text);
  const card = page.locator('.allergen-card');
  await expect(card).toContainText('Eticheta menționează:');
  await expect(card).toContainText('gluten');
  await expect(card).toContainText('lapte');
  await expect(card).toContainText('Urme posibile: arahide');
  await expect(card).toContainText('Informativ – nu schimbă evaluarea');
  await expect(page.locator('.summary-line')).toContainText('alergeni: gluten, lapte');
  const verdict = await page.locator('.verdict h2').textContent();

  await tab(page, 2).click();
  await page.check('#allergen-milk', { force: true });
  await tab(page, 0).click();
  await page.click('text=Verificare nouă').catch(() => {});
  await pasteIngredients(page, text);
  await expect(page.locator('.allergen.watched')).toContainText('lapte');
  await expect(page.locator('.verdict h2')).toHaveText(verdict);
});

test('no allergens found: says to check the label, never "allergen-free"', async ({ page }) => {
  await page.goto('./');
  await pasteIngredients(page, 'apă, zahăr, sare, acid citric');
  await expect(page.locator('.allergen-card')).toContainText('Nu am găsit alergeni în textul citit. Verifică eticheta');
  await expect(page.locator('.allergen-card')).not.toContainText('fără alergeni');
});

test('allergens and vegan status from Open Food Facts tags', async ({ page, api }) => {
  api.set({ food: { ...NUTELLA, allergens_tags: ['en:milk', 'en:nuts', 'en:soybeans'], traces_tags: [], ingredients_analysis_tags: ['en:non-vegan', 'en:vegetarian', 'en:palm-oil'] } });
  await page.goto('./');
  await enterBarcode(page, NUTELLA.code);
  const card = page.locator('.allergen-card');
  await expect(card).toContainText('lapte');
  await expect(page.locator('.diet-chips')).toContainText('Nu e vegan');
  await expect(page.locator('.diet-chips')).toContainText('Conține ulei de palmier');
  await expect(page.locator('.diet-chips')).toContainText('Open Food Facts');
});
