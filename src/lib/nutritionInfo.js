/**
 * Everything the app knows about a product's nutrition (v3.5): the values
 * per 100 g / 100 ml and where they come from, the Nutri-Score category, the
 * problems the sanity checks found, and the Nutri-Score – the database's, or
 * computed on the phone when the database has none and the values are
 * complete and consistent. Pure, unit-tested.
 */
import { parseNutrition, checkNutrition, NUTRIENT_KEYS } from './nutritionText.js';
import { nutriScore } from './nutriscore.js';
import { normalize } from './analyze.js';

export const NUTRI_CATEGORIES = ['general', 'drink', 'water', 'fats', 'cheese'];
const REQUIRED = ['saturatedFat', 'sugars', 'salt'];

/** Nutri-Score category from the database categories, the quantity / basis and the ingredients. */
export function inferCategory({ categories = [], quantity = '', basis = null, ingredients = '', name = '' } = {}) {
  const tags = categories.join(' ');
  if (/en:(natural-mineral-)?waters?\b|en:spring-waters/.test(tags) && !/flavou?red/.test(tags)) return 'water';
  if (/en:beverages|drinks?\b|juices?\b|sodas?\b/.test(tags)) return 'drink';
  if (/en:cheeses|cheeses\b/.test(tags)) return 'cheese';
  if (/en:fats\b|oils?\b|en:nuts|-nuts\b|en:seeds|butters?\b/.test(tags)) return 'fats';
  const q = normalize(`${quantity} ${name}`);
  if (basis === '100ml' || /\b\d+([.,]\d+)?\s*(ml|l|cl)\b/.test(q)) return 'drink';
  const ing = normalize(ingredients).trim();
  if (/^(100\s*%\s*)?(ulei|oil|unt\b|butter|margarina)/.test(ing) || /\bulei\b/.test(q)) return 'fats';
  if (/\bbranza\b|\bcascaval\b|\bcheese\b/.test(q)) return 'cheese';
  return 'general';
}

// Fruits, vegetables and legumes (for the "% fruits, vegetables, legumes" component).
const FVL = /(?<!\p{L})(rosii|tomate|pasta de tomate|mere|pere|capsuni|zmeura|afine|cirese|visine|caise|piersici|prune|struguri|banane|portocale|lamai|fructe|legume|morcovi|ceapa|ardei|castraveti|varza|spanac|dovlecei|vinete|mazare|fasole|linte|naut|soia boabe|tomatoes?|apples?|pears?|strawberr\w+|raspberr\w+|fruits?|vegetables?|carrots?|onions?|peppers?|peas|beans|lentils|chickpeas)(?!\p{L})[^,;()]{0,25}?(\d+(?:[.,]\d+)?)\s*%/gu;

/** Sum of the stated % of fruits, vegetables and legumes in the ingredients (null when none is stated). */
export function estimateFvl(ingredients) {
  const t = normalize(String(ingredients || ''));
  let sum = 0;
  let any = false;
  for (const m of t.matchAll(FVL)) { sum += Number(m[2].replace(',', '.')); any = true; }
  return any ? Math.min(100, sum) : null;
}

const SWEETENER = /(?<!\p{L})(e9[5-6]\d|e968|acesulfam\w*|aspartam\w*|sucraloz\w*|sucralose|zaharina|saccharin\w*|ciclamat\w*|cyclamate|stevi\w*|glicozide de steviol|steviol glycosides)(?!\p{L})/u;

/**
 * @param {{product?: object|null, saved?: object|null, ingredients?: string}} args
 *   saved.nutrition: the user's own values / category; saved.texts.nutrition: text read from a photo
 */
export function buildNutrition({ product = null, saved = null, ingredients = '' } = {}) {
  let values = null;
  let source = null;
  let basis = null;
  if (saved?.nutrition?.values && Object.keys(saved.nutrition.values).length) {
    values = saved.nutrition.values; source = 'edited'; basis = saved.nutrition.basis || null;
  } else if (product?.nutriments && Object.keys(product.nutriments).length >= 3) {
    values = product.nutriments; source = 'database';
  } else if (saved?.texts?.nutrition) {
    const p = parseNutrition(saved.texts.nutrition);
    if (p.found) { values = p.values; source = 'photo'; basis = p.basis; }
  }
  const autoCategory = inferCategory({ categories: product?.categories || [], quantity: product?.quantity || '', basis, ingredients, name: product?.name || '' });
  const category = saved?.nutrition?.category || autoCategory;
  const problems = values ? checkNutrition(values) : [];
  const fvl = estimateFvl(ingredients);
  let score = null;
  if (product?.nutriscore) score = { grade: product.nutriscore, computed: false };
  else if (values && !problems.length && REQUIRED.every((k) => values[k] != null) && (values.energyKj != null || values.energyKcal != null)) {
    const r = nutriScore({ ...values, fibre: values.fibre ?? 0, protein: values.protein ?? 0, fvl: fvl ?? 0, sweeteners: SWEETENER.test(normalize(ingredients)) }, category);
    if (r) score = { grade: r.grade, computed: true, points: r.score, fvlEstimated: fvl == null };
  }
  return { values, source, basis, category, categoryAuto: !saved?.nutrition?.category, problems, fvl, score, missing: values ? NUTRIENT_KEYS.filter((k) => values[k] == null) : NUTRIENT_KEYS };
}
