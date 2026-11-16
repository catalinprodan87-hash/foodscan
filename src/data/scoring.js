/**
 * The overall score (v3.8): weights, point tables and the EU bans behind the
 * cap at 25. Explained in docs/SCORING.md. Change anything here → raise
 * SCORE_VERSION and update tests/fixtures/score-golden.json.
 */
export const SCORE_VERSION = 1;

export const WEIGHTS = {
  food: { ingredients: 40, nutrition: 35, processing: 15, origin: 5, completeness: 5 },
  ingredients: { ingredients: 80, avoid: 10, completeness: 10 },
};

/** Points lost per ingredient / additive at each level. */
export const LEVEL_PENALTY = { high: 35, medium: 15, low: 5 };
export const GRADE_POINTS = { a: 100, b: 75, c: 50, d: 25, e: 0 };
export const NOVA_POINTS = { 1: 100, 2: 80, 3: 50, 4: 0 };
export const ORIGIN = { unknown: 50, base: 70, plus: 15, minus: 20 };
export const COMPLETENESS = { ingredients: 40, nutrition: 30, processing: 15, origin: 15 };
export const AVOID = { food: 15, ingredientsPart: 50, cap: 49 };
export const CAP_HIGH = 49;
export const CAP_BANNED = 25;
export const LOW_OCR = 70;

/** Bands: from (inclusive) → id. */
export const BANDS = [
  { from: 75, id: 'good' },
  { from: 50, id: 'fair' },
  { from: 25, id: 'below' },
  { from: 0, id: 'low' },
];

const R1333 = 'https://eur-lex.europa.eu/eli/reg/2008/1333/oj';
const R1223 = 'https://eur-lex.europa.eu/eli/reg/2009/1223/oj';

/**
 * Banned or not allowed in the EU for this kind of product. Food: by E-number;
 * cosmetics: by the code in nonFoodIngredients.js (only in cosmetics – in
 * household products some of these are restricted, not banned).
 */
export const EU_BANNED = {
  food: {
    E171: { rule: 'Reg. (UE) 2022/63', url: 'https://eur-lex.europa.eu/eli/reg/2022/63/oj' },
    E443: { rule: 'Reg. (CE) 1333/2008, Anexa II (neautorizat)', url: R1333 },
    E924: { rule: 'Reg. (CE) 1333/2008, Anexa II (neautorizat)', url: R1333 },
    E927a: { rule: 'Reg. (CE) 1333/2008, Anexa II (neautorizat)', url: R1333 },
  },
  cosmetic: {
    MDBGN: { rule: 'Reg. (CE) 1223/2009, Anexa II', url: R1223 },
    ISOPROPYLPARABEN: { rule: 'Reg. (UE) 358/2014', url: 'https://eur-lex.europa.eu/eli/reg/2014/358/oj' },
    ISOBUTYLPARABEN: { rule: 'Reg. (UE) 358/2014', url: 'https://eur-lex.europa.eu/eli/reg/2014/358/oj' },
    PHENYLPARABEN: { rule: 'Reg. (UE) 358/2014', url: 'https://eur-lex.europa.eu/eli/reg/2014/358/oj' },
    BENZYLPARABEN: { rule: 'Reg. (UE) 358/2014', url: 'https://eur-lex.europa.eu/eli/reg/2014/358/oj' },
    PENTYLPARABEN: { rule: 'Reg. (UE) 358/2014', url: 'https://eur-lex.europa.eu/eli/reg/2014/358/oj' },
    ZPT: { rule: 'Reg. (UE) 2021/1902', url: 'https://eur-lex.europa.eu/eli/reg/2021/1902/oj' },
    LILIAL: { rule: 'Reg. (UE) 2021/1902', url: 'https://eur-lex.europa.eu/eli/reg/2021/1902/oj' },
    HICC: { rule: 'Reg. (UE) 2017/1410', url: 'https://eur-lex.europa.eu/eli/reg/2017/1410/oj' },
    HYDROQUINONE: { rule: 'Reg. (CE) 1223/2009, Anexa II', url: R1223 },
    MERCURY: { rule: 'Reg. (CE) 1223/2009, Anexa II', url: R1223 },
    TPO: { rule: 'Reg. (UE) 2025/877', url: 'https://eur-lex.europa.eu/eli/reg/2025/877/oj' },
    DMTA: { rule: 'Reg. (UE) 2025/877', url: 'https://eur-lex.europa.eu/eli/reg/2025/877/oj' },
    DBP: { rule: 'Reg. (CE) 1223/2009, Anexa II', url: R1223 },
    D4: { rule: 'Reg. (CE) 1223/2009, Anexa II', url: R1223 },
    'COAL-TAR': { rule: 'Reg. (CE) 1223/2009, Anexa II', url: R1223 },
  },
};
