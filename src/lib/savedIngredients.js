/**
 * Remembered ingredients: when the ingredients of a scanned barcode come from
 * the user (a photo or pasted text, because the databases had none or did not
 * know the product), they are remembered by barcode. The next scan of the same
 * barcode shows the result straight away, even offline.
 *
 * Kept apart from the history so that deleting or clearing the history (or its
 * 200-entry cap) does not lose them; "Forget" on the result removes one.
 * Pure helpers + a small localStorage store.
 */

export const SAVED_MAX = 1000;
const LS_KEY = 'ingrediscan:savedIngredients';

// Product fields worth keeping (the database's own ingredients are not needed).
const PRODUCT_FIELDS = ['code', 'productType', 'name', 'brands', 'quantity', 'image', 'source', 'url',
  'additiveTags', 'nova', 'nutriscore', 'nutrition'];

function productSnapshot(p) {
  if (!p) return null;
  const out = {};
  for (const k of PRODUCT_FIELDS) if (p[k] !== undefined) out[k] = p[k];
  return out;
}

/**
 * What to remember from an analysis request (see buildRequest), or null when
 * there is nothing to remember: no barcode, or the ingredients came from a database.
 */
export function savedFromRequest(request, now = new Date()) {
  const barcode = request?.barcode || request?.product?.code || null;
  const text = request?.text?.trim();
  if (!barcode || !text) return null;
  return {
    barcode,
    text: request.text,
    productType: request.type || request.product?.productType || 'food',
    source: request.fromPhoto ? 'photo' : 'paste',
    confidence: request.fromPhoto ? request.confidence ?? null : null,
    product: productSnapshot(request.product),
    date: now.toISOString(),
  };
}

/**
 * Rebuilds an analysis request from a remembered entry. `product` (fresh from a
 * lookup) replaces the stored product details; the user's ingredients are kept.
 */
export function requestFromSaved(saved, product = null) {
  const p = productSnapshot(product) || saved.product;
  return {
    text: saved.text,
    type: p?.productType || saved.productType,
    auto: false,
    product: p ? { ...p, code: saved.barcode, ingredientsText: '', hasIngredients: false } : null,
    barcode: saved.barcode,
    fromPhoto: saved.source === 'photo',
    confidence: saved.confidence ?? null,
    saved: { date: saved.date, source: saved.source },
  };
}

/** Adds or replaces by barcode; keeps the newest `max`. */
export function upsertSaved(map, saved, max = SAVED_MAX) {
  const next = { ...map, [saved.barcode]: saved };
  const codes = Object.keys(next);
  if (codes.length <= max) return next;
  codes.sort((a, b) => (next[a].date < next[b].date ? 1 : -1));
  return Object.fromEntries(codes.slice(0, max).map((c) => [c, next[c]]));
}

/**
 * Entries in the history that hold user-supplied ingredients for a barcode
 * (from before this store existed), as remembered entries. Newest wins.
 */
export function savedFromHistory(entries = []) {
  const out = {};
  for (const e of entries) {
    if (!e?.barcode || e.source === 'barcode' || !e.text?.trim()) continue;
    if (out[e.barcode] && out[e.barcode].date >= e.date) continue;
    out[e.barcode] = {
      barcode: e.barcode,
      text: e.text,
      productType: e.productType,
      source: e.source === 'photo' ? 'photo' : 'paste',
      confidence: e.confidence ?? null,
      product: e.db
        ? productSnapshot({
          code: e.barcode, productType: e.productType, name: e.name, brands: e.brand, quantity: e.quantity,
          image: e.image, source: e.db.source, url: e.db.url, additiveTags: e.db.additiveTags,
          nova: e.db.nova, nutriscore: e.db.nutriscore, nutrition: e.db.nutrition ?? null,
        })
        : (e.name ? { code: e.barcode, productType: e.productType, name: e.name } : null),
      date: e.date,
    };
  }
  return out;
}

// ─────────────────────────────── storage ─────────────────────────────────

export function createSavedStore(ls) {
  let storage = ls;
  if (storage === undefined) {
    try { storage = globalThis.localStorage; } catch { storage = null; }
  }
  const read = () => {
    try { return JSON.parse(storage?.getItem(LS_KEY) || '{}') || {}; } catch { return {}; }
  };
  const write = (map) => {
    try { storage?.setItem(LS_KEY, JSON.stringify(map)); } catch { /* quota / private mode */ }
  };
  return {
    get(barcode) { return read()[barcode] || null; },
    all() { return read(); },
    save(saved) { if (saved) write(upsertSaved(read(), saved)); },
    remove(barcode) { const m = read(); delete m[barcode]; write(m); },
    /** Adds history entries for barcodes not remembered yet (one-off migration). */
    seed(entries) {
      const m = read();
      const fromHist = savedFromHistory(entries);
      let changed = false;
      for (const [code, s] of Object.entries(fromHist)) {
        if (!m[code]) { m[code] = s; changed = true; }
      }
      if (changed) write(m);
    },
  };
}
