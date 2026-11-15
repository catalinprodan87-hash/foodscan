import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures.js';

/** A benchmark label turned clockwise in the browser and re-encoded without EXIF. */
async function rotatedLabel(page, file, quarterTurns) {
  const b64 = readFileSync(file).toString('base64');
  const out = await page.evaluate(async ([data, q]) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const odd = q % 2 === 1;
    const c = new OffscreenCanvas(odd ? img.height : img.width, odd ? img.width : img.height);
    const ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((q * Math.PI) / 2);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (const x of bytes) s += String.fromCharCode(x);
    return btoa(s);
  }, [b64, quarterTurns]);
  return { name: `rotated-${quarterTurns}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.from(out, 'base64') };
}

for (const [turns, expected] of [[2, '180°'], [1, '270°']]) {
  test(`a photo saved ${turns * 90}° off is turned upright automatically, then read`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('./');
    await page.setInputFiles('.scan-card input[type=file][capture]', await rotatedLabel(page, 'bench/ocr/images/tomato-flat.png', turns));
    await expect(page.locator('.crop-wrap')).toBeVisible();
    await expect(page.locator('.auto-orient.turned')).toContainText(expected, { timeout: 150_000 });
    // The frame is landscape again (the label is wide).
    const box = await page.locator('.crop-wrap').boundingBox();
    expect(box.width / box.height).toBeGreaterThan(1);
    await page.click('text=Sari peste, citește toată poza');
    await expect(page.locator('#ocr-text')).toHaveValue(/concentrat de tomate/, { timeout: 60_000 });
  });
}

test('an upright photo is left as it is', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('./');
  await page.setInputFiles('.scan-card input[type=file][capture]', await rotatedLabel(page, 'bench/ocr/images/biscuits-flat.png', 0));
  await expect(page.locator('.auto-orient')).toHaveCount(1); // checking…
  await expect(page.locator('.auto-orient')).toHaveCount(0, { timeout: 150_000 }); // …done, nothing turned
});

test('tapping Rotește cancels the automatic check (the user decides)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('./');
  await page.setInputFiles('.scan-card input[type=file][capture]', await rotatedLabel(page, 'bench/ocr/images/tomato-flat.png', 2));
  await expect(page.locator('.crop-wrap')).toBeVisible();
  await page.click('.rotate-btn');
  await page.waitForTimeout(8000); // longer than the engine start + orientation check here
  await expect(page.locator('.auto-orient.turned')).toHaveCount(0);
});
