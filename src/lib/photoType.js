/**
 * What a photo of a pack shows, from its text (v3.4): the ingredients list,
 * the nutrition table, origin / packer details, the front, or something else.
 * Pure, unit-tested. The user can change the guess with one tap per type.
 */
import { normalize } from './analyze.js';

export const PHOTO_TYPES = ['ingredients', 'nutrition', 'origin', 'front', 'other'];

const count = (text, re) => (text.match(re) || []).length;

// Headings and words, accents removed (normalize), several languages; Unicode word edges (\b is ASCII only).
const INGREDIENT_HEADINGS = /(?<!\p{L})(ingrediente|ingredients?|ingredienti|ingredientes|ingredienten|zutaten|skladniki|osszetevok|sastojci|slozeni|zlozenie|sestavine|составки|съставки|состав|συστατικα|compozitie)(?!\p{L})/gu;
const NUTRITION_WORDS = /(?<!\p{L})(valoare energetica|valoarea energetica|valori nutritionale|declaratie nutritionala|informatii nutritionale|nutrition|energie|energia|energy|kcal|kj|grasimi|glucide|proteine|zaharuri|fibre|sare|acizi grasi saturati|fat|carbohydrate|protein|salt|sugars|zsir|szenhidrat|feherje|maznini|belaltsi)(?!\p{L})/gu;
const ORIGIN_WORDS = /(?<!\p{L})(tara de origine|origine|produs in|fabricat in|ambalat in|ambalat de|produs de|importat de|importator|distribuitor|made in|produced in|packed in|country of origin|origin|zona fao|fao \d+|pescuit|crescut|de crescatorie|decongelat|lot)(?!\p{L})/gu;

/**
 * What a photo contains (a back label often has the ingredients AND the
 * nutrition table, so a photo can feed several types).
 * @param {string} text all the text read from the photo
 * @returns {{types: string[], primary: string, scores: Record<string, number>}}
 *   types: what the photo contributes to; primary: the main one (for ordering)
 */
export function classifyPhoto(text) {
  const t = normalize(String(text || '')).replace(/\s+/g, ' ');
  const words = t.match(/[a-z\u0400-\u04ff\u0370-\u03ff]{2,}/g) || [];
  const commas = count(t, /,/g);
  const grams = count(t, /\d+(?:[.,]\d+)?\s?(?:g|kj|kcal|mg)(?![a-z])/g);
  const headings = count(t, INGREDIENT_HEADINGS);
  const scores = {
    ingredients: 4 * headings + Math.min(6, commas / 4),
    nutrition: count(t, NUTRITION_WORDS) + Math.min(6, grams / 2),
    origin: 2 * count(t, ORIGIN_WORDS),
  };
  const types = [];
  // A nutrition table has decimal commas too: without a heading, many numbers mean a table.
  const listLike = headings > 0 || (commas >= 6 && grams < commas / 2);
  if (listLike && scores.ingredients >= 2) types.push('ingredients');
  if (scores.nutrition >= 6) types.push('nutrition');
  if (scores.origin >= 2) types.push('origin');
  if (!types.length) types.push(words.length < 25 ? 'front' : 'other');
  const primary = types.includes('ingredients') ? 'ingredients' : types[0];
  return { types, primary, scores };
}

/** Ingredients photos first (the analysis needs them), then nutrition, origin, the rest. */
export const typeOrder = (type) => PHOTO_TYPES.indexOf(type);
