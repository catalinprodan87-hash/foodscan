import { test, expect, pasteIngredients, tab, enterBarcode, NUTELLA } from './fixtures.js';

test('newly covered E-numbers and plurals are recognised, with sources and review date', async ({ page }) => {
  await page.goto('./');
  await pasteIngredients(page, 'apă, îndulcitori: ciclamați, colorant: E161g, carbonat de calciu, polisorbat 60');
  const codes = page.locator('.additive .code');
  await expect(codes).toContainText(['E952', 'E435', 'E161g', 'E170']);
  await page.locator('.additive', { hasText: 'E952' }).locator('summary').click();
  const src = page.locator('.additive', { hasText: 'E952' }).locator('.item-sources');
  await expect(src).toContainText('Surse:');
  await expect(src).toContainText('verificat');
  await expect(src.locator('a').first()).toHaveAttribute('href', /^https:\/\//);
});

test('product page date from Open Food Facts, database counts in About', async ({ page, api }) => {
  api.set({ food: { ...NUTELLA, last_modified_t: 1735689600 } }); // 1 Jan 2025
  await page.goto('./');
  await enterBarcode(page, NUTELLA.code);
  await expect(page.locator('.product-updated')).toContainText('2025');
  await tab(page, 3).click();
  await expect(page.locator('.db-counts')).toContainText(/Aditivi alimentari: \d{3}/);
  await expect(page.locator('.db-counts')).toContainText('Grupe de alergeni (UE): 14');
});
