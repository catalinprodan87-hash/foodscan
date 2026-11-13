/**
 * Barcode → product lookup across the three Open *Facts databases.
 * Pure module (no DOM): `fetch` can be injected for tests.
 *
 *   food      → Open Food Facts      (world.openfoodfacts.org)
 *   cosmetic  → Open Beauty Facts    (world.openbeautyfacts.org)
 *   household → Open Products Facts  (world.openproductsfacts.org)
 *
 * All three share the API: GET {source}/api/v2/product/{code}.json?fields=…
 */
import { PRODUCT_TYPE_BY_ID } from '../data/productCategories.js';

/** Fallback order when no type is chosen or the chosen database has no match. */
export const LOOKUP_ORDER = ['food', 'cosmetic', 'household'];

export const SOURCE_NAMES = {
  food: 'Open Food Facts',
  cosmetic: 'Open Beauty Facts',
  household: 'Open Products Facts',
};

export const DEFAULT_TIMEOUT_MS = 8000;

const COMMON_FIELDS = [
  'code', 'product_type',
  'product_name_ro', 'product_name', 'product_name_en',
  'brands', 'quantity', 'image_front_small_url',
  'ingredients_text_ro', 'ingredients_text', 'ingredients_text_en',
];
const FOOD_FIELDS = ['additives_tags', 'nova_group', 'nutriscore_grade'];

/** Open *Facts `product_type` values → app product types. */
const OFF_PRODUCT_TYPES = { food: 'food', petfood: 'food', beauty: 'cosmetic', product: 'household' };

export function sourceFor(type) {
  return PRODUCT_TYPE_BY_ID[type]?.source;
}

export function fieldsFor(type) {
  return type === 'food' ? [...COMMON_FIELDS, ...FOOD_FIELDS] : COMMON_FIELDS;
}

export function apiUrl(type, code) {
  return `${sourceFor(type)}/api/v2/product/${encodeURIComponent(code)}.json?fields=${fieldsFor(type).join(',')}`;
}

export function productPageUrl(type, code) {
  return `${sourceFor(type)}/product/${encodeURIComponent(code)}`;
}

// ─────────────────────────────── Barcodes ────────────────────────────────

/** Keeps digits only ("5 941234 567890" → "5941234567890"). */
export function cleanBarcode(input) {
  return String(input ?? '').replace(/\D/g, '');
}

/** GTIN check digit (EAN-8, UPC-A, EAN-13, GTIN-14). */
export function isValidGtin(code) {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop();
  let sum = 0;
  digits.reverse().forEach((d, i) => { sum += d * (i % 2 === 0 ? 3 : 1); });
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Expands an 8-digit UPC-E code (number system + 6 digits + check) to the
 * 12-digit UPC-A code that the databases store.
 */
export function upcEToUpcA(upce) {
  const c = cleanBarcode(upce);
  if (!/^[01]\d{7}$/.test(c)) return null;
  const ns = c[0];
  const d = c.slice(1, 7);
  const check = c[7];
  const last = d[5];
  let body;
  if (last <= '2') body = d.slice(0, 2) + last + '0000' + d.slice(2, 5);
  else if (last === '3') body = d.slice(0, 3) + '00000' + d.slice(3, 5);
  else if (last === '4') body = d.slice(0, 4) + '00000' + d[4];
  else body = d.slice(0, 5) + '0000' + last;
  return ns + body + check;
}

/**
 * Normalises a scanned or typed code for lookup. UPC-E (from the scanner) is
 * expanded to UPC-A. Returns null if it cannot be a retail barcode.
 */
export function normalizeBarcode(input, format) {
  const c = cleanBarcode(input);
  if (format === 'UPC_E') return upcEToUpcA(c) || (c.length >= 8 ? c : null);
  if (c.length < 8 || c.length > 14) return null;
  return c;
}

// ─────────────────────────────── Mapping ─────────────────────────────────

const first = (...values) => values.find((v) => typeof v === 'string' && v.trim())?.trim() ?? '';

/** Maps an Open *Facts product to the app's product object. */
export function mapProduct(raw, type, code) {
  const p = raw || {};
  const ingredientsText = first(p.ingredients_text_ro, p.ingredients_text, p.ingredients_text_en);
  const product = {
    code: first(p.code, code),
    productType: type,
    name: first(p.product_name_ro, p.product_name, p.product_name_en),
    brands: first(p.brands),
    quantity: first(p.quantity),
    image: first(p.image_front_small_url) || null,
    ingredientsText,
    hasIngredients: ingredientsText.length > 0,
    source: SOURCE_NAMES[type],
    url: productPageUrl(type, first(p.code, code)),
  };
  if (type === 'food') {
    product.additiveTags = Array.isArray(p.additives_tags) ? p.additives_tags : [];
    const nova = Number(p.nova_group);
    product.nova = nova >= 1 && nova <= 4 ? nova : null;
    product.nutriscore = typeof p.nutriscore_grade === 'string' && /^[a-e]$/i.test(p.nutriscore_grade)
      ? p.nutriscore_grade.toLowerCase()
      : null;
  }
  return product;
}

/** Input for analyze() built from a looked-up product (plus optional pasted text). */
export function analyzeInput(product, pastedText) {
  const text = pastedText?.trim() ? pastedText : product.ingredientsText;
  const input = { text, productType: product.productType };
  if (product.productType === 'food') {
    input.additiveTags = product.additiveTags;
    input.nova = product.nova;
    input.nutriscore = product.nutriscore;
  }
  return input;
}

// ─────────────────────────────── Fetching ────────────────────────────────

export class LookupError extends Error {
  /** @param {'timeout'|'network'|'http'|'aborted'} kind */
  constructor(kind, message) {
    super(message || kind);
    this.kind = kind;
  }
}

/**
 * Fetches one product from one database.
 * @returns {Promise<{found: boolean, product?: object}>}
 * @throws {LookupError}
 */
export async function fetchProduct(type, code, { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    let res;
    try {
      res = await fetchImpl(apiUrl(type, code), { signal: controller.signal, headers: { Accept: 'application/json' } });
    } catch (err) {
      if (timedOut) throw new LookupError('timeout');
      if (signal?.aborted) throw new LookupError('aborted');
      throw new LookupError('network', err?.message);
    }
    // Open *Facts answers 404 with { status: 0 } for unknown products.
    if (res.status === 404) return { found: false };
    if (!res.ok) throw new LookupError('http', `HTTP ${res.status}`);

    let body;
    try {
      body = await res.json();
    } catch (err) {
      if (timedOut) throw new LookupError('timeout');
      throw new LookupError('http', 'Invalid JSON');
    }
    if (!body || body.status !== 1 || !body.product) return { found: false };

    // A database may serve a product of another type (shared Open *Facts
    // platform); its own product_type wins over the database it came from.
    const declared = OFF_PRODUCT_TYPES[body.product.product_type];
    const productType = declared || type;
    return { found: true, product: mapProduct(body.product, productType, code) };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Databases to query, in order: the chosen type first, then OFF → OBF → OPF. */
export function lookupOrder(chosenType) {
  if (!LOOKUP_ORDER.includes(chosenType)) return [...LOOKUP_ORDER];
  return [chosenType, ...LOOKUP_ORDER.filter((t) => t !== chosenType)];
}

/**
 * Looks a barcode up across the Open *Facts databases.
 * @param {string} code normalised barcode
 * @param {{productType?: string|null, fetchImpl?: Function, timeoutMs?: number, signal?: AbortSignal}} options
 * @returns {Promise<
 *   {status: 'found', code, product, tried: string[]} |
 *   {status: 'not_found', code, tried: string[]} |
 *   {status: 'error', code, kind: 'timeout'|'network'|'http', tried: string[]}
 * >}
 * Not found everywhere → 'not_found'. If nothing was found and at least one
 * database failed → 'error' (the product may exist; offer a retry).
 */
export async function lookupProduct(code, { productType = null, fetchImpl, timeoutMs, signal } = {}) {
  const tried = [];
  let error = null;
  for (const type of lookupOrder(productType)) {
    tried.push(type);
    try {
      const res = await fetchProduct(type, code, { fetchImpl, timeoutMs, signal });
      if (res.found) return { status: 'found', code, product: res.product, tried };
    } catch (err) {
      if (err.kind === 'aborted') throw err;
      error = error || err;
    }
  }
  if (error) return { status: 'error', code, kind: error.kind || 'network', tried };
  return { status: 'not_found', code, tried };
}
