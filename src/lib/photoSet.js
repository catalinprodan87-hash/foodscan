/**
 * A product's photo set (v3.4): every photo has a type and its text; the
 * texts are merged per type (photos of one label from several sides overlap,
 * mergeAll removes the repeats). Pure, unit-tested.
 */
import { mergeAll, extractIngredients } from './ocrText.js';
import { PHOTO_TYPES } from './photoType.js';

/**
 * @param {{types: string[], raw: string}[]} photos raw = all the text read from the photo; types = what it contains
 * @returns {Record<string, string>} merged text per type (types without photos left out)
 */
export function mergeByType(photos) {
  const out = {};
  for (const type of PHOTO_TYPES) {
    const texts = photos.filter((p) => p.types?.includes(type) && p.raw?.trim()).map((p) => (type === 'ingredients' ? extractIngredients(p.raw).text || p.raw : p.raw));
    if (texts.length) out[type] = mergeAll(texts).trim();
  }
  return out;
}

/** The text per type stored with a barcode, updated with a new set (types not photographed again are kept). */
export function mergeTexts(previous = {}, next = {}) {
  return { ...previous, ...Object.fromEntries(Object.entries(next).filter(([, v]) => v?.trim())) };
}
