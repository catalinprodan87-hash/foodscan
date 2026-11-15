/**
 * The OCR word clean-up against real Romanian ingredient lists
 * (bench/corpus/ro-ingredients.jsonl, Open Food Facts, ODbL).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { correctWords, getLexicon } from '../src/lib/lexicon.js';
import { normalize, findAdditiveNames, findECodes } from '../src/lib/analyze.js';
import { LEXICON_RO } from '../src/data/lexicon-ro.js';
import { ADDITIVES_BY_CODE } from '../src/data/additives.js';

const lists = readFileSync(new URL('../bench/corpus/ro-ingredients.jsonl', import.meta.url), 'utf8')
  .split('\n').filter(Boolean).slice(1).map((l) => JSON.parse(l).text);

const additivesIn = (text) => new Set([...findAdditiveNames(text).map((x) => x.code), ...findECodes(text).map((x) => x.code)]);

let seed = 7;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
/** One letter changed, dropped or doubled in about every third word – like OCR slips. */
function damage(text) {
  return text.replace(/\p{L}{4,}/gu, (w) => {
    if (rand() > 0.33) return w;
    const i = 1 + Math.floor(rand() * (w.length - 2));
    const r = rand();
    if (r < 0.4) return w.slice(0, i) + 'aeiourstnl'[Math.floor(rand() * 10)] + w.slice(i + 1);
    if (r < 0.7) return w.slice(0, i) + w.slice(i + 1);
    return w.slice(0, i) + w[i] + w.slice(i);
  });
}

describe('word clean-up on real Romanian ingredient lists', () => {
  test('inflected forms are not "corrected" to the base word (found by the jar benchmark)', () => {
    assert.equal(correctWords('ardei copti 40%').text, 'ardei copți 40%'); // diacritics yes, never "copt"
    assert.equal(correctWords('legume coapte').text, 'legume coapte');
  });

  test('the corpus is there (at least 300 lists)', () => {
    assert.ok(lists.length >= 300, `${lists.length} lists`);
  });

  test('diacritics are restored for ≥ 98% of words that have them', () => {
    const lex = getLexicon();
    const words = [...new Set(LEXICON_RO.split(' ').filter((w) => w !== normalize(w)))];
    let ok = 0;
    for (const w of words) if (correctWords(normalize(w), lex).text === lex.get(normalize(w))) ok++;
    assert.ok(ok / words.length >= 0.98, `${ok}/${words.length}`);
  });

  // Corpus texts are typed (or OCR'd) by people and contain typos ("licerină" for
  // glicerină). Fixing a typo into an additive name is right; changing a REAL word
  // into one would be a false alarm. Real words = seen at least 3 times in the corpus.
  test('real words are never turned into additive names (only typos are fixed)', (t) => {
    const freq = new Map();
    for (const t of lists) for (const w of t.toLowerCase().match(/\p{L}+/gu) || []) freq.set(w, (freq.get(w) || 0) + 1);
    const fixedTypos = [];
    for (const text of lists) {
      const before = additivesIn(text);
      const { text: after, changes } = correctWords(text);
      const invented = [...additivesIn(after)].filter((c) => !before.has(c));
      if (!invented.length) continue;
      for (const ch of changes) {
        if (!invented.some((c) => additivesIn(ch.to).has(c))) continue;
        assert.ok((freq.get(ch.from.toLowerCase()) || 0) < 3, `real word "${ch.from}" turned into "${ch.to}"`);
        fixedTypos.push(`${ch.from} → ${ch.to}`);
      }
    }
    t.diagnostic(`typos fixed into additive names: ${fixedTypos.join(', ') || 'none'}`);
  });

  test('damaged lists (OCR-like slips): the clean-up never invents an additive', () => {
    for (const text of lists) {
      // what the label means: the text plus its own typo fixes
      const truth = new Set([...additivesIn(text), ...additivesIn(correctWords(text).text)]);
      const damaged = damage(text);
      const seenDamaged = additivesIn(damaged);
      // The label may name an additive in an inflected form the matcher does not
      // know ("sorbitoli" = sorbitol); that still counts as on the label.
      const onLabel = (code) => (ADDITIVES_BY_CODE[code]?.aliases || []).some((a) => a.length >= 5 && normalize(text).includes(normalize(a)));
      for (const code of additivesIn(correctWords(damaged).text)) {
        assert.ok(truth.has(code) || seenDamaged.has(code) || onLabel(code), `${code} invented from: ${damaged.slice(0, 100)}`);
      }
    }
  });
});
