import { test, expect, enterBarcode, pasteIngredients, tab } from './fixtures.js';

const PARMESAN = {
  code: '8001234567897', product_name: 'Parmigiano Reggiano', quantity: '200 g',
  ingredients_text_ro: 'lapte, sare, cheag',
  origins: 'Italia', manufacturing_places: 'Italy', labels_tags: ['en:pdo'],
};

test('origin from the database: chain to the country where it is sold, PDO explained with its source', async ({ page, api }) => {
  api.set({ food: PARMESAN });
  await page.goto('./');
  await enterBarcode(page, PARMESAN.code);
  const card = page.locator('.origin-card');
  await expect(card).toContainText('De unde vine');
  await expect(card.locator('.origin-chain')).toContainText('Origine: Italia');
  await expect(card.locator('.origin-chain')).toContainText('Vândut în: România');
  await expect(card.locator('.origin-plus')).toContainText('Denumire de origine protejată');
  await expect(card.locator('.origin-plus a').first()).toHaveAttribute('href', /eur-lex/);
});

test('origin read from the label text; "Vândut în" follows the setting', async ({ page, api }) => {
  api.set({ food: null });
  await page.goto('./');
  await pasteIngredients(page, 'Ingrediente: somon 98%, sare. Pescuit în zona FAO 27. Țara de origine: Norvegia. Procesat în Polonia. Produs decongelat.');
  const card = page.locator('.origin-card');
  await expect(card.locator('.origin-chain')).toContainText('Pescuit: Norvegia (FAO 27 – Atlanticul de Nord-Est)');
  await expect(card.locator('.origin-chain')).toContainText('Procesat / ambalat: Polonia');
  await expect(card.locator('.origin-info')).toContainText('Decongelat');
  await expect(card.locator('.origin-info')).toContainText('controale oficiale la frontieră');
  await expect(card).not.toContainText(/nesigur[ăa] |periculos/);

  await tab(page, 3).click();
  await page.locator('#sale-country').selectOption('PL');
  await tab(page, 0).click(); // back to the same result: the chain follows the new setting
  await expect(page.locator('.origin-chain')).toContainText('Vândut în: Polonia');
});
