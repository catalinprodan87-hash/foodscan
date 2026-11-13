import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalize,
  stripDiacritics,
  fixOcrInECodes,
  findECodes,
  resolveOffTag,
  findAdditiveNames,
  matchTerms,
  findAvoidHits,
  estimateNova,
  analyze,
} from '../src/lib/analyze.js';
import { ADDITIVES, ADDITIVES_BY_CODE, CATEGORIES, LEVELS } from '../src/data/additives.js';
import { AVOID_PRESETS, defaultAvoidState } from '../src/data/avoidPresets.js';
import { detectLang, t, pick } from '../src/lib/i18n.js';

const codes = (list) => list.map((x) => x.code);

// ─────────────────────────────── normalize ───────────────────────────────
describe('normalize()', () => {
  test('lowercases and strips Romanian diacritics', () => {
    assert.equal(normalize('ZAHĂR Făină ÎNGHEȚATĂ Brânză'), 'zahar faina inghetata branza');
  });

  test('handles both comma-below (ș ț) and cedilla (ş ţ) forms', () => {
    assert.equal(normalize('ș ş Ș Ş ț ţ Ț Ţ'), 's s s s t t t t');
    assert.equal(normalize('conservanţi'), normalize('conservanți'));
    assert.equal(normalize('ţelină, şuncă'), 'telina, sunca');
  });

  test('strips other Latin diacritics and is length-preserving', () => {
    const s = 'Crème brûlée – Äpfel, piña';
    assert.equal(normalize(s), 'creme brulee - apfel, pina');
    assert.equal(normalize(s).length, s.length);
    assert.equal(stripDiacritics('Șuncă'), 'Sunca');
  });

  test('handles empty input', () => {
    assert.equal(normalize(''), '');
    assert.equal(normalize(null), '');
    assert.equal(normalize(undefined), '');
  });
});

// ─────────────────────────────── E-numbers ───────────────────────────────
describe('findECodes()', () => {
  test('finds the common written forms', () => {
    assert.deepEqual(codes(findECodes('E 250, E-211, e330, E150d, E407a')), ['E250', 'E211', 'E330', 'E150d', 'E407a']);
  });

  test('accepts "E - 211" and E-codes in parentheses / after colons', () => {
    assert.deepEqual(codes(findECodes('conservant:E202 (E - 211)')), ['E202', 'E211']);
  });

  test('uppercase E with a space matches, lowercase e with a space does not', () => {
    assert.deepEqual(codes(findECodes('E 471')), ['E471']);
    assert.deepEqual(codes(findECodes('e 471')), []);
  });

  test('Romanian "e 100%" is not an E-number', () => {
    assert.deepEqual(codes(findECodes('Sucul e 100% natural și e 330 ml.')), []);
    assert.deepEqual(codes(findECodes('E 100% natural')), []);
  });

  test('does not match E inside words or numbers glued to letters', () => {
    assert.deepEqual(codes(findECodes('ROE330, PE100, Tel 0722 150 100')), []);
  });

  test('keeps the letter suffix only when it exists in the database', () => {
    assert.deepEqual(codes(findECodes('E150c E150D')), ['E150c', 'E150d']);
    assert.deepEqual(codes(findECodes('E160a, E160c')), ['E160a', 'E160c']);
    // E322a does not exist → falls back to E322
    assert.deepEqual(codes(findECodes('E322a')), ['E322']);
  });

  test('ignores roman-numeral sub-variants written on labels', () => {
    assert.deepEqual(codes(findECodes('E322(i), E450iii, E160a(ii)')), ['E322', 'E450', 'E160a']);
  });

  test('reports unknown but plausible codes, ignores out-of-range numbers', () => {
    const found = findECodes('E999, E2024, E 050');
    assert.deepEqual(codes(found), ['E999']);
  });

  test('de-duplicates repeated codes', () => {
    assert.deepEqual(codes(findECodes('E330, e330, E 330')), ['E330']);
  });
});

describe('fixOcrInECodes()', () => {
  test('fixes O→0 and l/I→1 inside E-codes', () => {
    assert.equal(fixOcrInECodes('E33O'), 'E330');
    assert.equal(fixOcrInECodes('El50d'), 'E150d');
    assert.equal(fixOcrInECodes('EI02'), 'E102');
    assert.equal(fixOcrInECodes('E 2O2'), 'E 202');
    assert.equal(fixOcrInECodes('e4O7a'), 'e407a');
  });

  test('leaves ordinary words alone', () => {
    const s = 'Ello Eolo ulei de floarea-soarelui, Elle 100';
    assert.equal(fixOcrInECodes(s), s);
  });

  test('OCR-damaged codes are found by findECodes()', () => {
    assert.deepEqual(codes(findECodes('acid citric (E33O), colorant El50d, EI02')), ['E330', 'E150d', 'E102']);
  });
});

// ─────────────────────────── Open Food Facts tags ─────────────────────────
describe('resolveOffTag()', () => {
  test('maps OFF additive tags to database codes', () => {
    assert.equal(resolveOffTag('en:e322i'), 'E322');
    assert.equal(resolveOffTag('en:e450iii'), 'E450');
    assert.equal(resolveOffTag('en:e160aiv'), 'E160a');
    assert.equal(resolveOffTag('en:e150d'), 'E150d');
    assert.equal(resolveOffTag('en:e407a'), 'E407a');
    assert.equal(resolveOffTag('en:e330'), 'E330');
    assert.equal(resolveOffTag('E471'), 'E471');
  });

  test('falls back to the base code when the letter is unknown', () => {
    assert.equal(resolveOffTag('en:e960a'), 'E960');
  });

  test('returns null for non-additive tags', () => {
    assert.equal(resolveOffTag('en:palm-oil'), null);
    assert.equal(resolveOffTag(''), null);
    assert.equal(resolveOffTag(null), null);
  });
});

// ───────────────────────────── Name matching ─────────────────────────────
describe('findAdditiveNames()', () => {
  test('matches Romanian names with or without diacritics', () => {
    assert.deepEqual(codes(findAdditiveNames('benzoat de sodiu, acid citric, glutamat monosodic')), ['E211', 'E330', 'E621']);
    assert.deepEqual(codes(findAdditiveNames('Lecitină din soia; tartrazină')), ['E322', 'E102']);
    assert.deepEqual(codes(findAdditiveNames('LECITINA DIN SOIA, TARTRAZINA')), ['E322', 'E102']);
  });

  test('matches English names', () => {
    assert.deepEqual(codes(findAdditiveNames('Sodium nitrite, potassium sorbate, xanthan gum')), ['E250', 'E202', 'E415']);
  });

  test('longest alias wins: sulphite ammonia caramel is E150d, not E150c', () => {
    assert.deepEqual(codes(findAdditiveNames('colour: sulphite ammonia caramel')), ['E150d']);
    assert.deepEqual(codes(findAdditiveNames('colorant: caramel amoniacal-sulfitic')), ['E150d']);
    assert.deepEqual(codes(findAdditiveNames('colour: ammonia caramel')), ['E150c']);
  });

  test('longest alias wins: sodium carboxymethyl cellulose is E466, not E460', () => {
    assert.deepEqual(codes(findAdditiveNames('sodium carboxymethyl cellulose')), ['E466']);
  });

  test('short aliases (BHA, BHT, TBHQ, MSG) only as standalone capitals', () => {
    assert.deepEqual(codes(findAdditiveNames('antioxidant: BHA, BHT')), ['E320', 'E321']);
    assert.deepEqual(codes(findAdditiveNames('TBHQ; MSG')), ['E319', 'E621']);
    assert.deepEqual(codes(findAdditiveNames('bha, bht, msg')), []);
    assert.deepEqual(codes(findAdditiveNames('BHAKTI MSGS')), []);
  });

  test('whole-word only: no match inside other words', () => {
    // "agar" must not match "agarwood", "caolin" must not match "caolina"
    assert.deepEqual(codes(findAdditiveNames('agarwood, caolinita')), []);
  });

  test('handles line breaks and extra spaces inside multi-word names', () => {
    assert.deepEqual(codes(findAdditiveNames('benzoat\nde   sodiu')), ['E211']);
  });
});

// ─────────────────────────────── Avoid list ──────────────────────────────
describe('avoid-list matching', () => {
  test('whole-word boundaries: "zahăr" does not match "zaharină"', () => {
    assert.deepEqual(matchTerms('îndulcitor: zaharină', ['zahăr']), []);
    assert.deepEqual(matchTerms('zahăr, zaharină', ['zahăr']), ['zahăr']);
  });

  test('ignores negated mentions', () => {
    assert.deepEqual(matchTerms('fără zahăr adăugat', ['zahar']), []);
    assert.deepEqual(matchTerms('no added sugar; sugar-free', ['sugar']), []);
    assert.deepEqual(matchTerms('fara ulei de palmier', ['ulei de palmier']), []);
  });

  test('the "~" token allows words in between', () => {
    assert.deepEqual(matchTerms('amidon de porumb modificat', ['amidon ~ modificat']), ['amidon de porumb modificat']);
    assert.deepEqual(matchTerms('modified maize starch', ['modified ~ starch']), ['modified maize starch']);
  });

  test('default presets: palm oil, glucose-fructose syrup, hydrogenated fats on; others off', () => {
    const def = defaultAvoidState();
    assert.deepEqual(
      Object.entries(def.presets).filter(([, on]) => on).map(([id]) => id).sort(),
      ['gfs', 'hydrogenated', 'palm'],
    );
    for (const id of ['sugar', 'flavourings', 'maltodextrin', 'modstarch']) assert.equal(def.presets[id], false);
  });

  test('every preset has RO and EN labels and terms', () => {
    for (const p of AVOID_PRESETS) {
      assert.ok(p.label.en && p.label.ro, p.id);
      assert.ok(p.terms.length > 1, p.id);
    }
  });

  test('finds default presets in Romanian and English text', () => {
    const ro = findAvoidHits('ulei de palmier, sirop de glucoză-fructoză, grăsimi vegetale parțial hidrogenate');
    assert.deepEqual(ro.map((h) => h.id), ['palm', 'gfs', 'hydrogenated']);
    assert.deepEqual(ro[0].matches, ['ulei de palmier']);
    const en = findAvoidHits('Palm oil, glucose-fructose syrup, partially hydrogenated soybean oil');
    assert.deepEqual(en.map((h) => h.id), ['palm', 'gfs', 'hydrogenated']);
  });

  test('disabled presets are not reported; enabled ones are', () => {
    const text = 'zahăr, maltodextrină, arome, amidon modificat';
    assert.deepEqual(findAvoidHits(text).map((h) => h.id), []);
    const all = { presets: { sugar: true, flavourings: true, maltodextrin: true, modstarch: true } };
    assert.deepEqual(findAvoidHits(text, all).map((h) => h.id), ['sugar', 'flavourings', 'maltodextrin', 'modstarch']);
  });

  test('presets with codes match via E-numbers (modified starch E14xx)', () => {
    const hits = findAvoidHits('E1422', { presets: { modstarch: true } }, ['E1422']);
    assert.deepEqual(hits.map((h) => h.id), ['modstarch']);
  });

  test('custom terms are matched with word boundaries', () => {
    const hits = findAvoidHits('lapte praf, arahide', { presets: {}, custom: ['arahide', 'lapte'] });
    assert.deepEqual(hits.map((h) => h.id), ['custom:arahide', 'custom:lapte']);
    assert.deepEqual(findAvoidHits('laptele', { presets: {}, custom: ['lapte'] }), []);
  });
});

// ─────────────────────────────── NOVA estimate ───────────────────────────
describe('estimateNova()', () => {
  test('flavourings, glucose syrup, modified starch, hydrogenated fats, maltodextrin → 4', () => {
    for (const s of [
      'făină, apă, arome',
      'zahăr, sirop de glucoză',
      'lapte, amidon de porumb modificat',
      'ulei vegetal hidrogenat, sare',
      'maltodextrină, cacao',
      'sugar, natural flavouring',
      'milk, modified maize starch',
    ]) {
      assert.equal(estimateNova(s).nova, 4, s);
    }
  });

  test('cosmetic additives (colour, sweetener, emulsifier…) → 4', () => {
    const r = analyze({ text: 'apă, E951' });
    assert.equal(r.processing.nova, 4);
    assert.ok(r.processing.markers.includes('E951'));
  });

  test('non-cosmetic additives only → 3', () => {
    assert.equal(analyze({ text: 'castraveți, apă, oțet, sare, E202' }).processing.nova, 3);
  });

  test('culinary ingredients: single → 2, with other foods → 3', () => {
    assert.equal(estimateNova('ulei de floarea-soarelui').nova, 2);
    assert.equal(estimateNova('fasole, apă, sare').nova, 3);
  });

  test('plain food → 1, empty → null', () => {
    assert.equal(estimateNova('lapte de vacă pasteurizat').nova, 1);
    assert.equal(estimateNova('').nova, null);
  });

  test('negated markers do not count', () => {
    assert.equal(estimateNova('iaurt, fără arome').nova, 1);
  });
});

// ──────────────────────────────── analyze() ──────────────────────────────
describe('analyze()', () => {
  const sample =
    'Ingrediente: zahăr, ulei de palmier, făină de grâu, emulgator: lecitină din soia (E322), ' +
    'colorant: caramel amoniacal-sulfitic (E150d), E129, conservant: benzoat de sodiu, acid citric, arome.';

  test('returns additives sorted by risk, de-duplicated across code and name', () => {
    const r = analyze({ text: sample });
    assert.deepEqual(codes(r.additives), ['E129', 'E150d', 'E211', 'E322', 'E330']);
    const e150d = r.additives.find((a) => a.code === 'E150d');
    assert.deepEqual(e150d.matchedBy.sort(), ['code', 'name']);
    assert.equal(e150d.name.ro, 'Caramel amoniacal-sulfitic');
    assert.ok(e150d.why.en.includes('IARC'));
  });

  test('counts and verdict', () => {
    const r = analyze({ text: sample });
    assert.deepEqual(r.counts, { high: 1, medium: 2, low: 0, none: 2, unknown: 0, total: 5 });
    assert.equal(r.verdict, 'bad');
    assert.deepEqual(r.reasons.map((x) => x.type), ['high', 'avoid', 'medium', 'nova4']);
    assert.deepEqual(r.avoidHits.map((h) => h.id), ['palm']);
    assert.equal(r.processing.nova, 4);
    assert.equal(r.processing.source, 'estimate');
  });

  test('verdict "bad" from an avoid hit alone', () => {
    const r = analyze({ text: 'ulei de palmier, cacao' });
    assert.equal(r.counts.total, 0);
    assert.equal(r.verdict, 'bad');
  });

  test('verdict "warn" for medium additives or NOVA 4', () => {
    assert.equal(analyze({ text: 'vin, E220' }).verdict, 'warn');
    assert.equal(analyze({ text: 'iaurt, arome' }).verdict, 'warn');
  });

  test('verdict "ok" for harmless ingredients', () => {
    const r = analyze({ text: 'roșii, apă, sare, acid citric' });
    assert.equal(r.verdict, 'ok');
    assert.equal(r.additives[0].level, 'none');
  });

  test('verdict "unknown" for empty input', () => {
    assert.equal(analyze({}).verdict, 'unknown');
    assert.equal(analyze({ text: '   ' }).verdict, 'unknown');
  });

  test('uses Open Food Facts tags and database NOVA / Nutri-Score', () => {
    const r = analyze({ additiveTags: ['en:e322i', 'en:e450iii', 'en:e160aiv'], nova: 3, nutriscore: 'E' });
    assert.deepEqual(codes(r.additives), ['E450', 'E160a', 'E322']);
    assert.deepEqual(r.processing, { nova: 3, source: 'database', markers: [] });
    assert.equal(r.nutriscore, 'e');
    assert.equal(r.verdict, 'warn');
  });

  test('unknown E-numbers are reported as unknown', () => {
    const r = analyze({ text: 'E999' });
    assert.equal(r.additives[0].code, 'E999');
    assert.equal(r.additives[0].level, 'unknown');
    assert.equal(r.counts.unknown, 1);
  });

  test('respects the avoid state passed in', () => {
    const off = { presets: { palm: false } };
    assert.deepEqual(analyze({ text: 'ulei de palmier' }, off).avoidHits, []);
    assert.equal(analyze({ text: 'ulei de palmier' }, off).verdict, 'ok');
  });
});

// ─────────────────────────────── Database ────────────────────────────────
describe('additive database', () => {
  test('has about 100+ unique, well-formed entries', () => {
    assert.ok(ADDITIVES.length >= 100, `only ${ADDITIVES.length}`);
    assert.equal(new Set(ADDITIVES.map((a) => a.code)).size, ADDITIVES.length);
    for (const a of ADDITIVES) {
      assert.match(a.code, /^E\d{3,4}[a-f]?$/, a.code);
      assert.ok(CATEGORIES.includes(a.category), a.code);
      assert.ok(LEVELS.includes(a.level), a.code);
      assert.ok(a.name.en && a.name.ro, a.code);
      assert.ok(a.why.en && a.why.ro, a.code);
      assert.ok(Array.isArray(a.aliases) && a.aliases.length > 0, a.code);
    }
  });

  test('includes the required additives', () => {
    const required = [
      'E102', 'E104', 'E110', 'E122', 'E124', 'E129', 'E171', 'E127', 'E150c', 'E150d',
      'E210', 'E211', 'E212', 'E213', 'E220', 'E221', 'E222', 'E223', 'E224', 'E226', 'E227', 'E228',
      'E249', 'E250', 'E251', 'E252', 'E319', 'E320', 'E321',
      'E338', 'E339', 'E340', 'E341', 'E450', 'E451', 'E452', 'E407', 'E407a', 'E433', 'E466', 'E471',
      'E173', 'E520', 'E521', 'E522', 'E523', 'E541', 'E554', 'E556', 'E559',
      'E620', 'E621', 'E622', 'E623', 'E624', 'E625',
      'E950', 'E951', 'E952', 'E954', 'E955', 'E957', 'E959', 'E960', 'E961', 'E962', 'E964', 'E965', 'E966', 'E967', 'E968',
      'E420', 'E421', 'E953', 'E300', 'E330', 'E322', 'E415',
    ];
    for (const c of required) assert.ok(ADDITIVES_BY_CODE[c], c);
  });

  test('Southampton colours carry the EU warning and are rated high', () => {
    for (const c of ['E102', 'E104', 'E110', 'E122', 'E124', 'E129']) {
      assert.equal(ADDITIVES_BY_CODE[c].level, 'high', c);
      assert.ok(ADDITIVES_BY_CODE[c].why.en.includes('activity and attention in children'), c);
    }
    assert.ok(ADDITIVES_BY_CODE.E171.why.en.includes('2022'));
  });

  test('common harmless additives are rated "none"', () => {
    for (const c of ['E300', 'E330', 'E322', 'E415']) assert.equal(ADDITIVES_BY_CODE[c].level, 'none', c);
  });

  test('no alias is claimed by two different additives', () => {
    const owner = new Map();
    for (const a of ADDITIVES) {
      for (const alias of a.aliases) {
        const key = normalize(alias);
        assert.ok(!owner.has(key) || owner.get(key) === a.code, `${alias}: ${owner.get(key)} vs ${a.code}`);
        owner.set(key, a.code);
      }
    }
  });
});

// ────────────────────────────────── i18n ─────────────────────────────────
describe('i18n', () => {
  test('detectLang() picks Romanian or English from browser languages', () => {
    assert.equal(detectLang({ languages: ['ro-RO', 'en'] }), 'ro');
    assert.equal(detectLang({ languages: ['de-DE', 'en-US'] }), 'en');
    assert.equal(detectLang({ language: 'ro' }), 'ro');
    assert.equal(detectLang({ languages: ['fr'] }), 'en');
    assert.equal(detectLang(undefined), 'en');
  });

  test('t() translates with parameters and pick() selects a language', () => {
    assert.equal(t('ro', 'reason_high', { count: 2 }), '2 aditiv(i) cu risc ridicat');
    assert.equal(t('en', 'reason_nutriscore', { grade: 'D' }), 'Nutri-Score D');
    assert.equal(pick({ en: 'a', ro: 'b' }, 'ro'), 'b');
  });
});
