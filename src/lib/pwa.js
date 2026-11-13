/**
 * Service worker registration in "prompt" mode: when a new version is
 * deployed, `onNeedRefresh` fires and the app shows a "Reîncarcă" banner
 * instead of updating silently in the middle of a scan.
 */
import { registerSW } from 'virtual:pwa-register';

let updateSW = null;
const listeners = new Set();
let needRefresh = false;

export function startPwa() {
  if (updateSW || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefresh = true;
      listeners.forEach((fn) => fn(true));
    },
    onRegisteredSW(_url, registration) {
      // Look for a new version every hour while the app stays open.
      if (registration) setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    },
  });
}

export function onNeedRefresh(fn) {
  listeners.add(fn);
  if (needRefresh) fn(true);
  return () => listeners.delete(fn);
}

/** Activates the waiting service worker and reloads the page. */
export function applyUpdate() {
  if (updateSW) updateSW(true);
  else window.location.reload();
}
