import { readFileSync } from 'node:fs';
import { test, expect, enterBarcode, pasteIngredients, tab, NUTELLA } from './fixtures.js';

test('rotate button turns the photo 90° per tap; four taps restore it', async ({ page }) => {
  await page.goto('./');
  await page.setInputFiles('.scan-card input[type=file][capture]', 'bench/ocr/images/tomato-flat.png');
  const wrap = page.locator('.crop-wrap');
  await expect(wrap).toBeVisible();
  const ratio = async () => {
    const box = await wrap.boundingBox();
    return box.width / box.height;
  };
  const original = await ratio();
  expect(original).toBeGreaterThan(1); // landscape label
  await page.click('.rotate-btn');
  await expect.poll(ratio).toBeLessThan(1);
  for (let i = 0; i < 3; i++) await page.click('.rotate-btn');
  await expect.poll(ratio).toBeCloseTo(original, 1);
});

test('the crop frame has exactly the photo\'s shape, also for tall photos on short screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto('./');
  await page.setInputFiles('.scan-card input[type=file][capture]', 'bench/ocr/images/tomato-flat.png');
  await expect(page.locator('.crop-wrap')).toBeVisible();
  for (let turn = 0; turn < 2; turn++) {
    const { frame, photo } = await page.evaluate(() => {
      const box = document.querySelector('.crop-box').getBoundingClientRect();
      const img = document.querySelector('.crop-box img');
      return { frame: box.width / box.height, photo: img.naturalWidth / img.naturalHeight };
    });
    expect(frame).toBeCloseTo(photo, 1);
    await page.click('.rotate-btn'); // now tall: must not be letterboxed
    await page.waitForFunction((prev) => {
      const img = document.querySelector('.crop-box img');
      return img.complete && Math.abs(img.naturalWidth / img.naturalHeight - prev) > 0.1;
    }, photo);
  }
});

test('in-store barcode (20–29): no lookup, photo / paste offered, remembered after', async ({ page, api }) => {
  await page.goto('./');
  await enterBarcode(page, '2012345678903');
  await expect(page.locator('.notice h2')).toContainText('Cod intern al magazinului');
  expect(api.calls).toBe(0);
  await page.fill('#paste-ingredients', 'carne de porc, sare, condimente, E250');
  await page.click('.paste-prompt button[type=submit]');
  await expect(page.locator('.saved-note')).toContainText('Salvat');
  await page.click('text=Verificare nouă');
  await enterBarcode(page, '2012345678903');
  await expect(page.locator('.saved-note')).toContainText('salvate pentru acest cod');
  expect(api.calls).toBe(0);
});

test('a not-found barcode is remembered for 24 h; "Caută din nou" asks again', async ({ page, api }) => {
  await page.goto('./');
  await enterBarcode(page, '4006381333931');
  await expect(page.locator('.notice h2')).toContainText('Produs negăsit');
  const calls = api.calls;
  expect(calls).toBe(3);
  await page.click('button:has-text("Verificare nouă")');
  await enterBarcode(page, '4006381333931');
  await expect(page.locator('.retry-card')).toContainText('ultimele 24 de ore');
  expect(api.calls).toBe(calls); // answered from the cache
  api.set({ food: { ...NUTELLA, code: '4006381333931' } });
  await page.click('.retry-card button');
  await expect(page.locator('.product-name')).toHaveText(NUTELLA.product_name);
});

test('settings: backup, delete all, restore', async ({ page }) => {
  await page.goto('./');
  await pasteIngredients(page, 'apă, zahăr, E129');
  await tab(page, 2).click();
  await page.locator('.custom-form input:not([type=checkbox])').first().fill('scorțișoară');
  await page.locator('.custom-form button[type=submit]').first().click();

  await tab(page, 3).click();
  await expect(page.locator('.settings-card')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('text=Salvează copia')]);
  expect(download.suggestedFilename()).toMatch(/^ingrediscan-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const backup = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(backup.format).toBe('ingrediscan-backup');
  expect(backup.history).toHaveLength(1);
  expect(backup.avoid.custom[0].terms).toEqual(['scorțișoară']);

  await page.click('.settings-card button:has-text("Șterge toate datele")');
  await page.click('text=Da, șterge tot');
  await page.waitForLoadState('load');
  await tab(page, 1).click();
  await expect(page.locator('.history-row')).toHaveCount(0);

  await tab(page, 3).click();
  await page.setInputFiles('.settings-card input[type=file]', {
    name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.locator('.confirm-box')).toContainText('1 elemente în istoric');
  await page.click('.confirm-box button:has-text("Restaurează")');
  await expect(page.locator('.settings-card [role=status]')).toContainText('Lista de evitat a fost înlocuită');
  await tab(page, 1).click();
  await expect(page.locator('.history-row')).toHaveCount(1);
  await tab(page, 2).click();
  await expect(page.locator('.custom-list')).toContainText('scorțișoară');
});

test('settings: a file that is not a backup is refused', async ({ page }) => {
  await page.goto('./');
  await tab(page, 3).click();
  await page.setInputFiles('.settings-card input[type=file]', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.locator('.settings-card .form-error')).toContainText('nu este un fișier de rezervă');
});

test('privacy section says what leaves the phone', async ({ page }) => {
  await page.goto('./');
  await tab(page, 3).click();
  await expect(page.locator('#about-privacy')).toBeVisible();
  await expect(page.locator('.privacy-list').first()).toContainText('Doar codul de bare');
});

test('report a problem: editable text with version and timings, copied when sharing is unavailable', async ({ page, context, api }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => { delete Navigator.prototype.share; });
  api.set({ food: NUTELLA });
  await page.goto('./');
  await enterBarcode(page, NUTELLA.code);
  await expect(page.locator('.verdict')).toBeVisible();
  await page.click('.report-problem summary');
  const text = page.locator('.report-problem textarea');
  await expect(text).toHaveValue(/Versiune \/ Version: 2\.1\.0/);
  await expect(text).toHaveValue(/lookup \d+ ms ok \(found food\)/);
  await expect(text).toHaveValue(new RegExp(NUTELLA.code));
  await text.fill(`Test: ${await text.inputValue()}`);
  await page.click('.report-problem button:has-text("Trimite")');
  await expect(page.locator('.report-problem [role=status]')).toContainText('Copiat');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^Test: IngrediScan/);
});
