#!/usr/bin/env node
/**
 * Builds tests/fixtures/score-golden.json (v3.8): about 30 products with
 * complete data from Open Food Facts / Open Beauty Facts / Open Products
 * Facts (ODbL), used to calibrate the overall score and lock it in a golden
 * test. Run: NODE_USE_ENV_PROXY=1 node scripts/build-score-golden.mjs
 * Then: node scripts/build-score-golden.mjs --expect   (writes the scores)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { scoreProduct } from '../tests/scoreGoldenPipeline.js';

const OUT = 'tests/fixtures/score-golden.json';
const FIELDS = 'code,product_name,product_name_ro,brands,quantity,product_type,lang,ingredients_text_ro,ingredients_text,ingredients_text_en,additives_tags,nova_group,nutriscore_grade,nutriments,categories_tags,origins,manufacturing_places,labels_tags,emb_codes_tags,allergens_tags,traces_tags,ingredients_analysis_tags';
const FOOD = [
  ['5942219115845', 'water'], ['7613035833272', 'water'],
  ['3560070910366', 'oil'], ['4056489973010', 'oil'],
  ['8076800195057', 'pasta'], ['3560070614202', 'oats'], ['4056489195917', 'oats'], ['7300400117975', 'crispbread'],
  ['4056489021445', 'dairy'], ['7622210590473', 'dairy'], ['4056489849742', 'butter'], ['4056489192923', 'cheese-pdo'],
  ['4335619014459', 'nuts'], ['4056489068198', 'tofu'], ['4056489254676', 'fish'],
  ['8076809513692', 'sauce'], ['87157635', 'ketchup'], ['8076809513746', 'pesto'],
  ['80176800', 'spread'], ['80052760', 'sweets'], ['5410126716016', 'biscuits'], ['4014400400007', 'sweets'], ['8410376059366', 'biscuits'],
  ['5053990101573', 'crisps'], ['5410041435702', 'crackers'],
  ['5449000000996', 'soft-drink'], ['5449000131805', 'soft-drink'], ['5449000004840', 'soft-drink'], ['5999884034469', 'energy-drink'],
];
const UA = { 'User-Agent': 'IngrediScan-dev/1.0 (score calibration)' };

async function get(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.ok) return r.json();
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw new Error(`failed: ${url}`);
}

const keep = (p, type, group) => ({
  group, type,
  raw: Object.fromEntries(FIELDS.split(',').filter((k) => p[k] != null && p[k] !== '').map((k) => [k, p[k]])),
});

if (process.argv.includes('--expect')) {
  const data = JSON.parse(readFileSync(OUT, 'utf8'));
  for (const item of data.products) item.expected = scoreProduct(item);
  writeFileSync(OUT, `${JSON.stringify(data, null, 1)}\n`);
  for (const x of data.products) console.log(String(x.expected.general).padStart(4), x.expected.confidence.padEnd(7), x.group.padEnd(14), x.raw.product_name);
  process.exit(0);
}

const products = [];
for (const [code, group] of FOOD) {
  const j = await get(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`);
  if (j.product) products.push(keep({ code, ...j.product }, 'food', group));
}
for (const [host, type, group, terms] of [
  ['world.openbeautyfacts.org', 'cosmetic', 'cosmetic', ''],
  ['world.openproductsfacts.org', 'household', 'household', ''],
]) {
  const j = await get(`https://${host}/api/v2/search?countries_tags_en=romania&fields=${FIELDS}&page_size=60${terms}`);
  const good = (j.products || []).filter((p) => (p.ingredients_text || '').split(',').length >= 4 && p.product_name).slice(0, 3);
  for (const p of good) products.push(keep(p, type, group));
}
writeFileSync(OUT, `${JSON.stringify({
  _about: 'Products from Open Food Facts, Open Beauty Facts and Open Products Facts (ODbL 1.0, https://opendatacommons.org/licenses/odbl/1-0/), fetched for the v3.8 score calibration. Data only, no photos.',
  fetched: new Date().toISOString().slice(0, 10),
  products,
}, null, 1)}\n`);
console.log(`${products.length} products`);
