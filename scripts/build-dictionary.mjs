#!/usr/bin/env node
/**
 * Builds the on-device translation dictionaries (v3.6) from the Open Food
 * Facts ingredient and additive taxonomies (ODbL 1.0, © Open Food Facts
 * contributors): one file per source language, public/dict/{lang}.json,
 * mapping an ingredient name (accents removed, lower case) to its Romanian
 * name. Downloaded on the phone only when a label in that language is read.
 *
 *   node scripts/build-dictionary.mjs [taxonomy dir]
 *     the dir holds ingredients.json and additives.json from
 *     https://world.openfoodfacts.org/data/taxonomies/ (downloaded if missing)
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from '../src/lib/analyze.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.argv[2] || join(root, '.cache', 'taxonomies');
export const LANGS = ['en', 'fr', 'de', 'it', 'es', 'pt', 'nl', 'pl', 'hu', 'cs', 'sk', 'hr', 'sl', 'bg', 'el', 'ru', 'uk'];

async function load(name) {
  const file = join(dir, `${name}.json`);
  if (!existsSync(file)) {
    mkdirSync(dir, { recursive: true });
    const r = await fetch(`https://world.openfoodfacts.org/data/taxonomies/${name}.json`, { headers: { 'User-Agent': 'ingrediscan-build/1.0' } });
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    writeFileSync(file, await r.text());
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

const fold = (s) => normalize(String(s)).replace(/\s+/g, ' ').trim();
const ingredients = await load('ingredients');
const additives = await load('additives');
const out = Object.fromEntries(LANGS.map((l) => [l, {}]));
let entries = 0;
for (const v of Object.values(ingredients)) {
  const ro = v.name?.ro;
  if (!ro) continue;
  entries++;
  for (const l of LANGS) {
    const name = v.name[l];
    if (!name) continue;
    const key = fold(name);
    if (key.length < 2 || key === fold(ro)) continue;
    if (!out[l][key]) out[l][key] = ro.toLowerCase();
  }
}
// Additives: "E330 - Acid citric" → the Romanian name after the code (the code itself stays in the text).
for (const v of Object.values(additives)) {
  const ro = v.name?.ro?.replace(/^e\s?\d{3,4}[a-z]?\s*[-–:]\s*/i, '');
  if (!ro || /^e\s?\d/i.test(ro)) continue;
  for (const l of LANGS) {
    const name = v.name?.[l]?.replace(/^e\s?\d{3,4}[a-z]?\s*[-–:]\s*/i, '');
    if (!name) continue;
    const key = fold(name);
    if (key.length < 3 || key === fold(ro) || out[l][key]) continue;
    out[l][key] = ro.toLowerCase();
  }
}
const target = join(root, 'public', 'dict');
mkdirSync(target, { recursive: true });
let total = 0;
for (const l of LANGS) {
  const body = JSON.stringify({ lang: l, source: 'Open Food Facts taxonomies (ODbL 1.0)', terms: out[l] });
  writeFileSync(join(target, `${l}.json`), body);
  total += body.length;
  console.log(`${l}: ${Object.keys(out[l]).length} terms, ${(body.length / 1024).toFixed(0)} KB`);
}
console.log(`${entries} ingredients with a Romanian name; ${(total / 1024).toFixed(0)} KB in public/dict/`);
