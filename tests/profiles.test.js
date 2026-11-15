import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeProfiles, activeAvoid, updateActive, addProfile, renameProfile, removeProfile, setActive, MAX_PROFILES,
} from '../src/lib/profiles.js';
import { defaultAvoidState } from '../src/data/avoidPresets.js';

describe('family profiles', () => {
  test('the list saved before v2.8 becomes the profile "Eu" (nothing lost)', () => {
    const legacy = { ...defaultAvoidState(), custom: [{ id: 'c1', terms: ['scorțișoară'], types: ['food'] }] };
    const s = sanitizeProfiles(null, legacy);
    assert.equal(s.profiles.length, 1);
    assert.equal(s.profiles[0].name, 'Eu');
    assert.deepEqual(activeAvoid(s).custom[0].terms, ['scorțișoară']);
    assert.equal(sanitizeProfiles(null, null, 'en').profiles[0].name, 'Me');
  });

  test('add, switch, edit the active list, rename, remove', () => {
    let s = sanitizeProfiles(null, null);
    s = addProfile(s, '  Copil  ');
    assert.equal(s.profiles.length, 2);
    assert.equal(s.profiles[1].name, 'Copil');
    assert.equal(s.active, s.profiles[1].id, 'a new profile becomes active');
    s = updateActive(s, { ...activeAvoid(s), allergens: ['milk'] });
    assert.deepEqual(activeAvoid(s).allergens, ['milk']);
    s = setActive(s, 'me');
    assert.deepEqual(activeAvoid(s).allergens, [], 'each profile has its own list');
    s = renameProfile(s, s.profiles[1].id, 'Ana');
    assert.equal(s.profiles[1].name, 'Ana');
    s = removeProfile(s, 'me');
    assert.equal(s.profiles.length, 1);
    assert.equal(s.active, s.profiles[0].id);
    assert.equal(removeProfile(s, s.active).profiles.length, 1, 'the last profile stays');
  });

  test('bad data is cleaned; at most 8 profiles', () => {
    const s = sanitizeProfiles({ profiles: [{ id: 'a', name: 'A', presets: { palm: 'yes' }, allergens: ['milk', 'nope'] }, { id: 'a', name: 'dup' }, null], active: 'zzz' });
    assert.equal(s.profiles.length, 2);
    assert.notEqual(s.profiles[1].id, 'a');
    assert.deepEqual(s.profiles[0].allergens, ['milk']);
    assert.equal(s.active, 'a');
    let many = sanitizeProfiles(null, null);
    for (let i = 0; i < 12; i++) many = addProfile(many, `P${i}`);
    assert.equal(many.profiles.length, MAX_PROFILES);
  });
});

describe('send the list by link', async () => {
  const { encodeList, decodeList, MAX_LINK_CHARS } = await import('../src/lib/shareList.js');
  const avoid = { ...defaultAvoidState(), custom: [{ id: 'c1', terms: ['scorțișoară', 'cinnamon'], types: ['food'] }], allergens: ['milk', 'nuts'] };

  test('round trip, compressed (fragment only, nothing for a server)', async () => {
    const hash = await encodeList('Copil', avoid);
    assert.match(hash, /^import=z[A-Za-z0-9_-]+$/);
    assert.ok(hash.length < MAX_LINK_CHARS);
    const back = await decodeList(`#${hash}`);
    assert.equal(back.name, 'Copil');
    assert.deepEqual(back.avoid.allergens, ['milk', 'nuts']);
    assert.deepEqual(back.avoid.custom[0].terms, ['scorțișoară', 'cinnamon']);
    assert.deepEqual(Object.keys(back.avoid.presets).filter((k) => back.avoid.presets[k]), Object.keys(avoid.presets).filter((k) => avoid.presets[k]));
  });

  test('works without compression too; not an import → null; damaged → error', async () => {
    const hash = await encodeList('Eu', avoid, { CompressionStreamImpl: null });
    assert.match(hash, /^import=j/);
    assert.equal((await decodeList(hash)).name, 'Eu');
    assert.equal(await decodeList('#something'), null);
    await assert.rejects(decodeList('#import=zAAAA'), /invalid/);
  });
});

describe('v2.8 presets and glossary', async () => {
  const { analyze } = await import('../src/lib/analyze.js');
  const { GLOSSARY } = await import('../src/data/glossary.js');
  const on = (id) => { const s = defaultAvoidState(); return { ...s, presets: { ...s.presets, [id]: true } }; };
  const hitIds = (text, avoid) => analyze({ text, productType: 'food' }, avoid).avoidHits.map((h) => h.id);

  test('Southampton colours: off by default; found by name or E-number', () => {
    const s = defaultAvoidState();
    assert.equal(s.presets.southampton, false);
    assert.equal(s.presets.caffeine, false);
    assert.ok(hitIds('zahăr, colorant: tartrazină', on('southampton')).includes('southampton'));
    assert.ok(hitIds('zahăr, coloranți (E129, E133)', on('southampton')).includes('southampton'));
    assert.ok(!hitIds('zahăr, colorant: E133', on('southampton')).includes('southampton'));
  });

  test('caffeine: cafeină and guarana', () => {
    assert.ok(hitIds('apă, zahăr, cafeină', on('caffeine')).includes('caffeine'));
    assert.ok(hitIds('water, guarana extract', on('caffeine')).includes('caffeine'));
    assert.ok(!hitIds('apă, zahăr', on('caffeine')).includes('caffeine'));
  });

  test('glossary: unique ids, both languages', () => {
    assert.equal(new Set(GLOSSARY.map((g) => g.id)).size, GLOSSARY.length);
    for (const g of GLOSSARY) for (const l of ['ro', 'en']) assert.ok(g.term[l] && g.text[l].length > 60, `${g.id} ${l}`);
  });
});
