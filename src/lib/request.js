/**
 * Builds what the app analyses from pasted or photographed ingredients,
 * optionally attached to a barcode lookup (found without ingredients, or not
 * found at all). Pure, unit-tested.
 */
import { detectProductType } from './analyze.js';

/**
 * @param {{text: string, source?: 'paste'|'photo', product?: object|null,
 *          barcode?: string|null, chosenType?: string|null, confidence?: number}} p
 * @returns {{text, type, auto, product, barcode, fromPhoto, confidence}}
 *   type: the looked-up product's type, else the user's choice, else detected
 *   from the text. `product` keeps name, image and database scores.
 */
export function buildRequest({ text, source = 'paste', product = null, barcode = null, chosenType = null, confidence = null }) {
  let type;
  let auto = false;
  if (product) type = product.productType;
  else if (chosenType) type = chosenType;
  else {
    type = detectProductType(text);
    auto = true;
  }
  return {
    text,
    type,
    auto,
    product: product || null,
    barcode: product?.code || barcode || null,
    fromPhoto: source === 'photo',
    confidence: source === 'photo' ? confidence : null,
  };
}
