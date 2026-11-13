/** Small, failure-tolerant wrapper around localStorage. */
import { defaultAvoidState, AVOID_PRESETS } from '../data/avoidPresets.js';
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

/** Saved avoid state merged with defaults (new presets get their default value). */
export function getAvoidState() {
  const def = defaultAvoidState();
  const saved = load('avoid', null);
  if (!saved || typeof saved !== 'object') return def;
  const presets = { ...def.presets };
  for (const p of AVOID_PRESETS) {
    if (typeof saved.presets?.[p.id] === 'boolean') presets[p.id] = saved.presets[p.id];
  }
  const custom = Array.isArray(saved.custom) ? saved.custom.filter((s) => typeof s === 'string') : [];
  return { presets, custom };
}

export function setAvoidState(state) {
  save('avoid', state);
}
