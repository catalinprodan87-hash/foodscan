import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { analyze, estimateNova } from '../src/lib/analyze.js';
import { RESTRICTIONS, REGIONS, restrictionsFor } from '../src/data/restrictions.js';
import { ADDITIVES_BY_CODE } from '../src/data/additives.js';
import { NONFOOD_BY_CODE } from '../src/data/nonFoodIngredients.js';
import { mapProduct, mapNutrition, analyzeInput } from '../src/lib/lookup.js';
import { makeEntry, entryRequest } from '../src/lib/history.js';
import { buildRequest } from '../src/lib/request.js';

// ───────────────────────────── NOVA explanation ───────────────────────────
describe('NOVA: why this group', () => {
  test('tomato paste (tomato concentrate, water, salt) → NOVA 3 because salt is added to a food', () => {
    const r = analyze({ text: 'concentrat de tomate, apă, sare' });
    assert.equal(r.processing.nova, 3);
    assert.deepEqual(r.novaWhy, { rule: 'culinary_mixed', triggers: ['sare'], higherEstimate: null });
    assert.equal(r.verdict, 'ok'); // NOVA 3 never changes the verdict
  });

  test('each rule names the ingredients behind it', () => {
    assert.deepEqual(estimateNova('lapte de vacă pasteurizat'), { nova: 1, markers: [], rule: 'plain', triggers: [] });
    const oil = estimateNova('ulei de floarea-soarelui');
    assert.equal(oil.rule, 'culinary_single');
    assert.deepEqual(oil.triggers, ['ulei']);
    const pickles = analyze({ text: 'castraveți, apă, oțet, sare, E202' });
    assert.deepEqual(pickles.novaWhy, { rule: 'additives', triggers: ['E202'], higherEstimate: null });
    const biscuits = analyze({ text: 'făină, zahăr, arome, E471' });
    assert.equal(biscuits.novaWhy.rule, 'markers');
    assert.deepEqual(biscuits.novaWhy.triggers, ['E471', 'arome']);
  });

  test('a database value is kept, with its own rule', () => {
    const r = analyze({ text: 'cod liver, salt', nova: 3 });
    assert.deepEqual(r.processing, { nova: 3, source: 'database', markers: [] });
    assert.deepEqual(r.novaWhy, { rule: 'database', triggers: [], higherEstimate: null });
  });

  test('database NOVA 1 with additives in the list: the mismatch is reported', () => {
    // seen on a real product: Open Food Facts says NOVA 1, the label lists E224 and E330
    const r = analyze({ text: 'struguri, conservant: metabisulfit de potasiu (E224), acid citric (E330)', nova: 1 });
    assert.equal(r.processing.nova, 1);
    assert.deepEqual(r.novaWhy.higherEstimate, { nova: 3, rule: 'additives', triggers: ['E224', 'E330'] });
  });

  test('no NOVA for non-food or empty input', () => {
    assert.equal(analyze({ text: 'Aqua, Parfum', productType: 'cosmetic' }).novaWhy, null);
    assert.equal(analyze({}).novaWhy, null);
  });
});

// ─────────────────────────── Nutri-Score facts ────────────────────────────
describe('Nutri-Score: the facts behind the grade', () => {
  const COD_LIVER = {
    code: '5901489034140', product_name: 'Icelandic Cod Liver', brands: 'King Oscar', nutriscore_grade: 'e',
    nutrient_levels: { fat: 'high', salt: 'high', 'saturated-fat': 'high' },
    nutriments: { 'energy-kcal_100g': 548, fat_100g: 58, 'saturated-fat_100g': 9.9, salt_100g: 2.5, proteins_100g: 5.9 },
  };

  test('maps levels and amounts per 100 g (real Open Food Facts data for 5901489034140)', () => {
    assert.deepEqual(mapNutrition(COD_LIVER), {
      kcal: 548,
      items: [
        { key: 'fat', level: 'high', per100: 58 },
        { key: 'saturatedFat', level: 'high', per100: 9.9 },
        { key: 'salt', level: 'high', per100: 2.5 },
      ],
    });
  });

  test('no nutrition data → null; unknown level values are ignored', () => {
    assert.equal(mapNutrition({}), null);
    assert.equal(mapNutrition({ nutrient_levels: { fat: 'weird' }, nutriments: {} }), null);
    assert.deepEqual(mapNutrition({ nutriments: { sugars_100g: 12 } }).items, [{ key: 'sugars', level: null, per100: 12 }]);
  });

  test('a clean ingredient list with Nutri-Score E: the only reason is the Nutri-Score', () => {
    const product = mapProduct(COD_LIVER, 'food', COD_LIVER.code);
    const r = analyze(analyzeInput(product, 'ficat de cod, sare'));
    assert.equal(r.verdict, 'warn');
    assert.deepEqual(r.reasons, [{ type: 'nutriscore', grade: 'e' }]);
    assert.equal(r.counts.total, 0);
    assert.equal(r.processing.nova, 3); // NOVA and Nutri-Score are independent
  });

  test('nutrition facts survive the history round trip', () => {
    const product = mapProduct(COD_LIVER, 'food', COD_LIVER.code);
    const req = buildRequest({ text: 'ficat de cod, sare', source: 'photo', product });
    const entry = makeEntry(req, analyze(analyzeInput(product, req.text)));
    assert.equal(entryRequest(entry).product.nutrition.items[0].per100, 58);
  });
});

// ───────────────────── restrictions outside the EU ────────────────────────
describe('restrictions outside the EU', () => {
  test('every entry points at a real ingredient and is complete', () => {
    for (const [code, list] of Object.entries(RESTRICTIONS)) {
      assert.ok(ADDITIVES_BY_CODE[code] || NONFOOD_BY_CODE[code], `unknown code ${code}`);
      assert.ok(list.length > 0, code);
      for (const x of list) {
        assert.ok(REGIONS[x.region], `${code}: region ${x.region}`);
        assert.ok(['banned', 'not_approved', 'restricted', 'warning', 'phase_out'].includes(x.status), `${code}: ${x.status}`);
        assert.ok(x.en.length > 30 && x.ro.length > 30, code);
      }
    }
  });

  test('allowed in the EU, banned in the US: cyclamate, amaranth, erythrosine', () => {
    for (const code of ['E952', 'E123', 'E127']) {
      const us = restrictionsFor(code).find((x) => x.region === 'US');
      assert.equal(us.status, 'banned', code);
    }
    assert.match(restrictionsFor('E952')[0].en, /1970/);
    assert.match(restrictionsFor('E123')[0].en, /1976/);
  });

  test('a low-risk EU additive restricted elsewhere is flagged and raises the verdict to "warn"', () => {
    // Brilliant blue: low in the EU; California school ban + FDA phase-out plan
    assert.equal(ADDITIVES_BY_CODE.E133.level, 'low');
    const r = analyze({ text: 'apă, acid citric, E133' });
    const e133 = r.additives.find((a) => a.code === 'E133');
    assert.deepEqual(e133.restrictions.map((x) => x.region), ['US-CA', 'US']);
    assert.equal(r.restrictedElsewhere, 1);
    assert.equal(r.verdict, 'warn');
    assert.ok(r.reasons.some((x) => x.type === 'restricted' && x.count === 1));
  });

  test('cyclamate by name: flagged with the US ban and the Japanese status', () => {
    const r = analyze({ text: 'apă, îndulcitor: ciclamat de sodiu' });
    const item = r.additives.find((a) => a.code === 'E952');
    assert.deepEqual(item.restrictions.map((x) => `${x.region}:${x.status}`), ['US:banned', 'JP:not_approved']);
  });

  test('additives without restrictions are not flagged', () => {
    const r = analyze({ text: 'roșii, apă, sare, acid citric' });
    assert.equal(r.restrictedElsewhere, 0);
    assert.deepEqual(r.additives[0].restrictions, []);
    assert.equal(r.verdict, 'ok');
    assert.deepEqual(analyze({ text: 'E999' }).additives[0].restrictions, []);
  });

  test('cosmetics: triclosan (FDA) and oxybenzone (Hawaii) are flagged', () => {
    const soap = analyze({ text: 'Aqua, Triclosan', productType: 'cosmetic' });
    assert.equal(soap.items.find((i) => i.code === 'TRICLOSAN').restrictions[0].region, 'US');
    assert.ok(soap.reasons.some((x) => x.type === 'restricted'));
    const sun = analyze({ text: 'Aqua, Benzophenone-3', productType: 'cosmetic' });
    assert.equal(sun.items.find((i) => i.code === 'BP-3').restrictions[0].region, 'US-HI');
  });

  test('additives not authorised in the EU but used elsewhere are in the database as high risk', () => {
    for (const code of ['E216', 'E443', 'E924', 'E927a']) {
      assert.equal(ADDITIVES_BY_CODE[code].level, 'high', code);
      assert.match(ADDITIVES_BY_CODE[code].why.en, /[Nn]ot authorised in (the )?EU/, code);
    }
    assert.deepEqual(analyze({ text: 'wheat flour, potassium bromate, azodicarbonamide' }).additives.map((a) => a.code), ['E924', 'E927a']);
    assert.equal(analyze({ text: 'water, BVO' }).additives[0].code, 'E443');
  });
});
