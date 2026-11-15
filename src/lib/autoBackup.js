/**
 * Automatic backup taken before a data migration (v3.3: remembered
 * ingredients get a new schema). Kept in localStorage on the phone, in the
 * same format as "Salvează copia" (backup.js), so it can be downloaded and
 * restored the usual way. Removed by "Șterge toate datele".
 */
export const AUTO_KEY = 'ingrediscan:autoBackup';

/** @returns {boolean} whether it was stored (it may not fit in a full storage) */
export function saveAutoBackup(backup, reason, ls = globalThis.localStorage, now = new Date()) {
  try {
    ls.setItem(AUTO_KEY, JSON.stringify({ date: now.toISOString(), reason, backup }));
    return true;
  } catch {
    return false;
  }
}

/** @returns {{date: string, reason: string, backup: object}|null} */
export function getAutoBackup(ls = globalThis.localStorage) {
  try {
    const v = JSON.parse(ls.getItem(AUTO_KEY));
    return v && v.backup && v.date ? v : null;
  } catch {
    return null;
  }
}

export function removeAutoBackup(ls = globalThis.localStorage) {
  try { ls.removeItem(AUTO_KEY); } catch { /* ignore */ }
}
