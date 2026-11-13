/**
 * Scan history: every analysed product, newest first, at most 200.
 * Same barcode (or, without one, the same text and type) replaces the older entry.
 *
 * Storage: IndexedDB when available, localStorage otherwise (private mode,
 * old WebViews). Entry building, filtering and capping are pure functions.
 */
import { normalize } from './analyze.js';

export const HISTORY_MAX = 200;
const DB_NAME = 'ingrediscan';
const STORE = 'history';
const LS_KEY = 'ingrediscan:history';

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Stable id: barcode, else a hash of the normalised text and type. */
export function entryId({ barcode, text, productType }) {
  if (barcode) return `b:${barcode}`;
  return `t:${productType}:${hash(normalize(text || '').replace(/\s+/g, ' ').trim())}`;
}

/**
 * Builds a history entry from what was analysed (see buildRequest) and the result.
 * source: 'barcode' (ingredients from the database), 'photo' or 'paste'.
 */
export function makeEntry(request, result, now = new Date()) {
  const p = request.product || null;
  const text = request.text?.trim() ? request.text : p?.ingredientsText || '';
  let source = 'paste';
  if (request.fromPhoto) source = 'photo';
  else if (p && !request.text?.trim()) source = 'barcode';
  const barcode = request.barcode || p?.code || null;
  return {
    id: entryId({ barcode, text, productType: result.productType }),
    barcode,
    name: p?.name || '',
    brand: p?.brands || '',
    quantity: p?.quantity || '',
    image: p?.image || null,
    productType: result.productType,
    source,
    text,
    db: p
      ? {
        source: p.source || null,
        url: p.url || null,
        hasIngredients: !!p.hasIngredients,
        additiveTags: p.additiveTags || [],
        nova: p.nova ?? null,
        nutriscore: p.nutriscore ?? null,
      }
      : null,
    confidence: request.fromPhoto ? request.confidence ?? null : null,
    verdict: result.verdict,
    counts: result.counts,
    date: now.toISOString(),
  };
}

/** Rebuilds an analysis request (same shape as buildRequest) from an entry. */
export function entryRequest(entry) {
  const product = entry.db
    ? {
      code: entry.barcode,
      productType: entry.productType,
      name: entry.name,
      brands: entry.brand,
      quantity: entry.quantity,
      image: entry.image,
      ingredientsText: entry.text,
      hasIngredients: !!entry.text,
      source: entry.db.source,
      url: entry.db.url,
      additiveTags: entry.db.additiveTags,
      nova: entry.db.nova,
      nutriscore: entry.db.nutriscore,
    }
    : null;
  return {
    text: entry.text,
    type: entry.productType,
    auto: false,
    product,
    barcode: entry.barcode,
    fromPhoto: entry.source === 'photo',
    confidence: entry.confidence ?? null,
    fromHistory: true,
  };
}

/** Input for analyze() from an entry. */
export function entryAnalyzeInput(entry) {
  const input = { text: entry.text, productType: entry.productType };
  if (entry.productType === 'food' && entry.db) {
    input.additiveTags = entry.db.additiveTags;
    input.nova = entry.db.nova;
    input.nutriscore = entry.db.nutriscore;
  }
  return input;
}

/** Display title: product name, else the start of the ingredients text. */
export function entryTitle(entry) {
  if (entry.name) return entry.name;
  const t = (entry.text || '').replace(/\s+/g, ' ').trim();
  return t.length > 48 ? `${t.slice(0, 46)}…` : t || entry.barcode || '';
}

/** Adds or replaces an entry; newest first; capped at `max`. */
export function upsertEntries(list, entry, max = HISTORY_MAX) {
  return [entry, ...list.filter((e) => e.id !== entry.id)]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, max);
}

/**
 * Search by name / brand / barcode, filter by type and verdict.
 * @param {(entry) => string} verdictOf current verdict (re-analysed with the
 *        current avoid list); defaults to the stored one
 */
export function filterEntries(list, { query = '', type = 'all', verdict = 'all' } = {}, verdictOf = (e) => e.verdict) {
  const q = normalize(query).trim();
  return list.filter((e) => {
    if (type !== 'all' && e.productType !== type) return false;
    if (verdict !== 'all' && verdictOf(e) !== verdict) return false;
    if (!q) return true;
    return normalize(`${e.name} ${e.brand} ${e.barcode || ''}`).includes(q);
  });
}

// ─────────────────────────────── storage ─────────────────────────────────

function openDb(idb) {
  return new Promise((resolve, reject) => {
    const req = idb.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

function idbRequest(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    let value;
    if (req) req.onsuccess = () => { value = req.result; };
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function idbBackend(db) {
  const sortDesc = (list) => list.sort((a, b) => (a.date < b.date ? 1 : -1));
  return {
    name: 'indexeddb',
    async all() { return sortDesc((await idbRequest(db, 'readonly', (s) => s.getAll())) || []); },
    async save(entry, max) {
      await idbRequest(db, 'readwrite', (s) => s.put(entry));
      const list = await this.all();
      const extra = list.slice(max);
      if (extra.length) await idbRequest(db, 'readwrite', (s) => { extra.forEach((e) => s.delete(e.id)); });
      return list.slice(0, max);
    },
    async remove(id) { await idbRequest(db, 'readwrite', (s) => s.delete(id)); },
    async clear() { await idbRequest(db, 'readwrite', (s) => s.clear()); },
  };
}

function localBackend(ls) {
  const read = () => {
    try { return JSON.parse(ls?.getItem(LS_KEY) || '[]'); } catch { return []; }
  };
  const write = (list) => {
    try { ls?.setItem(LS_KEY, JSON.stringify(list)); } catch { /* quota / private mode */ }
  };
  return {
    name: 'localstorage',
    async all() { return read(); },
    async save(entry, max) {
      const list = upsertEntries(read(), entry, max);
      write(list);
      return list;
    },
    async remove(id) { write(read().filter((e) => e.id !== id)); },
    async clear() { write([]); },
  };
}

/**
 * @returns {Promise<{name, all, save, remove, clear}>} IndexedDB backend, or
 *          localStorage if IndexedDB is missing or fails to open.
 */
export async function createHistoryStore({ indexedDB: idb = globalThis.indexedDB, localStorage: ls } = {}) {
  let storage = ls;
  if (storage === undefined) {
    try { storage = globalThis.localStorage; } catch { storage = null; }
  }
  if (idb) {
    try {
      return idbBackend(await openDb(idb));
    } catch { /* fall back */ }
  }
  return localBackend(storage);
}
