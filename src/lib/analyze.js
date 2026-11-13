/**
 * IngrediScan analysis engine. Pure functions, no DOM – runs in the browser
 * and in Node (tests).
 */
import { ADDITIVES, ADDITIVES_BY_CODE } from '../data/additives.js';
import { AVOID_PRESETS, defaultAvoidState, normalizeCustomEntry } from '../data/avoidPresets.js';
import { NONFOOD_INGREDIENTS, NONFOOD_BY_CODE } from '../data/nonFoodIngredients.js';
import { PRODUCT_TYPE_BY_ID } from '../data/productCategories.js';

export const PRODUCT_TYPES = ['food', 'cosmetic', 'household'];

// ───────────────────────────── Normalisation ─────────────────────────────

/** Explicit map so both Romanian forms (comma-below and legacy cedilla) are handled. */
const CHAR_MAP = {
  'ă': 'a', 'Ă': 'A', 'â': 'a', 'Â': 'A', 'î': 'i', 'Î': 'I',
  'ș': 's', 'Ș': 'S', 'ş': 's', 'Ş': 'S',
  'ț': 't', 'Ț': 'T', 'ţ': 't', 'Ţ': 'T',
  '‘': "'", '’': "'", 'ʼ': "'", '`': "'",
  '‐': '-', '‑': '-', '–': '-', '—': '-',
  ' ': ' ',
};

function mapChar(ch, lower) {
  let out = CHAR_MAP[ch];
  if (out === undefined) {
    // Generic diacritic removal (é → e, ü → u …) – only if it keeps length 1.
    const stripped = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    out = stripped.length === ch.length ? stripped : ch;
  }
  if (lower) {
    const l = out.toLowerCase();
    if (l.length === out.length) out = l;
  }
  return out;
}

/**
 * Removes diacritics but keeps case. Length-preserving: index i in the
 * output corresponds to index i in the input.
 */
export function stripDiacritics(text) {
  if (!text) return '';
  let out = '';
  for (const ch of String(text)) out += mapChar(ch, false);
  return out;
}

/**
 * Lowercase + strip diacritics (ă â î ș ş ț ţ and others). Length-preserving,
 * so match positions can be mapped back onto the original text.
 */
export function normalize(text) {
  if (!text) return '';
  let out = '';
  for (const ch of String(text)) out += mapChar(ch, true);
  return out;
}

// ───────────────────────────── Term → RegExp ─────────────────────────────

/*
 * "Word character" for boundaries: digits + Latin (incl. extended), Greek and
 * Cyrillic letters. An explicit class instead of \p{L} because Unicode
 * property escapes make compiling ~650 alias regexes ~40x slower.
 */
const WORD_CHAR = '0-9A-Za-z\\u00AA\\u00B5\\u00BA\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u024F\\u0370-\\u03FF\\u0400-\\u04FF';
const B_BEFORE = `(?<![${WORD_CHAR}])`;
const B_AFTER = `(?![${WORD_CHAR}])`;

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True for aliases like "BHA", "MSG", "TBHQ" that must match as standalone capitals. */
export function isCapsAlias(term) {
  return /^[A-Z][A-Z0-9]{1,5}$/.test(term);
}

/**
 * Compiles a label term into a whole-word RegExp source on normalised text.
 * Whitespace → \s+, hyphen → optional space/hyphen, "~" → up to 3 words.
 */
function termSource(term) {
  const tokens = normalize(term).trim().split(/\s+/);
  let src = '';
  tokens.forEach((tok, i) => {
    if (tok === '~') {
      src += '(?:\\s+[^\\s,;:()\\[\\]]+){0,3}?';
      return;
    }
    const body = escapeRe(tok).replace(/-/g, '[\\s-]*');
    src += (i === 0 ? '' : '\\s+') + body;
  });
  return src;
}

/** Returns a global RegExp for a term (caps-only aliases are case-sensitive). */
export function compileTerm(term) {
  if (isCapsAlias(term)) {
    return { caps: true, re: new RegExp(B_BEFORE + escapeRe(term) + B_AFTER, 'g') };
  }
  return { caps: false, re: new RegExp(B_BEFORE + termSource(term) + B_AFTER, 'g') };
}

function* execAll(re, text) {
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) { re.lastIndex++; continue; }
    yield m;
  }
}

// ──────────────────────────── E-number parsing ───────────────────────────

const OCR_CANDIDATE = /(?<![\p{L}\p{N}])(E[ ]?-?[ ]?|e)([0-9OoIl|]{3,4})(?=[a-fA-F]?(?:\(?(?:i{1,3}|iv|vi{0,3})\)?)?(?![\p{L}\p{N}]))/gu;

/**
 * Fixes common OCR confusions inside E-codes only: O/o → 0, I/l/| → 1.
 * "E33O" → "E330", "El50d" → "E150d". Words without a real digit are left alone.
 */
export function fixOcrInECodes(text) {
  if (!text) return '';
  return String(text).replace(OCR_CANDIDATE, (whole, prefix, digits) => {
    if (!/\d/.test(digits) || /^\d+$/.test(digits)) return whole;
    return prefix + digits.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
  });
}

/*
 * Uppercase E: optional space and/or hyphen ("E 250", "E-211", "E - 211").
 * Lowercase e: only attached to the digits ("e330"), so the Romanian
 * "e 100%" ("is 100%") never matches.
 * Optional letter suffix (E150d, E407a) and roman-numeral sub-variant
 * (E322i, E450(iii), E160aiv) which is ignored.
 */
const E_CODE_RE = /(?<![\p{L}\p{N}])(?:E[ ]?-?[ ]?|e)(\d{3,4})([a-fA-F])?(?:\(?(?:i{1,3}|iv|vi{0,3})\)?)?(?![\p{L}\p{N}])(?![ ]?%)/gu;

/** Resolves digits + optional letter to a database code, or an unknown code. */
export function resolveCode(digits, letter) {
  const n = Number(digits);
  if (!(n >= 100 && n <= 1599)) return null;
  const base = 'E' + n;
  const l = letter ? letter.toLowerCase() : '';
  if (l && ADDITIVES_BY_CODE[base + l]) return base + l;
  if (ADDITIVES_BY_CODE[base]) return base;
  return base + l;
}

/**
 * Finds E-numbers in free text.
 * @returns {{code: string, raw: string, index: number}[]} unique by code, in order of appearance
 */
export function findECodes(text) {
  const fixed = fixOcrInECodes(text);
  const seen = new Map();
  for (const m of execAll(E_CODE_RE, fixed)) {
    const code = resolveCode(m[1], m[2]);
    if (!code || seen.has(code)) continue;
    seen.set(code, { code, raw: String(text).slice(m.index, m.index + m[0].length), index: m.index });
  }
  return [...seen.values()];
}

/**
 * Resolves an Open Food Facts additive tag ("en:e322i", "en:e450iii",
 * "en:e160aiv", "en:e150d") to a database code ("E322", "E450", "E160a", "E150d").
 * Returns null for anything that is not an E-number tag.
 */
export function resolveOffTag(tag) {
  if (!tag) return null;
  const m = /^(?:[a-z]{2,3}:)?e(\d{3,4})([a-z]*)$/i.exec(String(tag).trim());
  if (!m) return null;
  const suffix = m[2].toLowerCase();
  const letter = /^[a-f]/.test(suffix) ? suffix[0] : '';
  return resolveCode(m[1], letter);
}

// ──────────────────────────── Name matching ──────────────────────────────

/** Compiles every alias of every entry into { code, alias, caps, re }. */
function buildAliasIndex(entries) {
  const index = [];
  for (const entry of entries) {
    for (const alias of entry.aliases) index.push({ code: entry.code, alias, ...compileTerm(alias) });
  }
  return index;
}

let aliasIndex = null;
function getAliasIndex() {
  if (!aliasIndex) aliasIndex = buildAliasIndex(ADDITIVES);
  return aliasIndex;
}

/** Picks non-overlapping spans, longest first (then earliest). */
function pickLongest(cands) {
  const sorted = [...cands].sort((x, y) => (y.end - y.start) - (x.end - x.start) || x.start - y.start);
  const taken = [];
  for (const c of sorted) {
    if (taken.some((t) => c.start < t.end && t.start < c.end)) continue;
    taken.push(c);
  }
  return taken.sort((x, y) => x.start - y.start);
}

/**
 * Finds additives by name/alias. When aliases overlap the longest one wins
 * ("sulphite ammonia caramel" → E150d, not E150c). All-caps aliases
 * (BHA, BHT, TBHQ, MSG …) only match standalone capitals in the original text.
 * @returns {{code: string, text: string, index: number}[]}
 */
export function findAdditiveNames(text) {
  return matchAliasIndex(text, getAliasIndex());
}

/** Shared matcher: all aliases, longest non-overlapping match wins. */
function matchAliasIndex(text, index) {
  if (!text) return [];
  const norm = normalize(text);
  const cased = stripDiacritics(text);
  const cands = [];
  for (const entry of index) {
    const hay = entry.caps ? cased : norm;
    for (const m of execAll(entry.re, hay)) {
      cands.push({ code: entry.code, start: m.index, end: m.index + m[0].length });
    }
  }
  return pickLongest(cands).map((c) => ({ code: c.code, text: String(text).slice(c.start, c.end), index: c.start }));
}

// ───────────────────────── Non-food (cosmetic / household) ───────────────

/** Database domains for a non-food product type, taken from productCategories.js. */
export function domainsForType(type) {
  const db = PRODUCT_TYPE_BY_ID[type]?.db || [];
  return db.filter((d) => d.startsWith('nonfood:')).map((d) => d.slice('nonfood:'.length));
}

const nonFoodIndexCache = new Map();
function getNonFoodIndex(type) {
  let index = nonFoodIndexCache.get(type);
  if (!index) {
    const domains = domainsForType(type);
    index = buildAliasIndex(NONFOOD_INGREDIENTS.filter((x) => domains.includes(x.domain)));
    nonFoodIndexCache.set(type, index);
  }
  return index;
}

/**
 * Finds cosmetic or household ingredients by INCI / common name, with the same
 * longest-match-wins rule as findAdditiveNames().
 * cosmetic → domains cosmetic + both; household → household + both.
 * @returns {{code: string, text: string, index: number}[]}
 */
export function findNonFoodItems(text, type) {
  if (type !== 'cosmetic' && type !== 'household') return [];
  return matchAliasIndex(text, getNonFoodIndex(type));
}

// ─────────────────────────── Product type detection ──────────────────────

/*
 * Signals with weights. Strong signals (2) are almost never seen on food
 * labels; weak ones (1) need company.
 */
const COSMETIC_SIGNALS = [
  [2, ['aqua', 'parfum', 'INCI', 'aqua/water', 'water/aqua']],
  [1, ['glycerin', 'cetearyl alcohol', 'cetyl alcohol', 'butylene glycol', 'propylene glycol',
    'phenoxyethanol', 'tocopheryl acetate', 'sodium laureth sulfate', 'sodium lauryl sulfate',
    'cocamidopropyl betaine', 'dimethicone', 'limonene', 'linalool', 'panthenol', 'allantoin',
    'caprylic/capric triglyceride', 'ethylhexylglycerin', 'disodium edta', 'tetrasodium edta',
    'butyrospermum parkii', 'cyclopentasiloxane', 'polysorbate 20', 'carbomer']],
];
const HOUSEHOLD_SIGNALS = [
  [2, ['agenti de suprafata', 'agent de suprafata', 'agenti tensioactivi', 'fosfonati', 'inalbitori',
    'inalbitor', 'hipoclorit', 'agenti de albire optica', 'surfactants', 'surfactant',
    'phosphonates', 'bleaching agents', 'optical brighteners', 'hypochlorite', 'zeoliti', 'zeolites',
    'policarboxilati', 'polycarboxylates']],
];
/* EU Detergents Regulation 648/2004 percentage bands: "<5%", "5-15%", "15-30%", "30% sau mai mult". */
const DETERGENT_BAND_RE = /(?:<|≤|sub)\s?5\s?%|(?<![0-9])(?:5\s?-\s?15|15\s?-\s?30)\s?%|30\s?%\s?(?:sau mai mult|or more)/i;
/* "CI 77891", "C.I. 19140" – INCI colour index numbers. */
const COLOUR_INDEX_RE = /(?<![A-Za-z0-9])C\.?\s?I\.?\s?[1-7]\d{4}(?![0-9])/;

function signalScore(text, groups) {
  let score = 0;
  const hits = [];
  for (const [weight, terms] of groups) {
    const found = matchTerms(text, terms);
    if (found.length) {
      score += weight * found.length;
      hits.push(...found);
    }
  }
  return { score, hits };
}

/**
 * Guesses the product type from the ingredients text:
 * INCI signals (Aqua, Parfum, Glycerin, CI 7xxxx…) → 'cosmetic';
 * detergent signals (agenți de suprafață, fosfonați, înălbitori, hipoclorit,
 * Reg. 648/2004 % bands) → 'household'; otherwise 'food'.
 */
export function detectProductType(text) {
  if (!text || !text.trim()) return 'food';
  const cos = signalScore(text, COSMETIC_SIGNALS);
  if (COLOUR_INDEX_RE.test(text)) cos.score += 2;
  const hh = signalScore(text, HOUSEHOLD_SIGNALS);
  if (DETERGENT_BAND_RE.test(text)) hh.score += 1;
  // E-numbers are a strong food signal.
  const food = findECodes(text).length * 2;

  if (hh.score >= 2 && hh.score >= cos.score && hh.score > food) return 'household';
  if (cos.score >= 2 && cos.score > food) return 'cosmetic';
  return 'food';
}

// ───────────────────────── Household safety tips ─────────────────────────

const CHLORINE_CODES = ['HYPOCHLORITE', 'DCCNA'];
const AMMONIA_CODES = ['AMMONIA'];
/* Acids in the database have category 'acid'; these common ones are not in it. */
const EXTRA_ACID_TERMS = [
  'acid citric', 'citric acid', 'acid lactic', 'lactic acid', 'acid acetic', 'acetic acid',
  'otet', 'vinegar', 'acid oxalic', 'oxalic acid', 'acid glicolic', 'glycolic acid',
];

/**
 * Household mixing tips.
 * - 'neverMix' (strong): chlorine bleach together with an acid or ammonia in
 *   the same product (toxic chlorine / chloramine gas).
 * - 'mixCaution': chlorine bleach or ammonia on its own → never mix with other
 *   cleaners. `kind` is 'chlorine' (warns about acids and ammonia) or
 *   'ammonia' (warns about chlorine bleach).
 */
function householdSafetyTips(text, items) {
  const first = (x) => x.matches[0];
  const chlorine = items.filter((x) => CHLORINE_CODES.includes(x.code)).map(first);
  const ammonia = items.filter((x) => AMMONIA_CODES.includes(x.code)).map(first);
  if (chlorine.length) {
    const partners = items.filter((x) => x.category === 'acid').map(first);
    partners.push(...matchTerms(text, EXTRA_ACID_TERMS), ...ammonia);
    if (partners.length) return [{ type: 'neverMix', chlorine, partners: [...new Set(partners)] }];
    return [{ type: 'mixCaution', kind: 'chlorine', substances: chlorine }];
  }
  if (ammonia.length) return [{ type: 'mixCaution', kind: 'ammonia', substances: ammonia }];
  return [];
}

// ─────────────────────────────── Avoid list ──────────────────────────────

const termCache = new Map();
function cachedTerm(term) {
  let t = termCache.get(term);
  if (!t) { t = compileTerm(term); termCache.set(term, t); }
  return t;
}

const NEGATION_BEFORE = /(?:^|[^\p{L}\p{N}])(?:fara|without|no|free\s+from|free\s+of)(?:\s+(?:adaos\s+de|adaos|added))?\s*$/u;
const NEGATION_AFTER = /^[\s-]*(?:free|liber)(?![\p{L}\p{N}])/u;

/**
 * Matches a list of terms with whole-word boundaries ("zahăr" never matches
 * "zaharină"). Negated mentions ("fără zahăr", "no added sugar",
 * "sugar-free") are ignored.
 * @returns {string[]} matched snippets of the original text (unique)
 */
export function matchTerms(text, terms) {
  if (!text || !terms?.length) return [];
  const norm = normalize(text);
  const cased = stripDiacritics(text);
  const cands = [];
  for (const term of terms) {
    const { caps, re } = cachedTerm(term);
    for (const m of execAll(re, caps ? cased : norm)) {
      const start = m.index;
      const end = start + m[0].length;
      if (NEGATION_BEFORE.test(norm.slice(Math.max(0, start - 30), start))) continue;
      if (NEGATION_AFTER.test(norm.slice(end, end + 12))) continue;
      cands.push({ start, end });
    }
  }
  const seen = new Set();
  const out = [];
  for (const c of pickLongest(cands)) {
    const snippet = String(text).slice(c.start, c.end);
    const key = normalize(snippet).replace(/\s+/g, ' ');
    if (!seen.has(key)) { seen.add(key); out.push(snippet); }
  }
  return out;
}

function resolveAvoidState(avoidState) {
  const def = defaultAvoidState();
  if (!avoidState) return def;
  return {
    presets: { ...def.presets, ...(avoidState.presets || {}) },
    custom: Array.isArray(avoidState.custom) ? avoidState.custom.map(normalizeCustomEntry).filter(Boolean) : [],
  };
}

/**
 * @param {string} text
 * @param {object} avoidState { presets: {id: bool}, custom: string[] }
 * @param {(string|{code: string, matches?: string[]})[]} found codes or items
 *        already found (for presets with `codes`)
 * @param {string} [productType] only presets for this type are checked
 * @returns {{id: string, label: {en, ro}, matches: string[]}[]}
 */
export function findAvoidHits(text, avoidState, found = [], productType = 'food') {
  const state = resolveAvoidState(avoidState);
  const byCode = new Map(found.map((f) => (typeof f === 'string' ? [f, f] : [f.code, f.matches?.[0] || f.code])));
  const hits = [];
  for (const preset of AVOID_PRESETS) {
    if (!preset.types.includes(productType) || !state.presets[preset.id]) continue;
    const matches = matchTerms(text, preset.terms);
    for (const code of preset.codes || []) {
      if (byCode.has(code) && !matches.includes(byCode.get(code))) matches.push(byCode.get(code));
    }
    if (matches.length) hits.push({ id: preset.id, label: preset.label, matches });
  }
  // Custom entries: alternative spellings ("soia / soy"), limited to their product types.
  for (const entry of state.custom) {
    if (!entry.types.includes(productType)) continue;
    const matches = matchTerms(text, entry.terms);
    const label = entry.terms.join(' / ');
    if (matches.length) hits.push({ id: 'custom:' + entry.id, label: { en: label, ro: label }, matches, custom: true });
  }
  return hits;
}

// ───────────────────────────── NOVA estimate ─────────────────────────────

/** Additive categories that NOVA treats as "cosmetic" → ultra-processed. */
export const COSMETIC_CATEGORIES = ['colour', 'sweetener', 'enhancer', 'emulsifier', 'thickener'];

/** Ingredient / function-name markers of ultra-processing (NOVA 4). */
export const NOVA4_MARKERS = [
  // flavourings
  'aroma', 'arome', 'aromatizant', 'aromatizanti', 'aromatizanta',
  'flavouring', 'flavourings', 'flavoring', 'flavorings', 'flavour', 'flavours', 'flavor', 'flavors',
  'potentiator de aroma', 'potentiatori de aroma', 'flavour enhancer', 'flavor enhancer',
  // sugars & starches of industrial origin
  'sirop de glucoza', 'sirop de glucoza-fructoza', 'sirop de fructoza-glucoza', 'sirop de fructoza',
  'glucose syrup', 'glucose-fructose syrup', 'fructose-glucose syrup', 'high fructose corn syrup',
  'zahar invertit', 'sirop de zahar invertit', 'invert sugar', 'invert sugar syrup',
  'dextroza', 'dextrose', 'maltodextrina', 'maltodextrin', 'izoglucoza', 'isoglucose',
  'amidon ~ modificat', 'modified ~ starch',
  // fats
  'hidrogenat', 'hidrogenata', 'hidrogenate', 'hydrogenated',
  'interesterificat', 'interesterificata', 'interesterificate', 'interesterified',
  // proteins
  'proteine hidrolizate', 'proteina hidrolizata', 'hydrolysed protein', 'hydrolyzed protein',
  'izolat proteic', 'izolat de proteine', 'protein isolate',
  'cazeinat', 'cazeinat de sodiu', 'caseinate', 'sodium caseinate',
  'carne separata mecanic', 'mechanically separated',
  // function names written on labels
  'colorant', 'coloranti', 'colour', 'colours', 'color', 'colors',
  'indulcitor', 'indulcitori', 'sweetener', 'sweeteners',
  'emulgator', 'emulgatori', 'emulsifier', 'emulsifiers',
  'agent de ingrosare', 'agenti de ingrosare', 'thickener', 'thickeners',
  'agent de glazurare', 'agenti de glazurare', 'glazing agent', 'glazing agents',
];

const CULINARY_TERMS = [
  'sare', 'salt', 'zahar', 'sugar', 'ulei', 'oil', 'otet', 'vinegar', 'unt', 'butter',
  'untura', 'lard', 'miere', 'honey',
];

function countIngredients(text) {
  let depth = 0;
  let count = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === ',' || ch === ';')) {
      if (current.trim()) count++;
      current = '';
    } else current += ch;
  }
  if (current.trim()) count++;
  return count;
}

/**
 * Estimates the NOVA group from the ingredients text when no database value
 * is available.
 * @returns {{nova: 1|2|3|4|null, markers: string[]}}
 */
export function estimateNova(text, additives = []) {
  const hasText = !!(text && text.trim());
  if (!hasText && !additives.length) return { nova: null, markers: [] };

  const markers = [];
  for (const add of additives) {
    if (COSMETIC_CATEGORIES.includes(add.category)) markers.push(add.code);
  }
  if (hasText) markers.push(...matchTerms(text, NOVA4_MARKERS));
  if (markers.length) return { nova: 4, markers };

  if (additives.length) return { nova: 3, markers: [] };
  if (!hasText) return { nova: null, markers: [] };

  const culinary = matchTerms(text, CULINARY_TERMS);
  const n = countIngredients(text);
  if (culinary.length) return { nova: n > 1 ? 3 : 2, markers: [] };
  return { nova: 1, markers: [] };
}

// ───────────────────────────────── analyze ───────────────────────────────

const LEVEL_RANK = { high: 0, medium: 1, low: 2, unknown: 3, none: 4 };

function codeSortKey(code) {
  const m = /^E(\d+)([a-z]?)/.exec(code);
  return m ? Number(m[1]) * 10 + (m[2] ? m[2].charCodeAt(0) - 96 : 0) : 99999;
}

function countLevels(items) {
  const counts = { high: 0, medium: 0, low: 0, none: 0, unknown: 0, total: items.length };
  for (const x of items) counts[x.level]++;
  return counts;
}

/**
 * Cosmetic / household analysis: INCI / label-name matching only, no
 * E-numbers, NOVA or Nutri-Score.
 * Verdict: any high → bad; any medium or avoid-list hit → warn; else ok.
 */
function analyzeNonFood(text, productType, avoidState) {
  const items = [];
  const byCode = new Map();
  for (const m of findNonFoodItems(text, productType)) {
    let item = byCode.get(m.code);
    if (!item) {
      const db = NONFOOD_BY_CODE[m.code];
      item = {
        code: m.code, category: db.category, level: db.level, name: db.name, why: db.why,
        domain: db.domain, known: true, matchedBy: ['name'], matches: [], index: m.index,
      };
      byCode.set(m.code, item);
      items.push(item);
    }
    if (!item.matches.includes(m.text)) item.matches.push(m.text);
  }
  items.sort((x, y) => LEVEL_RANK[x.level] - LEVEL_RANK[y.level] || x.index - y.index);

  const avoidHits = findAvoidHits(text, avoidState, items, productType);
  const counts = countLevels(items);

  const reasons = [];
  if (counts.high) reasons.push({ type: 'high', count: counts.high });
  if (avoidHits.length) reasons.push({ type: 'avoid', count: avoidHits.length });
  if (counts.medium) reasons.push({ type: 'medium', count: counts.medium });

  let verdict;
  if (!text.trim()) verdict = 'unknown';
  else if (counts.high) verdict = 'bad';
  else if (counts.medium || avoidHits.length) verdict = 'warn';
  else verdict = 'ok';

  return {
    productType,
    verdict,
    reasons,
    items,
    additives: [],
    avoidHits,
    processing: null,
    nutriscore: null,
    counts,
    safetyTips: productType === 'household' ? householdSafetyTips(text, items) : [],
  };
}

/**
 * @param {{text?: string, productType?: 'food'|'cosmetic'|'household', additiveTags?: string[],
 *          nova?: number|null, nutriscore?: string|null}} input
 * @param {object} [avoidState] { presets: {id: bool}, custom: string[] }
 * @returns result with the same shape for every product type; `items` holds
 *          the matched entries (for food it is the same array as `additives`).
 */
export function analyze(input = {}, avoidState) {
  const text = input.text ? String(input.text) : '';
  const productType = PRODUCT_TYPES.includes(input.productType) ? input.productType : 'food';
  if (productType !== 'food') return analyzeNonFood(text, productType, avoidState);

  const tags = Array.isArray(input.additiveTags) ? input.additiveTags : [];

  // 1. Collect additives from E-codes, names and OFF tags.
  const found = new Map();
  const add = (code, how, snippet) => {
    let item = found.get(code);
    if (!item) {
      const db = ADDITIVES_BY_CODE[code];
      item = db
        ? { code, category: db.category, level: db.level, name: db.name, why: db.why, known: true, matchedBy: [], matches: [] }
        : { code, category: 'other', level: 'unknown', name: null, why: null, known: false, matchedBy: [], matches: [] };
      found.set(code, item);
    }
    if (!item.matchedBy.includes(how)) item.matchedBy.push(how);
    if (snippet && !item.matches.includes(snippet)) item.matches.push(snippet);
  };

  for (const e of findECodes(text)) add(e.code, 'code', e.raw.trim());
  for (const n of findAdditiveNames(text)) add(n.code, 'name', n.text);
  for (const tag of tags) {
    const code = resolveOffTag(tag);
    if (code) add(code, 'tag', null);
  }

  const additives = [...found.values()].sort(
    (x, y) => LEVEL_RANK[x.level] - LEVEL_RANK[y.level] || codeSortKey(x.code) - codeSortKey(y.code),
  );

  // 2. Avoid list.
  const avoidHits = findAvoidHits(text, avoidState, additives.map((x) => x.code), 'food');

  // 3. Processing level.
  const dbNova = Number(input.nova);
  let processing;
  if (dbNova >= 1 && dbNova <= 4) {
    processing = { nova: dbNova, source: 'database', markers: [] };
  } else {
    const est = estimateNova(text, additives);
    processing = { nova: est.nova, source: est.nova ? 'estimate' : null, markers: est.markers };
  }

  // 4. Counts.
  const counts = countLevels(additives);

  // 5. Verdict.
  const nutriscore = typeof input.nutriscore === 'string' && /^[a-e]$/i.test(input.nutriscore.trim())
    ? input.nutriscore.trim().toLowerCase()
    : null;
  const hasInput = !!text.trim() || tags.length > 0 || processing.source === 'database' || !!nutriscore;

  const reasons = [];
  if (counts.high) reasons.push({ type: 'high', count: counts.high });
  if (avoidHits.length) reasons.push({ type: 'avoid', count: avoidHits.length });
  if (counts.medium) reasons.push({ type: 'medium', count: counts.medium });
  if (processing.nova === 4) reasons.push({ type: 'nova4' });
  if (nutriscore === 'd' || nutriscore === 'e') reasons.push({ type: 'nutriscore', grade: nutriscore });

  let verdict;
  if (!hasInput) verdict = 'unknown';
  else if (counts.high || avoidHits.length) verdict = 'bad';
  else if (counts.medium || processing.nova === 4 || nutriscore === 'd' || nutriscore === 'e') verdict = 'warn';
  else verdict = 'ok';

  return {
    productType, verdict, reasons, items: additives, additives, avoidHits, processing, nutriscore, counts, safetyTips: [],
  };
}
