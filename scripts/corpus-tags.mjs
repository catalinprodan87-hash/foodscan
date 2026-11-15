#!/usr/bin/env node
/**
 * Adds Open Food Facts' own allergen, traces and vegan / palm-oil analysis
 * tags to each corpus list (bench/corpus/ro-ingredients.jsonl), so the
 * allergen detection can be compared with them. Product API, one request
 * every 1.5 s, backing off when busy. Run by hand:  node scripts/corpus-tags.mjs
 * (NODE_USE_ENV_PROXY=1 where a proxy is used).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'bench', 'corpus', 'ro-ingredients.jsonl');
const UA = 'IngrediScan/2.5 (open-source ingredient checker; corpus tags)';
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
const header = JSON.parse(lines[0]);
const rows = lines.slice(1).map((l) => JSON.parse(l));

let done = 0;
for (const row of rows) {
  if (row.allergens) { done++; continue; }
  for (const wait of [0, 30000, 60000, 120000]) {
    if (wait) { console.log(`busy, waiting ${wait / 1000} s`); await sleep(wait); }
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${row.code}.json?fields=allergens_tags,traces_tags,ingredients_analysis_tags`, { headers: { 'User-Agent': UA } });
      if (res.status === 503 || res.status === 429) continue;
      if (!res.ok) { console.log(`${row.code}: HTTP ${res.status}`); break; }
      const p = (await res.json()).product || {};
      row.allergens = p.allergens_tags || [];
      row.traces = p.traces_tags || [];
      row.analysis = p.ingredients_analysis_tags || [];
      break;
    } catch (err) { console.log(`${row.code}: ${err.message}`); break; }
  }
  done++;
  if (done % 25 === 0) {
    console.log(`${done}/${rows.length}`);
    writeFileSync(file, [header, ...rows].map((r) => JSON.stringify(r)).join('\n') + '\n'); // save progress
  }
  await sleep(1500);
}
header._tags = new Date().toISOString().slice(0, 10);
writeFileSync(file, [header, ...rows].map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`tags for ${rows.filter((r) => r.allergens).length}/${rows.length} lists`);
