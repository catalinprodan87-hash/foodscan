import AxeBuilder from '@axe-core/playwright';
import { test, expect, pasteIngredients, tab, NUTELLA, enterBarcode } from './fixtures.js';

/** A second person "Copil" whose list also avoids caffeine. */
async function addChildWithCaffeine(page) {
  await tab(page, 2).click();
  await page.click('.add-profile-btn');
  await page.fill('#profile-name', 'Copil');
  await page.click('.profile-form button[type=submit]');
  await expect(page.locator('.profile-bar .chip-btn.active')).toHaveText('Copil');
  await page.click('label[for="preset-food-caffeine"]');
  await expect(page.locator('#preset-food-caffeine')).toBeChecked();
}

test('profiles: each person has a list; the result can be checked for another person', async ({ page }) => {
  await page.goto('./');
  await addChildWithCaffeine(page);
  // Back to "Eu": caffeine is not on that list.
  await page.locator('.profile-bar .chip-btn', { hasText: 'Eu' }).click();
  await expect(page.locator('#preset-food-caffeine')).not.toBeChecked();

  await tab(page, 0).click();
  await pasteIngredients(page, 'apă, zahăr, cafeină');
  await expect(page.locator('#result-profile')).toHaveValue(/.+/);
  await expect(page.locator('#avoid-hits')).not.toContainText('Cafeină');
  await page.selectOption('#result-profile', { label: 'Copil' });
  await expect(page.locator('#avoid-hits')).toContainText('Cafeină');

  // Kept after a reload.
  await page.reload();
  await tab(page, 2).click();
  await expect(page.locator('.profile-bar .chip-btn.active')).toHaveText('Copil');
});

test('send a list by link; opening the link offers to add it as a new person', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => { delete navigator.share; });
  await page.goto('./');
  await addChildWithCaffeine(page);
  await page.click('label[for="allergen-gluten"]');
  await page.locator('.profile-actions button').first().click();
  await expect(page.locator('.toast')).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const url = copied.split('\n').pop();
  expect(url).toMatch(/#import=[zj][A-Za-z0-9_-]+$/);

  // Opening the link (same phone here, so it becomes a third list).
  const other = await context.newPage();
  await other.goto(url);
  const card = other.locator('.import-card');
  await expect(card).toContainText('Copil');
  await card.locator('.btn.primary').click();
  await expect(other.locator('.import-card')).toHaveCount(0);
  expect(new URL(other.url()).hash).toBe('');
  await expect(other.locator('.profile-bar .chip-btn:not(.add-profile-btn)')).toHaveCount(3);
  await expect(other.locator('.profile-bar .chip-btn.active')).toHaveText('Copil');
  await expect(other.locator('#preset-food-caffeine')).toBeChecked();
  await expect(other.locator('#allergen-gluten')).toBeChecked();
});

test('a damaged link says so and changes nothing', async ({ page }) => {
  await page.goto('./#import=zAAAA');
  await expect(page.locator('.import-card[role=alert]')).toBeVisible();
  await page.locator('.import-card button').click();
  await expect(page.locator('.import-card')).toHaveCount(0);
});

test('glossary opens from the "?" on a score tile and from About', async ({ page, api }) => {
  api.set({ food: NUTELLA });
  await page.goto('./');
  await enterBarcode(page, NUTELLA.code);
  await page.locator('.score-tile .help-btn').first().click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('NOVA');
  await expect(dlg.locator('.gl-item.current')).toContainText('NOVA');
  await page.keyboard.press('Escape');
  await expect(page.locator('.glossary')).toHaveCount(0);
  // Score tiles read as one sentence by screen readers.
  await expect(page.locator('.score-tile .sr-only').first()).toContainText('NOVA 4 din 4');

  await tab(page, 3).click();
  await page.locator('.about-view button', { hasText: 'Ce înseamnă' }).click();
  await expect(page.locator('.glossary')).toContainText('DZA');
});

test('new presets: Southampton colours and caffeine (off by default)', async ({ page }) => {
  await page.goto('./');
  await tab(page, 2).click();
  await expect(page.locator('#preset-food-southampton')).not.toBeChecked();
  await page.click('label[for="preset-food-southampton"]');
  await tab(page, 0).click();
  await pasteIngredients(page, 'zahăr, colorant: tartrazină');
  await expect(page.locator('#avoid-hits')).toContainText('Coloranți cu avertizare');
});

test('scan-first setting opens the camera on start', async ({ page }) => {
  await page.goto('./');
  await tab(page, 3).click();
  await page.getByLabel('Deschide camera direct').check();
  await page.reload();
  await expect(page.locator('.scanner')).toBeVisible();
});

test('onboarding: "try with an example" shows a result', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.removeItem('ingrediscan:flag:onboarded'));
  await page.goto('./');
  const onb = page.locator('.onboarding');
  await onb.locator('.btn.primary').click();
  await onb.locator('.btn.primary').click();
  await onb.locator('.btn.ghost', { hasText: 'exemplu' }).click();
  await expect(page.locator('.onboarding')).toHaveCount(0);
  await expect(page.locator('.verdict')).toBeVisible();
});

// ───────────────────────── accessibility ─────────────────────────

const axe = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = r.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  expect(bad.map((v) => `${name}: ${v.id} – ${v.nodes.slice(0, 4).map((n) => `${n.target.join(' ')} ${(n.any[0]?.message || '').slice(0, 90)}`).join(' | ')}`)).toEqual([]);
};

for (const scheme of ['light', 'dark']) {
  test(`axe: no serious or critical issues on any screen (${scheme})`, async ({ page, api }) => {
    await page.emulateMedia({ colorScheme: scheme });
    api.set({ food: NUTELLA });
    await page.goto('./');
    await axe(page, 'home');
    await enterBarcode(page, NUTELLA.code);
    await expect(page.locator('.verdict')).toBeVisible();
    await page.locator('details.score-details summary').click();
    await axe(page, 'result');
    await tab(page, 1).click();
    await axe(page, 'history');
    await tab(page, 2).click();
    await axe(page, 'list');
    await tab(page, 3).click();
    await axe(page, 'about');
    await page.locator('.about-view button', { hasText: 'Ce înseamnă' }).click();
    await axe(page, 'glossary');
  });
}

test('text at 200%: no screen scrolls sideways', async ({ page, api }) => {
  api.set({ food: NUTELLA });
  await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '200%'; }));
  await page.goto('./');
  const wide = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await wide(), 'home').toBeLessThanOrEqual(1);
  await enterBarcode(page, NUTELLA.code);
  await expect(page.locator('.verdict')).toBeVisible();
  expect(await wide(), 'result').toBeLessThanOrEqual(1);
  for (const [i, name] of [[1, 'history'], [2, 'list'], [3, 'about']]) {
    await tab(page, i).click();
    expect(await wide(), name).toBeLessThanOrEqual(1);
  }
});
