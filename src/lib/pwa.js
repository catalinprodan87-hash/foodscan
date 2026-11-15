/**
 * Service worker registration in "prompt" mode: when a new version is
 * deployed, `onNeedRefresh` fires and the app shows a "Reîncarcă" banner
 * instead of updating silently in the middle of a scan.
 *
 * v3.0: before the reload the expected version is stored (updateStatus.js);
 * if no new worker takes control within 15 s, the app says the update failed.
 */
import { registerSW } from 'virtual:pwa-register';
import { pendingUpdate, savePending, clearPending, UPDATE_TIMEOUT_MS } from './updateStatus.js';

/* global __BUILD_ID__ */
const RUNNING = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'; // version + build time

let updateSW = null;
let registration = null;
const listeners = new Set();
const failListeners = new Set();
let needRefresh = false;

export function startPwa() {
  if (updateSW || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefresh = true;
      listeners.forEach((fn) => fn(true));
    },
    onRegisteredSW(_url, reg) {
      registration = reg || null;
      // Look for a new version every hour while the app stays open.
      if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    },
  });
}

export function onNeedRefresh(fn) {
  listeners.add(fn);
  if (needRefresh) fn(true);
  return () => listeners.delete(fn);
}

/** Called when "Reîncarcă" did not lead to a new version within 15 s. */
export function onUpdateFailed(fn) {
  failListeners.add(fn);
  return () => failListeners.delete(fn);
}

/** The waiting worker's version (null if it does not answer within 1 s). */
function waitingVersion() {
  const sw = registration?.waiting;
  if (!sw) return Promise.resolve(null);
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 1000);
    ch.port1.onmessage = (e) => { clearTimeout(timer); resolve(typeof e.data === 'string' ? e.data : null); };
    sw.postMessage({ type: 'GET_VERSION' }, [ch.port2]);
  });
}

/** Activates the waiting service worker and reloads the page. */
export async function applyUpdate() {
  if (!updateSW) { window.location.reload(); return; }
  savePending(pendingUpdate(RUNNING, await waitingVersion()));
  // workbox-window reloads only for an update it found itself; one found by
  // the hourly check would activate without a reload, so reload on the switch.
  let done = false;
  const reload = () => { if (!done) { done = true; window.location.reload(); } };
  navigator.serviceWorker?.addEventListener('controllerchange', reload, { once: true });
  setTimeout(() => {
    if (done) return;
    clearPending();
    failListeners.forEach((fn) => fn());
  }, UPDATE_TIMEOUT_MS);
  updateSW(true);
}
