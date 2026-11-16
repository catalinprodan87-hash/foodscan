import { test, expect, enterBarcode } from './fixtures.js';

const GERMAN = {
  code: '4008400402222', product_name: 'Nuss-Nougat-Creme', lang: 'de',
  ingredients_text: 'Zutaten: Zucker, Palmöl, HASELNÜSSE (13 %), MAGERMILCHPULVER (8,7 %), fettarmer Kakao (7,4 %), Emulgator Lecithine (SOJA), Vanillin, Frühlingsquark.',
};

test('ingredients only in German: translated on the phone, marked, original a tap away; the analysis finds the allergens', async ({ page, api }) => {
  api.set({ food: GERMAN });
  await page.goto('./');
  await enterBarcode(page, GERMAN.code);
  const note = page.locator('.translation-note');
  await expect(note).toContainText('Tradus automat din germană');
  const text = page.locator('.ingredients-text');
  await expect(text).toContainText('zahăr, ulei de palmier, ALUNE DE PĂDURE');
  await expect(text.locator('mark.untranslated')).toContainText('Frühlingsquark');
  await expect(page.locator('.allergen-card')).toContainText('lapte');
  await expect(page.locator('.allergen-card')).toContainText('soia');
  await note.locator('text=Vezi originalul').click();
  await expect(text).toContainText('Zucker, Palmöl');
  await note.locator('text=Vezi traducerea').click();
  await expect(text).toContainText('zahăr');
});

test('a Romanian list is not translated', async ({ page, api }) => {
  api.set({ food: { code: '5941234567899', product_name: 'Biscuiți', ingredients_text_ro: 'făină de grâu, zahăr, ulei de palmier, sare' } });
  await page.goto('./');
  await enterBarcode(page, '5941234567899');
  await expect(page.locator('.verdict')).toBeVisible();
  await expect(page.locator('.translation-note')).toHaveCount(0);
});
