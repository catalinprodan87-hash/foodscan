import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NONFOOD_INGREDIENTS, NONFOOD_BY_CODE, NONFOOD_DOMAINS, NONFOOD_CATEGORIES } from '../src/data/nonFoodIngredients.js';
import { PRODUCT_TYPES } from '../src/data/productCategories.js';
import { compileTerm, normalize, stripDiacritics } from '../src/lib/analyze.js';

const LEVELS = ['high', 'medium', 'low', 'none'];

/** Test-only matcher: all aliases, longest non-overlapping match wins (same rule as the food matcher). */
function findNonFood(text, domains = NONFOOD_DOMAINS) {
  const norm = normalize(text);
  const cased = stripDiacritics(text);
  const cands = [];
  for (const ing of NONFOOD_INGREDIENTS) {
    if (!domains.includes(ing.domain)) continue;
    for (const alias of ing.aliases) {
      const { caps, re } = compileTerm(alias);
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(caps ? cased : norm)) !== null) {
        cands.push({ code: ing.code, start: m.index, end: m.index + m[0].length });
      }
    }
  }
  cands.sort((x, y) => (y.end - y.start) - (x.end - x.start) || x.start - y.start);
  const taken = [];
  for (const c of cands) if (!taken.some((t) => c.start < t.end && t.start < c.end)) taken.push(c);
  return [...new Set(taken.map((t) => t.code))];
}

test('every entry is complete and valid', () => {
  for (const x of NONFOOD_INGREDIENTS) {
    assert.ok(x.code, 'code');
    assert.ok(NONFOOD_DOMAINS.includes(x.domain), `${x.code} domain`);
    assert.ok(NONFOOD_CATEGORIES.includes(x.category), `${x.code} category`);
    assert.ok(LEVELS.includes(x.level), `${x.code} level`);
    assert.ok(x.name.en && x.name.ro, `${x.code} name`);
    assert.ok(x.why.en && x.why.ro, `${x.code} why`);
    assert.ok(x.aliases.length > 0, `${x.code} aliases`);
  }
});

test('codes are unique', () => {
  assert.equal(Object.keys(NONFOOD_BY_CODE).length, NONFOOD_INGREDIENTS.length);
});

test('no alias is shared by two entries', () => {
  const seen = new Map();
  for (const x of NONFOOD_INGREDIENTS) {
    for (const a of x.aliases) {
      const key = /^[A-Z0-9]+$/.test(a) ? a : normalize(a);
      assert.ok(!seen.has(key), `alias "${a}" in ${x.code} and ${seen.get(key)}`);
      seen.set(key, x.code);
    }
  }
});

test('shampoo INCI list', () => {
  const inci = 'Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Sodium Chloride, Parfum, Zinc Pyrithione, Methylchloroisothiazolinone, Methylisothiazolinone, Limonene, Linalool, Butylphenyl Methylpropional';
  const found = findNonFood(inci, ['cosmetic', 'both']);
  for (const c of ['SLES', 'CAPB', 'PARFUM', 'ZPT', 'MCI/MI', 'MIT', 'LIMONENE', 'LINALOOL', 'LILIAL']) {
    assert.ok(found.includes(c), `expected ${c}, got ${found.join(',')}`);
  }
  assert.ok(!found.includes('SLS'), 'laureth must not be read as lauryl');
  assert.ok(!found.includes('PEG'), '"laureth" inside SLES must not also count as PEG');
});

test('parabens are told apart', () => {
  const found = findNonFood('Methylparaben, Propylparaben, Isobutylparaben', ['cosmetic']);
  assert.deepEqual(found.sort(), ['ISOBUTYLPARABEN', 'METHYLPARABEN', 'PROPYLPARABEN']);
});

test('sunscreen and gel polish', () => {
  assert.deepEqual(findNonFood('Homosalate, Octocrylene, Benzophenone-3, Cyclopentasiloxane', ['cosmetic', 'both']).sort(), ['BP-3', 'D5', 'HOMOSALATE', 'OCTOCRYLENE']);
  assert.ok(findNonFood('HEMA, Trimethylbenzoyl Diphenylphosphine Oxide', ['cosmetic']).includes('TPO'));
});

test('Romanian detergent label (Reg. 648/2004 style)', () => {
  const label = 'Conține: 5-15% agenți de suprafață anionici, <5% agenți de suprafață neionici, fosfonați, săpun, enzime, agenți de albire optică, parfumuri, Benzisothiazolinone, Methylisothiazolinone, Limonene';
  const found = findNonFood(label, ['household', 'both']);
  for (const c of ['ANIONIC', 'NONIONIC', 'PHOSPHONATES', 'SAPONIFIED', 'ENZYMES', 'OPTICAL-BR', 'PARFUM', 'BIT', 'MIT', 'LIMONENE']) {
    assert.ok(found.includes(c), `expected ${c}, got ${found.join(',')}`);
  }
  assert.ok(!found.includes('PHOSPHATES-H'), 'fosfonați must not be read as fosfați');
});

test('Romanian bleach / toilet cleaner', () => {
  const found = findNonFood('Conține hipoclorit de sodiu, hidroxid de sodiu, <5% înălbitori pe bază de clor', ['household', 'both']);
  assert.ok(found.includes('HYPOCHLORITE'));
  assert.ok(found.includes('NAOH'));
});

test('domain filter keeps household-only items out of cosmetics', () => {
  assert.ok(!findNonFood('Benzisothiazolinone', ['cosmetic', 'both']).includes('BIT'));
});

test('product categories reference valid databases', () => {
  const types = PRODUCT_TYPES.map((t) => t.type);
  assert.deepEqual(types, ['food', 'cosmetic', 'household']);
  for (const t of PRODUCT_TYPES) assert.ok(t.groups.length > 0 && t.source.startsWith('https://'));
});
