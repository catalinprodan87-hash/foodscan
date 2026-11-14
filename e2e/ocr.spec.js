import { test, expect } from './fixtures.js';

// Smoke test of the real on-device OCR (downloads the engine from the preview server).
test('photo of an ingredients label → crop → review → result', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('./');
  await page.setInputFiles('.scan-card input[type=file][capture]', 'bench/ocr/images/tomato-flat.png');
  await expect(page.locator('.crop-box img')).toBeVisible();
  await page.click('text=Sari peste, citește toată poza');
  const text = page.locator('#ocr-text');
  await expect(text).toBeVisible({ timeout: 150_000 });
  await expect(text).toHaveValue(/concentrat de tomate/);
  await page.click('.review-card button[type=submit]');
  await expect(page.locator('.verdict')).toBeVisible();
  await expect(page.locator('.photo-chip')).toBeVisible();
});
