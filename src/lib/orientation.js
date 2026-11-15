/**
 * Decides how to turn a photo so its text is upright, from what the OCR
 * worker measured on a small copy (see the 'orient' message in ocrWorker.js):
 *
 *   base      0 = lines horizontal, 1 = lines steep (photo taken sideways)
 *   vote      PaddleOCR's direction classifier, weighted over the main lines:
 *             {flip, confidence} – flip = the (base-turned) text is upside down
 *   texts     when the classifier was unsure or missing: the same lines read
 *             by the recogniser both ways, {up: [{text, conf}], down: [...]}
 *
 * Pure (unit-tested). The lexicon score is the share of words the app knows
 * (ingredient words, additive names…): upright text scores high, text read
 * upside down is nonsense and scores near zero.
 */
import { getLexicon } from './lexicon.js';
import { normalize } from './analyze.js';
import { CLS_SURE } from './paddleCore.js';

export { CLS_SURE };

/** Share of words (≥ 3 letters) that are in the ingredient word list. 0…1. */
export function lexiconScore(text, lex = getLexicon()) {
  const words = normalize(String(text || '')).match(/[a-z]{3,}/g) || [];
  if (!words.length) return 0;
  return words.filter((w) => lex.has(w)).length / words.length;
}

/** How convincing a set of read lines is: recogniser confidence and known words. */
export function readingScore(lines, lex) {
  if (!lines?.length) return 0;
  const conf = lines.reduce((n, l) => n + (l.conf || 0), 0) / lines.length;
  return 0.5 * conf + 0.5 * lexiconScore(lines.map((l) => l.text).join(' '), lex);
}

/**
 * @param {{base: 0|1, lines: number, vote?: {flip: boolean, confidence: number}|null,
 *          texts?: {up: {text, conf}[], down: {text, conf}[]}|null}} m
 * @returns {{turns: 0|1|2|3, method: 'none'|'cls'|'recogniser'|'weak', confidence: number}}
 *   turns: quarter turns clockwise to apply to the photo
 */
export function pickRotation(m, lex) {
  if (!m || !m.lines) return { turns: 0, method: 'none', confidence: 0 };
  const base = m.base === 1 ? 1 : 0;
  const turnsFor = (flip) => (base + (flip ? 2 : 0)) % 4;
  if (m.vote && m.vote.confidence >= CLS_SURE) {
    return { turns: turnsFor(m.vote.flip), method: 'cls', confidence: m.vote.confidence };
  }
  if (m.texts) {
    const up = readingScore(m.texts.up, lex);
    const down = readingScore(m.texts.down, lex);
    return { turns: turnsFor(down > up), method: 'recogniser', confidence: Math.abs(up - down) };
  }
  if (m.vote) return { turns: turnsFor(m.vote.flip), method: 'weak', confidence: m.vote.confidence };
  return { turns: base, method: 'weak', confidence: 0 };
}
