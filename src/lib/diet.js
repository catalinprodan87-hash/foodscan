/**
 * Vegan / vegetarian and palm-oil chips. Open Food Facts' own ingredient
 * analysis wins when it has an answer; otherwise a cautious guess from the
 * ingredients text ("după ingrediente: probabil…"). Information only – never
 * in the verdict unless the user puts it on their avoid list.
 */
import { matchTerms } from './analyze.js';
import { AVOID_PRESETS_BY_ID } from '../data/avoidPresets.js';

// Not vegetarian: meat, fish, gelatine, animal fats, insect colours.
const MEAT = ['carne', 'carne de porc', 'carne de vita', 'carne de pui', 'carne de curcan', 'porc', 'vita', 'pui', 'curcan', 'miel', 'oaie', 'vanat', 'sunca', 'bacon', 'slanina', 'untura', 'osanza', 'seu', 'sorici', 'organe', 'ficat', 'sange', 'pate', 'salam', 'carnati', 'crenvursti', 'gelatina', 'gelatina de porc', 'gelatina de vita', 'colagen', 'peste', 'de peste', 'ton', 'somon', 'hering', 'sardine', 'hamsii', 'ansoa', 'creveti', 'scoici', 'midii', 'calamar', 'carmin', 'cosenila', 'acid carminic', 'cheag animal', 'meat', 'pork', 'beef', 'chicken', 'gelatin', 'gelatine', 'lard', 'tallow', 'fish', 'anchovies', 'carmine'];
const MEAT_CODES = ['E120', 'E441', 'E542', 'E904', 'E920'];
// Vegetarian but not vegan.
const ANIMAL = ['lapte', 'lapte praf', 'lactoza', 'zer', 'cazeina', 'cazeinat', 'smantana', 'frisca', 'unt', 'branza', 'cascaval', 'iaurt', 'chefir', 'ou', 'oua', 'albus', 'galbenus', 'miere', 'ceara de albine', 'propolis', 'laptisor de matca', 'lanolina', 'milk', 'whey', 'lactose', 'butter', 'cream', 'cheese', 'egg', 'eggs', 'honey', 'beeswax'];
const ANIMAL_CODES = ['E901', 'E913', 'E966', 'E1105'];
const NOT_DAIRY = /\s*(?:de\s+)?(?:cacao|shea|karite|cocos|migdale|soia|ovaz|orez|arahide)\b/;

const offStatus = (tags, prefix) => {
  for (const s of ['non-', 'maybe-', '']) if (tags.includes(`en:${s}${prefix}`)) return s === '' ? 'yes' : s === 'non-' ? 'no' : 'maybe';
  return null;
};

/**
 * @param {string} text ingredients text
 * @param {{analysisTags?: string[], codes?: string[]}} extra Open Food Facts
 *        ingredients_analysis_tags and the additive codes found
 * @returns {{vegan: {status: 'yes'|'no'|'maybe', source: 'database'|'label'}|null,
 *            vegetarian: {...}|null, palm: {status: 'yes'|'no'|'maybe', source}|null}}
 */
export function dietInfo(text, { analysisTags = [], codes = [] } = {}) {
  const t = String(text || '');
  const out = { vegan: null, vegetarian: null, palm: null };

  const offVegan = offStatus(analysisTags, 'vegan');
  const offVeg = offStatus(analysisTags, 'vegetarian');
  if (offVegan) out.vegan = { status: offVegan, source: 'database' };
  if (offVeg) out.vegetarian = { status: offVeg, source: 'database' };

  if (t.trim() && (!out.vegan || !out.vegetarian)) {
    const meat = matchTerms(t, MEAT).length > 0 || MEAT_CODES.some((c) => codes.includes(c));
    const animal = matchTerms(t, ANIMAL).filter((m) => !NOT_DAIRY.test(t.slice(t.indexOf(m) + m.length, t.indexOf(m) + m.length + 14))).length > 0
      || ANIMAL_CODES.some((c) => codes.includes(c));
    // Only "probably": a short or misread list can hide an animal ingredient.
    if (!out.vegetarian) out.vegetarian = { status: meat ? 'no' : 'maybe', source: 'label' };
    if (!out.vegan) out.vegan = { status: meat || animal ? 'no' : 'maybe', source: 'label' };
  }

  if (analysisTags.includes('en:palm-oil')) out.palm = { status: 'yes', source: 'database' };
  else if (analysisTags.includes('en:may-contain-palm-oil')) out.palm = { status: 'maybe', source: 'database' };
  else if (analysisTags.includes('en:palm-oil-free')) out.palm = { status: 'no', source: 'database' };
  else if (t.trim() && matchTerms(t, AVOID_PRESETS_BY_ID.palm.terms).length) out.palm = { status: 'yes', source: 'label' };
  return out;
}
