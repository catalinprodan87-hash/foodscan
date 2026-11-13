/** Install / platform detection. Pure functions with injectable globals. */

/** iPhone / iPad (iPadOS reports itself as a Mac with touch). */
export function isIos(nav = globalThis.navigator) {
  const ua = nav?.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return /Macintosh/i.test(ua) && (nav?.maxTouchPoints || 0) > 1;
}

/** Running as an installed app (home-screen icon). */
export function isStandalone(win = globalThis.window) {
  try {
    if (win?.matchMedia?.('(display-mode: standalone)').matches) return true;
  } catch { /* ignore */ }
  return win?.navigator?.standalone === true;
}

/**
 * What install help to show: 'prompt' (Android/desktop button), 'ios' (Share →
 * Add to Home Screen hint), or null (installed, dismissed, or not possible).
 */
export function installMode({ standalone, ios, hasPrompt, iosHintDismissed }) {
  if (standalone) return null;
  if (hasPrompt) return 'prompt';
  if (ios && !iosHintDismissed) return 'ios';
  return null;
}
