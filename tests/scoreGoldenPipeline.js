/**
 * The app's path from a database product to its score (lookup → analysis →
 * nutrition → origin → score), shared by the golden test and the script
 * that builds the fixture. Avoid list: none (general score).
 */
import { mapProduct, analyzeInput } from '../src/lib/lookup.js';
import { analyze } from '../src/lib/analyze.js';
import { buildNutrition } from '../src/lib/nutritionInfo.js';
import { assessOrigin } from '../src/lib/origin.js';
import { computeScore } from '../src/lib/score.js';

export function scoreProduct({ raw, type }) {
  const product = mapProduct(raw, type, raw.code);
  const nutrition = type === 'food' ? buildNutrition({ product, saved: {}, ingredients: product.ingredientsText }) : null;
  const input = analyzeInput(product);
  if (type === 'food' && !input.nutriscore && nutrition?.score?.computed) input.nutriscore = nutrition.score.grade;
  const result = analyze(input);
  const origin = type === 'food' ? assessOrigin({ text: product.ingredientsText, product: product.origin, saleCountry: 'RO' }) : null;
  const s = computeScore({ result, text: product.ingredientsText, grade: nutrition?.score?.grade || null, origin });
  return { general: s.general, band: s.band, confidence: s.confidence, caps: s.caps.map((c) => c.id), parts: Object.fromEntries(s.parts.map((p) => [p.id, Math.round(p.points)])) };
}
