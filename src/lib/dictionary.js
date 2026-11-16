/**
 * Loads a translation dictionary (public/dict/{lang}.json, built from the
 * Open Food Facts taxonomies) once per language; the service worker keeps it
 * for offline use. null when it cannot be loaded (no translation then).
 */
export const DICT_LANGS = ['en', 'fr', 'de', 'it', 'es', 'pt', 'nl', 'pl', 'hu', 'cs', 'sk', 'hr', 'sl', 'bg', 'el', 'ru', 'uk'];
const cache = new Map();

export function loadDictionary(lang, { baseUrl = globalThis.document?.baseURI, fetchImpl = globalThis.fetch } = {}) {
  if (!DICT_LANGS.includes(lang)) return Promise.resolve(null);
  if (!cache.has(lang)) {
    const url = new URL(`dict/${lang}.json`, baseUrl).href;
    cache.set(lang, fetchImpl(url).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => {
      if (!d) cache.delete(lang); // try again next time
      return d;
    }));
  }
  return cache.get(lang);
}
