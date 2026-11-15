import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRepeatFilter, addScan, updateScan, MAX_ITEMS } from '../src/lib/shopping.js';
import { compareEntries } from '../src/lib/compare.js';
import { makeEntry } from '../src/lib/history.js';
import { analyze } from '../src/lib/analyze.js';

describe('shopping mode', () => {
  test('the same code within 10 s is ignored; later it counts again', () => {
    const ok = createRepeatFilter(10_000);
    assert.equal(ok('1', 0), true);
    assert.equal(ok('1', 500), false);
    assert.equal(ok('2', 600), true);
    assert.equal(ok('1', 9_000), false, 'still in front of the camera (the clock restarts each time)');
    assert.equal(ok('1', 20_000), true);
  });

  test('new codes go on top as "loading"; a repeat moves to the top without a new lookup', () => {
    let { items, isNew } = addScan([], 'A', 1);
    assert.equal(isNew, true);
    ({ items } = addScan(items, 'B', 2));
    assert.deepEqual(items.map((x) => x.code), ['B', 'A']);
    const r = addScan(items, 'A', 3);
    assert.equal(r.isNew, false);
    assert.deepEqual(r.items.map((x) => x.code), ['A', 'B']);
    items = updateScan(r.items, 'B', { state: 'found', verdict: 'ok' });
    assert.equal(items.find((x) => x.code === 'B').verdict, 'ok');
    let many = [];
    for (let i = 0; i < MAX_ITEMS + 5; i++) many = addScan(many, String(i), i).items;
    assert.equal(many.length, MAX_ITEMS);
  });
});

describe('compare two products', () => {
  const entry = (text, nutrition) => {
    const req = { text, type: 'food', product: null, barcode: null };
    const e = makeEntry(req, analyze({ text, productType: 'food' }));
    if (nutrition) e.db = { nutrition: { items: nutrition } };
    return e;
  };

  test('verdicts, flagged additives, shared items and allergens side by side', () => {
    const a = entry('zahăr, E129, E211, lapte praf', [{ key: 'sugars', level: 'high' }]);
    const b = entry('apă, E211, lecitină din soia');
    const c = compareEntries(a, b, { presets: {}, custom: [] });
    assert.equal(c.a.verdict, 'bad');
    assert.deepEqual(c.a.flagged.map((x) => x.code), ['E129', 'E211']);
    assert.deepEqual(c.b.flagged.map((x) => x.code), ['E211']);
    assert.deepEqual(c.shared.flagged, ['E211']);
    assert.deepEqual(c.a.allergens, ['milk']);
    assert.deepEqual(c.b.allergens, ['soy']);
    assert.equal(c.a.nutrients.sugars, 'high');
    assert.equal(c.b.nutrients.sugars, null);
  });

  test('uses the current avoid list', () => {
    const a = entry('făină, scorțișoară');
    const b = entry('făină, zahăr');
    const c = compareEntries(a, b, { presets: {}, custom: [{ id: 'x', terms: ['scorțișoară'], types: ['food'] }] });
    assert.equal(c.a.avoid.length, 1);
    assert.equal(c.a.verdict, 'bad');
    assert.equal(c.b.avoid.length, 0);
  });
});
