#!/usr/bin/env node
/**
 * Barcode benchmark: the app's photo decoder on the 24 hard images in
 * truth.json. Reports reads, misses, MISREADS (a wrong code – the worst
 * outcome) and time. Fails if reads drop below, or misreads rise above, the
 * baseline.
 *   npm run bench:barcodes                       compare with baseline.json
 *   npm run bench:barcodes -- --update-baseline  store a new baseline
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, root } from '../lib/server.mjs';

const here = join(root, 'bench', 'barcode');
const updateBaseline = process.argv.includes('--update-baseline');
const truth = JSON.parse(readFileSync(join(here, 'truth.json'), 'utf8'));

const server = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`${server.url}bench/barcode/harness.html`);
await page.waitForFunction(() => window.benchReady);
const native = await page.evaluate(() => window.hasNativeDetector);
console.log(`Decoder: ${native ? 'native BarcodeDetector + ZXing' : 'ZXing-C++ (no native BarcodeDetector in this browser)'}\n`);

const rows = [];
for (const [file, code] of Object.entries(truth)) {
  const r = await page.evaluate((u) => window.decode(u), `${server.url}bench/barcode/${file}`);
  const outcome = r.code === code ? 'read' : r.code ? 'MISREAD' : 'miss';
  rows.push({ file, expected: code, got: r.code, outcome, ms: r.ms });
  console.log(`${file.replace('images/', '').padEnd(26)} ${outcome.padEnd(8)} ${String(r.ms).padStart(6)} ms${outcome === 'MISREAD' ? `  got ${r.code}, expected ${code}` : ''}`);
}
await browser.close();
await server.close();

const count = (o) => rows.filter((r) => r.outcome === o).length;
const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
const summary = { images: rows.length, reads: count('read'), misses: count('miss'), misreads: count('MISREAD'), medianMs: ms[Math.floor(ms.length / 2)], native };
console.log(`\n${summary.reads}/${summary.images} read · ${summary.misses} missed · ${summary.misreads} misread · median ${summary.medianMs} ms`);

const date = new Date().toISOString();
mkdirSync(join(root, 'bench', 'results'), { recursive: true });
const out = join(root, 'bench', 'results', `barcode-${date.slice(0, 19).replace(/[:T]/g, '-')}.json`);
writeFileSync(out, `${JSON.stringify({ date, summary, rows }, null, 1)}\n`);
console.log(`Results: ${out}`);

const baselinePath = join(here, 'baseline.json');
if (updateBaseline) {
  writeFileSync(baselinePath, `${JSON.stringify({ date, summary }, null, 1)}\n`);
  console.log('Baseline updated.');
} else if (existsSync(baselinePath)) {
  const base = JSON.parse(readFileSync(baselinePath, 'utf8')).summary;
  const problems = [];
  if (summary.reads < base.reads) problems.push(`reads ${summary.reads} < baseline ${base.reads}`);
  if (summary.misreads > base.misreads) problems.push(`misreads ${summary.misreads} > baseline ${base.misreads}`);
  if (problems.length) {
    console.error(`\nWorse than baseline: ${problems.join('; ')}`);
    process.exit(1);
  }
  console.log('Within baseline.');
}
