/**
 * Photos / text shared into the installed app (Web Share Target, v2.9;
 * several photos at once since v3.0). The service worker keeps the shared
 * items in Cache Storage under these keys and opens the app at ./?share=1;
 * takeShared() reads them once and removes them.
 */
export const SHARE_CACHE = 'ingrediscan-share';
export const SHARE_TEXT = '/__share/text';
export const SHARE_MAX_FILES = 10; // more are ignored (the photo flow merges up to 3)
export const sharePhotoKey = (i) => `/__share/photo/${i}`;

/** True when the app was opened by a share. */
export const isShareLaunch = (search = globalThis.location?.search || '') => new URLSearchParams(search).get('share') === '1';

async function toFile(res, i) {
  const blob = await res.blob();
  const name = decodeURIComponent(res.headers.get('x-file-name') || `photo-${i + 1}.jpg`);
  return new File([blob], name, { type: blob.type || res.headers.get('content-type') || 'image/jpeg' });
}

/**
 * @returns {Promise<{files?: File[], text?: string}|null>} what was shared, or null
 */
export async function takeShared(cachesImpl = globalThis.caches) {
  if (!cachesImpl) return null;
  try {
    const cache = await cachesImpl.open(SHARE_CACHE);
    const files = [];
    for (let i = 0; i < SHARE_MAX_FILES; i++) {
      const res = await cache.match(sharePhotoKey(i));
      if (!res) break;
      files.push(await toFile(res, i));
      await cache.delete(sharePhotoKey(i));
    }
    const text = await cache.match(SHARE_TEXT);
    await cache.delete(SHARE_TEXT);
    if (files.length) return { files };
    if (text) {
      const value = (await text.text()).trim();
      return value ? { text: value } : null;
    }
  } catch { /* storage unavailable */ }
  return null;
}

/**
 * Where to tell the user about sharing into the app:
 *   'ios'      – iPhone / iPad: not supported (Safari has no Web Share Target)
 *   'browser'  – Android, but running in a browser tab: install the app first
 *   'android'  – installed on Android: if it is missing from the share sheet, reinstall
 *   null       – desktop: nothing to say
 */
export function shareHintKind({ ua = globalThis.navigator?.userAgent || '', standalone = false } = {}) {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua))) return 'ios';
  if (/Android/i.test(ua)) return standalone ? 'android' : 'browser';
  return null;
}
