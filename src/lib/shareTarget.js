/**
 * Photos / text shared into the installed app (Web Share Target, v2.9).
 * The service worker keeps the shared item in Cache Storage under these keys
 * and opens the app at ./?share=1; takeShared() reads it once and removes it.
 */
export const SHARE_CACHE = 'ingrediscan-share';
export const SHARE_PHOTO = '/__share/photo';
export const SHARE_TEXT = '/__share/text';

/** True when the app was opened by a share. */
export const isShareLaunch = (search = globalThis.location?.search || '') => new URLSearchParams(search).get('share') === '1';

/**
 * @returns {Promise<{file?: File, text?: string}|null>} what was shared, or null
 */
export async function takeShared(cachesImpl = globalThis.caches) {
  if (!cachesImpl) return null;
  try {
    const cache = await cachesImpl.open(SHARE_CACHE);
    const photo = await cache.match(SHARE_PHOTO);
    const text = await cache.match(SHARE_TEXT);
    await cache.delete(SHARE_PHOTO);
    await cache.delete(SHARE_TEXT);
    if (photo) {
      const blob = await photo.blob();
      const name = decodeURIComponent(photo.headers.get('x-file-name') || 'photo.jpg');
      return { file: new File([blob], name, { type: blob.type || photo.headers.get('content-type') || 'image/jpeg' }) };
    }
    if (text) {
      const value = (await text.text()).trim();
      return value ? { text: value } : null;
    }
  } catch { /* storage unavailable */ }
  return null;
}
