import { test, expect, enterBarcode, NUTELLA, TOMATO_NO_INGREDIENTS } from './fixtures.js';

test('barcode found with ingredients → result with scores', async ({ page, api }) => {
  api.set({ food: NUTELLA });
  await page.goto('./');
  await enterBarcode(page, NUTELLA.code);
  await expect(page.locator('.product-name')).toHaveText(NUTELLA.product_name);
  await expect(page.locator('.verdict')).toBeVisible();
  await expect(page.locator('.score-tile')).toHaveCount(2);
  await expect(page.locator('.tile-big').first()).toHaveText('NOVA 4');
});

test('found without ingredients → paste → saved → re-scan is instant, also offline', async ({ page, api }) => {
  api.set({ food: TOMATO_NO_INGREDIENTS });
  await page.goto('./');
  await enterBarcode(page, TOMATO_NO_INGREDIENTS.code);
  await expect(page.locator('.notice')).toBeVisible();
  await page.fill('#paste-ingredients', 'concentrat de tomate, apă, sare, E211');
  await page.click('.paste-prompt button[type=submit]');
  await expect(page.locator('.saved-note')).toContainText('Salvat');

  await page.click('text=Verificare nouă');
  await enterBarcode(page, TOMATO_NO_INGREDIENTS.code);
  await expect(page.locator('.saved-note')).toContainText('salvate pentru acest cod');
  await expect(page.locator('.additive .code')).toContainText(['E211']);

  // Offline (every lookup fails) after a reload: still shown from the device.
  api.set({ fail: true });
  await page.reload();
  await enterBarcode(page, TOMATO_NO_INGREDIENTS.code);
  await expect(page.locator('.saved-note')).toBeVisible();
  await expect(page.locator('.verdict')).toBeVisible();

  // Forget → back to the "no ingredients" flow.
  api.set({ fail: false });
  await page.click('.saved-note .link-btn');
  await expect(page.locator('.notice')).toBeVisible();
});

test('barcode not found anywhere → photo and paste options', async ({ page }) => {
  await page.goto('./');
  await enterBarcode(page, '4006381333931');
  await expect(page.locator('.notice h2')).toContainText('Produs negăsit');
  await expect(page.locator('.notice input[type=file]')).toHaveCount(2); // one photo (camera) or several (gallery)
  await expect(page.locator('#paste-ingredients')).toBeVisible();
});

test('lookup fails → retry offered, then succeeds', async ({ page, api }) => {
  api.set({ fail: true, food: NUTELLA });
  await page.goto('./');
  await enterBarcode(page, NUTELLA.code);
  await expect(page.locator('.notice-error')).toBeVisible();
  api.set({ fail: false });
  await page.click('.notice-error button');
  await expect(page.locator('.product-name')).toHaveText(NUTELLA.product_name);
});

test('invalid check digit is rejected before any lookup', async ({ page, api }) => {
  await page.goto('./');
  await enterBarcode(page, '3017620422004');
  await expect(page.locator('#barcode-error')).toBeVisible();
  expect(api.calls).toBe(0);
});
