/** Small, failure-tolerant wrapper around localStorage. */
import { sanitizeAvoidState } from './avoidList.js';
import { LANGS } from './i18n.js';

const PREFIX = 'ingrediscan:';

function store() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // access can throw in private mode / sandboxed frames
  }
}

export function load(key, fallback) {
  try {
    const raw = store()?.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    store()?.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getLang() {
  const v = load('lang', null);
  return LANGS.includes(v) ? v : null;
}

export function setLang(lang) {
  if (LANGS.includes(lang)) save('lang', lang);
}

/** Saved avoid state, cleaned and merged with defaults (older formats upgraded). */
export function getAvoidState() {
  return sanitizeAvoidState(load('avoid', null));
}

export function setAvoidState(state) {
  save('avoid', state);
}

/** One-time flags: first-run slides seen, iPhone install hint dismissed. */
export function getFlag(name) {
  return load('flag:' + name, false) === true;
}

export function setFlag(name, value = true) {
  save('flag:' + name, !!value);
}
