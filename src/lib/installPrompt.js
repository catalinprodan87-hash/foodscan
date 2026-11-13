/**
 * Captures `beforeinstallprompt` as early as possible (it can fire before
 * React mounts) and exposes it to the UI. Android / desktop Chromium only.
 */
let deferred = null;
let installed = false;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn({ canInstall: !!deferred, installed }));

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // show our own button instead of the mini-infobar
    deferred = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    emit();
  });
}

export function subscribeInstall(fn) {
  listeners.add(fn);
  fn({ canInstall: !!deferred, installed });
  return () => listeners.delete(fn);
}

/** Shows the browser's install dialog. @returns {Promise<boolean>} accepted */
export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  emit();
  e.prompt();
  const choice = await e.userChoice.catch(() => null);
  return choice?.outcome === 'accepted';
}
