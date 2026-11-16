import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nutriScore, gradeFor } from '../src/lib/nutriscore.js';
import { parseNutrition, checkNutrition, fromNutriments } from '../src/lib/nutritionText.js';
import { inferCategory, estimateFvl, buildNutrition } from '../src/lib/nutritionInfo.js';

test('Nutri-Score 2023: the same grade and score as Open Food Facts on 175 products sold in Romania', () => {
  const { products } = JSON.parse(readFileSync(new URL('./fixtures/nutriscore-off.json', import.meta.url)));
  const cat = (k) => (k.is_water ? 'water' : k.is_beverage ? 'drink' : k.is_fat_oil_nuts_seeds ? 'fats' : k.is_cheese ? 'cheese' : k.is_red_meat_product ? 'redMeat' : 'general');
  let same = 0;
  for (const p of products) {
    const c = p.components;
    const v = (id) => c[id]?.value ?? null;
    const sat = v('saturated_fat') ?? (v('energy_from_saturated_fat') != null ? v('energy_from_saturated_fat') / 37 : null);
    const fat = c.saturated_fat_ratio ? sat / (v('saturated_fat_ratio') / 100) : null;
    const r = nutriScore({ energyKj: v('energy') ?? 0, sugars: v('sugars'), saturatedFat: sat, fat, salt: v('salt'), protein: v('proteins'), fibre: v('fiber'), fvl: v('fruits_vegetables_legumes'), sweeteners: v('non_nutritive_sweeteners') > 0 }, cat(p.kind));
    if (r && r.grade === p.grade && r.score === p.score) same++;
  }
  // One product differs: salt shown as 1.6 g but stored a hair above (8 points at Open Food Facts, 7 here).
  assert.ok(same >= products.length - 1, `${same}/${products.length}`);
});

test('grade thresholds per category', () => {
  assert.equal(gradeFor(0), 'a');
  assert.equal(gradeFor(3), 'c');
  assert.equal(gradeFor(19), 'e');
  assert.equal(gradeFor(2, 'drink'), 'b');
  assert.equal(gradeFor(10, 'drink'), 'e');
  assert.equal(gradeFor(-6, 'fats'), 'a');
  assert.equal(nutriScore({}, 'water').grade, 'a');
  assert.equal(nutriScore({ energyKj: 100 }, 'general'), null); // incomplete
});

test('nutrition table from label text: per 100 g, the portion-first layout, the reference intake ignored', () => {
  const ketchup = parseNutrition('Valoare energetică 511 kJ / 120 kcal • 77 kJ / 18 kcal • 1%; Grăsimi 0,1 g • 0 g • 0%; din care acizi grași saturați 0 g • 0 g • 0%; Glucide 28,9 g • 4,3 g • 2%; din care zaharuri 26 g • 3,9 g • 4%; Fibre 0,3 g • <0,1 g • -; Proteine 0,8 g • 0,1 g • 0%; Sare 2,30 g • 0,35 g • 6% *CR – Consumul de referință al unui adult obișnuit (8400 kJ / 2000 kcal)');
  assert.deepEqual(ketchup.values, { energyKj: 511, energyKcal: 120, saturatedFat: 0, sugars: 26, carbohydrates: 28.9, fibre: 0.3, protein: 0.8, salt: 2.3, fat: 0.1 });
  const oil = parseNutrition('DECLARAȚIE NUTRIȚIONALĂ/10g (o lingură)/100g: Valoare energetică: 370 kJ/90 kcal / 3700 kJ/900 kcal; Grăsimi: 10 g / 100g - din care acizi grași saturați: 1,1g / 11g; Glucide: 0g - din care zaharuri: 0g; Proteine: 0 g; Sare: 0g');
  assert.equal(oil.portionFirst, true);
  assert.equal(oil.values.energyKcal, 900);
  assert.equal(oil.values.fat, 100);
  assert.equal(oil.values.saturatedFat, 11);
  const kinder = parseNutrition('Valoare energetică / Енергийна стойност (kJ/kcal) 2360/566 296/71 4\nGrăsimi / Мазнини / Zsír (g) 35,0 4,4 6\ndin care acizi grași saturați / от които наситени мастни киселини (g) 22,6 2,8 14\nGlucide / Въглехидрати (g) 53,5 6,7 3\ndin care zaharuri / от които захари (g) 53,3 6,7 7\nProteine / Белтъци (g) 8,7 1,1 2\nSare / Сол / Só (g) 0,313 0,039 1');
  assert.deepEqual(kinder.values, { energyKj: 2360, energyKcal: 566, saturatedFat: 22.6, sugars: 53.3, carbohydrates: 53.5, protein: 8.7, salt: 0.313, fat: 35 });
});

test('sanity checks: energy against the macronutrients, sugars ≤ carbohydrates, saturated ≤ fat', () => {
  assert.deepEqual(checkNutrition({ energyKj: 2360, energyKcal: 566, fat: 35, saturatedFat: 22.6, carbohydrates: 53.5, sugars: 53.3, protein: 8.7, salt: 0.313 }), []);
  assert.deepEqual(checkNutrition({ energyKj: 400, energyKcal: 566, fat: 35, carbohydrates: 53.5, protein: 8.7 }), ['energy', 'kjKcal']);
  assert.deepEqual(checkNutrition({ sugars: 60, carbohydrates: 53.5, saturatedFat: 40, fat: 35 }), ['sugars', 'saturatedFat']);
  assert.deepEqual(checkNutrition({ fat: 219 }), ['over100']);
});

test('category: water, drinks, fats/oils/nuts, cheese, general', () => {
  assert.equal(inferCategory({ categories: ['en:beverages', 'en:waters', 'en:natural-mineral-waters'] }), 'water');
  assert.equal(inferCategory({ categories: ['en:beverages', 'en:sodas'] }), 'drink');
  assert.equal(inferCategory({ quantity: '330 ml' }), 'drink');
  assert.equal(inferCategory({ ingredients: '100% ulei rafinat de floarea-soarelui' }), 'fats');
  assert.equal(inferCategory({ categories: ['en:cheeses'] }), 'cheese');
  assert.equal(inferCategory({ quantity: '550 g' }), 'general');
});

test('% fruits, vegetables, legumes from the ingredients (only when stated)', () => {
  assert.equal(estimateFvl('apă, zahăr 21,2%, pastă de tomate 15,2%, oțet'), 15.2);
  assert.equal(estimateFvl('zahăr, ulei'), null);
});

test('the database grade is used; otherwise computed from consistent values (marked)', () => {
  const values = { energyKj: 511, energyKcal: 120, fat: 0.1, saturatedFat: 0, carbohydrates: 28.9, sugars: 26, fibre: 0.3, protein: 0.8, salt: 2.3 };
  assert.deepEqual(buildNutrition({ product: { nutriscore: 'd', nutriments: values } }).score, { grade: 'd', computed: false });
  const own = buildNutrition({ saved: { texts: { nutrition: 'Valoare energetică 511 kJ / 120 kcal; Grăsimi 0,1 g; din care acizi grași saturați 0 g; Glucide 28,9 g; din care zaharuri 26 g; Fibre 0,3 g; Proteine 0,8 g; Sare 2,30 g' } }, ingredients: 'apă, zahăr, pastă de tomate 15,2%' });
  assert.equal(own.source, 'photo');
  assert.equal(own.score.computed, true);
  assert.equal(own.score.grade, 'e'); // ketchup: 1 (energy) + 7 (sugars 26 g) + 11 (salt 2.3 g) = 19 → E
  // Inconsistent values: no grade computed.
  assert.equal(buildNutrition({ saved: { nutrition: { values: { ...values, energyKj: 2000, energyKcal: 120 } } } }).score, null);
  assert.deepEqual(fromNutriments({ 'energy-kj_100g': 511, 'salt_100g': 2.3, x: 1 }), { energyKj: 511, salt: 2.3 });
});
