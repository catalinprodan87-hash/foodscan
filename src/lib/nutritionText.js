/**
 * Nutrition values from a label's text (photo of the nutrition table, v3.5)
 * and from Open Food Facts, per 100 g (or 100 ml), plus sanity checks.
 * Pure, unit-tested.
 *
 * On a table the first number after a row name is the "per 100 g" column
 * (the per-portion column and %RI follow). Row names in RO, EN, HU, BG, DE,
 * FR, IT, PL, HR/SR, CZ/SK.
 */
import { normalize } from './analyze.js';

export const NUTRIENT_KEYS = ['energyKj', 'energyKcal', 'fat', 'saturatedFat', 'carbohydrates', 'sugars', 'fibre', 'protein', 'salt'];

const L = '(?<!\\p{L})';
const R = '(?!\\p{L})';
// Row names (normalised: no accents, lower case). Order matters: "din care acizi grași saturați" before "grăsimi".
const ROWS = [
  ['saturatedFat', 'acizi grasi saturati|grasi saturati|saturati|saturated fat|saturates|of which saturates|telitett zsirsav\\w*|наситени мастни киселини|наситени|gesattigte fettsauren|davon gesattigte|acides gras satures|dont acides gras satures|acidi grassi saturi|di cui acidi grassi saturi|kwasy tluszczowe nasycone|nasycone|zasicene masne kiseline|zasicene|nasycene mastne kyseliny|nasycene'],
  ['sugars', 'din care zaharuri|zaharuri|sugars|of which sugars|cukrok|amelybol cukrok|захари|davon zucker|zucker|dont sucres|sucres|di cui zuccheri|zuccheri|cukry|w tym cukry|seceri|od kojih seceri|cukry|z toho cukry'],
  ['carbohydrates', 'glucide|carbohydrates?|szenhidrat|въглехидрати|kohlenhydrate|glucides|carboidrati|weglowodany|ugljikohidrati|ugljeni hidrati|sacharidy'],
  ['fibre', 'fibre|fibra|fibres|fiber|rost|влакнини|ballaststoffe|fibres alimentaires|fibre alimentari|blonnik|vlakna|vlaknina'],
  ['protein', 'proteine|proteins?|feherje|белтъци|eiweiss|eiweis|proteines|proteine|bialko|bjelancevine|proteini|bilkoviny|bielkoviny'],
  ['salt', 'sare|salt|so|сол|salz|sel|sale|sol'],
  ['fat', 'grasimi|grasime|fat|fats|zsir|мазнини|fett|matieres grasses|lipides|grassi|tluszcz|masti|masnoce|tuky'],
];
const ROW_RE = ROWS.map(([key, alts]) => [key, new RegExp(`${L}(?:${alts})${R}`, 'gu')]);
const NUM = /(<\s*)?(\d+(?:[.,]\d+)?)\s*(kj|kcal|g|mg)?/giu;

const toNum = (s) => Number(String(s).replace(',', '.'));

/**
 * @param {string} text
 * @returns {{values: Record<string, number>, basis: '100g'|'100ml'|null, found: number}}
 */
export function parseNutrition(text) {
  const t = normalize(String(text || '')).replace(/\s+/g, ' ');
  const values = {};
  // "…/10g (o lingura)/100g": the portion column comes first, per 100 g second.
  const portionFirst = /(?<![\d.,])\d{1,3}\s*(?:g|ml)\b[^0-9]{0,30}\/\s*100\s*(?:g|ml)/.test(t);
  const pick = portionFirst ? 1 : 0;
  // Energy: "2360 kJ / 566 kcal", "1941 kJ 463 kcal", "(kJ/kcal) 2360/566"
  const kjKcalPair = t.match(/kj\s*\/\s*kcal\)?\D{0,12}?(\d{2,4})\s*\/\s*(\d{1,3}(?:[.,]\d+)?)/);
  if (kjKcalPair) { values.energyKj = toNum(kjKcalPair[1]); values.energyKcal = toNum(kjKcalPair[2]); }
  // kJ and kcal that agree (kJ ≈ 4.184 × kcal), not the reference intake (8400 kJ / 2000 kcal).
  const kjs = [...t.matchAll(/(\d{1,4}(?:[.,]\d+)?)\s*kj/g)].map((m) => toNum(m[1])).filter((v) => v !== 8400);
  const kcals = [...t.matchAll(/(\d{1,4}(?:[.,]\d+)?)\s*kcal/g)].map((m) => toNum(m[1])).filter((v) => v !== 2000);
  if (values.energyKj == null) {
    const pairs = [];
    for (const a of kjs) for (const b of kcals) if (b > 0 && Math.abs(a / 4.184 - b) <= Math.max(3, 0.05 * b)) pairs.push([a, b]);
    const pair = pairs[pick] || pairs[0];
    if (pair) [values.energyKj, values.energyKcal] = pair;
    else {
      if (kjs.length) values.energyKj = kjs[pick] ?? kjs[0];
      if (kcals.length) values.energyKcal = kcals[pick] ?? kcals[0];
    }
  }

  const taken = []; // character ranges already used by a longer row name
  for (const [key, re] of ROW_RE) {
    if (values[key] != null) continue;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(t))) {
      const start = m.index;
      const end = start + m[0].length;
      if (taken.some(([a, b]) => start < b && end > a)) continue;
      // The first number after the row name, before the next row name.
      const rest = t.slice(end, end + 50);
      NUM.lastIndex = 0;
      let n = NUM.exec(rest);
      if (n && pick) { const second = NUM.exec(rest); if (second && !/[a-z]{4,}/.test(rest.slice(n.index + n[0].length, second.index))) n = second; }
      if (!n) continue;
      if (/[a-z]{4,}/.test(rest.slice(0, n.index).replace(/din care|of which|davon|dont|di cui|w tym|od kojih|z toho|amelybol/g, ''))) continue;
      if (n[3] === 'kj' || n[3] === 'kcal') continue;
      let v = toNum(n[2]);
      if (n[3] === 'mg') v /= 1000;
      if (n[1]) v = Math.max(0, v - 0.01); // "<0,1 g": just below
      if (v > 100) continue; // a lost decimal comma ("219" for 21,9 g): not a value
      values[key] = v;
      taken.push([start, end]);
      break;
    }
  }
  const basis = /100\s*ml/.test(t) ? '100ml' : /100\s*g/.test(t) ? '100g' : null;
  return { values, basis, portionFirst, found: Object.keys(values).length };
}

/** Open Food Facts nutriments → the same keys (per 100 g / 100 ml). */
export function fromNutriments(n = {}) {
  const num = (k) => (typeof n[k] === 'number' && Number.isFinite(n[k]) ? n[k] : null);
  const out = {
    energyKj: num('energy-kj_100g') ?? num('energy_100g'),
    energyKcal: num('energy-kcal_100g'),
    fat: num('fat_100g'),
    saturatedFat: num('saturated-fat_100g'),
    carbohydrates: num('carbohydrates_100g'),
    sugars: num('sugars_100g'),
    fibre: num('fiber_100g'),
    protein: num('proteins_100g'),
    salt: num('salt_100g'),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v != null));
}

/**
 * Sanity checks (values per 100 g). Energy ≈ 17 kJ/g carbohydrates and
 * protein + 37 kJ/g fat + 8 kJ/g fibre (EU Reg. 1169/2011 Annex XIV), within
 * 20 % or 80 kJ; sugars ≤ carbohydrates; saturated ≤ fat; nothing above 100 g.
 * @returns {string[]} problem ids (empty when consistent)
 */
export function checkNutrition(v) {
  const problems = [];
  const kj = v.energyKj ?? (v.energyKcal != null ? v.energyKcal * 4.184 : null);
  if (kj != null && v.fat != null && v.carbohydrates != null && v.protein != null) {
    const expected = 37 * v.fat + 17 * (v.carbohydrates + v.protein) + 8 * (v.fibre || 0);
    if (Math.abs(kj - expected) > Math.max(80, 0.2 * Math.max(kj, expected))) problems.push('energy');
  }
  if (v.energyKj != null && v.energyKcal != null && Math.abs(v.energyKj / 4.184 - v.energyKcal) > Math.max(5, 0.05 * v.energyKcal)) problems.push('kjKcal');
  if (v.sugars != null && v.carbohydrates != null && v.sugars > v.carbohydrates + 0.05) problems.push('sugars');
  if (v.saturatedFat != null && v.fat != null && v.saturatedFat > v.fat + 0.05) problems.push('saturatedFat');
  if (['fat', 'carbohydrates', 'protein', 'sugars', 'saturatedFat', 'fibre', 'salt'].some((k) => v[k] > 100)) problems.push('over100');
  return problems;
}
