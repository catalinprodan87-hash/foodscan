/**
 * Shared setup: onboarding skipped, Open *Facts API mocked per test, page
 * errors collected (a test fails if the page throws).
 */
import { test as base, expect } from '@playwright/test';

export const NUTELLA = {
  code: '3017620422003', product_name: 'Cremă de alune cu cacao', brands: 'Ferrero', quantity: '400 g',
  ingredients_text_ro: 'Zahăr, ulei de palmier, alune de pădure 13%, cacao degresată 7,4%, lapte praf degresat 6,6%, zer praf, emulgatori: lecitine (soia), vanilină.',
  additives_tags: ['en:e322'], nova_group: 4, nutriscore_grade: 'e',
  nutrient_levels: { fat: 'high', 'saturated-fat': 'high', sugars: 'high', salt: 'low' },
};
export const TOMATO_NO_INGREDIENTS = { code: '5949069402286', product_name: 'Pastă de tomate', brands: 'Test', nova_group: 3, nutriscore_grade: 'c' };

const found = (product) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 1, product }) });
const notFound = { status: 404, contentType: 'application/json', body: '{"status":0}' };

export const test = base.extend({
  /**
   * api.set({ food: product | null, beauty, products, fail: false })
   * Which Open *Facts database knows which product; `fail` makes every request
   * fail as if offline. api.calls counts requests.
   */
  // auto: every test is mocked, even when it doesn't use `api` – never the real network.
  api: [async ({ context }, use) => {
    const state = { food: null, beauty: null, products: null, fail: false, calls: 0 };
    await context.route(/open(food|beauty|products)facts\.org\/api/, (route) => {
      state.calls++;
      if (state.fail) return route.abort('internetdisconnected');
      const url = route.request().url();
      const db = url.includes('openfoodfacts') ? 'food' : url.includes('openbeautyfacts') ? 'beauty' : 'products';
      const p = state[db];
      return route.fulfill(p && url.includes(p.code) ? found(p) : notFound);
    });
    await use({
      set: (patch) => Object.assign(state, patch),
      get calls() { return state.calls; },
    });
  }, { auto: true }],
  page: async ({ page, context }, use) => {
    await context.addInitScript(() => localStorage.setItem('ingrediscan:flag:onboarded', 'true'));
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await use(page);
    expect(errors, 'page errors').toEqual([]);
  },
});

export { expect };

/** Types a barcode into the manual field and submits it. */
export async function enterBarcode(page, code) {
  await page.fill('#barcode', code);
  await page.click('.barcode-form button[type=submit]');
}

/** Pastes ingredients on the home screen and analyses them. */
export async function pasteIngredients(page, text) {
  await page.fill('#ingredients', text);
  await page.click('.input-card button[type=submit]');
  await expect(page.locator('.verdict')).toBeVisible();
}

export const tab = (page, i) => page.locator('.tabbar button').nth(i);
