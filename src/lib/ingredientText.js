/**
 * Which ingredients text a product is analysed with, and the user's own
 * version of it (v3.3). Pure, unit-tested.
 *
 * A remembered record (savedIngredients.js) per barcode:
 *   { barcode, text, source: 'photo'|'paste'|'edit', explicit, original, … }
 *   explicit – the user chose this text over the database's (edited, replaced
 *              or completed it); it always wins
 *   original – what it replaced: { text, origin: 'database'|'photo'|'paste' }
 *              ("Revino la textul original")
 *
 * Without an explicit choice the order is: the database's Romanian text →
 * the user's own text (photo / paste, saved because the database had none)
 * → the database's text in another language.
 */

export const SAVED_SCHEMA = 2;

/**
 * @param {{product?: object|null, saved?: object|null}} args
 * @returns {{text: string, origin: 'database'|'user'|'edited'|'none', lang: string|null}}
 */
export function chooseIngredients({ product = null, saved = null } = {}) {
  const dbText = product?.ingredientsText?.trim() ? product.ingredientsText : '';
  const userText = saved?.text?.trim() ? saved.text : '';
  if (userText && saved.explicit) return { text: userText, origin: 'edited', lang: null };
  if (dbText && product.ingredientsLang === 'ro') return { text: dbText, origin: 'database', lang: 'ro' };
  if (userText) return { text: userText, origin: 'user', lang: null };
  if (dbText) return { text: dbText, origin: 'database', lang: product.ingredientsLang || null };
  return { text: '', origin: 'none', lang: null };
}

/**
 * The record for a text the user wrote over the current one.
 * @param {object|null} existing the record already remembered for the barcode
 * @param {{barcode, text, currentText, currentOrigin, productType, product, source?, now?}} p
 *   currentOrigin: where the text being replaced came from ('database'|'user'|'edited')
 */
export function editedRecord(existing, { barcode, text, currentText, currentOrigin, productType, product = null, source = 'edit', now = new Date() }) {
  const original = existing?.original
    || (currentText?.trim()
      ? { text: currentText, origin: currentOrigin === 'database' ? 'database' : (existing?.source === 'photo' ? 'photo' : 'paste') }
      : null);
  return {
    ...(existing || {}),
    v: SAVED_SCHEMA,
    barcode,
    text,
    productType: productType || existing?.productType || 'food',
    source,
    explicit: true,
    original,
    product: product ?? existing?.product ?? null,
    date: now.toISOString(),
  };
}

/**
 * Back to the text the user's version replaced.
 * @returns {{remove: true}|{record: object}} remove the record (the database text applies again) or the restored record
 */
export function revertRecord(record) {
  const o = record?.original;
  if (!o || o.origin === 'database' || !o.text?.trim()) return { remove: true };
  return { record: { ...record, text: o.text, source: o.origin, explicit: false, original: null } };
}

/** "Completează": the database text followed by what the photo / typing adds. */
export function completeText(base, addition) {
  const a = String(addition || '').trim();
  const b = String(base || '').trim();
  if (!a) return b;
  if (!b) return a;
  return `${b.replace(/[.\s]+$/, '')}, ${a}`;
}

/** Remembered records from before v3.3 → schema 2 (nothing is lost; the old fields stay). */
export function migrateSaved(map) {
  const out = {};
  let changed = 0;
  for (const [code, s] of Object.entries(map || {})) {
    if (!s || typeof s !== 'object' || typeof s.text !== 'string') continue;
    if (s.v === SAVED_SCHEMA) { out[code] = s; continue; }
    out[code] = { ...s, v: SAVED_SCHEMA, explicit: !!s.explicit, original: s.original || null };
    changed++;
  }
  return { map: out, changed };
}
