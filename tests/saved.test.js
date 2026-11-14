import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { savedFromRequest, requestFromSaved, upsertSaved, savedFromHistory, createSavedStore } from '../src/lib/savedIngredients.js';
import { buildRequest } from '../src/lib/request.js';
import { analyzeInput } from '../src/lib/lookup.js';
import { analyze } from '../src/lib/analyze.js';

const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const NOW = new Date('2026-11-14T10:00:00Z');
const PRODUCT = {
  code: '5949069402286', productType: 'food', name: 'Pastă de tomate', brands: 'X', quantity: '140 g', image: null,
  source: 'Open Food Facts', url: 'https://example.org/p', hasIngredients: false, ingredientsText: '',
  additiveTags: [], nova: 4, nutriscore: 'c', nutrition: null,
};

describe('remembered ingredients', () => {
  test('a photo for a barcode found without ingredients is remembered, with the product details', () => {
    const req = buildRequest({ text: 'concentrat de tomate, sare', source: 'photo', product: PRODUCT, confidence: 0.91 });
    const s = savedFromRequest(req, NOW);
    assert.equal(s.barcode, PRODUCT.code);
    assert.equal(s.source, 'photo');
    assert.equal(s.confidence, 0.91);
    assert.equal(s.product.name, 'Pastă de tomate');
    assert.equal(s.product.ingredientsText, undefined, 'database ingredients are not kept');
    assert.equal(s.date, NOW.toISOString());
  });

  test('pasted text for a barcode that was not found is remembered without product', () => {
    const s = savedFromRequest(buildRequest({ text: 'apă, zahăr, E330', barcode: '4006381333931' }), NOW);
    assert.equal(s.barcode, '4006381333931');
    assert.equal(s.source, 'paste');
    assert.equal(s.product, null);
    assert.equal(s.productType, 'food');
  });

  test('nothing is remembered without a barcode or without user text', () => {
    assert.equal(savedFromRequest(buildRequest({ text: 'apă, zahăr' })), null);
    assert.equal(savedFromRequest({ text: '', type: 'food', product: { ...PRODUCT, hasIngredients: true }, barcode: PRODUCT.code }), null);
  });

  test('the next scan rebuilds the same analysis (same verdict and scores)', () => {
    const req = buildRequest({ text: 'concentrat de tomate, sare, E211', source: 'photo', product: PRODUCT, confidence: 0.9 });
    const first = analyze(analyzeInput(req.product, req.text));
    const again = requestFromSaved(savedFromRequest(req, NOW));
    assert.equal(again.barcode, PRODUCT.code);
    assert.equal(again.fromPhoto, true);
    assert.deepEqual(again.saved, { date: NOW.toISOString(), source: 'photo' });
    const second = analyze(analyzeInput(again.product, again.text));
    assert.equal(second.verdict, first.verdict);
    assert.equal(second.nutriscore, 'c');
    assert.equal(second.processing.nova, 4);
    assert.deepEqual(second.items.map((x) => x.code), first.items.map((x) => x.code));
  });

  test('fresh product details replace the stored ones, the user text stays', () => {
    const s = savedFromRequest(buildRequest({ text: 'roșii, sare', source: 'photo', product: PRODUCT }), NOW);
    const r = requestFromSaved(s, { ...PRODUCT, name: 'Pastă de tomate 24%', nutriscore: 'b', hasIngredients: true, ingredientsText: 'altceva' });
    assert.equal(r.product.name, 'Pastă de tomate 24%');
    assert.equal(r.product.nutriscore, 'b');
    assert.equal(r.text, 'roșii, sare');
    assert.equal(analyzeInput(r.product, r.text).text, 'roșii, sare');
  });

  test('without product details the saved type is used', () => {
    const s = savedFromRequest(buildRequest({ text: 'Aqua, Sodium Laureth Sulfate, Parfum', barcode: '4006381333931', chosenType: 'cosmetic' }), NOW);
    const r = requestFromSaved(s);
    assert.equal(r.type, 'cosmetic');
    assert.equal(r.product, null);
  });

  test('upsert replaces by barcode and keeps the newest', () => {
    let m = {};
    for (let i = 0; i < 5; i++) m = upsertSaved(m, { barcode: 'c' + i, text: 'x', date: `2026-01-0${i + 1}` }, 3);
    assert.deepEqual(Object.keys(m).sort(), ['c2', 'c3', 'c4']);
    m = upsertSaved(m, { barcode: 'c3', text: 'new', date: '2026-02-01' }, 3);
    assert.equal(m.c3.text, 'new');
  });

  test('history entries with photo / pasted ingredients for a barcode are picked up (newest wins)', () => {
    const entries = [
      { barcode: '1', source: 'photo', text: 'a', productType: 'food', date: '2026-10-02', name: 'P', db: { source: 'Open Food Facts', additiveTags: [], nova: 3, nutriscore: 'd' } },
      { barcode: '1', source: 'paste', text: 'old', productType: 'food', date: '2026-10-01', db: null },
      { barcode: '2', source: 'barcode', text: 'from db', productType: 'food', date: '2026-10-01', db: {} },
      { barcode: null, source: 'paste', text: 'no code', productType: 'food', date: '2026-10-01' },
    ];
    const m = savedFromHistory(entries);
    assert.deepEqual(Object.keys(m), ['1']);
    assert.equal(m['1'].text, 'a');
    assert.equal(m['1'].product.nova, 3);
  });

  test('store: save, get, remove, seed only adds missing barcodes', () => {
    const ls = memoryStorage();
    const store = createSavedStore(ls);
    store.save(savedFromRequest(buildRequest({ text: 'apă', barcode: '111' }), NOW));
    assert.equal(createSavedStore(ls).get('111').text, 'apă', 'persists');
    store.seed([
      { barcode: '111', source: 'paste', text: 'other', productType: 'food', date: '2026-12-01' },
      { barcode: '222', source: 'photo', text: 'lapte', productType: 'food', date: '2026-10-01' },
    ]);
    assert.equal(store.get('111').text, 'apă');
    assert.equal(store.get('222').text, 'lapte');
    store.remove('111');
    assert.equal(store.get('111'), null);
    assert.equal(createSavedStore(null).get('x'), null, 'no storage: no crash');
  });
});
