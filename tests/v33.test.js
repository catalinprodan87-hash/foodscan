import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseIngredients, editedRecord, revertRecord, completeText, migrateSaved, SAVED_SCHEMA } from '../src/lib/ingredientText.js';
import { saveAutoBackup, getAutoBackup, removeAutoBackup } from '../src/lib/autoBackup.js';
import { mapProduct } from '../src/lib/lookup.js';

const dbRo = { ingredientsText: 'zahăr, lapte', ingredientsLang: 'ro' };
const dbEn = { ingredientsText: 'sugar, milk', ingredientsLang: 'en' };
const photo = { text: 'zahăr, lapte praf, E322', source: 'photo', explicit: false };

test('text choice: explicit edit > database Romanian > own text > database other language', () => {
  assert.deepEqual(chooseIngredients({ product: dbRo, saved: { ...photo, explicit: true } }), { text: photo.text, origin: 'edited', lang: null });
  assert.equal(chooseIngredients({ product: dbRo, saved: photo }).origin, 'database');
  assert.equal(chooseIngredients({ product: dbEn, saved: photo }).origin, 'user');
  assert.deepEqual(chooseIngredients({ product: dbEn }), { text: 'sugar, milk', origin: 'database', lang: 'en' });
  assert.equal(chooseIngredients({}).origin, 'none');
});

test('the lookup says which language the database text is in', () => {
  assert.equal(mapProduct({ ingredients_text_ro: 'zahăr', ingredients_text: 'sugar', lang: 'en' }, 'food', '1').ingredientsLang, 'ro');
  assert.equal(mapProduct({ ingredients_text: 'Zucker', lang: 'de' }, 'food', '1').ingredientsLang, 'de');
  assert.equal(mapProduct({ ingredients_text_en: 'sugar' }, 'food', '1').ingredientsLang, 'en');
  assert.equal(mapProduct({}, 'food', '1').ingredientsLang, null);
});

test('editing keeps the first original, so "back to the original" goes all the way back', () => {
  const now = new Date('2026-11-16T10:00:00Z');
  const r1 = editedRecord(null, { barcode: '594', text: 'zahăr, lapte, sare', currentText: 'zahăr, lapte', currentOrigin: 'database', productType: 'food', now });
  assert.deepEqual(r1.original, { text: 'zahăr, lapte', origin: 'database' });
  assert.equal(r1.explicit, true);
  assert.equal(r1.v, SAVED_SCHEMA);
  const r2 = editedRecord(r1, { barcode: '594', text: 'zahăr, lapte, sare, E330', currentText: r1.text, currentOrigin: 'edited', now });
  assert.deepEqual(r2.original, r1.original);
  assert.deepEqual(revertRecord(r2), { remove: true }); // the database's text applies again
  // Edited over an earlier photo: back to the photo text.
  const fromPhoto = editedRecord({ ...photo, barcode: '595' }, { barcode: '595', text: 'x, y', currentText: photo.text, currentOrigin: 'user', now });
  assert.deepEqual(fromPhoto.original, { text: photo.text, origin: 'photo' });
  const back = revertRecord(fromPhoto);
  assert.equal(back.record.text, photo.text);
  assert.equal(back.record.explicit, false);
  assert.equal(back.record.original, null);
});

test('"Completează": database text, then what the photo adds', () => {
  assert.equal(completeText('zahăr, lapte.', 'E322, arome'), 'zahăr, lapte, E322, arome');
  assert.equal(completeText('', 'sare'), 'sare');
  assert.equal(completeText('sare', ' '), 'sare');
});

test('migration: old remembered entries get the new fields, nothing is lost', () => {
  const old = { 594: { barcode: '594', text: 'zahăr', source: 'photo', date: '2026-01-01' }, bad: null };
  const { map, changed } = migrateSaved(old);
  assert.equal(changed, 1);
  assert.deepEqual(map['594'], { ...old['594'], v: SAVED_SCHEMA, explicit: false, original: null });
  assert.equal(map.bad, undefined);
  assert.equal(migrateSaved(map).changed, 0); // runs once
});

test('automatic backup is kept, read back and removed', () => {
  const store = new Map();
  const ls = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  assert.equal(saveAutoBackup({ format: 'ingrediscan-backup', version: 2 }, 'v3.3', ls, new Date('2026-11-16T09:00:00Z')), true);
  assert.equal(getAutoBackup(ls).reason, 'v3.3');
  removeAutoBackup(ls);
  assert.equal(getAutoBackup(ls), null);
  const full = { setItem: () => { throw new Error('quota'); } };
  assert.equal(saveAutoBackup({}, 'v3.3', full), false);
});
