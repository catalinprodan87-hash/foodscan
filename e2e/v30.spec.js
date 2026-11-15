import { test, expect, pasteIngredients, tab, APP_VERSION, enterBarcode } from './fixtures.js';

test('no "report a problem" and no "add to Open Facts" anywhere; the Open Facts link stays', async ({ page, api }) => {
  api.set({ food: { code: '5941234567899', product_name: 'Biscuiți', ingredients_text_ro: 'făină, zahăr, E129' } });
  await page.goto('./');
  await enterBarcode(page, '5941234567899');
  await expect(page.locator('.verdict')).toBeVisible();
  await expect(page.locator('.report-problem, .add-product')).toHaveCount(0);
  await expect(page.locator('a[href*="openfoodfacts.org/product/"]').first()).toBeVisible();
  await tab(page, 0).click();
  await enterBarcode(page, '5940000000004'); // not found anywhere
  await expect(page.locator('.notice')).toBeVisible();
  await expect(page.locator('.add-product, a[href*="product.pl"]')).toHaveCount(0);
});

test('disclaimer: not in a footer; one short line on results, in full when something high-risk is flagged; in full on About', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('footer.disclaimer')).toHaveCount(0);
  await pasteIngredients(page, 'apă, zahăr, sare');
  const note = page.locator('.disclaimer-note');
  await expect(note).toContainText('Doar informativ, nu sfat medical.');
  await note.locator('button').click();
  await expect(note).toContainText('Toți aditivii comercializați în UE');

  await tab(page, 0).click();
  await pasteIngredients(page, 'zahăr, dioxid de titan E171');
  await expect(page.locator('.disclaimer-note')).toContainText('Toți aditivii comercializați în UE');

  await tab(page, 3).click();
  await expect(page.locator('#about-disclaimer')).toBeVisible();
  await expect(page.locator('footer.disclaimer')).toHaveCount(0);
});

test('after an update: "Actualizare reușită" and "Ce e nou" once', async ({ page, context }) => {
  await context.addInitScript(() => {
    if (sessionStorage.getItem('e2e:once')) return;
    sessionStorage.setItem('e2e:once', '1');
    sessionStorage.setItem('e2e:keepNews', '1');
    localStorage.setItem('ingrediscan:lastVersion', JSON.stringify('2.9.0'));
    localStorage.setItem('ingrediscan:pendingUpdate', JSON.stringify({ from: '2.9.0+x', to: null, at: Date.now() }));
  });
  await page.goto('./');
  await expect(page.locator('.toast')).toContainText(`Actualizare reușită – v${APP_VERSION}`);
  const news = page.locator('.whats-new');
  await expect(news).toContainText(`Ce e nou în v${APP_VERSION.split('.').slice(0, 2).join('.')}`);
  await news.locator('button').click();
  await expect(news).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.whats-new')).toHaveCount(0);
  await expect(page.locator('.toast')).toHaveCount(0);
});

test('an update that did not switch builds says so', async ({ page, context }) => {
  await context.addInitScript(() => {
    if (sessionStorage.getItem('e2e:once')) return;
    sessionStorage.setItem('e2e:once', '1');
    localStorage.setItem('ingrediscan:pendingUpdate', JSON.stringify({ from: 'old', to: '9.9.9+other', at: Date.now() }));
  });
  await page.goto('./');
  await expect(page.locator('.toast')).toContainText('Actualizarea nu a reușit – încearcă din nou');
});

test('About explains sharing into the app (Android) or why not (iPhone)', async ({ page }) => {
  await page.goto('./');
  await tab(page, 3).click();
  await expect(page.locator('.share-hint')).toContainText('instalează întâi aplicația'); // Pixel 7 in a browser tab
});

test.describe('iPhone', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' });
  test('share hint says it is not supported and points to the photo button', async ({ page }) => {
    await page.goto('./');
    await tab(page, 3).click();
    await expect(page.locator('.share-hint')).toContainText('Fotografiază ingredientele');
  });
});
