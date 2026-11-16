import AxeBuilder from '@axe-core/playwright';
import { test, expect, enterBarcode, pasteIngredients, tab, NUTELLA } from './fixtures.js';

test('overall score: your score is the big number when your list is hit; general score and breakdown shown', async ({ page, api }) => {
  api.set({ food: NUTELLA });
  await page.goto('./');
  await enterBarcode(page, NUTELLA.code);
  const card = page.locator('.score-card');
  await expect(card.locator('h2')).toHaveText('Scor general');
  const big = Number(await card.locator('.score-num').textContent());
  expect(big).toBeGreaterThanOrEqual(1);
  expect(big).toBeLessThanOrEqual(49); // palm oil is on the default avoid list
  await expect(card.locator('.score-personal')).toContainText('Scorul tău');
  await expect(card.locator('.score-band')).toHaveText(/Slab|Sub medie/);
  await card.locator('summary').click();
  await expect(card.locator('.score-parts li')).toHaveCount(5);
  await expect(card.locator('.score-parts')).toContainText('Nutri-Score E');
  await expect(card.locator('.score-parts')).toContainText('NOVA 4');
  const axe = await new AxeBuilder({ page }).include('.score-card').analyze();
  expect(axe.violations).toEqual([]);

  // The history shows the general score (not the personal one).
  const general = Number((await card.locator('.score-personal').textContent()).match(/general (\d+)/)[1]);
  await tab(page, 1).click();
  await expect(page.locator('.history-score').first()).toHaveText(`${general}/100`);
});

test('cosmetics get an "ingredient score"; a banned-in-EU ingredient caps it at 25', async ({ page }) => {
  await page.goto('./');
  await page.locator('.type-selector [role=radio]', { hasText: 'Cosmetice' }).click();
  await pasteIngredients(page, 'AQUA, GLYCERIN, CETEARYL ALCOHOL, PARFUM, BUTYLPHENYL METHYLPROPIONAL');
  const card = page.locator('.score-card');
  await expect(card.locator('h2')).toHaveText('Scor ingrediente');
  expect(Number(await card.locator('.score-num').textContent())).toBeLessThanOrEqual(25);
  await expect(card.locator('.score-cap', { hasText: 'Plafonat la 25' })).toContainText('interzis sau nepermis în UE');
});

test('estimated when the data is incomplete', async ({ page }) => {
  await page.goto('./');
  await pasteIngredients(page, 'apă, zahăr, sare');
  await expect(page.locator('.score-card .score-estimated')).toContainText('scor estimat – date incomplete');
});

test('another family profile: the big number is the general score; their list is shown under it', async ({ page }) => {
  await page.goto('./');
  await tab(page, 2).click();
  await page.click('.add-profile-btn');
  await page.fill('#profile-name', 'Copil');
  await page.click('.profile-form button[type=submit]');
  await page.click('label[for="preset-food-caffeine"]');
  await page.locator('.profile-bar .chip-btn', { hasText: 'Eu' }).click();
  await tab(page, 0).click();
  await pasteIngredients(page, 'apă, zahăr, cafeină');
  const card = page.locator('.score-card');
  const general = Number(await card.locator('.score-num').textContent());
  await page.selectOption('#result-profile', { label: 'Copil' });
  await expect(card.locator('.score-personal')).toContainText('Cu lista profilului Copil');
  expect(Number(await card.locator('.score-num').textContent())).toBe(general);
});
