/**
 * Turns raw OCR text from a label photo into a clean ingredients list.
 * Pure functions (no DOM), unit-tested in tests/ocr.test.js.
 *
 *   1. find the start marker ("Ingrediente:", "Ingredients:", "Compoziție:",
 *      "INCI:", or "Conține:" for detergents)
 *   2. cut before whatever follows the list: nutrition table, storage / usage
 *      text, producer info, hazard statements, or another language's block
 *      (HU / BG … often follow on Romanian labels)
 *   3. join broken lines, undo end-of-line hyphenation, tidy punctuation and
 *      fix OCR errors inside E-codes
 */
import { normalize, stripDiacritics, fixOcrInECodes } from './analyze.js';

// ───────────────────────────── start markers ─────────────────────────────

/*
 * Groups in order of preference: a Romanian marker wins over an English one
 * wherever it is on the label, then INCI, then "Conține:" (detergents, Reg.
 * 648/2004). OCR often reads the capital I as l, 1 or |.
 * Patterns run on normalised text (lowercase, no diacritics).
 */
const START_GROUPS = [
  { kind: 'ro', re: /(?<![a-z0-9])(?:[il1|]ngrediente|compozitie|compozitia)(?![a-z0-9])\s*(?:\(inci\))?\s*[:;.]?/ },
  { kind: 'en', re: /(?<![a-z0-9])(?:[il1|]ngredients|composition)(?![a-z0-9])\s*(?:\(inci\))?\s*[:;.]?/ },
  { kind: 'inci', re: /(?<![a-z0-9])[il1|]nci(?![a-z0-9])\s*[:;]/ },
  // "Conține:" needs the colon, so "Poate conține urme de…" is not a start.
  { kind: 'contains', re: /(?<![a-z0-9])(?:contine|contains)\s*:/ },
];

export function findStart(raw) {
  const norm = normalize(raw);
  for (const g of START_GROUPS) {
    const m = g.re.exec(norm);
    if (m) return { kind: g.kind, index: m.index, end: m.index + m[0].length, marker: raw.slice(m.index, m.index + m[0].length).trim() };
  }
  return null;
}

// ────────────────────────────── stop markers ─────────────────────────────

/* Normalised phrases that end the ingredients list (whole words). */
const STOP_PHRASES = [
  // nutrition table
  'valori nutritionale', 'valorile nutritionale', 'valoare nutritionala', 'declaratie nutritionala',
  'declaratia nutritionala', 'informatii nutritionale', 'informatie nutritionala', 'valoare energetica',
  'valoarea energetica', 'energie', 'nutrition', 'nutritional', 'energy',
  // allergen precaution (not part of the list)
  'poate contine', 'may contain', 'contine urme',
  // storage, use, preparation
  'a se pastra', 'a se consuma', 'a se agita', 'a se utiliza', 'a se folosi', 'a se feri', 'a se tine',
  'a nu se', 'se pastreaza', 'pastrare', 'conditii de pastrare', 'mod de utilizare', 'mod de folosire',
  'mod de preparare', 'mod de administrare', 'mod de intrebuintare', 'instructiuni', 'store in', 'store at',
  'keep in', 'keep out', 'keep away', 'best before', 'use by', 'directions', 'how to use',
  'consumati de preferinta', 'a se consuma de preferinta', 'expira', 'data expirarii',
  'termen de valabilitate', 'valabil pana',
  // producer, lot, quantity
  'lot', 'produs in', 'produs de', 'fabricat in', 'fabricat de', 'made in', 'producator', 'importator',
  'importat de', 'distribuitor', 'distribuit de', 'ambalat in', 'greutate neta', 'cantitate neta',
  'masa neta', 'net weight', 'f.i.l', 'tel', 'www', 'http',
  // warnings
  'precautii', 'atentie', 'avertisment', 'avertizari', 'pericol', 'danger', 'warning', 'caution',
  // other languages' ingredient headings
  'osszetevok', 'osszetevoi', 'zlozenie', 'slozeni', 'sklad', 'zutaten', 'ingredienti', 'ingredientes',
  'sastojci', 'sestavine', 'sastav', 'ingredienten',
];
/* Only after a Romanian start: an English block that follows is another language. */
const STOP_AFTER_RO = ['ingredients'];
/* Numeric nutrition lines: cut at the start of the line, not mid-line. */
const LINE_STOPS = /(?<![a-z0-9])(?:kcal|kj)(?![a-z0-9])/;
/* Hazard / precautionary statement codes (CLP): H319, P102, EUH208. */
const HAZARD_CODE = /(?<![A-Za-z0-9])(?:EUH|H|P)\d{3}(?![0-9])/;
/* Language codes that open another block: "HU:", "BG:", "(HU)". RO/MD are ours. */
const LANG_CODE = /(?<![A-Za-z])(?:HU|BG|EN|GB|DE|AT|SK|CZ|CS|PL|UA|UK|RU|HR|SR|RS|SI|SL|GR|EL|IT|FR|ES|PT|NL|MK|TR|LT|LV|ET|EE|AL|BA|ME)\s*:|\((?:HU|BG|EN|GB|DE|SK|CZ|PL|UA|RU|HR|SR|SL|GR|IT|FR|ES)\)/;
/* Cyrillic or Greek words (BG / UA / RU / MK / GR blocks). */
const NON_LATIN_RUN = /[\u0370-\u03FF\u0400-\u04FF]{3,}/;

let phraseRe = null;
function getPhraseRe(phrases) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  return new RegExp(`(?<![a-z0-9])(?:${phrases.map(esc).join('|')})(?![a-z0-9])`);
}

function firstMatch(re, text, from) {
  const m = re.exec(text.slice(from));
  return m ? from + m.index : -1;
}

/**
 * Index where the ingredients list ends (exclusive), searching from `from`.
 * @returns {{index: number, reason: string|null}}
 */
export function findStop(raw, from = 0, startKind = null) {
  const norm = normalize(raw);
  const cased = stripDiacritics(raw);
  phraseRe = phraseRe || getPhraseRe(STOP_PHRASES);
  const candidates = [
    ['phrase', firstMatch(phraseRe, norm, from)],
    ['hazard', firstMatch(HAZARD_CODE, cased, from)],
    ['language', firstMatch(LANG_CODE, cased, from)],
    ['language', firstMatch(NON_LATIN_RUN, raw, from)],
  ];
  if (startKind === 'ro') candidates.push(['language', firstMatch(getPhraseRe(STOP_AFTER_RO), norm, from)]);
  const line = firstMatch(LINE_STOPS, norm, from);
  if (line >= 0) {
    const lineStart = raw.lastIndexOf('\n', line) + 1;
    candidates.push(['nutrition', Math.max(from, lineStart)]);
  }
  let best = { index: raw.length, reason: null };
  for (const [reason, idx] of candidates) {
    if (idx >= 0 && idx < best.index) best = { index: idx, reason };
  }
  return best;
}

// ──────────────────────────────── cleaning ───────────────────────────────

/* Words that keep their hyphen across a line break ("glucoză-\nfructoză"). */
const KEEP_HYPHEN = new Set([
  'glucoza', 'fructoza', 'glucose', 'fructose', 'floarea', 'alfa', 'alpha', 'beta', 'gama', 'gamma',
  'mono', 'di', 'tri', 'poli', 'l', 'dl', 'd', 'peg', 'ppg', 'ci', 'acid', 'e',
]);

const CONJUNCTIONS = new Set(['si', 'sau', 'and', 'or']);

/**
 * Joins broken lines, undoes end-of-line hyphenation, tidies spaces and
 * punctuation, fixes OCR errors inside E-codes.
 */
export function cleanOcrText(section) {
  let s = String(section || '').replace(/\r/g, '');
  // End-of-line hyphenation: "emul-\ngatori" → "emulgatori" (same letter case on both sides).
  s = s.replace(/([\p{L}]+)[-\u00AD][ \t]*\n[ \t]*([\p{L}]+)/gu, (m, left, next) => {
    // Suspended hyphen: "mono-\nși digliceride" → "mono- și digliceride".
    if (CONJUNCTIONS.has(normalize(next))) return `${left}- ${next}`;
    const lastChar = left.slice(-1);
    const sameCase = (lastChar === lastChar.toLowerCase()) === (next[0] === next[0].toLowerCase());
    if (!sameCase || KEEP_HYPHEN.has(normalize(left))) return `${left}-${next}`;
    return left + next;
  });
  s = s
    .replace(/[|¦_]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/[ \t\u00A0]+/g, ' ')
    .replace(/\s+([,.;:)\]])/g, '$1')
    .replace(/([([])\s+/g, '$1')
    .replace(/([,;])(?=[^\s\d])/g, '$1 ')
    .replace(/,\s*,+/g, ',')
    .replace(/^[\s:;.,\-–—)]+/, '')
    .replace(/^\(?inci\)?\s*[:;]?\s*/i, '')
    .replace(/[\s([{,;:–—-]+$/, '') // dangling "(", "," … left by the cut
    .trim();
  return fixOcrInECodes(s);
}

// ─────────────────────────────── extraction ──────────────────────────────

/**
 * @returns {{text: string, foundStart: boolean, startKind: string|null, marker: string|null,
 *            stopReason: string|null}}
 */
export function extractIngredients(rawText) {
  const raw = String(rawText || '').replace(/\r/g, '');
  const start = findStart(raw);
  const from = start ? start.end : 0;
  const stop = findStop(raw, from, start?.kind);
  let text = cleanOcrText(raw.slice(from, stop.index));
  // Nothing usable between the markers: give the user everything to edit.
  if (text.length < 3) text = cleanOcrText(raw);
  return {
    text,
    foundStart: !!start,
    startKind: start?.kind || null,
    marker: start?.marker || null,
    stopReason: stop.reason,
  };
}

/** Thresholds for the "take a better photo" tip. */
export const MIN_CONFIDENCE = 55;
export const MIN_TEXT_LENGTH = 25;

export function needsBetterPhoto({ confidence, text }) {
  return (Number.isFinite(confidence) && confidence < MIN_CONFIDENCE) || String(text || '').trim().length < MIN_TEXT_LENGTH;
}
