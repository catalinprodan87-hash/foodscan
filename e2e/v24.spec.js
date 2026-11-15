import { test, expect } from './fixtures.js';

test('a jar photographed from two sides: the second photo completes the text', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('./');
  await page.setInputFiles('.scan-card input[type=file][capture]', 'bench/ocr/images/jar-a.jpg');
  await expect(page.locator('.crop-wrap')).toBeVisible();
  await page.click('text=Sari peste, citește toată poza');
  const text = page.locator('#ocr-text');
  await expect(text).toBeVisible({ timeout: 150_000 });
  await expect(text).not.toHaveValue(/floarea-soarelui/);

  await page.setInputFiles('.add-photo input[type=file]', 'bench/ocr/images/jar-b.jpg');
  await expect(page.locator('.photo-parts li')).toHaveCount(2, { timeout: 120_000 });
  await expect(text).toHaveValue(/floarea-soarelui/);
  await expect(text).toHaveValue(/ardei/);
  await expect(page.locator('.review-card')).toContainText('rândurile au fost unite');

  // Removing the second photo gives the first text back.
  await page.click('.part-remove');
  await expect(page.locator('.photo-parts')).toHaveCount(0);
  await expect(text).not.toHaveValue(/floarea-soarelui/);

  await page.setInputFiles('.add-photo input[type=file]', 'bench/ocr/images/jar-b.jpg');
  await expect(page.locator('.photo-parts li')).toHaveCount(2, { timeout: 120_000 });
  await page.click('.review-card button[type=submit]');
  await expect(page.locator('.verdict')).toBeVisible();
  await expect(page.locator('.ingredients-text')).toContainText('floarea-soarelui');
});
