import { test, expect, pasteIngredients, tab } from './fixtures.js';

// Small phones, light and dark: nothing may scroll sideways.
for (const width of [390, 320]) {
  for (const scheme of ['light', 'dark']) {
    test(`no horizontal overflow at ${width}px, ${scheme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('./');
      // On a phone, content wider than the screen widens the layout viewport
      // (the page is zoomed out to fit), so check both widths.
      const overflow = () => page.evaluate((w) => Math.max(window.innerWidth, document.documentElement.scrollWidth) - w, width);
      expect(await overflow()).toBeLessThanOrEqual(0);
      await pasteIngredients(page, 'Ingrediente: zahăr, sirop de glucoză-fructoză, colorant: E129, E133, antioxidant: BHA, conservant: metabisulfit de sodiu (E223), aromă.');
      expect(await overflow(), 'result').toBeLessThanOrEqual(0);
      for (const [i, name] of [[1, 'history'], [2, 'avoid list'], [3, 'about']]) {
        await tab(page, i).click();
        await expect(page.locator('.page-title, h1').first()).toBeVisible();
        expect(await overflow(), name).toBeLessThanOrEqual(0);
      }
    });
  }
}
