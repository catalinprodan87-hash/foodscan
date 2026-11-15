import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateOutcome, pendingUpdate, whatsNewFor, checkAfterStart, PENDING_KEY, LAST_VERSION_KEY } from '../src/lib/updateStatus.js';
import { WHATS_NEW, shortVersion } from '../src/data/whatsNew.js';

const now = 1_000_000_000;

test('update outcome: the expected version is running → success; otherwise failed', () => {
  assert.equal(updateOutcome(pendingUpdate('2.9.0', '3.0.0', now), '3.0.0', now + 5000), 'success');
  assert.equal(updateOutcome(pendingUpdate('2.9.0', '3.0.0', now), '2.9.0', now + 5000), 'failed');
  // The waiting worker did not say its version: any change counts as success.
  assert.equal(updateOutcome(pendingUpdate('2.9.0', null, now), '3.0.0', now + 5000), 'success');
  assert.equal(updateOutcome(pendingUpdate('2.9.0', null, now), '2.9.0', now + 5000), 'failed');
});

test('no marker, a broken one or a stale one (app closed mid-update) → nothing to say', () => {
  assert.equal(updateOutcome(null, '3.0.0', now), null);
  assert.equal(updateOutcome('x', '3.0.0', now), null);
  assert.equal(updateOutcome({ to: '3.0.0' }, '3.0.0', now), null);
  assert.equal(updateOutcome(pendingUpdate('2.9.0', '3.0.0', now), '3.0.0', now + 11 * 60 * 1000), null);
});

test("what's new: once per version, not on a fresh install", () => {
  assert.equal(whatsNewFor(null, '3.0.0', true), '3.0.0'); // used v2.x (no record yet), now 3.0
  assert.equal(whatsNewFor('2.9.0', '3.0.0', true), '3.0.0');
  assert.equal(whatsNewFor('3.0.0', '3.0.0', true), null);
  assert.equal(whatsNewFor(null, '3.0.0', false), null);
  assert.equal(whatsNewFor(null, 'dev', true), null);
});

test('checkAfterStart reads and clears the marker, and remembers the version', () => {
  const store = new Map([[PENDING_KEY, JSON.stringify(pendingUpdate('2.9.0', '3.0.0'))], [LAST_VERSION_KEY, '"2.9.0"']]);
  const ls = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  assert.deepEqual(checkAfterStart({ build: '3.0.0', version: '3.0.0' }, true, ls), { outcome: 'success', news: '3.0.0' });
  assert.equal(store.has(PENDING_KEY), false);
  assert.deepEqual(checkAfterStart({ build: '3.0.0', version: '3.0.0' }, true, ls), { outcome: null, news: null });
  // A redeploy of the same version: the build id differs, so it is a change.
  store.set(PENDING_KEY, JSON.stringify(pendingUpdate('3.0.0+a', null)));
  assert.equal(checkAfterStart({ build: '3.0.0+b', version: '3.0.0' }, true, ls).outcome, 'success');
});

test("what's new: every entry in both languages; the current version has one", async () => {
  const { readFileSync } = await import('node:fs');
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  for (const [v, e] of Object.entries(WHATS_NEW)) {
    assert.match(v, /^\d+\.\d+\.\d+$/);
    assert.ok(e.ro.length && e.ro.length === e.en.length, v);
  }
  assert.ok(WHATS_NEW[version], `no "what's new" for ${version}`);
  assert.equal(shortVersion('3.0.0'), '3.0');
});
