import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBackup, parseBackup, historyToRestore, mergeSaved, clearLocalData, backupFileName,
  requestPersistence, storageStatus, BACKUP_VERSION,
} from '../src/lib/backup.js';
import { exportAvoidList } from '../src/lib/avoidList.js';
import { defaultAvoidState } from '../src/data/avoidPresets.js';
import { recordTiming, getTimings, buildReport, TIMINGS_MAX } from '../src/lib/diagnostics.js';
import { rotatedSize, fitSize } from '../src/lib/imagePrep.js';

const memory = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    _m: m,
  };
};
const entry = (id, date) => ({ id, date, text: 'apă', productType: 'food', verdict: 'ok' });

describe('backup', () => {
  test('round trip: build → JSON → parse', () => {
    const avoid = { ...defaultAvoidState(), custom: [{ id: 'c1', terms: ['scorțișoară'], types: ['food'] }] };
    const data = buildBackup({ history: [entry('b:1', '2026-11-01')], saved: { 1: { barcode: '1', text: 'sare', date: '2026-11-01' } }, avoid }, new Date('2026-11-15T10:00:00Z'));
    assert.equal(data.version, BACKUP_VERSION);
    const back = parseBackup(JSON.stringify(data));
    assert.equal(back.history.length, 1);
    assert.equal(back.saved['1'].text, 'sare');
    assert.deepEqual(back.avoid.custom[0].terms, ['scorțișoară']);
  });

  test('an avoid-list export restores only the list', () => {
    const r = parseBackup(exportAvoidList(defaultAvoidState()));
    assert.deepEqual(r.history, []);
    assert.deepEqual(r.saved, {});
    assert.ok(r.avoid.presets);
  });

  test('invalid, broken and newer files are refused; bad items skipped', () => {
    assert.throws(() => parseBackup('not json'), /invalid/);
    assert.throws(() => parseBackup('{"format":"other"}'), /invalid/);
    assert.throws(() => parseBackup(JSON.stringify({ format: 'ingrediscan-backup', version: BACKUP_VERSION + 1 })), /newer/);
    const r = parseBackup(JSON.stringify({ format: 'ingrediscan-backup', version: 1, history: [entry('a', 'x'), { junk: 1 }], saved: { x: { nope: 1 } } }));
    assert.equal(r.history.length, 1);
    assert.deepEqual(r.saved, {});
    assert.equal(r.avoid, null);
  });

  test('restore adds only new or newer history; saved: newer wins', () => {
    const current = [entry('a', '2026-11-05'), entry('b', '2026-11-01')];
    const incoming = [entry('a', '2026-11-01'), entry('b', '2026-11-03'), entry('c', '2026-10-01')];
    assert.deepEqual(historyToRestore(current, incoming).map((e) => e.id), ['b', 'c']);
    const merged = mergeSaved(
      { 1: { barcode: '1', text: 'new', date: '2026-11-10' }, 2: { barcode: '2', text: 'old', date: '2026-01-01' } },
      { 1: { barcode: '1', text: 'older', date: '2026-11-01' }, 2: { barcode: '2', text: 'newer', date: '2026-02-01' }, 3: { barcode: '3', text: 'x', date: '2026-01-01' } },
    );
    assert.equal(merged['1'].text, 'new');
    assert.equal(merged['2'].text, 'newer');
    assert.ok(merged['3']);
  });

  test('delete all: only this app’s keys are removed', () => {
    const ls = memory();
    ls.setItem('ingrediscan:history', '[]');
    ls.setItem('ingrediscan:savedIngredients', '{}');
    ls.setItem('ingrediscan:flag:onboarded', 'true');
    ls.setItem('other-app', 'keep');
    assert.equal(clearLocalData(ls), 3);
    assert.deepEqual([...ls._m.keys()], ['other-app']);
  });

  test('file name, and storage helpers without support', async () => {
    assert.equal(backupFileName(new Date('2026-11-15T10:00:00Z')), 'ingrediscan-backup-2026-11-15.json');
    assert.equal(await requestPersistence({}), null);
    assert.deepEqual(await storageStatus({}), { persisted: null, usage: null, quota: null });
    const nav = { storage: { persisted: async () => false, persist: async () => true, estimate: async () => ({ usage: 5, quota: 10 }) } };
    assert.equal(await requestPersistence(nav), true);
    assert.deepEqual(await storageStatus(nav), { persisted: false, usage: 5, quota: 10 });
  });
});

describe('diagnostics', () => {
  test('keeps only the last 20 timings', () => {
    const ls = memory();
    for (let i = 0; i < 25; i++) recordTiming('lookup', i, true, `n${i}`, { ls });
    const list = getTimings({ ls });
    assert.equal(list.length, TIMINGS_MAX);
    assert.equal(list[0].detail, 'n5');
    assert.equal(list.at(-1).ms, 24);
  });

  test('the report has version, device, timings and OCR text, and no image data', () => {
    const r = buildReport({
      version: '2.1.0', userAgent: 'TestPhone', lang: 'ro', screen: 'photo-review',
      timings: [{ phase: 'ocr', ms: 4200, ok: true, detail: 'crop', at: '2026-11-15T10:00:00.000Z' }],
      ocr: { confidence: 61, text: 'Ingrediente: zahar, apa' }, product: { name: 'Biscuiți', code: '5940000000007' },
    });
    for (const s of ['2.1.0', 'TestPhone', 'photo-review', 'ocr 4200 ms ok', 'Ingrediente: zahar', '5940000000007', 'Ce s-a întâmplat']) {
      assert.ok(r.includes(s), s);
    }
    assert.ok(!/data:image|base64/.test(r));
  });
});

describe('rotate', () => {
  test('odd quarter turns swap the sides; four turns give the original size back', () => {
    assert.deepEqual(rotatedSize(4000, 3000, 1), { width: 3000, height: 4000 });
    assert.deepEqual(rotatedSize(4000, 3000, 2), { width: 4000, height: 3000 });
    assert.deepEqual(rotatedSize(4000, 3000, -1), { width: 3000, height: 4000 });
    let size = fitSize(4000, 3000, 3000);
    for (let i = 0; i < 4; i++) size = { ...size, ...rotatedSize(size.width, size.height, 1) };
    assert.deepEqual([size.width, size.height], [3000, 2250]);
  });
});
