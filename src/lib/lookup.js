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
  'code', 'product_type', 'last_modified_t',
  'product_name_ro', 'product_name', 'product_name_en',
  'brands', 'quantity', 'image_front_small_url',
  'ingredients_text_ro', 'ingredients_text', 'ingredients_text_en',
];
const FOOD_FIELDS = ['additives_tags', 'nova_group', 'nutriscore_grade', 'nutrient_levels', 'nutriments', 'allergens_tags', 'traces_tags', 'ingredients_analysis_tags'];

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

const NUTRIENTS = [
  ['fat', 'fat', 'fat_100g'],
  ['saturatedFat', 'saturated-fat', 'saturated-fat_100g'],
  ['sugars', 'sugars', 'sugars_100g'],
  ['salt', 'salt', 'salt_100g'],
];

/**
 * The facts behind a Nutri-Score: Open Food Facts' low / moderate / high
 * levels and amounts per 100 g for fat, saturated fat, sugars and salt, plus
 * energy. Null when the database has none of them.
 * @returns {{kcal: number|null, items: {key, level: string|null, per100: number|null}[]}|null}
 */
export function mapNutrition(p) {
  const levels = p?.nutrient_levels || {};
  const n = p?.nutriments || {};
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const items = NUTRIENTS
    .map(([key, levelKey, amountKey]) => ({
      key,
      level: ['low', 'moderate', 'high'].includes(levels[levelKey]) ? levels[levelKey] : null,
      per100: num(n[amountKey]),
    }))
    .filter((x) => x.level || x.per100 != null);
  const kcal = num(n['energy-kcal_100g']);
  return items.length || kcal != null ? { kcal, items } : null;
}

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
    // when the product page was last edited (Unix seconds → ISO date)
    updated: Number(p.last_modified_t) > 0 ? new Date(Number(p.last_modified_t) * 1000).toISOString().slice(0, 10) : null,
  };
  if (type === 'food') {
    product.nutrition = mapNutrition(p);
    product.additiveTags = Array.isArray(p.additives_tags) ? p.additives_tags : [];
    product.allergenTags = Array.isArray(p.allergens_tags) ? p.allergens_tags : [];
    product.traceTags = Array.isArray(p.traces_tags) ? p.traces_tags : [];
    product.analysisTags = Array.isArray(p.ingredients_analysis_tags) ? p.ingredients_analysis_tags : [];
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
    input.allergenTags = product.allergenTags || [];
    input.traceTags = product.traceTags || [];
    input.analysisTags = product.analysisTags || [];
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

/** After this long without an answer, the remaining databases are asked in parallel. */
export const STAGGER_MS = 1500;

/**
 * Looks a barcode up across the Open *Facts databases.
 *
 * The databases are asked in priority order (chosen type first). When one
 * answers quickly, the next is asked after it, as before. When one is slow
 * (no answer within `staggerMs`), all the remaining ones start in parallel,
 * so a hanging server costs about one timeout instead of three. Priority is
 * kept: a match in a lower database only wins once every higher one has
 * answered "not found" (or failed).
 *
 * @param {string} code normalised barcode
 * @param {{productType?: string|null, fetchImpl?: Function, timeoutMs?: number,
 *          signal?: AbortSignal, staggerMs?: number}} options
 * @returns {Promise<
 *   {status: 'found', code, product, tried: string[]} |
 *   {status: 'not_found', code, tried: string[]} |
 *   {status: 'error', code, kind: 'timeout'|'network'|'http', tried: string[]}
 * >}
 * Not found everywhere → 'not_found'. If nothing was found and at least one
 * database failed → 'error' (the product may exist; offer a retry).
 * `tried`: the databases that were asked, in priority order.
 */
export async function lookupProduct(code, { productType = null, fetchImpl, timeoutMs, signal, staggerMs = STAGGER_MS } = {}) {
  const order = lookupOrder(productType);
  const ctrl = new AbortController(); // also stops the slower requests once a match is chosen
  const onAbort = () => ctrl.abort();
  if (signal?.aborted) ctrl.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  const tasks = [];
  const start = () => {
    const type = order[tasks.length];
    const promise = fetchProduct(type, code, { fetchImpl, timeoutMs, signal: ctrl.signal }).then(
      (res) => ({ res }),
      (err) => ({ err }),
    );
    tasks.push({ type, promise });
  };

  let error = null;
  try {
    start();
    for (let i = 0; i < order.length; i++) {
      if (i >= tasks.length) start();
      const { promise } = tasks[i];
      if (tasks.length < order.length) {
        let timer;
        const slow = new Promise((resolve) => { timer = setTimeout(() => resolve('slow'), staggerMs); });
        const first = await Promise.race([promise.then(() => 'done'), slow]);
        clearTimeout(timer);
        if (first === 'slow') while (tasks.length < order.length) start();
      }
      const { res, err } = await promise;
      if (err) {
        if (err.kind === 'aborted' || signal?.aborted) throw new LookupError('aborted');
        error = error || err;
        continue;
      }
      if (res.found) return { status: 'found', code, product: res.product, tried: tasks.map((t) => t.type) };
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
    ctrl.abort(); // any request still running is no longer needed
  }
  const tried = tasks.map((t) => t.type);
  if (error) return { status: 'error', code, kind: error.kind || 'network', tried };
  return { status: 'not_found', code, tried };
}

// ─────────────────────── In-store and cached answers ───────────────────────

/**
 * EAN-13 codes starting with 20–29 are "restricted circulation" numbers
 * (GS1): shops print them for products weighed or packed in store, so no
 * public database knows them.
 */
export function isInStoreCode(code) {
  return /^2\d{12}$/.test(String(code || ''));
}

export const NOT_FOUND_TTL_MS = 24 * 60 * 60 * 1000;
const NOT_FOUND_KEY = 'ingrediscan:notFound';
const NOT_FOUND_MAX = 200;

/**
 * Remembers barcodes that no database knew, for 24 h, so scanning the same
 * unknown product again answers at once. "Caută din nou" bypasses it.
 */
export function createNotFoundCache(ls, now = () => Date.now()) {
  let storage = ls;
  if (storage === undefined) {
    try { storage = globalThis.localStorage; } catch { storage = null; }
  }
  const read = () => {
    try { return JSON.parse(storage?.getItem(NOT_FOUND_KEY) || '{}') || {}; } catch { return {}; }
  };
  const write = (map) => {
    try { storage?.setItem(NOT_FOUND_KEY, JSON.stringify(map)); } catch { /* quota / private mode */ }
  };
  const fresh = (map) => Object.fromEntries(Object.entries(map).filter(([, at]) => now() - at < NOT_FOUND_TTL_MS));
  return {
    has(code) { return code in fresh(read()); },
    add(code) {
      const map = fresh(read());
      map[code] = now();
      const codes = Object.keys(map).sort((a, b) => map[b] - map[a]).slice(0, NOT_FOUND_MAX);
      write(Object.fromEntries(codes.map((c) => [c, map[c]])));
    },
    remove(code) { const map = read(); delete map[code]; write(map); },
  };
}
