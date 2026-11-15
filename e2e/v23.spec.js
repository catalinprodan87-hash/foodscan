import { test, expect } from './fixtures.js';

test('the crop box is placed on the ingredients list automatically', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('./');
  await page.setInputFiles('.scan-card input[type=file][capture]', 'bench/ocr/images/biscuits-photo.jpg');
  await expect(page.locator('.crop-found')).toBeVisible({ timeout: 120_000 });
  // truth: the ingredients paragraph is at y ≈ 0.44, h ≈ 0.14 of the photo
  const box = await page.evaluate(() => {
    const frame = document.querySelector('.crop-box').getBoundingClientRect();
    const r = document.querySelector('.crop-rect').getBoundingClientRect();
    return { y: (r.top - frame.top) / frame.height, h: r.height / frame.height };
  });
  expect(box.y).toBeGreaterThan(0.3);
  expect(box.y).toBeLessThan(0.46);
  expect(box.h).toBeLessThan(0.35);
  await page.click('text=Citește zona aleasă');
  await expect(page.locator('#ocr-text')).toHaveValue(/făină de grâu/, { timeout: 60_000 });
});

test('moving the box yourself is never overridden by the suggestion', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('./');
  await page.setInputFiles('.scan-card input[type=file][capture]', 'bench/ocr/images/biscuits-photo.jpg');
  const rect = page.locator('.crop-rect');
  await expect(rect).toBeVisible();
  const b = await rect.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 30, { steps: 4 });
  await page.mouse.up();
  // Position inside the photo frame (notes above the photo may shift the whole frame).
  const inFrame = () => page.evaluate(() => {
    const f = document.querySelector('.crop-box').getBoundingClientRect();
    const r = document.querySelector('.crop-rect').getBoundingClientRect();
    return (r.top - f.top) / f.height;
  });
  const moved = await inFrame();
  await page.waitForTimeout(6000); // longer than the suggestion takes here
  await expect(page.locator('.crop-found')).toHaveCount(0);
  expect(await inFrame()).toBeCloseTo(moved, 3);
});

test('words the reader was unsure about are offered for checking', async ({ page }) => {
  test.setTimeout(240_000); // a real photo with a fold: some words stay uncertain
  await page.goto('./');
  await page.setInputFiles('.scan-card input[type=file][capture]', 'tests/corpus/own/ro-09-bomboane-fructe-iaurt.jpg');
  await expect(page.locator('.crop-wrap')).toBeVisible();
  await page.click('text=Sari peste, citește toată poza');
  await expect(page.locator('#ocr-text')).toBeVisible({ timeout: 200_000 });
  const chips = page.locator('.check-chip');
  await expect(chips.first()).toBeVisible();
  const word = await chips.first().textContent();
  await chips.first().click();
  const selected = await page.evaluate(() => { const el = document.querySelector('#ocr-text'); return el.value.slice(el.selectionStart, el.selectionEnd); });
  expect(selected.toLowerCase()).toBe(word.toLowerCase());
});
