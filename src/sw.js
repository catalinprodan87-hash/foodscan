/*
 * Service worker (vite-plugin-pwa "injectManifest"). Same behaviour as the
 * generated one before v2.9 – precache the app, update on "Reîncarcă",
 * OCR engine cache-first, product lookups network-first – plus the Web Share
 * Target: a photo (or text) shared from another app is POSTed to
 * ./share-target, kept in Cache Storage and the app opens with ?share=1.
 */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import { SHARE_CACHE, SHARE_TEXT, SHARE_MAX_FILES, sharePhotoKey } from './lib/shareTarget.js';

/* global __BUILD_ID__ */
const VERSION = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

// "Reîncarcă" in the update banner (registerSW → updateSW(true)); the app asks the
// waiting worker its version first, to say afterwards whether the update worked.
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'GET_VERSION') e.ports?.[0]?.postMessage(VERSION);
});
clientsClaim(); // the first install controls the page at once (OCR caching)

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Self-hosted OCR engine + language data: download once, then offline.
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/ocr/') && !url.pathname.endsWith('manifest.json'),
  new CacheFirst({
    cacheName: 'ocr-engine',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 90 * 24 * 60 * 60 }), new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);

// Translation dictionaries (v3.6): downloaded the first time a label in that language is read.
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/dict/') && url.pathname.endsWith('.json'),
  new CacheFirst({ cacheName: 'dictionaries', plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 180 * 24 * 60 * 60 }), new CacheableResponsePlugin({ statuses: [200] })] }),
);

// Product lookups: fresh data when online, last known answer when offline.
registerRoute(
  /^https:\/\/world\.open(food|beauty|products)facts\.org\/api\/v2\/product\//,
  new NetworkFirst({
    cacheName: 'openfacts-api',
    plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 14 * 24 * 60 * 60 }), new CacheableResponsePlugin({ statuses: [200] })],
  }),
);

// ───── Web Share Target (manifest share_target, POST multipart) ─────
const SHARE_PATH = new URL('share-target', self.registration.scope).pathname;

async function receiveShare(request) {
  const back = new URL('./?share=1', self.registration.scope).href;
  try {
    const form = await request.formData();
    // A fresh cache: nothing left over from an earlier share.
    await caches.delete(SHARE_CACHE);
    const cache = await caches.open(SHARE_CACHE);
    const files = form.getAll('photo').filter((f) => f && typeof f === 'object' && /^image\//.test(f.type)).slice(0, SHARE_MAX_FILES);
    if (files.length) {
      await Promise.all(files.map((f, i) => cache.put(sharePhotoKey(i), new Response(f, {
        headers: { 'content-type': f.type, 'x-file-name': encodeURIComponent(f.name || `photo-${i + 1}.jpg`) },
      }))));
    } else {
      const text = [form.get('text'), form.get('title')].filter((x) => typeof x === 'string' && x.trim()).join('\n');
      if (text) await cache.put(SHARE_TEXT, new Response(text.slice(0, 20000), { headers: { 'content-type': 'text/plain;charset=utf-8' } }));
    }
  } catch { /* the app says nothing arrived */ }
  return Response.redirect(back, 303);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'POST') return;
  if (new URL(request.url).pathname !== SHARE_PATH) return;
  event.respondWith(receiveShare(request));
});
