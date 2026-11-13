import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { analyze, detectProductType, findNonFoodItems, findAvoidHits, domainsForType } from '../src/lib/analyze.js';
import { AVOID_PRESETS, AVOID_PRESETS_BY_ID, defaultAvoidState, presetsForType } from '../src/data/avoidPresets.js';
import { NONFOOD_BY_CODE } from '../src/data/nonFoodIngredients.js';

const codes = (list) => list.map((x) => x.code);

const SHAMPOO =
  'Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Glycerin, Sodium Chloride, Parfum, ' +
  'Methylparaben, Methylisothiazolinone, Limonene, Linalool, CI 19140';
const DETERGENT =
  'Conține: 5-15% agenți de suprafață anionici, <5% agenți de suprafață neionici, fosfonați, săpun, ' +
  'enzime, agenți de albire optică, parfumuri, Benzisothiazolinone, Methylisothiazolinone';
const BLEACH = 'Conține: <5% înălbitori pe bază de clor (hipoclorit de sodiu), hidroxid de sodiu';
const FOOD = 'Ingrediente: zahăr, ulei de palmier, glicerol, emulgator: lecitină din soia (E322), arome';

// ─────────────────────────── productType routing ──────────────────────────
describe('analyze() productType routing', () => {
  test('defaults to food and keeps food behaviour', () => {
    const r = analyze({ text: FOOD });
    assert.equal(r.productType, 'food');
    assert.deepEqual(codes(r.additives), ['E322', 'E422']);
    assert.equal(r.items, r.additives);
    assert.equal(r.processing.nova, 4);
    assert.deepEqual(r.safetyTips, []);
  });

  test('unknown productType values fall back to food', () => {
    assert.equal(analyze({ text: FOOD, productType: 'toys' }).productType, 'food');
  });

  test('domains come from productCategories.js', () => {
    assert.deepEqual(domainsForType('cosmetic'), ['cosmetic', 'both']);
    assert.deepEqual(domainsForType('household'), ['household', 'both']);
    assert.deepEqual(domainsForType('food'), []);
  });

  test('cosmetic: matches cosmetic + both domains, skips E-numbers, NOVA and Nutri-Score', () => {
    const r = analyze({ text: SHAMPOO + ', E330', productType: 'cosmetic', nova: 4, nutriscore: 'e' });
    assert.equal(r.productType, 'cosmetic');
    for (const c of ['MIT', 'SLES', 'CAPB', 'PARFUM', 'METHYLPARABEN', 'LIMONENE', 'LINALOOL']) {
      assert.ok(codes(r.items).includes(c), c);
    }
    assert.ok(!codes(r.items).some((c) => c.startsWith('E')), 'no E-numbers for cosmetics');
    assert.deepEqual(r.additives, []);
    assert.equal(r.processing, null);
    assert.equal(r.nutriscore, null);
    for (const i of r.items) assert.ok(['cosmetic', 'both'].includes(i.domain), i.code);
  });

  test('household: matches household + both domains only', () => {
    const r = analyze({ text: DETERGENT, productType: 'household' });
    for (const c of ['ANIONIC', 'NONIONIC', 'PHOSPHONATES', 'ENZYMES', 'OPTICAL-BR', 'PARFUM', 'BIT', 'MIT', 'SAPONIFIED']) {
      assert.ok(codes(r.items).includes(c), c);
    }
    for (const i of r.items) assert.ok(['household', 'both'].includes(i.domain), i.code);
  });

  test('domain filter: BIT is household-only, parabens are cosmetic-only', () => {
    assert.deepEqual(codes(findNonFoodItems('Benzisothiazolinone', 'cosmetic')), []);
    assert.deepEqual(codes(findNonFoodItems('Benzisothiazolinone', 'household')), ['BIT']);
    assert.deepEqual(codes(findNonFoodItems('Methylparaben', 'household')), []);
    assert.deepEqual(findNonFoodItems('Methylparaben', 'food'), []);
  });

  test('longest match wins: laureth is SLES, not SLS or PEG', () => {
    const r = analyze({ text: 'Sodium Laureth Sulfate', productType: 'cosmetic' });
    assert.deepEqual(codes(r.items), ['SLES']);
  });

  test('items are sorted by risk and the result shape matches food', () => {
    const r = analyze({ text: SHAMPOO, productType: 'cosmetic' });
    assert.equal(r.items[0].code, 'MIT');
    const rank = { high: 0, medium: 1, low: 2, none: 3 };
    for (let i = 1; i < r.items.length; i++) assert.ok(rank[r.items[i - 1].level] <= rank[r.items[i].level]);
    for (const key of ['productType', 'verdict', 'reasons', 'items', 'additives', 'avoidHits', 'processing', 'nutriscore', 'counts', 'safetyTips']) {
      assert.ok(key in r, key);
      assert.ok(key in analyze({ text: FOOD }), key);
    }
    assert.equal(r.counts.total, r.items.length);
  });
});

// ─────────────────────────── non-food verdicts ────────────────────────────
describe('non-food verdict', () => {
  test('any high → bad', () => {
    const r = analyze({ text: 'Aqua, Methylisothiazolinone', productType: 'cosmetic' });
    assert.equal(r.verdict, 'bad');
    assert.deepEqual(r.reasons.map((x) => x.type), ['high']);
  });

  test('any medium → warn', () => {
    assert.equal(analyze({ text: 'Aqua, Propylparaben', productType: 'cosmetic' }).verdict, 'warn');
  });

  test('avoid-list hit alone → warn (not bad, unlike food)', () => {
    const avoid = { presets: { sulfates: true } };
    const r = analyze({ text: 'Aqua, Sodium Lauryl Sulfate, Glycerin', productType: 'cosmetic' }, avoid);
    assert.equal(r.counts.high + r.counts.medium, 0);
    assert.equal(r.verdict, 'warn');
    assert.deepEqual(r.reasons.map((x) => x.type), ['avoid']);
  });

  test('only low / none → ok; empty → unknown', () => {
    assert.equal(analyze({ text: 'Aqua, Sodium Lauryl Sulfate', productType: 'cosmetic' }).verdict, 'ok');
    assert.equal(analyze({ text: ' ', productType: 'household' }).verdict, 'unknown');
  });
});

// ─────────────────────────── never-mix safety tip ─────────────────────────
describe('household safety tip', () => {
  test('chlorine + acid → never mix', () => {
    const r = analyze({ text: 'hipoclorit de sodiu, acid clorhidric', productType: 'household' });
    assert.deepEqual(r.safetyTips, [{ type: 'neverMix', chlorine: ['hipoclorit de sodiu'], partners: ['acid clorhidric'] }]);
  });

  test('chlorine + ammonia, or chlorine + citric acid → never mix', () => {
    assert.equal(analyze({ text: 'sodium hypochlorite, ammonia', productType: 'household' }).safetyTips.length, 1);
    assert.equal(analyze({ text: 'dicloroizocianurat de sodiu, acid citric', productType: 'household' }).safetyTips.length, 1);
  });

  test('chlorine bleach alone → general "never mix" caution', () => {
    const r = analyze({ text: BLEACH, productType: 'household' });
    assert.equal(r.safetyTips.length, 1);
    assert.equal(r.safetyTips[0].type, 'mixCaution');
    assert.equal(r.safetyTips[0].kind, 'chlorine');
    assert.ok(r.safetyTips[0].substances.length > 0);
    const tabs = analyze({ text: 'sodium dichloroisocyanurate', productType: 'household' });
    assert.deepEqual(tabs.safetyTips, [{ type: 'mixCaution', kind: 'chlorine', substances: ['sodium dichloroisocyanurate'] }]);
  });

  test('ammonia alone → caution about chlorine bleach', () => {
    const r = analyze({ text: 'apă, amoniac, agenți de suprafață neionici', productType: 'household' });
    assert.deepEqual(r.safetyTips, [{ type: 'mixCaution', kind: 'ammonia', substances: ['amoniac'] }]);
  });

  test('chlorine + ammonia in the same product → strong never-mix tip', () => {
    const r = analyze({ text: 'hipoclorit de sodiu, amoniac', productType: 'household' });
    assert.deepEqual(r.safetyTips, [{ type: 'neverMix', chlorine: ['hipoclorit de sodiu'], partners: ['amoniac'] }]);
  });

  test('acid alone, other cleaners, or cosmetics → no tip', () => {
    assert.deepEqual(analyze({ text: 'acid clorhidric', productType: 'household' }).safetyTips, []);
    assert.deepEqual(analyze({ text: DETERGENT, productType: 'household' }).safetyTips, []);
    assert.deepEqual(analyze({ text: 'sodium hypochlorite, citric acid', productType: 'cosmetic' }).safetyTips, []);
  });
});

// ───────────────────────────── auto-detection ─────────────────────────────
describe('detectProductType()', () => {
  test('INCI signals → cosmetic', () => {
    assert.equal(detectProductType(SHAMPOO), 'cosmetic');
    assert.equal(detectProductType('Aqua, Glycerin, Cetearyl Alcohol'), 'cosmetic');
    assert.equal(detectProductType('Talc, Mica, CI 77891, CI 77491'), 'cosmetic');
    assert.equal(detectProductType('Parfum (Fragrance), Alcohol Denat.'), 'cosmetic');
  });

  test('detergent signals → household', () => {
    assert.equal(detectProductType(DETERGENT), 'household');
    assert.equal(detectProductType(BLEACH), 'household');
    assert.equal(detectProductType('Conține: fosfonați, <5% înălbitori pe bază de oxigen'), 'household');
  });

  test('detergent signals win over "parfumuri" on detergent labels', () => {
    assert.equal(detectProductType('agenți de suprafață anionici, parfumuri, Limonene, Linalool'), 'household');
  });

  test('food otherwise, including food with glycerin or a single weak signal', () => {
    assert.equal(detectProductType(FOOD), 'food');
    assert.equal(detectProductType('Ingredients: sugar, glycerin, cocoa butter'), 'food');
    assert.equal(detectProductType('zahăr, făină, E471, glicerol'), 'food');
    assert.equal(detectProductType(''), 'food');
  });

  test('"aqua" must be a whole word', () => {
    assert.equal(detectProductType('aquafaba, năut, sare'), 'food');
  });
});

// ─────────────────────────────── presets ──────────────────────────────────
describe('non-food avoid presets', () => {
  const NONFOOD_IDS = ['fragrance', 'sulfates', 'parabens', 'silicones', 'formaldehyde', 'isothiazolinones', 'microplastics'];

  test('all non-food presets exist and are off by default', () => {
    const def = defaultAvoidState();
    for (const id of NONFOOD_IDS) {
      assert.ok(AVOID_PRESETS_BY_ID[id], id);
      assert.equal(def.presets[id], false, id);
    }
  });

  test('every preset code exists in its database', () => {
    for (const id of NONFOOD_IDS) {
      for (const c of AVOID_PRESETS_BY_ID[id].codes) assert.ok(NONFOOD_BY_CODE[c], `${id}: ${c}`);
    }
  });

  test('presets are filtered by product type', () => {
    const ids = (t) => presetsForType(t).map((p) => p.id);
    assert.deepEqual(ids('food'), ['palm', 'gfs', 'hydrogenated', 'sugar', 'flavourings', 'maltodextrin', 'modstarch']);
    assert.deepEqual(ids('cosmetic'), NONFOOD_IDS);
    assert.deepEqual(ids('household'), NONFOOD_IDS.filter((id) => id !== 'parabens'));
  });

  test('fragrance preset covers parfum and every fragrance-category item', () => {
    const p = AVOID_PRESETS_BY_ID.fragrance;
    assert.ok(p.codes.includes('PARFUM'));
    for (const c of ['LIMONENE', 'LINALOOL', 'LILIAL', 'OAKMOSS']) assert.ok(p.codes.includes(c), c);
  });

  test('parabens preset covers all paraben codes', () => {
    assert.equal(AVOID_PRESETS_BY_ID.parabens.codes.length, 9);
  });

  const on = (...ids) => ({ presets: Object.fromEntries(ids.map((id) => [id, true])) });
  const hitIds = (text, type, ...ids) => analyze({ text, productType: type }, on(...ids)).avoidHits.map((h) => h.id);

  test('each preset matches by item code', () => {
    assert.deepEqual(hitIds('Aqua, Parfum, Linalool', 'cosmetic', 'fragrance'), ['fragrance']);
    assert.deepEqual(hitIds('Ammonium Lauryl Sulfate', 'cosmetic', 'sulfates'), ['sulfates']);
    assert.deepEqual(hitIds('Butylparaben', 'cosmetic', 'parabens'), ['parabens']);
    assert.deepEqual(hitIds('Cyclopentasiloxane, Dimethicone', 'cosmetic', 'silicones'), ['silicones']);
    assert.deepEqual(hitIds('DMDM Hydantoin', 'cosmetic', 'formaldehyde'), ['formaldehyde']);
    assert.deepEqual(hitIds('Octylisothiazolinone', 'household', 'isothiazolinones'), ['isothiazolinones']);
    assert.deepEqual(hitIds('Polyethylene, PTFE', 'cosmetic', 'microplastics'), ['microplastics']);
  });

  test('hits show the label text, not the internal code', () => {
    const r = analyze({ text: 'Aqua, Cyclopentasiloxane, Dimethicone', productType: 'cosmetic' }, on('silicones'));
    assert.deepEqual(r.avoidHits[0].matches, ['Cyclopentasiloxane', 'Dimethicone']);
  });

  test('presets for another product type are ignored even if enabled', () => {
    assert.deepEqual(hitIds('ulei de palmier', 'cosmetic', 'palm'), []);
    assert.deepEqual(hitIds('Methylparaben', 'food', 'parabens'), []);
    assert.deepEqual(findAvoidHits('ulei de palmier', on('palm'), [], 'household'), []);
  });

  test('custom terms apply to every product type', () => {
    const avoid = { presets: {}, custom: ['lanolin'] };
    assert.equal(analyze({ text: 'Aqua, Lanolin', productType: 'cosmetic' }, avoid).avoidHits.length, 1);
  });
});
