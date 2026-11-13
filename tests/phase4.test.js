import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  makeEntry, entryRequest, entryAnalyzeInput, entryTitle, upsertEntries, filterEntries,
  createHistoryStore, entryId, HISTORY_MAX,
} from '../src/lib/history.js';
import {
  sanitizeAvoidState, parseTermsInput, addCustom, updateCustom, removeCustom, setPreset,
  exportAvoidList, importAvoidList, previewCounts,
} from '../src/lib/avoidList.js';
import { collectSpans, highlightSegments, itemDomId, shareSummary, addProductUrl, addProductLinks } from '../src/lib/share.js';
import { isIos, isStandalone, installMode } from '../src/lib/install.js';
import { analyze } from '../src/lib/analyze.js';
import { buildRequest } from '../src/lib/request.js';
import { mapProduct, analyzeInput } from '../src/lib/lookup.js';
import { defaultAvoidState, normalizeCustomEntry } from '../src/data/avoidPresets.js';

// ───────────────────────────────── helpers ────────────────────────────────

/** Mirrors App: request → analyze → history entry. */
function scan({ text = '', product = null, barcode = null, source = 'paste', chosenType = null }, avoid, date) {
  const req = buildRequest({ text, source, product, barcode, chosenType });
  const input = req.product ? analyzeInput(req.product, req.text) : { text: req.text, productType: req.type };
  return makeEntry(req, analyze(input, avoid), date);
}

const at = (n) => new Date(Date.UTC(2026, 10, 1, 12, 0, n));

const NUTELLA = mapProduct({
  code: '3017620422003', product_name: 'Nutella', brands: 'Ferrero', quantity: '400 g',
  image_front_small_url: 'https://images.openfoodfacts.org/n.jpg',
  ingredients_text_ro: 'Zahăr, ulei de palmier, alune de pădure 13%, cacao, lapte praf, emulgatori: lecitine (soia), vanilină.',
  additives_tags: ['en:e322'], nova_group: 4, nutriscore_grade: 'e',
}, 'food', '3017620422003');

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

// ───────────────────────────────── history ────────────────────────────────
describe('history entries', () => {
  test('a barcode scan stores barcode, name, brand, image, type, source, text, database fields, verdict, date', () => {
    const e = scan({ product: NUTELLA }, undefined, at(1));
    assert.equal(e.id, 'b:3017620422003');
    assert.equal(e.barcode, '3017620422003');
    assert.equal(e.name, 'Nutella');
    assert.equal(e.brand, 'Ferrero');
    assert.equal(e.image, 'https://images.openfoodfacts.org/n.jpg');
    assert.equal(e.productType, 'food');
    assert.equal(e.source, 'barcode');
    assert.ok(e.text.startsWith('Zahăr'));
    assert.deepEqual(e.db, { source: 'Open Food Facts', url: 'https://world.openfoodfacts.org/product/3017620422003', hasIngredients: true, additiveTags: ['en:e322'], nova: 4, nutriscore: 'e' });
    assert.equal(e.verdict, 'bad'); // palm oil is on by default
    assert.equal(e.date, '2026-11-01T12:00:01.000Z');
  });

  test('source is "photo" or "paste" for typed / photographed text', () => {
    assert.equal(scan({ text: 'Aqua, Parfum', source: 'photo' }).source, 'photo');
    assert.equal(scan({ text: 'zahăr, sare' }).source, 'paste');
    // pasted text for a not-found barcode keeps the barcode
    const e = scan({ text: 'zahăr, E250', barcode: '5940000000004' });
    assert.equal(e.id, 'b:5940000000004');
    assert.equal(e.source, 'paste');
  });

  test('same barcode replaces the older entry; list stays newest first', () => {
    let list = [];
    list = upsertEntries(list, scan({ product: NUTELLA }, undefined, at(1)));
    list = upsertEntries(list, scan({ text: 'apă, sare' }, undefined, at(2)));
    list = upsertEntries(list, scan({ product: NUTELLA }, undefined, at(3)));
    assert.equal(list.length, 2);
    assert.deepEqual(list.map((e) => e.date), [at(3).toISOString(), at(2).toISOString()]);
    assert.equal(list.filter((e) => e.barcode === '3017620422003').length, 1);
  });

  test('the same pasted text and type also replaces instead of duplicating', () => {
    assert.equal(entryId({ text: 'Zahăr,  sare', productType: 'food' }), entryId({ text: 'zahar, sare', productType: 'food' }));
    assert.notEqual(entryId({ text: 'zahăr', productType: 'food' }), entryId({ text: 'zahăr', productType: 'cosmetic' }));
  });

  test(`keeps only the last ${HISTORY_MAX}`, () => {
    let list = [];
    for (let i = 0; i < HISTORY_MAX + 15; i++) {
      list = upsertEntries(list, scan({ text: `ingredient ${i}, sare` }, undefined, new Date(Date.UTC(2026, 0, 1, 0, 0, i))));
    }
    assert.equal(list.length, HISTORY_MAX);
    assert.ok(list[0].text.startsWith(`ingredient ${HISTORY_MAX + 14}`));
    assert.ok(!list.some((e) => e.text.startsWith('ingredient 0,')));
  });

  test('search by name, brand or barcode (diacritics-insensitive); filter by type and verdict', () => {
    const list = [
      scan({ product: NUTELLA }, undefined, at(1)),
      scan({ text: 'Aqua, Sodium Laureth Sulfate, Methylisothiazolinone', chosenType: 'cosmetic' }, undefined, at(2)),
      scan({ text: 'Conține: <5% agenți de suprafață neionici, parfumuri', chosenType: 'household' }, undefined, at(3)),
      { ...scan({ text: 'apă, sare, roșii' }, undefined, at(4)), name: 'Suc de roșii', brand: 'Cămara' },
    ];
    assert.deepEqual(filterEntries(list, { query: 'nutel' }).map((e) => e.name), ['Nutella']);
    assert.deepEqual(filterEntries(list, { query: 'ferrero' }).length, 1);
    assert.deepEqual(filterEntries(list, { query: '30176204' }).length, 1);
    assert.deepEqual(filterEntries(list, { query: 'camara' }).map((e) => e.name), ['Suc de roșii']);
    assert.deepEqual(filterEntries(list, { type: 'cosmetic' }).map((e) => e.productType), ['cosmetic']);
    assert.deepEqual(filterEntries(list, { type: 'household' }).length, 1);
    assert.deepEqual(filterEntries(list, { verdict: 'bad' }).map((e) => e.productType).sort(), ['cosmetic', 'food']);
    assert.deepEqual(filterEntries(list, { verdict: 'ok' }).length, 2);
    assert.deepEqual(filterEntries(list, { type: 'food', verdict: 'ok', query: 'suc' }).length, 1);
  });

  test('opening an entry re-analyses it with the CURRENT avoid list', () => {
    const entry = scan({ text: 'făină, zahăr, arome' }, undefined, at(1)); // flavourings preset is off by default
    assert.equal(entry.verdict, 'warn'); // NOVA 4 only
    const avoidNow = setPreset(defaultAvoidState(), 'flavourings', true);
    const req = entryRequest(entry);
    assert.equal(req.fromHistory, true);
    const again = analyze({ text: req.text, productType: req.type }, avoidNow);
    assert.equal(again.verdict, 'bad');
    assert.deepEqual(again.avoidHits.map((h) => h.id), ['flavourings']);
    // and the list's verdict filter uses the re-analysed verdict
    const current = (e) => analyze(entryAnalyzeInput(e), avoidNow).verdict;
    assert.equal(filterEntries([entry], { verdict: 'bad' }, current).length, 1);
    assert.equal(filterEntries([entry], { verdict: 'bad' }).length, 0);
  });

  test('re-analysis of a barcode entry keeps the database NOVA, Nutri-Score and additive tags', () => {
    const entry = scan({ product: NUTELLA }, undefined, at(1));
    const req = entryRequest(entry);
    assert.equal(req.product.name, 'Nutella');
    const r = analyze(analyzeInput(req.product, req.text), { presets: { palm: false } });
    assert.deepEqual(r.processing, { nova: 4, source: 'database', markers: [] });
    assert.equal(r.nutriscore, 'e');
    assert.equal(r.verdict, 'warn'); // palm switched off → no longer "bad"
  });

  test('entry title falls back to the start of the ingredients text', () => {
    assert.equal(entryTitle({ name: 'Nutella' }), 'Nutella');
    assert.equal(entryTitle({ name: '', text: 'apă, sare' }), 'apă, sare');
    assert.ok(entryTitle({ name: '', text: 'x'.repeat(80) }).endsWith('…'));
  });

  test('localStorage fallback store: save, replace, limit, remove, clear', async () => {
    const store = await createHistoryStore({ indexedDB: null, localStorage: memoryStorage() });
    assert.equal(store.name, 'localstorage');
    await store.save(scan({ product: NUTELLA }, undefined, at(1)), 3);
    await store.save(scan({ text: 'a, b' }, undefined, at(2)), 3);
    await store.save(scan({ product: NUTELLA }, undefined, at(3)), 3);
    let all = await store.all();
    assert.equal(all.length, 2);
    assert.equal(all[0].barcode, '3017620422003');
    for (let i = 0; i < 5; i++) await store.save(scan({ text: `t${i}, sare` }, undefined, at(10 + i)), 3);
    all = await store.all();
    assert.equal(all.length, 3);
    await store.remove(all[0].id);
    assert.equal((await store.all()).length, 2);
    await store.clear();
    assert.deepEqual(await store.all(), []);
  });

  test('a failing IndexedDB falls back to localStorage', async () => {
    const brokenIdb = { open: () => { const req = {}; setTimeout(() => req.onerror?.()); return req; } };
    const store = await createHistoryStore({ indexedDB: brokenIdb, localStorage: memoryStorage() });
    assert.equal(store.name, 'localstorage');
  });
});

// ──────────────────────────────── avoid list ──────────────────────────────
describe('avoid list: custom entries per type', () => {
  test('"soia / soy" → alternative spellings; default types: all', () => {
    assert.deepEqual(parseTermsInput(' soia /soy / ') , ['soia', 'soy']);
    const s = addCustom(defaultAvoidState(), { terms: 'soia / soy' });
    assert.deepEqual(s.custom, [{ id: 'c-soia', terms: ['soia', 'soy'], types: ['food', 'cosmetic', 'household'] }]);
  });

  test('either spelling matches, whole words only', () => {
    const s = addCustom(defaultAvoidState(), { terms: 'soia / soy' });
    assert.equal(analyze({ text: 'lecitină din soia' }, s).avoidHits.at(-1).id, 'custom:c-soia');
    assert.equal(analyze({ text: 'soy lecithin' }, s).avoidHits.at(-1).id, 'custom:c-soia');
    assert.equal(analyze({ text: 'soiaxyz' }, s).avoidHits.length, 0);
  });

  test('an entry limited to cosmetics does not fire on food or cleaners', () => {
    const s = addCustom(defaultAvoidState(), { terms: 'lanolin / lanolină', types: ['cosmetic'] });
    assert.equal(analyze({ text: 'Aqua, Lanolin', productType: 'cosmetic' }, s).avoidHits.length, 1);
    assert.equal(analyze({ text: 'lanolină, zahăr', productType: 'food' }, s).avoidHits.length, 0);
    assert.equal(analyze({ text: 'lanolin', productType: 'household' }, s).avoidHits.length, 0);
  });

  test('custom hits make a food verdict "bad" and a cosmetic verdict "warn"', () => {
    const s = addCustom(defaultAvoidState(), { terms: 'arahide / peanut' });
    assert.equal(analyze({ text: 'cacao, arahide' }, s).verdict, 'bad');
    assert.equal(analyze({ text: 'Aqua, Peanut Oil', productType: 'cosmetic' }, s).verdict, 'warn');
  });

  test('edit and delete', () => {
    let s = addCustom(defaultAvoidState(), { terms: 'soia' });
    s = addCustom(s, { terms: 'soia' }); // duplicate gets its own id
    assert.deepEqual(s.custom.map((c) => c.id), ['c-soia', 'c-soia-2']);
    s = updateCustom(s, 'c-soia', { terms: 'soia / soy / soja', types: ['food'] });
    assert.deepEqual(s.custom[0], { id: 'c-soia', terms: ['soia', 'soy', 'soja'], types: ['food'] });
    s = updateCustom(s, 'c-soia-2', { terms: ' / ' }); // emptied → removed
    assert.equal(s.custom.length, 1);
    s = removeCustom(s, 'c-soia');
    assert.deepEqual(s.custom, []);
  });

  test('older saved lists (plain strings) are upgraded', () => {
    const s = sanitizeAvoidState({ presets: { palm: false, bogus: true }, custom: ['lapte', '', 42, { terms: ['ou'], types: ['food', 'pets'] }] });
    assert.equal(s.presets.palm, false);
    assert.equal('bogus' in s.presets, false);
    assert.deepEqual(s.custom.map((c) => c.terms[0]), ['lapte', 'ou']); // non-text values are dropped
    assert.deepEqual(s.custom[1].types, ['food']); // unknown type 'pets' ignored
    assert.equal(normalizeCustomEntry(null), null);
  });

  test('export → import round trip', () => {
    let s = setPreset(defaultAvoidState(), 'parabens', true);
    s = setPreset(s, 'palm', false);
    s = addCustom(s, { terms: 'soia / soy', types: ['food', 'cosmetic'] });
    const json = exportAvoidList(s, at(0));
    const parsed = JSON.parse(json);
    assert.equal(parsed.format, 'ingrediscan-avoid-list');
    assert.equal(parsed.version, 1);
    assert.deepEqual(importAvoidList(json), s);
  });

  test('import rejects files that are not an IngrediScan list', () => {
    assert.throws(() => importAvoidList('not json'), /invalid/);
    assert.throws(() => importAvoidList('{"presets":{}}'), /invalid/);
    assert.throws(() => importAvoidList('[]'), /invalid/);
  });

  test('preview: how many history items each preset / custom entry would flag', () => {
    const history = [
      scan({ product: NUTELLA }, undefined, at(1)),
      scan({ text: 'făină, ulei de palmier, arome' }, undefined, at(2)),
      scan({ text: 'Aqua, Methylparaben, Parfum', chosenType: 'cosmetic' }, undefined, at(3)),
      scan({ text: 'tofu din soia, apă' }, undefined, at(4)),
    ];
    const s = addCustom(defaultAvoidState(), { terms: 'soia / soy' });
    const counts = previewCounts(history, s);
    assert.equal(counts.palm, 2);
    assert.equal(counts.flavourings, 1); // counted even though the preset is off
    assert.equal(counts.parabens, 1);
    assert.equal(counts.fragrance, 1);
    assert.equal(counts['custom:c-soia'], 2); // Nutella (lecitine (soia)) + tofu
    assert.equal(counts.sulfates, 0);
  });
});

// ─────────────────────────────── highlighting ─────────────────────────────
describe('highlighting flagged words', () => {
  const text = 'Zahăr, ulei de palmier, colorant: caramel amoniacal-sulfitic (E150d), E129, acid citric, conservant: sorbat de potasiu.';
  const result = analyze({ text });

  test('spans for high / medium / low items and avoid hits, not for harmless ones', () => {
    const spans = collectSpans(text, result);
    const by = (s) => text.slice(s.start, s.end);
    assert.deepEqual(spans.map((s) => [by(s), s.level]), [
      ['ulei de palmier', 'avoid'],
      ['caramel amoniacal-sulfitic', 'medium'],
      ['E150d', 'medium'],
      ['E129', 'high'],
      ['sorbat de potasiu', 'low'],
    ]);
    assert.ok(!spans.some((s) => by(s) === 'acid citric')); // rated "none"
    assert.equal(spans.find((s) => by(s) === 'E129').target, 'item-E129');
    assert.equal(spans[0].target, 'avoid-hits');
  });

  test('segments rebuild the exact text', () => {
    const segs = highlightSegments(text, collectSpans(text, result));
    assert.equal(segs.map((s) => s.text).join(''), text);
    assert.equal(segs.filter((s) => s.level).length, 5);
  });

  test('overlaps: the more severe span wins', () => {
    const r = { items: [{ code: 'X', level: 'low', matches: ['sodium benzoate'] }, { code: 'Y', level: 'high', matches: ['benzoate'] }], avoidHits: [] };
    const spans = collectSpans('sodium benzoate', r);
    assert.deepEqual(spans.map((s) => s.level), ['high']);
  });

  test('cosmetic items are highlighted too; ids are DOM-safe', () => {
    const t2 = 'Aqua, Methylchloroisothiazolinone, Parfum';
    const r = analyze({ text: t2, productType: 'cosmetic' });
    const spans = collectSpans(t2, r);
    assert.ok(spans.some((s) => s.target === 'item-MCI-MI' && s.level === 'high'));
    assert.equal(itemDomId('MCI/MI'), 'item-MCI-MI');
  });
});

// ───────────────────────────── share & add links ──────────────────────────
describe('share and add-product links', () => {
  test('share summary: name, verdict, flagged ingredients, link', () => {
    const r = analyze(analyzeInput(NUTELLA));
    const s = shareSummary(r, { lang: 'ro', product: NUTELLA, appUrl: 'https://x.github.io/foodscan/' });
    assert.equal(s.title, 'IngrediScan: Nutella');
    assert.ok(s.text.startsWith('Nutella: Nerecomandat'));
    assert.ok(s.text.includes('Din lista ta de evitat: Ulei de palmier'));
    assert.ok(s.text.includes('Nutri-Score E'));
    assert.ok(s.text.includes('https://world.openfoodfacts.org/product/3017620422003'));
    assert.equal(s.url, 'https://x.github.io/foodscan/');
  });

  test('share summary lists high/medium items with their level (EN)', () => {
    const r = analyze({ text: 'apă, E129, E150d, E330' });
    const s = shareSummary(r, { lang: 'en', barcode: '5940000000004' });
    assert.ok(s.text.startsWith('Barcode 5940000000004: Not recommended'));
    assert.ok(s.text.includes('E129 Allura red AC (High risk)'));
    assert.ok(s.text.includes('E150d'));
    assert.ok(!s.text.includes('E330'));
  });

  test('pasted text without a product: the summary is named after the start of the text', () => {
    const r = analyze({ text: 'zahăr, ulei de palmier, E129, făină de grâu, sare, arome naturale' });
    const s = shareSummary(r, { lang: 'ro', text: 'zahăr, ulei de palmier, E129, făină de grâu, sare, arome naturale' });
    assert.ok(s.text.startsWith('„zahăr, ulei de palmier, E129, făină de…”: Nerecomandat'), s.text.split('\n')[0]);
  });

  test('add-product links point to the right Open *Facts site', () => {
    assert.equal(addProductUrl('food', '5940000000004'), 'https://world.openfoodfacts.org/cgi/product.pl?type=search_or_add&action=process&code=5940000000004');
    assert.ok(addProductUrl('cosmetic', '1').startsWith('https://world.openbeautyfacts.org/'));
    assert.ok(addProductUrl('household', '1').startsWith('https://world.openproductsfacts.org/'));
    assert.deepEqual(addProductLinks('1', 'household').map((l) => l.name), ['Open Products Facts', 'Open Food Facts', 'Open Beauty Facts']);
  });
});

// ───────────────────────────────── install ────────────────────────────────
describe('install detection', () => {
  test('iPhone, iPad (desktop UA with touch), Android', () => {
    assert.equal(isIos({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }), true);
    assert.equal(isIos({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 }), true);
    assert.equal(isIos({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 }), false);
    assert.equal(isIos({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' }), false);
  });

  test('standalone detection and which help to show', () => {
    assert.equal(isStandalone({ matchMedia: () => ({ matches: true }) }), true);
    assert.equal(isStandalone({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } }), true);
    assert.equal(installMode({ standalone: true, hasPrompt: true }), null);
    assert.equal(installMode({ standalone: false, hasPrompt: true }), 'prompt');
    assert.equal(installMode({ standalone: false, ios: true, iosHintDismissed: false }), 'ios');
    assert.equal(installMode({ standalone: false, ios: true, iosHintDismissed: true }), null);
    assert.equal(installMode({ standalone: false, ios: false }), null);
  });
});

// ──────────────────────────── colour contrast ─────────────────────────────
describe('colour contrast (WCAG AA, 4.5:1 for text)', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const lum = (hex) => {
    const [r, g, b] = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const block = (selector) => css.slice(css.indexOf(selector)).split('}')[0];
  const varIn = (src, name) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(src)?.[1];
  const bgOf = (cls) => new RegExp(`\\.${cls}\\s*\\{[^}]*background:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[1];

  test('verdict banners and NOVA badges: white text', () => {
    for (const cls of ['verdict-bad', 'verdict-warn', 'verdict-ok', 'verdict-unknown', 'nova-1', 'nova-2', 'nova-3', 'nova-4']) {
      const bg = bgOf(cls);
      assert.ok(bg, cls);
      assert.ok(ratio('#ffffff', bg) >= 4.5, `${cls} ${bg}: ${ratio('#ffffff', bg).toFixed(2)}`);
    }
  });

  test('risk pills and highlights in light and dark mode', () => {
    const light = block(':root {');
    const dark = block('@media (prefers-color-scheme: dark) {\n  :root {');
    for (const [label, src] of [['light', light], ['dark', dark]]) {
      for (const level of ['high', 'medium', 'low', 'none', 'unknown']) {
        const fg = varIn(src, level);
        const bg = varIn(src, `${level}-bg`);
        assert.ok(fg && bg, `${label} ${level}`);
        assert.ok(ratio(fg, bg) >= 4.5, `${label} ${level}: ${fg} on ${bg} = ${ratio(fg, bg).toFixed(2)}`);
      }
      const text = varIn(src, 'text');
      const bgPage = varIn(src, 'bg');
      const muted = varIn(src, 'muted');
      const surface = varIn(src, 'surface');
      assert.ok(ratio(text, bgPage) >= 4.5, `${label} text`);
      assert.ok(ratio(muted, surface) >= 4.5, `${label} muted on surface: ${ratio(muted, surface).toFixed(2)}`);
    }
  });
});
