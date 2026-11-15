import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { findAllergens, splitTraces } from '../src/lib/allergens.js';
import { dietInfo } from '../src/lib/diet.js';
import { analyze } from '../src/lib/analyze.js';
import { ALLERGENS } from '../src/data/allergens.js';
import { STRINGS } from '../src/lib/i18n.js';
import { shareSummary } from '../src/lib/share.js';

const ids = (list) => list.map((a) => a.id);

describe('allergens (EU 14, information only)', () => {
  test('one example per group, Romanian and English', () => {
    const cases = {
      gluten: 'făină de grâu', crustaceans: 'creveți', eggs: 'ouă praf', fish: 'ulei de pește', peanuts: 'arahide prăjite',
      soy: 'lecitină din soia', milk: 'lapte praf degresat', nuts: 'alune de pădure', celery: 'țelină', mustard: 'muștar',
      sesame: 'semințe de susan', sulphites: 'dioxid de sulf', lupin: 'făină de lupin', molluscs: 'midii',
    };
    assert.deepEqual(Object.keys(cases).sort(), ALLERGENS.map((a) => a.id).sort(), 'all 14 groups covered');
    for (const [id, text] of Object.entries(cases)) assert.deepEqual(ids(findAllergens(`apă, ${text}, sare`).contains), [id], text);
    assert.deepEqual(ids(findAllergens('wheat flour, milk powder, eggs, peanuts').contains), ['gluten', 'eggs', 'peanuts', 'milk']);
  });

  test('"may contain" goes to traces, not contains; a contained allergen is not repeated', () => {
    const r = findAllergens('Zahăr, lapte praf, cacao. Poate conține urme de arahide, ouă și lapte.');
    assert.deepEqual(ids(r.contains), ['milk']);
    assert.deepEqual(ids(r.traces), ['eggs', 'peanuts']);
    assert.deepEqual(ids(findAllergens('zahăr. May contain traces of nuts and sesame.').traces), ['nuts', 'sesame']);
    assert.deepEqual(ids(findAllergens('Produs într-o fabrică care procesează soia și muștar. Ingrediente: orez').traces), ['soy', 'mustard']);
  });

  test('not allergens: cocoa butter, coconut, plant milks, wheat glucose syrup, refined soybean oil, "fără"', () => {
    assert.deepEqual(findAllergens('unt de cacao, lapte de cocos, nucă de cocos').contains, []);
    assert.deepEqual(ids(findAllergens('lapte de ovăz').contains), ['gluten'], 'oat drink: not milk, but oats are a gluten cereal');
    assert.deepEqual(findAllergens('sirop de glucoză din grâu, maltodextrină (din grâu), dextroză din grâu').contains, []);
    assert.deepEqual(findAllergens('ulei de soia, ulei rafinat de soia').contains, []);
    assert.deepEqual(findAllergens('lapte fără lactoză').contains.map((a) => a.matches), [['lapte']]);
    assert.deepEqual(findAllergens('fără gluten, fără lactoză').contains, []);
    assert.deepEqual(findAllergens('alune de pământ').contains.map((a) => a.id), ['peanuts'], 'peanuts, not tree nuts');
    assert.deepEqual(findAllergens('peste 18 luni').contains, [], '"peste" = over');
    assert.deepEqual(findAllergens('cod lot 1234').contains, [], '"cod" = code');
  });

  test('sulphites from E220–E228; Open Food Facts tags merged with their source', () => {
    assert.deepEqual(ids(findAllergens('vin, E224', { codes: ['E224'] }).contains), ['sulphites']);
    const r = findAllergens('zahăr, lapte', { offAllergens: ['en:milk', 'en:soybeans'], offTraces: ['en:nuts', 'en:milk'] });
    assert.deepEqual(r.contains.map((a) => [a.id, a.sources]), [['soy', ['database']], ['milk', ['label', 'database']]]);
    assert.deepEqual(ids(r.traces), ['nuts']);
  });

  test('traces split at the end of the sentence', () => {
    const s = splitTraces('Lapte. Poate conține urme de ouă. A se păstra la rece, nuci.');
    assert.match(s.traces, /oua/);
    assert.doesNotMatch(s.traces, /nuci/);
    assert.match(s.contains, /nuci/);
  });

  test('analyze() returns allergens and diet for food; never changes the verdict', () => {
    const plain = analyze({ text: 'apă, zahăr, sare', productType: 'food' });
    const withMilk = analyze({ text: 'apă, zahăr, sare, lapte praf. Poate conține urme de alune.', productType: 'food' });
    assert.equal(withMilk.verdict, plain.verdict);
    assert.deepEqual(ids(withMilk.allergens.contains), ['milk']);
    assert.deepEqual(ids(withMilk.allergens.traces), ['nuts']);
    const watched = analyze({ text: 'apă, lapte', productType: 'food' }, { presets: {}, custom: [], allergens: ['milk'] });
    assert.equal(watched.verdict, analyze({ text: 'apă, lapte', productType: 'food' }).verdict, 'watching an allergen does not change the verdict');
  });
});

describe('vegan / vegetarian / palm oil', () => {
  test('Open Food Facts analysis wins', () => {
    const d = dietInfo('lapte', { analysisTags: ['en:vegan', 'en:vegetarian', 'en:palm-oil-free'] });
    assert.deepEqual(d.vegan, { status: 'yes', source: 'database' });
    assert.deepEqual(d.palm, { status: 'no', source: 'database' });
  });

  test('from the ingredients: cautious', () => {
    assert.equal(dietInfo('carne de porc, sare').vegetarian.status, 'no');
    assert.equal(dietInfo('lapte, zahăr').vegan.status, 'no');
    assert.equal(dietInfo('lapte, zahăr').vegetarian.status, 'maybe');
    assert.equal(dietInfo('făină, zahăr, unt de cacao').vegan.status, 'maybe', 'cocoa butter is not dairy');
    assert.equal(dietInfo('zahăr, colorant: E120', { codes: ['E120'] }).vegetarian.status, 'no', 'carmine');
    assert.deepEqual(dietInfo('zahăr, ulei de palmier').palm, { status: 'yes', source: 'label' });
    assert.equal(dietInfo('zahăr').palm, null, 'no palm oil seen ≠ palm-oil free');
    assert.deepEqual(dietInfo(''), { vegan: null, vegetarian: null, palm: null });
  });
});

describe('wording (no medical claims)', () => {
  test('allergen and diet texts never promise safety or absence', () => {
    const banned = /\b(sigur|sigură|fără risc|fără alergeni|safe|allergen-free|free of allergens|nu conține alergeni|does not contain allergens)\b/i;
    for (const lang of Object.keys(STRINGS)) {
      for (const [key, value] of Object.entries(STRINGS[lang])) {
        if (!/^(allerg|diet|vegan|vegetarian|shareInfo)/.test(key)) continue;
        assert.doesNotMatch(value, banned, `${lang}.${key}: ${value}`);
      }
    }
  });

  test('the shared summary marks allergens as information', () => {
    const r = analyze({ text: 'zahăr, lapte praf. Poate conține urme de alune.', productType: 'food' });
    const { text } = shareSummary(r, { lang: 'ro' });
    assert.match(text, /Alergeni \(informativ, verifică eticheta\): lapte; Urme posibile: fructe cu coajă/);
  });
});

describe('allergen fixes found on the real corpus', () => {
  test('sulphites only in "may contain" are traces, not contained (E220 matched by name)', () => {
    const r = analyze({ text: 'Mălai 90%, sare. Poate conține urme de lapte, dioxid de sulf și sulfiți.', productType: 'food' });
    assert.deepEqual(ids(r.allergens.contains), []);
    assert.deepEqual(ids(r.allergens.traces), ['milk', 'sulphites']);
  });

  test('caramel coloured with sulphites is not a sulphite allergen', () => {
    assert.deepEqual(findAllergens('apă, zahăr, colorant (caramel cu sulfit de amoniu)').contains, []);
    assert.deepEqual(ids(findAllergens('vin, conservant: sulfiți').contains), ['sulphites']);
  });

  test('French and German words (imported products)', () => {
    assert.deepEqual(ids(findAllergens('farine de BLÉ, lait écrémé, soja, noisettes').contains), ['gluten', 'soy', 'milk', 'nuts']);
    assert.deepEqual(ids(findAllergens('Weizenmehl, Milchpulver, Haselnüsse, Senf').contains), ['milk', 'nuts', 'mustard']);
  });
});
