/**
 * Backup of everything the app keeps on the phone – history, remembered
 * ingredients, avoid list – as one JSON file, and the "delete all data" and
 * storage helpers behind the settings card. Pure parts are unit-tested.
 */
import { sanitizeAvoidState, EXPORT_FORMAT as AVOID_FORMAT } from './avoidList.js';
import { sanitizeProfiles } from './profiles.js';

export const BACKUP_FORMAT = 'ingrediscan-backup';
export const BACKUP_VERSION = 2; // 2: family profiles (v2.8); version 1 files (one avoid list) still restore
export const KEY_PREFIX = 'ingrediscan:';

/** The backup object (stringify it to save). */
export function buildBackup({ history = [], saved = {}, profiles }, now = new Date()) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    history,
    saved,
    profiles: sanitizeProfiles(profiles),
  };
}

export function backupFileName(now = new Date()) {
  return `ingrediscan-backup-${now.toISOString().slice(0, 10)}.json`;
}

const isEntry = (e) => e && typeof e === 'object' && typeof e.id === 'string' && typeof e.date === 'string';
const isSaved = (s) => s && typeof s === 'object' && typeof s.barcode === 'string' && typeof s.text === 'string';

/**
 * Reads a backup file (or an avoid-list export, which restores just the list).
 * Unknown or broken entries are skipped.
 * @returns {{history: object[], saved: Record<string, object>, avoid: object|null, profiles: object|null}}
 *   profiles (version 2) replace all profiles; avoid (version 1, avoid-list
 *   export) replaces the active profile's list
 * @throws Error('invalid') not an IngrediScan file; Error('newer') made by a newer app version
 */
export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('invalid'); }
  if (data?.format === AVOID_FORMAT) return { history: [], saved: {}, avoid: sanitizeAvoidState(data), profiles: null };
  if (!data || data.format !== BACKUP_FORMAT) throw new Error('invalid');
  if (!(data.version >= 1)) throw new Error('invalid');
  if (data.version > BACKUP_VERSION) throw new Error('newer');
  const history = Array.isArray(data.history) ? data.history.filter(isEntry) : [];
  const saved = Object.fromEntries(
    Object.values(data.saved && typeof data.saved === 'object' ? data.saved : {}).filter(isSaved).map((s) => [s.barcode, s]),
  );
  if (data.version >= 2 && data.profiles) return { history, saved, avoid: null, profiles: sanitizeProfiles(data.profiles) };
  return { history, saved, avoid: data.avoid ? sanitizeAvoidState(data.avoid) : null, profiles: null };
}

/** History entries from the backup that are new or newer than what the phone has. */
export function historyToRestore(current, incoming) {
  const have = new Map(current.map((e) => [e.id, e.date]));
  return incoming.filter((e) => !have.has(e.id) || have.get(e.id) < e.date);
}

/** Remembered ingredients merged by barcode; the newer one wins. */
export function mergeSaved(current, incoming) {
  const out = { ...current };
  for (const [code, s] of Object.entries(incoming)) {
    if (!out[code] || out[code].date < s.date) out[code] = s;
  }
  return out;
}

// ───────────────────────────── browser only ──────────────────────────────

/** Removes every key this app wrote to localStorage. */
export function clearLocalData(ls = globalThis.localStorage) {
  try {
    const keys = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k?.startsWith(KEY_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => ls.removeItem(k));
    return keys.length;
  } catch {
    return 0;
  }
}

/**
 * Asks the browser not to evict the app's data under storage pressure.
 * @returns {Promise<boolean|null>} persisted, or null when not supported
 */
export async function requestPersistence(nav = globalThis.navigator) {
  try {
    if (!nav?.storage?.persist) return null;
    if (await nav.storage.persisted()) return true;
    return await nav.storage.persist();
  } catch {
    return null;
  }
}

/** { persisted: boolean|null, usage: bytes|null, quota: bytes|null } */
export async function storageStatus(nav = globalThis.navigator) {
  const out = { persisted: null, usage: null, quota: null };
  try { if (nav?.storage?.persisted) out.persisted = await nav.storage.persisted(); } catch { /* ignore */ }
  try {
    if (nav?.storage?.estimate) {
      const e = await nav.storage.estimate();
      out.usage = e.usage ?? null;
      out.quota = e.quota ?? null;
    }
  } catch { /* ignore */ }
  return out;
}
