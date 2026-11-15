import { test } from 'node:test';
import assert from 'node:assert/strict';
import { takeShared, isShareLaunch, SHARE_PHOTO, SHARE_TEXT } from '../src/lib/shareTarget.js';

const fakeCaches = (entries) => {
  const store = new Map(Object.entries(entries));
  return { store, open: async () => ({ match: async (k) => store.get(k), delete: async (k) => store.delete(k) }) };
};

test('isShareLaunch reads ?share=1 only', () => {
  assert.equal(isShareLaunch('?share=1'), true);
  assert.equal(isShareLaunch('?share=0'), false);
  assert.equal(isShareLaunch(''), false);
});

test('a shared photo comes back as a File once, with its name and type', async () => {
  const c = fakeCaches({ [SHARE_PHOTO]: new Response(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), { headers: { 'x-file-name': encodeURIComponent('etichetă.png'), 'content-type': 'image/png' } }) });
  const got = await takeShared(c);
  assert.equal(got.file.name, 'etichetă.png');
  assert.equal(got.file.type, 'image/png');
  assert.equal(got.file.size, 3);
  assert.equal(await takeShared(c), null);
});

test('shared text is trimmed; empty text or nothing gives null', async () => {
  assert.deepEqual(await takeShared(fakeCaches({ [SHARE_TEXT]: new Response('  apă, zahăr \n') })), { text: 'apă, zahăr' });
  assert.equal(await takeShared(fakeCaches({ [SHARE_TEXT]: new Response('  ') })), null);
  assert.equal(await takeShared(fakeCaches({})), null);
  assert.equal(await takeShared(undefined), null);
});
