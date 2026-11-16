import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPhoto } from '../src/lib/photoType.js';
import { mergeByType, mergeTexts } from '../src/lib/photoSet.js';
import { idsToDrop } from '../src/lib/thumbStore.js';

test('photo type from its text: ingredients, nutrition table, origin, front', () => {
  assert.deepEqual(classifyPhoto('Ingrediente: apă, zahăr 21,2% (din UE și din afara UE), pastă de tomate, oțet, amidon modificat din porumb, sare.').types, ['ingredients']);
  assert.deepEqual(classifyPhoto('Valori nutriționale medii per 100 g Valoare energetică 511 kJ / 120 kcal Grăsimi 0,1 g din care acizi grași saturați 0 g Glucide 28,9 g din care zaharuri 26 g Proteine 0,8 g Sare 2,30 g').types, ['nutrition']);
  assert.deepEqual(classifyPhoto('Produs și ambalat în UE pentru: MEGA IMAGE S.R.L., București, România. Țara de origine: Italia. Lot 2318').types, ['origin']);
  assert.deepEqual(classifyPhoto('KETCHUP dulce 550 g').types, ['front']);
  assert.deepEqual(classifyPhoto('Съставки: захар, какаова маса, палмово масло, лешници, мляко на прах').types, ['ingredients']);
  // A back label with both: it feeds both.
  assert.deepEqual(classifyPhoto('Ingrediente: zahăr, lapte praf, unt de cacao. Valori nutriționale per 100 g: Valoare energetică 2360 kJ / 566 kcal; Grăsimi 35,0 g; Glucide 53,5 g; zaharuri 53,3 g; Proteine 8,7 g; Sare 0,313 g').types, ['ingredients', 'nutrition']);
  // The real oil label: ingredients line + nutrition declaration → the table wins over its decimal commas.
  assert.deepEqual(classifyPhoto('DECLARAȚIE NUTRIȚIONALĂ/10g/100g: Valoare energetică: 370 kJ/90 kcal / 3700 kJ/900 kcal; Grăsimi: 10 g / 100g - din care acizi grași saturați: 1,1g / 11g; Glucide: 0g - din care zaharuri: 0g; Proteine: 0 g; Sare: 0g').types, ['nutrition']);
});

test('texts merged per type; overlapping photos of one label lose the repeat', () => {
  const merged = mergeByType([
    { types: ['ingredients'], raw: 'Ingrediente: zahăr, ulei de palmier, alune de pădure 13%, cacao' },
    { types: ['ingredients', 'nutrition'], raw: 'alune de pădure 13%, cacao degresată 7,4%, lapte praf' },
    { types: ['nutrition'], raw: 'Grăsimi 30,9 g' },
    { types: ['front'], raw: '' },
  ]);
  assert.match(merged.ingredients, /^zahăr, ulei de palmier, alune de pădure 13%, cacao degresată 7,4%, lapte praf$/);
  assert.match(merged.nutrition, /Grăsimi 30,9 g/);
  assert.equal(merged.front, undefined);
  assert.deepEqual(mergeTexts({ ingredients: 'a', origin: 'b' }, { ingredients: 'c', nutrition: '' }), { ingredients: 'c', origin: 'b' });
});

test('thumbnails: the oldest go beyond the cap', () => {
  const e = [{ id: 'a', date: '3' }, { id: 'b', date: '1' }, { id: 'c', date: '2' }];
  assert.deepEqual(idsToDrop(e, 2), ['b']);
  assert.deepEqual(idsToDrop(e, 5), []);
});
