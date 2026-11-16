/**
 * Small thumbnails (~160 px JPEG) of the photos in a product's set, so the
 * user can see what was photographed. IndexedDB, on the phone only, never in
 * backups; the oldest are dropped beyond THUMBS_MAX.
 */
export const THUMBS_MAX = 300;
export const THUMB_SIDE = 160;
const DB = 'ingrediscan-thumbs';
const STORE = 'thumbs';

function open(idb = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!idb) { reject(new Error('no indexedDB')); return; }
    const req = idb.open(DB, 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { keyPath: 'id' });
      s.createIndex('barcode', 'barcode');
      s.createIndex('date', 'date');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const done = (tx) => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });

/** Ids to drop so that at most `max` remain (oldest first). Pure. */
export function idsToDrop(entries, max = THUMBS_MAX) {
  if (entries.length <= max) return [];
  return [...entries].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, entries.length - max).map((e) => e.id);
}

/** A data URL thumbnail of an image / canvas (browser). */
export function makeThumb(img, side = THUMB_SIDE) {
  const w = img.width;
  const h = img.height;
  const k = Math.min(1, side / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.7);
}

export async function saveThumbs(barcode, thumbs, { idb, max = THUMBS_MAX } = {}) {
  try {
    const db = await open(idb);
    let tx = db.transaction(STORE, 'readwrite');
    for (const t of thumbs) tx.objectStore(STORE).put({ ...t, barcode });
    await done(tx);
    tx = db.transaction(STORE, 'readonly');
    const all = await new Promise((resolve) => { const r = tx.objectStore(STORE).getAll(); r.onsuccess = () => resolve(r.result || []); r.onerror = () => resolve([]); });
    const drop = idsToDrop(all.map(({ id, date }) => ({ id, date })), max);
    if (drop.length) {
      tx = db.transaction(STORE, 'readwrite');
      drop.forEach((id) => tx.objectStore(STORE).delete(id));
      await done(tx);
    }
    db.close();
    return true;
  } catch {
    return false;
  }
}

export async function getThumbs(barcode, { idb } = {}) {
  try {
    const db = await open(idb);
    const tx = db.transaction(STORE, 'readonly');
    const list = await new Promise((resolve) => {
      const r = tx.objectStore(STORE).index('barcode').getAll(barcode);
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => resolve([]);
    });
    db.close();
    return list.sort((a, b) => (a.date < b.date ? -1 : 1));
  } catch {
    return [];
  }
}

export async function clearThumbs({ idb = globalThis.indexedDB } = {}) {
  try { await new Promise((resolve) => { const r = idb.deleteDatabase(DB); r.onsuccess = resolve; r.onerror = resolve; r.onblocked = resolve; }); } catch { /* ignore */ }
}
