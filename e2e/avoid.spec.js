import { test, expect, pasteIngredients, tab } from './fixtures.js';

test('a custom avoid term is flagged in the next analysis', async ({ page }) => {
  await page.goto('./');
  await tab(page, 2).click();
  await page.locator('.custom-form input[type=text], .custom-form input:not([type=checkbox])').first().fill('scorțișoară');
  await page.locator('.custom-form button[type=submit]').first().click();
  await expect(page.locator('.custom-list')).toContainText('scorțișoară');

  await tab(page, 0).click();
  await pasteIngredients(page, 'făină, zahăr, scortisoara 2%, sare');
  await expect(page.locator('#avoid-hits .avoid-hits')).toContainText(/scorțișoară/i);
});

test('"without" phrases are not hits', async ({ page }) => {
  await page.goto('./');
  await tab(page, 2).click();
  await page.locator('.custom-form input:not([type=checkbox])').first().fill('lactoză');
  await page.locator('.custom-form button[type=submit]').first().click();
  await tab(page, 0).click();
  await pasteIngredients(page, 'lapte fără lactoză, cultură de bacterii');
  await expect(page.locator('#avoid-hits')).toBeVisible();
  await expect(page.locator('#avoid-hits .avoid-hits')).toHaveCount(0);
});
