import { test, expect, pasteIngredients, tab } from './fixtures.js';

// A fake camera, and a stand-in BarcodeDetector that reports a queue of codes
// (headless Chromium has neither a camera nor a barcode detector).
test.use({
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  permissions: ['camera'],
});

const fakeDetector = () => {
  window.__codes = [];
  window.BarcodeDetector = class {
    static async getSupportedFormats() { return ['ean_13', 'ean_8', 'upc_a', 'upc_e']; }
    async detect() {
      const q = window.__codes;
      if (!q.length) return [];
      q[0].n -= 1;
      const { code } = q[0];
      if (q[0].n <= 0) q.shift();
      return code ? [{ rawValue: code, format: 'ean_13' }] : [];
    }
  };
};
/** Shows `code` to the "camera" for a few frames, then nothing. */
const show = (page, code) => page.evaluate((c) => window.__codes.push({ code: c, n: 6 }, { code: null, n: 4 }), code);

const product = (code, name, text, extra = {}) => ({ code, product_name: name, ingredients_text_ro: text, ...extra });
const PRODUCTS = [
  product('5941234567899', 'Biscuiți cu cacao', 'făină de grâu, zahăr, ulei de palmier, E129'),
  product('5940000000004', 'Apă minerală', 'apă minerală naturală'),
  product('3017620422003', 'Cremă de alune', 'zahăr, ulei de palmier, alune 13%, lapte praf'),
  product('4006381333931', 'Iaurt', 'lapte, culturi lactice'),
];

test('shopping mode: five products in a row without leaving the camera; open one and come back', async ({ page, context, api }) => {
  await context.addInitScript(fakeDetector);
  api.set({ food: [...PRODUCTS, { code: '5449000000996', product_name: 'Fără ingrediente' }] });
  await page.goto('./');
  await page.click('.scan-btn');
  await expect(page.locator('.scanner')).toBeVisible();
  await page.click('.shop-toggle');
  await expect(page.locator('.shop-sheet')).toBeVisible();

  for (const p of PRODUCTS) await show(page, p.code);
  await show(page, '5449000000996'); // found, but without ingredients
  await show(page, '5941234567899'); // the first one again: no duplicate

  const cards = page.locator('.shop-card');
  await expect(cards).toHaveCount(5);
  await expect(page.locator('.shop-card', { hasText: 'Biscuiți cu cacao' })).toContainText('Nerecomandat');
  await expect(page.locator('.shop-card', { hasText: 'Apă minerală' })).toContainText('Pare în regulă');
  await expect(page.locator('.shop-card', { hasText: 'Fără ingrediente' })).toContainText('lipsesc ingredientele');
  await expect(page.locator('.scanner')).toBeVisible(); // still scanning
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });

  await page.locator('.shop-card', { hasText: 'Biscuiți cu cacao' }).click();
  await expect(page.locator('.product-name')).toHaveText('Biscuiți cu cacao');
  await page.click('text=Înapoi la cumpărături');
  await expect(page.locator('.shop-card')).toHaveCount(5); // list intact

  // Shopping scans are in the history.
  await page.click('.scanner-close');
  await tab(page, 1).click();
  await expect(page.locator('.history-row')).toHaveCount(4);
});

test('compare two products from the history', async ({ page }) => {
  await page.goto('./');
  await pasteIngredients(page, 'zahăr, E129, E211, lapte praf');
  await page.click('text=Verificare nouă');
  await pasteIngredients(page, 'apă, E211, lecitină din soia');
  await tab(page, 1).click();
  await page.click('text=Compară două');
  const rows = page.locator('.history-row .history-open');
  await rows.nth(0).click();
  await rows.nth(1).click();
  await page.click('.compare-bar button:has-text("Compară")');
  const table = page.locator('.cmp-table');
  await expect(table).toBeVisible();
  await expect(table.locator('.cmp-list li.shared')).toHaveCount(2); // E211 in both columns
  await expect(table).toContainText('lapte');
  await expect(table).toContainText('soia');
  // readable at 320 px
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => Math.max(innerWidth, document.documentElement.scrollWidth))).toBeLessThanOrEqual(320);
  await page.click('text=Înapoi la istoric');
  await expect(page.locator('.history-row')).toHaveCount(2);
});
