#!/usr/bin/env node
/**
 * Builds bench/corpus/ro-ingredients.jsonl: Romanian ingredient lists from
 * Open Food Facts (products sold in Romania with a Romanian ingredients text).
 * Run by hand, not in CI:  node scripts/build-corpus.mjs [pages=20] [--from=N]
 *
 * Polite use of the API: one search request every 10 s (the search API allows
 * about 10 a minute), backing off when the server is busy, a descriptive
 * User-Agent, and only the fields needed. Node needs the proxy settings of
 * the environment: NODE_USE_ENV_PROXY=1 where a proxy is used.
 *
 * Licence: Open Food Facts data is under the Open Database Licence (ODbL 1.0);
 * the first line of the output says so, with the source and date.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'bench', 'corpus', 'ro-ingredients.jsonl');
const pages = Number(process.argv[2] || 20);
const from = Number(process.argv.find((a) => a.startsWith('--from='))?.slice(7) || 1); // continue an earlier run (adds to the file)
const PAGE_SIZE = 100;
const WAIT_MS = 10000;
const RETRIES = [30000, 60000, 120000, 240000]; // server busy (503 / 429): wait longer, then try again
const UA = 'IngrediScan/2.4 (open-source ingredient checker; corpus builder)';

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
/** Romanian cedilla letters (ş ţ) → comma-below (ș ț), the correct spelling. */
export const fixCedilla = (s) => s.replace(/ş/g, 'ș').replace(/Ş/g, 'Ș').replace(/ţ/g, 'ț').replace(/Ţ/g, 'Ț');

const seen = new Set();
const rows = [];
if (from > 1 && existsSync(out)) {
  for (const line of readFileSync(out, 'utf8').split('\n').slice(1)) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    seen.add(r.text);
    rows.push(r);
  }
  console.log(`continuing from page ${from} with ${rows.length} lists`);
}
for (let page = from; page <= pages; page++) {
  const url = `https://world.openfoodfacts.org/api/v2/search?countries_tags_en=romania&fields=code,ingredients_text_ro&page_size=${PAGE_SIZE}&page=${page}`;
  let data = null;
  for (let attempt = 0; attempt <= RETRIES.length && !data; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (res.status === 503 || res.status === 429) throw Object.assign(new Error(`HTTP ${res.status}`), { busy: true });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      if (!err.busy || attempt === RETRIES.length) { console.error(`page ${page}: ${err.message} – stopping`); break; }
      console.log(`page ${page}: server busy, waiting ${RETRIES[attempt] / 1000} s`);
      await sleep(RETRIES[attempt]);
    }
  }
  if (!data) break;
  let added = 0;
  for (const p of data.products || []) {
    const text = fixCedilla(String(p.ingredients_text_ro || '').replace(/\s+/g, ' ').trim());
    if (text.length < 20 || !text.includes(',') || seen.has(text)) continue;
    seen.add(text);
    rows.push({ code: p.code, text });
    added++;
  }
  console.log(`page ${page}/${pages}: +${added} (total ${rows.length})`);
  if (!data.products?.length) break;
  if (page < pages) await sleep(WAIT_MS);
}

mkdirSync(dirname(out), { recursive: true });
const header = {
  _source: 'Open Food Facts – https://world.openfoodfacts.org (products sold in Romania, Romanian ingredients text)',
  _licence: 'Open Database Licence (ODbL 1.0) – https://opendatacommons.org/licenses/odbl/1-0/ ; individual contents: DbCL 1.0',
  _built: new Date().toISOString().slice(0, 10),
  _count: rows.length,
};
writeFileSync(out, [header, ...rows].map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`${rows.length} ingredient lists → ${out}`);
