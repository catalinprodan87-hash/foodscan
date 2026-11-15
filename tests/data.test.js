/**
 * Schema checks for the hand-written databases: every entry complete in both
 * languages, valid levels and codes, restrictions pointing at known regions,
 * and no label alias that would match two different ingredients.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ADDITIVES, ADDITIVES_BY_CODE, CATEGORIES } from '../src/data/additives.js';
import { NONFOOD_INGREDIENTS, NONFOOD_BY_CODE, NONFOOD_DOMAINS, NONFOOD_CATEGORIES } from '../src/data/nonFoodIngredients.js';
import { RESTRICTIONS, REGIONS, STATUS_LEVEL } from '../src/data/restrictions.js';
import { AVOID_PRESETS } from '../src/data/avoidPresets.js';
import { normalize } from '../src/lib/analyze.js';

const LEVELS = ['high', 'medium', 'low', 'none'];
const E_CODE = /^E\d{3,4}[a-h]?$/;
const filled = (x) => typeof x === 'string' && x.trim().length > 0;

// Aliases deliberately shared between entries (same substance listed twice on
// purpose, e.g. a food additive that is also a cosmetic ingredient). Add with a reason.
const SHARED_ALIAS_WHITELIST = new Set([]);

function checkEntry(e, where) {
  assert.ok(filled(e.code), `${where}: code`);
  assert.ok(LEVELS.includes(e.level), `${where} ${e.code}: level "${e.level}"`);
  for (const lang of ['en', 'ro']) {
    assert.ok(filled(e.name?.[lang]), `${where} ${e.code}: name.${lang}`);
    assert.ok(filled(e.why?.[lang]), `${where} ${e.code}: why.${lang}`);
    assert.ok(e.why[lang].trim().length >= 20, `${where} ${e.code}: why.${lang} too short`);
  }
  assert.ok(Array.isArray(e.aliases), `${where} ${e.code}: aliases`);
  for (const a of e.aliases) assert.ok(filled(a), `${where} ${e.code}: empty alias`);
}

describe('food additives database', () => {
  test('every entry is complete and valid', () => {
    for (const e of ADDITIVES) {
      checkEntry(e, 'additives');
      assert.match(e.code, E_CODE, `bad E-code ${e.code}`);
      assert.ok(CATEGORIES.includes?.(e.category) ?? Object.values(CATEGORIES).includes(e.category), `${e.code}: category ${e.category}`);
    }
  });

  test('codes are unique and the index matches', () => {
    const codes = ADDITIVES.map((e) => e.code);
    assert.equal(new Set(codes).size, codes.length, 'duplicate codes');
    assert.equal(Object.keys(ADDITIVES_BY_CODE).length, codes.length);
  });
});

describe('non-food ingredients database', () => {
  test('every entry is complete and valid', () => {
    const cats = Array.isArray(NONFOOD_CATEGORIES) ? NONFOOD_CATEGORIES.map((c) => c.id ?? c) : Object.keys(NONFOOD_CATEGORIES);
    for (const e of NONFOOD_INGREDIENTS) {
      checkEntry(e, 'nonFood');
      assert.ok(NONFOOD_DOMAINS.includes(e.domain), `${e.code}: domain ${e.domain}`);
      assert.ok(cats.includes(e.category), `${e.code}: category ${e.category}`);
      assert.ok(e.aliases.length > 0, `${e.code}: no aliases`);
    }
  });

  test('codes are unique and do not clash with E-numbers', () => {
    const codes = NONFOOD_INGREDIENTS.map((e) => e.code);
    assert.equal(new Set(codes).size, codes.length, 'duplicate codes');
    assert.equal(Object.keys(NONFOOD_BY_CODE).length, codes.length);
    for (const c of codes) assert.ok(!ADDITIVES_BY_CODE[c], `${c} is also an additive code`);
  });
});

describe('aliases', () => {
  // A label word must lead to one ingredient: the same normalised alias on two
  // entries of the same database would make the result depend on list order.
  for (const [label, list] of [['additives', ADDITIVES], ['nonFood', NONFOOD_INGREDIENTS]]) {
    test(`${label}: no alias points to two codes`, () => {
      const seen = new Map();
      const clashes = [];
      for (const e of list) {
        for (const a of e.aliases) {
          const key = normalize(a).trim();
          const prev = seen.get(key);
          if (prev && prev !== e.code && !SHARED_ALIAS_WHITELIST.has(key)) clashes.push(`"${a}": ${prev} and ${e.code}`);
          seen.set(key, e.code);
        }
      }
      assert.deepEqual(clashes, []);
    });
  }

  test('ALL-CAPS short aliases have at least 2 characters (they match only as capitals)', () => {
    for (const e of [...ADDITIVES, ...NONFOOD_INGREDIENTS]) {
      for (const a of e.aliases) {
        if (a === a.toUpperCase() && /[A-Z]/.test(a)) assert.ok(a.replace(/[^A-Z0-9]/g, '').length >= 2, `${e.code}: alias "${a}"`);
      }
    }
  });
});

describe('restrictions outside the EU', () => {
  test('every code exists and every rule is complete', () => {
    for (const [code, rules] of Object.entries(RESTRICTIONS)) {
      assert.ok(ADDITIVES_BY_CODE[code] || NONFOOD_BY_CODE[code], `unknown code ${code}`);
      assert.ok(rules.length > 0, `${code}: empty`);
      for (const r of rules) {
        assert.ok(REGIONS[r.region] && r.region !== 'EU', `${code}: region ${r.region}`);
        assert.ok(r.status in STATUS_LEVEL, `${code}: status ${r.status}`);
        assert.ok(['high', 'medium', 'low'].includes(r.level), `${code}: level ${r.level}`);
        for (const lang of ['en', 'ro']) assert.ok(filled(r[lang]) && r[lang].length >= 30, `${code}: ${lang} reason`);
      }
    }
  });

  test('every region has names in both languages', () => {
    for (const [id, r] of Object.entries(REGIONS)) {
      assert.ok(filled(r.en) && filled(r.ro), id);
    }
  });
});

describe('avoid-list presets', () => {
  test('ids unique, labels in both languages, terms or codes that exist', () => {
    const ids = AVOID_PRESETS.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const p of AVOID_PRESETS) {
      assert.ok(filled(p.label?.en) && filled(p.label?.ro), p.id);
      assert.ok(Array.isArray(p.types) && p.types.length > 0, `${p.id}: types`);
      const terms = p.terms || [];
      const codes = p.codes || [];
      assert.ok(terms.length + codes.length > 0, `${p.id}: no terms or codes`);
      // E-numbers are found in the text even when not in the database yet
      // (E1410, E1413… are a known gap, see ROADMAP D1); other codes must exist.
      for (const c of codes) {
        if (E_CODE.test(c)) continue;
        assert.ok(NONFOOD_BY_CODE[c], `${p.id}: unknown code ${c}`);
      }
    }
  });
});

describe('sources and review dates (v2.6)', async () => {
  const { sourcesFor, reviewedFor } = await import('../src/data/sources.js');
  test('every high or medium entry, and every restriction outside the EU, cites at least one source', () => {
    for (const e of [...ADDITIVES, ...NONFOOD_INGREDIENTS].filter((x) => x.level === 'high' || x.level === 'medium')) {
      assert.ok(sourcesFor(e).length > 0, `${e.code}: no source in "${e.why.en.slice(0, 80)}"`);
    }
    for (const [code, rules] of Object.entries(RESTRICTIONS)) {
      for (const r of rules) assert.ok(sourcesFor({ why: { en: '' } }, [r]).length > 0, `${code} ${r.region}: no source`);
    }
  });

  test('sources have a title in both languages and an https link; review dates are ISO dates', () => {
    for (const e of [...ADDITIVES, ...NONFOOD_INGREDIENTS]) {
      for (const s of sourcesFor(e)) assert.ok(s.en && s.ro && /^https:\/\//.test(s.url), `${e.code} ${s.id}`);
      assert.match(reviewedFor(e, ADDITIVES_BY_CODE[e.code] ? 'additives' : 'nonFood'), /^\d{4}-\d{2}-\d{2}$/, e.code);
    }
  });
});
