/**
 * The user's own nutrition values / Nutri-Score category per barcode (v3.5),
 * in localStorage; part of backups.
 */
const KEY = 'ingrediscan:nutrition';
export const NUTRITION_MAX = 1000;

export function createNutritionStore(ls = globalThis.localStorage) {
  const read = () => { try { return JSON.parse(ls?.getItem(KEY) || '{}') || {}; } catch { return {}; } };
  const write = (m) => { try { ls?.setItem(KEY, JSON.stringify(m)); } catch { /* quota */ } };
  return {
    get: (code) => read()[code] || null,
    all: read,
    save(code, entry) {
      const m = read();
      m[code] = { ...(m[code] || {}), ...entry, date: new Date().toISOString() };
      const codes = Object.keys(m);
      if (codes.length > NUTRITION_MAX) codes.sort((a, b) => (m[a].date < m[b].date ? -1 : 1)).slice(0, codes.length - NUTRITION_MAX).forEach((c) => delete m[c]);
      write(m);
    },
    replaceAll: (m) => write(m || {}),
  };
}
