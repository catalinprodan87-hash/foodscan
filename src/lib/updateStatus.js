/**
 * Did the update the user asked for ("Reîncarcă") actually happen?
 * Before reloading, the app stores what it expects; on the next start it
 * compares that with the running build. Pure parts are unit-tested.
 */
export const PENDING_KEY = 'ingrediscan:pendingUpdate';
export const LAST_VERSION_KEY = 'ingrediscan:lastVersion';
export const UPDATE_TIMEOUT_MS = 15_000;
const STALE_MS = 10 * 60 * 1000; // an old marker (app closed mid-update) is ignored

/**
 * What to remember before the reload: the running build and the waiting
 * worker's build (when it answered). Builds are "version+build time", so a
 * redeploy of the same version still counts as a change.
 */
export const pendingUpdate = (from, to, now = Date.now()) => ({ from, to: to || null, at: now });

/**
 * @returns {'success'|'failed'|null} null when no update was pending (or the marker is stale)
 */
export function updateOutcome(pending, running, now = Date.now()) {
  if (!pending || typeof pending !== 'object' || !pending.from) return null;
  if (!(now - pending.at < STALE_MS)) return null;
  if (pending.to) return running === pending.to ? 'success' : 'failed';
  return running !== pending.from ? 'success' : 'failed';
}

/**
 * Version to show "what's new" for, once per version: when the app runs a new
 * version for the first time on a phone that already used it (onboarded).
 * Returns null for a fresh install or when nothing changed.
 */
export function whatsNewFor(lastVersion, running, onboarded) {
  if (!onboarded || !running || running === 'dev') return null;
  return lastVersion === running ? null : running;
}

// ───────────────────────────── browser only ──────────────────────────────

const read = (ls, k) => { try { return JSON.parse(ls.getItem(k)); } catch { return null; } };
const write = (ls, k, v) => { try { if (v == null) ls.removeItem(k); else ls.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

/**
 * Called once at start: the outcome of a pending update (cleared) and the version to show news for.
 * @param {{build: string, version: string}} running build id (version + build time) and version
 */
export function checkAfterStart({ build, version }, onboarded, ls = globalThis.localStorage) {
  const outcome = updateOutcome(read(ls, PENDING_KEY), build);
  write(ls, PENDING_KEY, null);
  const news = whatsNewFor(read(ls, LAST_VERSION_KEY), version, onboarded);
  write(ls, LAST_VERSION_KEY, version);
  return { outcome, news };
}

export const savePending = (p, ls = globalThis.localStorage) => write(ls, PENDING_KEY, p);
export const clearPending = (ls = globalThis.localStorage) => write(ls, PENDING_KEY, null);
