/**
 * Family profiles: each person (Eu, Copil…) has their own avoid list and
 * allergens to highlight. The app works with the ACTIVE profile's list exactly
 * as it did with the single list before v2.8. Pure, unit-tested.
 *
 *   state = { profiles: [{ id, name, presets, custom, allergens }], active: id }
 */
import { sanitizeAvoidState } from './avoidList.js';

export const MAX_PROFILES = 8;
export const DEFAULT_NAME = { ro: 'Eu', en: 'Me' };

const cleanName = (name) => String(name || '').replace(/\s+/g, ' ').trim().slice(0, 24);
const newId = (taken) => {
  let i = taken.length + 1;
  while (taken.includes(`p${i}`)) i++;
  return `p${i}`;
};

/**
 * Valid profiles from storage; an older single avoid list becomes the first
 * profile ("Eu"), so nobody loses their list when updating.
 */
export function sanitizeProfiles(raw, legacyAvoid = null, lang = 'ro') {
  const list = [];
  for (const p of Array.isArray(raw?.profiles) ? raw.profiles : []) {
    if (!p || typeof p !== 'object' || list.length >= MAX_PROFILES) continue;
    const id = typeof p.id === 'string' && p.id && !list.some((x) => x.id === p.id) ? p.id : newId(list.map((x) => x.id));
    list.push({ id, name: cleanName(p.name) || DEFAULT_NAME[lang], ...sanitizeAvoidState(p) });
  }
  if (!list.length) list.push({ id: 'me', name: DEFAULT_NAME[lang] || DEFAULT_NAME.ro, ...sanitizeAvoidState(legacyAvoid) });
  const active = list.some((p) => p.id === raw?.active) ? raw.active : list[0].id;
  return { profiles: list, active };
}

/** The active profile's list ({presets, custom, allergens}), as the rest of the app uses it. */
export function activeAvoid(state) {
  const p = state.profiles.find((x) => x.id === state.active) || state.profiles[0];
  return { presets: p.presets, custom: p.custom, allergens: p.allergens };
}

export const activeProfile = (state) => state.profiles.find((x) => x.id === state.active) || state.profiles[0];

/** Replaces the active profile's list. */
export function updateActive(state, avoid) {
  const clean = sanitizeAvoidState(avoid);
  return { ...state, profiles: state.profiles.map((p) => (p.id === state.active ? { ...p, ...clean } : p)) };
}

/** Adds a profile (an empty list, or the given one) and makes it active. */
export function addProfile(state, name, avoid = null) {
  if (state.profiles.length >= MAX_PROFILES) return state;
  const id = newId(state.profiles.map((p) => p.id));
  const profile = { id, name: cleanName(name) || `${state.profiles.length + 1}`, ...sanitizeAvoidState(avoid) };
  return { profiles: [...state.profiles, profile], active: id };
}

export function renameProfile(state, id, name) {
  const n = cleanName(name);
  if (!n) return state;
  return { ...state, profiles: state.profiles.map((p) => (p.id === id ? { ...p, name: n } : p)) };
}

/** Removes a profile; the last one cannot be removed. */
export function removeProfile(state, id) {
  if (state.profiles.length <= 1) return state;
  const profiles = state.profiles.filter((p) => p.id !== id);
  return { profiles, active: state.active === id ? profiles[0].id : state.active };
}

export function setActive(state, id) {
  return state.profiles.some((p) => p.id === id) ? { ...state, active: id } : state;
}
