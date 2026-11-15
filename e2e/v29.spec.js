import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { test, expect } from './fixtures.js';

// These tests need the real service worker (blocked in the other tests so the
// API mocks are never bypassed).
test.use({ serviceWorkers: 'allow' });

const swReady = (page) => page.evaluate(async () => {
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) {
    await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
  }
  return true;
});

/** What Android does on "Share → IngrediScan": a multipart POST navigation to ./share-target. */
async function shareInto(page, { file, text }) {
  await page.evaluate(({ text: shared }) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = './share-target';
    form.enctype = 'multipart/form-data';
    form.id = 'share-form';
    form.innerHTML = '<input type="file" name="photo" multiple><input type="hidden" name="text">';
    form.querySelector('[name=text]').value = shared || '';
    document.body.appendChild(form);
  }, { text });
  if (file) await page.setInputFiles('#share-form input[type=file]', file);
  await Promise.all([page.waitForURL(/\?share=1|\/$/), page.evaluate(() => document.getElementById('share-form').submit())]);
}

test('two photos shared at once: both are read and merged', async ({ page }) => {
  await page.goto('./');
  await swReady(page);
  await shareInto(page, { file: ['bench/ocr/images/tomato-flat.png', 'bench/ocr/images/biscuits-flat.png'] });
  test.setTimeout(120_000);
  await expect(page.locator('.crop-box img')).toBeVisible();
  await page.click('text=Sari peste, citește toată poza');
  await expect(page.locator('#ocr-text')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.photo-parts li')).toHaveCount(2, { timeout: 60_000 });
  expect(new URL(page.url()).search).toBe('');
});

test('a photo shared from another app opens the photo flow', async ({ page }) => {
  await page.goto('./');
  await swReady(page);
  await shareInto(page, { file: 'bench/ocr/images/tomato-flat.png' });
  await expect(page.locator('.crop-box img')).toBeVisible();
  expect(new URL(page.url()).search).toBe(''); // ?share=1 removed
  // Read once: a reload does not open it again.
  await page.reload();
  await expect(page.locator('.crop-box img')).toHaveCount(0);
});

test('shared text goes into the ingredients box', async ({ page }) => {
  await page.goto('./');
  await swReady(page);
  await shareInto(page, { text: 'apă, zahăr, E129' });
  await expect(page.locator('#ingredients')).toHaveValue('apă, zahăr, E129');
  await expect(page.locator('.toast')).toContainText('casetă');
});

test('opened with ?share=1 but nothing shared: says so', async ({ page }) => {
  await page.goto('./?share=1');
  await expect(page.locator('.toast')).toContainText('Nu a sosit nimic');
});

test('offline start after the first visit; the OCR engine is cached when used', async ({ page, context }) => {
  await page.goto('./');
  await swReady(page);
  const cached = await page.evaluate(async () => {
    const r = await fetch('./ocr/paddle/dict.txt');
    return r.ok;
  }).catch(() => null);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#ingredients')).toBeVisible();
  await expect(page.locator('.offline-banner')).toBeVisible();
  await context.setOffline(false);
  if (cached) expect(await page.evaluate(() => caches.has('ocr-engine'))).toBe(true);
});

for (const how of ['next visit', 'hourly check']) test(`a new version shows "Reîncarcă" and applies on tap (${how})`, async ({ page }) => {
  // Own static server over dist/, so sw.js can change as after a deploy
  // (the browser's service-worker update check bypasses request routing).
  let version = '';
  const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json' };
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = join('dist', path.endsWith('/') ? `${path}index.html` : path);
    try {
      let body = await readFile(file);
      if (path.endsWith('/sw.js')) body = Buffer.concat([body, Buffer.from(version)]);
      res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  try {
    await page.goto(base);
    await swReady(page);
    await expect(page.locator('.update-banner')).toHaveCount(0);
    version = '\n// next version';
    if (how === 'next visit') await page.reload();
    else await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await expect(page.locator('.update-banner')).toBeVisible({ timeout: 15_000 });
    await Promise.all([page.waitForEvent('load'), page.locator('.update-banner button').click()]);
    await expect(page.locator('.update-banner')).toHaveCount(0);
    await expect(page.locator('.toast')).toContainText('Actualizare reușită – v');
    expect(await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !r.waiting))).toBe(true);
  } finally {
    server.close();
  }
});
