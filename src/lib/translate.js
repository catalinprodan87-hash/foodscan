/**
 * On-device translation of an ingredients list into Romanian (v3.6), term
 * by term, with the Open Food Facts taxonomy dictionary for the source
 * language (public/dict/{lang}.json). Pure, unit-tested.
 *
 * - E-numbers, percentages, numbers and capitalised INCI-like codes stay as
 *   they are; words in capitals (allergens) are translated in capitals.
 * - A phrase is looked up whole, then the longest known word sequences.
 * - A word not in the dictionary gets one try at a near spelling (one
 *   letter wrong, for misread words); otherwise it stays untranslated and is
 *   marked as unknown.
 */
import { normalize } from './analyze.js';
import { levenshtein } from './ocrText.js';

const HEADINGS = /^(ingredients?|ingrédients|ingredienti|ingredientes|ingrediënten|zutaten|składniki|összetevők|složení|zloženie|sastojci|sestavine|съставки|состав|склад|συστατικά)$/iu;
// Codes stay: E-numbers, numbers / percentages, tokens with digits (CI 77891, PEG-40).
const KEEP = /^(ci\s?\d{5}|e\s?\d{3,4}[a-z]?|\d+(?:[.,]\d+)?\s*%?|(?=[\p{L}-]*\d)[\p{L}\d-]{2,})$/iu;
const fold = (s) => normalize(String(s)).replace(/\s+/g, ' ').trim();

/** Word list of a dictionary (for near-spelling correction), built once per dictionary. */
const vocabCache = new WeakMap();
function vocabulary(terms) {
  let v = vocabCache.get(terms);
  if (!v) {
    v = new Set();
    for (const k of Object.keys(terms)) for (const w of k.split(' ')) if (w.length >= 5) v.add(w);
    vocabCache.set(terms, v);
  }
  return v;
}

/** Near-spelling correction only for long words: short real words ("frais") must not become others ("fraise"). */
export const MIN_CORRECT = 7;

/** One word at edit distance 1 (unique), or null. */
export function correctWord(word, terms) {
  const w = fold(word);
  if (w.length < MIN_CORRECT) return null;
  let found = null;
  for (const v of vocabulary(terms)) {
    if (Math.abs(v.length - w.length) > 1 || v[0] !== w[0]) continue;
    if (levenshtein(v, w) === 1) {
      if (found && found !== v) return null; // ambiguous
      found = v;
    }
  }
  return found;
}

const matchCase = (src, out) => (src === src.toUpperCase() && /\p{L}/u.test(src) ? out.toUpperCase() : out);

/**
 * Translates one ingredient phrase (between separators).
 * @returns {{out: string, unknown: string[], known: number, words: number}}
 */
function translatePhrase(phrase, terms) {
  const lead = phrase.match(/^\s*/)[0];
  const trail = phrase.match(/\s*$/)[0];
  const core = phrase.trim();
  if (!core) return { out: phrase, unknown: [], known: 0, words: 0 };
  if (HEADINGS.test(core)) return { out: `${lead}Ingrediente${trail}`, unknown: [], known: 1, words: 1 };
  if (KEEP.test(core)) return { out: phrase, unknown: [], known: 0, words: 0 };
  const whole = terms[fold(core)];
  if (whole) return { out: lead + matchCase(core, whole) + trail, unknown: [], known: 1, words: 1 };
  // Words with what stands next to them ("Zucker 30 %").
  const tokens = core.split(/(\s+)/);
  const words = tokens.filter((x) => x.trim());
  const out = [];
  const unknown = [];
  let known = 0;
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    const bare = w.replace(/[.!]+$/, '');
    if (KEEP.test(bare) || /^\d/.test(w) || /^[%*®™]+$/.test(w) || (/^ci$/i.test(bare) && /^\d{5}/.test(words[i + 1] || ''))) { out.push(w); i++; continue; }
    let done = false;
    for (let n = Math.min(5, words.length - i); n >= 1 && !done; n--) {
      const seq = words.slice(i, i + n).join(' ');
      const ro = terms[fold(seq)];
      if (ro) { out.push(matchCase(seq, ro)); known += n; i += n; done = true; }
    }
    if (done) continue;
    const near = correctWord(w, terms);
    const ro = near && terms[near];
    if (ro) { out.push(matchCase(w, ro)); known++; } else { out.push(w); unknown.push(w); }
    i++;
  }
  return { out: lead + out.join(' ') + trail, unknown, known, words: words.length };
}

/**
 * @param {string} text the ingredients in another language
 * @param {{terms: Record<string, string>}} dict the source language's dictionary
 * @returns {{text: string, unknown: string[], coverage: number}} coverage = share of words translated
 */
export function translateIngredients(text, dict) {
  const terms = dict?.terms || {};
  const parts = String(text || '').split(/([,;:()[\]{}]|\.\s|\n|\s[-–]\s)/);
  let known = 0;
  let words = 0;
  const unknown = [];
  const out = parts.map((p, i) => {
    if (i % 2 === 1) return p; // separators stay
    const r = translatePhrase(p, terms);
    known += r.known;
    words += r.words;
    unknown.push(...r.unknown);
    return r.out;
  });
  return { text: out.join(''), unknown: [...new Set(unknown)], coverage: words ? known / words : 1 };
}
