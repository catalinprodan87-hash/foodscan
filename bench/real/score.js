/**
 * Scoring for the real-photo benchmark (pure, unit-tested in tests/benchScore.test.js).
 *
 * The reader returns all the text of a photo in its own line order; a block of
 * the label (one language's ingredients, the origin line…) is somewhere inside
 * it. findBlock() aligns the block against the best-matching stretch of the
 * reader's text (semi-global edit distance: free start and end in the OCR
 * text), so a block is scored on its own whatever else the photo contains.
 *
 *   strict  – lower case, cedilla ş ţ = comma ș ț, quotes / dashes unified,
 *             spaces collapsed: diacritics count (ă vs a is an error)
 *   folded  – the app's normalize(): diacritics removed, as the analysis sees it
 */
import { normalize } from '../../src/lib/analyze.js';

const SAME = { 'ş': 'ș', 'ţ': 'ț', 'Ş': 'ș', 'Ţ': 'ț', '‘': "'", '’': "'", '„': '"', '“': '"', '”': '"', '–': '-', '—': '-', '·': '.', '•': '.' };

export function strictText(s) {
  return [...String(s || '').toLowerCase()].map((c) => SAME[c] ?? c).join('').replace(/\s+/g, ' ').trim();
}
export const foldedText = (s) => normalize(String(s || '')).replace(/\s+/g, ' ').trim();

const words = (s) => s.split(' ').filter(Boolean);

/**
 * Semi-global alignment of `ref` (all of it) inside `hyp` (any stretch).
 * Works on arrays (characters or words).
 * @returns {{edits: number, start: number, end: number}} edits to turn the best stretch of hyp into ref
 */
export function findBlock(ref, hyp) {
  const m = ref.length;
  const n = hyp.length;
  let prev = new Int32Array(n + 1); // row 0: free start
  let prevStart = new Int32Array(n + 1).map((_, j) => j);
  let cur = new Int32Array(n + 1);
  let curStart = new Int32Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    curStart[0] = 0;
    const r = ref[i - 1];
    for (let j = 1; j <= n; j++) {
      const sub = prev[j - 1] + (r === hyp[j - 1] ? 0 : 1);
      const del = prev[j] + 1; // ref char missing from hyp
      const ins = cur[j - 1] + 1; // extra char in hyp
      if (sub <= del && sub <= ins) { cur[j] = sub; curStart[j] = prevStart[j - 1]; }
      else if (del <= ins) { cur[j] = del; curStart[j] = prevStart[j]; }
      else { cur[j] = ins; curStart[j] = curStart[j - 1]; }
    }
    [prev, cur] = [cur, prev];
    [prevStart, curStart] = [curStart, prevStart];
  }
  let best = m;
  let end = 0;
  for (let j = 0; j <= n; j++) if (prev[j] < best) { best = prev[j]; end = j; }
  return { edits: best, start: best === m ? 0 : prevStart[end], end };
}

/** Character and word error rates of a prose block inside the reader's text. */
export function scoreProse(refText, hypText) {
  const out = {};
  for (const [mode, f] of [['strict', strictText], ['folded', foldedText]]) {
    const r = f(refText);
    const h = f(hypText);
    const c = findBlock([...r], [...h]);
    const rw = words(r);
    const w = findBlock(rw, words(h));
    out[mode] = { chars: r.length, charEdits: c.edits, words: rw.length, wordEdits: w.edits };
  }
  return out;
}

/** "18,9 g" / "18.9g" / "2360/566" → canonical token ("18,9g", "2360/566"). */
export const valueToken = (s) => foldedText(s).replace(/\s+/g, '').replace(/\./g, ',');

/** Value tokens in the reader's text: numbers with an optional unit or slash pair. */
export function valueTokens(text) {
  const t = foldedText(text).replace(/(\d)\s+(?=(?:g|kj|kcal|ml|%)\b)/g, '$1').replace(/(\d)\s*\/\s*(\d)/g, '$1/$2').replace(/\./g, ',');
  return t.match(/<?\d+(?:,\d+)?(?:\/\d+(?:,\d+)?)?(?:g|kj|kcal|ml|%)?/g) || [];
}

/**
 * Nutrition table: share of row names found (folded, allowing one wrong
 * character per 6) and share of values found (as a multiset, so "0 g" printed
 * four times must be read four times).
 */
export function scoreTable(block, hypText) {
  const h = foldedText(hypText);
  const labelsFound = (block.labels || []).filter((l) => {
    const r = foldedText(l);
    return findBlock([...r], [...h]).edits <= Math.floor(r.length / 6);
  });
  const pool = valueTokens(hypText);
  const counts = new Map();
  for (const v of pool) counts.set(v, (counts.get(v) || 0) + 1);
  const valuesFound = [];
  const missingValues = [];
  for (const v of block.values || []) {
    const k = valueToken(v);
    if (counts.get(k) > 0) { counts.set(k, counts.get(k) - 1); valuesFound.push(v); } else missingValues.push(v);
  }
  return {
    labels: (block.labels || []).length, labelsFound: labelsFound.length,
    values: (block.values || []).length, valuesFound: valuesFound.length,
    missingValues,
  };
}

/** Error rate in % (one decimal) from summed edits and lengths. */
export const rate = (edits, total) => (total ? Math.round((edits / total) * 1000) / 10 : null);
