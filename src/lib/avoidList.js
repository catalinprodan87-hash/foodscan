/**
 * Avoid-list editing helpers: custom entries, export / import as JSON, and the
 * "how many history items would this flag" preview. Pure, unit-tested.
 */
import { AVOID_PRESETS, defaultAvoidState, normalizeCustomEntry } from '../data/avoidPresets.js';
import { analyze } from './analyze.js';
import { entryAnalyzeInput } from './history.js';

export const EXPORT_FORMAT = 'ingrediscan-avoid-list';
export const EXPORT_VERSION = 1;

/** Cleans any stored / imported value into a valid avoid state. */
export function sanitizeAvoidState(raw) {
  const def = defaultAvoidState();
  if (!raw || typeof raw !== 'object') return def;
  const presets = { ...def.presets };
  for (const p of AVOID_PRESETS) {
    if (typeof raw.presets?.[p.id] === 'boolean') presets[p.id] = raw.presets[p.id];
  }
  const seen = new Set();
  const custom = [];
  for (const item of Array.isArray(raw.custom) ? raw.custom : []) {
    const entry = normalizeCustomEntry(item);
    if (!entry) continue;
    let { id } = entry;
    while (seen.has(id)) id += '-2';
    seen.add(id);
    custom.push({ ...entry, id });
  }
  return { presets, custom };
}

/** "soia / soy" → ['soia', 'soy'] */
export function parseTermsInput(input) {
  return normalizeCustomEntry({ terms: input })?.terms || [];
}

function uniqueId(state, base) {
  const ids = new Set(state.custom.map((c) => c.id));
  let id = base;
  for (let i = 2; ids.has(id); i++) id = `${base}-${i}`;
  return id;
}

export function addCustom(state, { terms, types }) {
  const entry = normalizeCustomEntry({ terms, types });
  if (!entry) return state;
  return { ...state, custom: [...state.custom, { ...entry, id: uniqueId(state, entry.id) }] };
}

export function updateCustom(state, id, { terms, types }) {
  const entry = normalizeCustomEntry({ id, terms, types });
  if (!entry) return removeCustom(state, id);
  return { ...state, custom: state.custom.map((c) => (c.id === id ? entry : c)) };
}

export function removeCustom(state, id) {
  return { ...state, custom: state.custom.filter((c) => c.id !== id) };
}

export function setPreset(state, id, on) {
  return { ...state, presets: { ...state.presets, [id]: !!on } };
}

/** JSON text for "Export" (moving the list to another phone). */
export function exportAvoidList(state, now = new Date()) {
  const clean = sanitizeAvoidState(state);
  return JSON.stringify({ format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: now.toISOString(), ...clean }, null, 2);
}

/**
 * Parses an exported file. Throws Error('invalid') for anything that is not
 * an IngrediScan avoid list.
 */
export function importAvoidList(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('invalid'); }
  if (!data || data.format !== EXPORT_FORMAT || typeof data.presets !== 'object') throw new Error('invalid');
  return sanitizeAvoidState(data);
}

/**
 * For each preset and custom entry, how many history items it would flag
 * (whether it is switched on or not).
 * @returns {Record<string, number>} keys: preset id, or 'custom:' + entry id
 */
export function previewCounts(entries, state) {
  const all = {
    presets: Object.fromEntries(AVOID_PRESETS.map((p) => [p.id, true])),
    custom: state.custom,
  };
  const counts = Object.fromEntries([
    ...AVOID_PRESETS.map((p) => [p.id, 0]),
    ...state.custom.map((c) => ['custom:' + c.id, 0]),
  ]);
  for (const entry of entries) {
    if (!entry.text) continue;
    const result = analyze(entryAnalyzeInput(entry), all);
    for (const hit of result.avoidHits) {
      if (hit.id in counts) counts[hit.id]++;
    }
  }
  return counts;
}
