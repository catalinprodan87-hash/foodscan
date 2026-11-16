import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyze } from '../src/lib/analyze.js';
import { computeScore, countIngredients, bandFor } from '../src/lib/score.js';
import { SCORE_VERSION, WEIGHTS, EU_BANNED } from '../src/data/scoring.js';
import { ADDITIVES_BY_CODE } from '../src/data/additives.js';
import { NONFOOD_BY_CODE } from '../src/data/nonFoodIngredients.js';
import { STRINGS } from '../src/lib/i18n.js';
import { scoreProduct } from './scoreGoldenPipeline.js';

const golden = JSON.parse(readFileSync(new URL('./fixtures/score-golden.json', import.meta.url), 'utf8'));
const score = (text, o = {}) => computeScore({
  result: analyze({ text, productType: o.type || 'food', nova: o.nova, nutriscore: o.grade }, o.avoid),
  text, grade: o.grade, origin: o.origin, ocrConfidence: o.ocr,
});

describe('v3.8 score: data', () => {
  it('weights add up to 100', () => {
    for (const w of Object.values(WEIGHTS)) assert.equal(Object.values(w).reduce((a, b) => a + b, 0), 100);
  });
  it('every EU ban points to a known ingredient and a regulation link', () => {
    for (const code of Object.keys(EU_BANNED.food)) assert.ok(ADDITIVES_BY_CODE[code], code);
    for (const code of Object.keys(EU_BANNED.cosmetic)) assert.ok(NONFOOD_BY_CODE[code], code);
    for (const x of [...Object.values(EU_BANNED.food), ...Object.values(EU_BANNED.cosmetic)]) assert.match(x.url, /^https:\/\/eur-lex\.europa\.eu\//);
  });
  it('bands', () => {
    assert.deepEqual([0, 24, 25, 49, 50, 74, 75, 100].map(bandFor), ['low', 'low', 'below', 'below', 'fair', 'fair', 'good', 'good']);
  });
  it('UI strings in both languages', () => {
    for (const k of ['scoreTitle', 'scoreIngredientsTitle', 'scoreInsufficient', 'scoreEstimated', 'scoreBand_good', 'scorePart_nutrition', 'scoreCap_high', 'scoreCap_banned', 'scorePersonal']) {
      assert.ok(STRINGS.ro[k] && STRINGS.en[k], k);
    }
  });
});

describe('v3.8 score: rules and edge cases', () => {
  it('no ingredients list: "date insuficiente", no number', () => {
    const s = score('');
    assert.equal(s.insufficient, true);
    assert.equal(s.general, null);
    assert.equal(computeScore({}).insufficient, true);
  });
  it('a plain food with everything known is near 100, high confidence', () => {
    const s = score('apă minerală naturală', { nova: 1, grade: 'a' });
    assert.ok(s.general >= 95);
    assert.equal(s.confidence, 'high');
    assert.equal(s.band, 'good');
  });
  it('missing nutrition and NOVA: weights shared out, lower confidence', () => {
    const s = score('apă, sare');
    assert.equal(s.confidence, 'medium'); // the app estimates NOVA from the text
    const ids = s.parts.map((p) => p.id);
    assert.ok(!ids.includes('nutrition'));
    assert.ok(Math.abs(s.parts.reduce((a, p) => a + p.share, 0) - 1) < 1e-9);
  });
  it('any high-level ingredient caps at 49', () => {
    const s = score('apă, E129', { nova: 1, grade: 'a' });
    assert.ok(s.caps.some((c) => c.id === 'high'));
    assert.ok(s.general <= 49);
  });
  it('banned in the EU caps at 25 (food: E171)', () => {
    const s = score('zahăr, E171', { nova: 1, grade: 'a' });
    assert.equal(s.general, 25);
    assert.deepEqual(s.caps.find((c) => c.id === 'banned').codes, ['E171']);
  });
  it('banned in EU cosmetics caps a cosmetic, not a household product', () => {
    const text = 'AQUA, GLYCERIN, PARFUM, BUTYLPHENYL METHYLPROPIONAL';
    assert.equal(score(text, { type: 'cosmetic' }).general <= 25, true);
    assert.equal(score(text, { type: 'household' }).caps.some((c) => c.id === 'banned'), false);
  });
  it('cosmetics: "scor ingrediente", no nutrition / processing / origin', () => {
    const s = score('AQUA, GLYCERIN, CETEARYL ALCOHOL, TOCOPHEROL', { type: 'cosmetic' });
    assert.equal(s.kind, 'ingredients');
    assert.deepEqual(s.parts.map((p) => p.id), ['ingredients', 'avoid', 'completeness']);
  });
  it('a short list (probably not read in full) lowers completeness and confidence', () => {
    const s = score('AQUA', { type: 'cosmetic' });
    assert.equal(s.confidence, 'low');
    assert.equal(s.parts.find((p) => p.id === 'completeness').points, 50);
  });
  it('avoid list: personal score lower and capped at 49, general unchanged', () => {
    const avoid = { presets: {}, custom: ['zahăr'] };
    const s = score('zahăr, apă', { nova: 1, grade: 'a', avoid });
    const g = score('zahăr, apă', { nova: 1, grade: 'a' });
    assert.equal(s.avoidHits, 1);
    assert.equal(s.general, g.general);
    assert.ok(s.personal <= 49 && s.personal < s.general);
  });
  it('photo text with low reading confidence lowers the confidence one step', () => {
    assert.equal(score('apă', { nova: 1, grade: 'a', ocr: 50 }).confidence, 'medium');
  });
  it('origin: known with pluses scores more than unknown', () => {
    const known = score('apă', { nova: 1, grade: 'a', origin: { known: true, points: [{ id: 'local', kind: 'plus' }] } });
    const unknown = score('apă', { nova: 1, grade: 'a', origin: { known: false, points: [{ id: 'unknown', kind: 'minus' }] } });
    assert.ok(known.general > unknown.general);
  });
  it('never below 1', () => {
    assert.ok(score('E171, E129, E102, E110, E211, E250', { nova: 4, grade: 'e' }).general >= 1);
  });
  it('counting ingredients ignores commas inside brackets', () => {
    assert.equal(countIngredients('apă, emulgatori (E471, E322), sare'), 3);
    assert.equal(countIngredients(''), 0);
  });
});

describe(`v3.8 score: golden test (${golden.products.length} products, scoreVersion ${SCORE_VERSION})`, () => {
  it('about 30 products, food and non-food', () => {
    assert.ok(golden.products.length >= 30);
    assert.ok(golden.products.some((p) => p.type !== 'food'));
  });
  for (const item of golden.products) {
    it(`${item.group}: ${item.raw.product_name} → ${item.expected.general}`, () => {
      assert.deepEqual(scoreProduct(item), item.expected, 'score changed: raise SCORE_VERSION and rebuild the fixture (scripts/build-score-golden.mjs --expect)');
    });
  }
  const by = (group) => golden.products.filter((p) => p.group === group).map((p) => p.expected.general);
  it('plain foods score at least 80', () => {
    for (const g of ['water', 'oats', 'pasta', 'oil', 'nuts']) for (const s of by(g)) assert.ok(s >= 80, `${g} ${s}`);
  });
  it('sweets and spreads graded E and NOVA 4 score below 50', () => {
    const sweets = golden.products.filter((p) => ['sweets', 'spread'].includes(p.group) && p.raw.nutriscore_grade === 'e' && Number(p.raw.nova_group) === 4);
    assert.ok(sweets.length >= 3);
    for (const p of sweets) assert.ok(p.expected.general < 50, p.raw.product_name);
  });
  it('with equal ingredients and NOVA, a better Nutri-Score scores higher', () => {
    const r = analyze({ text: 'apă, zahăr', productType: 'food', nova: 3 });
    const s = 'abcde'.split('').map((g) => computeScore({ result: r, text: 'apă, zahăr', grade: g }).general);
    for (let i = 1; i < s.length; i++) assert.ok(s[i] < s[i - 1], s.join(','));
  });
});

import { makeEntry, entryRequest } from '../src/lib/history.js';
import { scoreForEntry } from '../src/lib/scoreEntry.js';
import { compareEntries } from '../src/lib/compare.js';
import { shareSummary } from '../src/lib/share.js';
import { mapProduct } from '../src/lib/lookup.js';

describe('v3.8 score: history, compare, share use the general score', () => {
  const raw = { code: '8001234567897', product_name: 'Parmigiano', ingredients_text_ro: 'lapte, sare, cheag', nova_group: 1, nutriscore_grade: 'd', origins: 'Italia', labels_tags: ['en:pdo'] };
  const product = mapProduct(raw, 'food', raw.code);
  const avoid = { presets: {}, custom: ['sare'] };
  const result = analyze({ text: product.ingredientsText, productType: 'food', nova: 1, nutriscore: 'd' }, avoid);
  const entry = makeEntry({ product, barcode: raw.code }, result, new Date('2026-11-16T10:00:00Z'), { grade: 'd', originText: '' });

  it('the entry keeps what the score needs; the request brings the origin back', () => {
    assert.equal(entry.grade, 'd');
    assert.deepEqual(entry.db.origin.labels, ['en:pdo']);
    assert.deepEqual(entryRequest(entry).product.origin, entry.db.origin);
  });
  it('history score = the result\'s general score (not personal)', () => {
    const fromEntry = scoreForEntry(entry);
    const live = computeScore({ result, text: product.ingredientsText, grade: 'd', origin: null });
    assert.equal(fromEntry.avoidHits, 0);
    assert.ok(live.avoidHits === 1 && live.personal < live.general);
    assert.ok(fromEntry.general >= 1 && fromEntry.general <= 100);
  });
  it('old entries without the new fields still get a score', () => {
    const old = { ...entry, grade: undefined, originText: undefined, db: { ...entry.db, origin: undefined } };
    assert.ok(scoreForEntry(old).general > 0);
  });
  it('compare shows the general score of both', () => {
    const c = compareEntries(entry, entry, avoid);
    assert.equal(c.a.score.general, scoreForEntry(entry).general);
  });
  it('sharing says the general score with its band', () => {
    const text = shareSummary(result, { lang: 'ro', product, score: 64 }).text;
    assert.match(text, /Scor general: 64\/100 \(Acceptabil\)/);
    assert.doesNotMatch(shareSummary(result, { lang: 'ro', product }).text, /Scor general/);
  });
});
