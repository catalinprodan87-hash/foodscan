import { test } from 'node:test';
import assert from 'node:assert/strict';
import { takeShared, isShareLaunch, shareHintKind, sharePhotoKey, SHARE_TEXT } from '../src/lib/shareTarget.js';

const fakeCaches = (entries) => {
  const store = new Map(Object.entries(entries));
  return { store, open: async () => ({ match: async (k) => store.get(k), delete: async (k) => store.delete(k) }) };
};
const png = (n, name) => new Response(new Blob([new Uint8Array(n)], { type: 'image/png' }), { headers: { 'x-file-name': encodeURIComponent(name), 'content-type': 'image/png' } });

test('isShareLaunch reads ?share=1 only', () => {
  assert.equal(isShareLaunch('?share=1'), true);
  assert.equal(isShareLaunch('?share=0'), false);
  assert.equal(isShareLaunch(''), false);
});

test('shared photos come back as Files, in order, once', async () => {
  const c = fakeCaches({ [sharePhotoKey(0)]: png(3, 'etichetă.png'), [sharePhotoKey(1)]: png(5, 'spate.png') });
  const got = await takeShared(c);
  assert.deepEqual(got.files.map((f) => [f.name, f.type, f.size]), [['etichetă.png', 'image/png', 3], ['spate.png', 'image/png', 5]]);
  assert.equal(await takeShared(c), null);
});

test('shared text is trimmed; empty text or nothing gives null', async () => {
  assert.deepEqual(await takeShared(fakeCaches({ [SHARE_TEXT]: new Response('  apă, zahăr \n') })), { text: 'apă, zahăr' });
  assert.equal(await takeShared(fakeCaches({ [SHARE_TEXT]: new Response('  ') })), null);
  assert.equal(await takeShared(fakeCaches({})), null);
  assert.equal(await takeShared(undefined), null);
});

test('share hint: iPhone not supported, Android tab → install, installed → reinstall note, desktop → nothing', () => {
  assert.equal(shareHintKind({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }), 'ios');
  assert.equal(shareHintKind({ ua: 'Mozilla/5.0 (Linux; Android 14; SM-A546B) SamsungBrowser/27.0' }), 'browser');
  assert.equal(shareHintKind({ ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/140', standalone: true }), 'android');
  assert.equal(shareHintKind({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140' }), null);
});
