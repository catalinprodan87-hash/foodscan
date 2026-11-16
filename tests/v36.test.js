import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectLanguage } from '../src/lib/langDetect.js';
import { translateIngredients, correctWord } from '../src/lib/translate.js';
import { loadDictionary, DICT_LANGS } from '../src/lib/dictionary.js';
import { analyze } from '../src/lib/analyze.js';

const dict = (l) => JSON.parse(readFileSync(new URL(`../public/dict/${l}.json`, import.meta.url)));

test('language of real ingredient lists (corpus transcripts)', () => {
  const own = JSON.parse(readFileSync(new URL('./corpus/own/truth.json', import.meta.url)));
  const off = JSON.parse(readFileSync(new URL('./corpus/off/truth.json', import.meta.url)));
  let right = 0;
  let total = 0;
  for (const p of [...own.photos, ...off.photos]) {
    for (const b of p.blocks.filter((x) => x.kind === 'ingredients' && x.text.length > 60 && ['ro', 'en', 'fr', 'de', 'it', 'pl', 'hu', 'bg', 'cs', 'sk', 'hr'].includes(x.lang))) {
      total++;
      if (detectLanguage(b.text).lang === b.lang) right++;
    }
  }
  assert.ok(right / total >= 0.9, `${right}/${total}`);
  assert.equal(detectLanguage('E330').lang, null);
});

test('German, Hungarian and Bulgarian lists into Romanian; codes and percentages kept; capitals kept', () => {
  const de = translateIngredients('Zutaten: Zucker, Palmöl, HASELNÜSSE (13 %), MAGERMILCHPULVER (8,7 %), fettarmer Kakao (7,4 %), Emulgator Lecithine (SOJA), Vanillin, E330.', dict('de'));
  assert.equal(de.text, 'Ingrediente: zahăr, ulei de palmier, ALUNE DE PĂDURE (13 %), LAPTE PRAF DEGRESAT (8,7 %), cacao cu conținut redus de grăsime (7,4 %), emulsifiant lecitine (SOIA), vanilină, E330.');
  assert.deepEqual(de.unknown, []);
  const hu = translateIngredients('kakaómassza, cukor, pálmaolaj, MOGYORÓ (10%), kakaóvaj', dict('hu'));
  assert.equal(hu.text, 'masă de cacao, zahăr, ulei de palmier, ALUNE DE PĂDURE (10%), unt de cacao');
  const bg = translateIngredients('какаова маса, захар, палмово масло', dict('bg'));
  assert.equal(bg.text, 'masă de cacao, zahăr, ulei de palmier');
});

test('unknown words stay as they are and are listed; short real words are not "corrected" into others', () => {
  const r = translateIngredients('basilic frais 30%, Parmigiano Reggiano', dict('fr'));
  assert.ok(r.unknown.includes('frais'));
  assert.ok(r.text.startsWith('busuioc frais 30%'));
  assert.equal(correctWord('frais', dict('fr').terms), null);
  // A long word misread by one letter is corrected ("Haselnuse" → hazelnut).
  assert.ok(translateIngredients('Haselnusse', dict('de')).text.toLowerCase().includes('alune'));
});

test('the analysis of a translated list finds allergens and avoid-list items', () => {
  const de = translateIngredients('Zucker, Palmöl, HASELNÜSSE, MAGERMILCHPULVER, Emulgator Lecithine (SOJA)', dict('de'));
  const r = analyze({ text: `${de.text}\n${'Zucker, Palmöl, HASELNÜSSE, MAGERMILCHPULVER, Emulgator Lecithine (SOJA)'}`, productType: 'food' });
  const ids = r.allergens.contains.map((a) => a.id);
  for (const a of ['nuts', 'milk', 'soy']) assert.ok(ids.includes(a), a);
  assert.ok(r.avoidHits.some((h) => h.id === 'palm'));
});

test('dictionaries load once per language; unknown languages and failures give null', async () => {
  let calls = 0;
  const fetchImpl = async (url) => { calls++; return { ok: url.endsWith('/de.json'), json: async () => ({ terms: { zucker: 'zahăr' } }) }; };
  assert.deepEqual(await loadDictionary('de', { baseUrl: 'https://x/app/', fetchImpl }), { terms: { zucker: 'zahăr' } });
  await loadDictionary('de', { baseUrl: 'https://x/app/', fetchImpl });
  assert.equal(calls, 1);
  assert.equal(await loadDictionary('xx', { baseUrl: 'https://x/', fetchImpl }), null);
  assert.equal(await loadDictionary('fr', { baseUrl: 'https://x/', fetchImpl }), null);
  assert.ok(DICT_LANGS.every((l) => dict(l).terms));
});
