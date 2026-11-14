import { test, expect, pasteIngredients } from './fixtures.js';

test('pasted ingredients → verdict, flagged additives, highlighted text', async ({ page }) => {
  await page.goto('./');
  await pasteIngredients(page, 'Ingrediente: zahăr, sirop de glucoză-fructoză, colorant: E129, conservant: benzoat de sodiu, aromă.');
  await expect(page.locator('.verdict h2')).toHaveText('Nerecomandat');
  const codes = page.locator('.additive .code');
  await expect(codes).toContainText(['E129', 'E211']);
  await expect(page.locator('.additive', { hasText: 'E129' }).locator('.pill').first()).toHaveText(/Risc ridicat/);
  await expect(page.locator('.ingredients-text .hl-high').first()).toBeVisible();
});

test('RO → EN switch translates the result', async ({ page }) => {
  await page.goto('./');
  await pasteIngredients(page, 'apă, zahăr, E330');
  await page.click('.lang-switch button:has-text("EN")');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.verdict h2')).not.toHaveText(/Nerecomandat|Atenție|În regulă/);
  await page.click('.lang-switch button:has-text("RO")');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
});

test('cosmetic ingredients are detected as a cosmetic', async ({ page }) => {
  await page.goto('./');
  await pasteIngredients(page, 'Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Parfum, Methylisothiazolinone, CI 42090');
  await expect(page.locator('.type-badge, .badge-type').first()).toContainText(/Cosmetic/i);
  await expect(page.locator('.additive', { hasText: /Methylisothiazolinone/i })).toBeVisible();
});
