#!/usr/bin/env node
/**
 * OCR benchmark: runs the app's real OCR path (PaddleOCR in a Web Worker, in
 * Chromium) on every image in truth.json, whole photo and ingredients crop.
 *
 *   npm run bench:ocr                       run, compare with baseline.json
 *   npm run bench:ocr -- --update-baseline  run and store as the new baseline
 *   npm run bench:ocr -- --only=tomato      one label
 *
 * Reports per image: CER (character error rate of the extracted ingredients
 * text vs. the truth, after normalisation), key-word recall and time. Fails
 * (exit 1) if the average recall of any group drops > 2 points below the
 * baseline. Timings are from this machine, not a phone.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, root } from '../lib/server.mjs';
import { normalize } from '../../src/lib/analyze.js';
import { levenshtein } from '../../src/lib/ocrText.js';

const here = join(root, 'bench', 'ocr');
const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--only='))?.slice(7);
const updateBaseline = args.includes('--update-baseline');
const MAX_RECALL_DROP = 2; // percentage points

const truth = JSON.parse(readFileSync(join(here, 'truth.json'), 'utf8'));
const norm = (s) => normalize(String(s || '')).replace(/\s+/g, ' ').trim();

export function scoreText(text, label) {
  const t = norm(text);
  const ref = norm(label.truth);
  const cer = Math.min(1, levenshtein(t, ref) / Math.max(1, ref.length));
  const found = label.terms.filter((term) => t.includes(norm(term)));
  return { cer: Math.round(cer * 1000) / 1000, recall: found.length / label.terms.length, missing: label.terms.filter((x) => !found.includes(x)) };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

const server = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`${server.url}bench/ocr/harness.html`);
await page.waitForFunction(() => window.benchReady);

const names = Object.keys(truth).filter((n) => !only || n === only);
// Warm-up: engine download from the dev server + model initialisation.
const first = truth[names[0]].images.flat;
await page.evaluate(([u]) => window.readImage(u, null), [`${server.url}bench/ocr/${first.file}`]);

const rows = [];
for (const name of names) {
  const label = truth[name];
  for (const [variant, img] of Object.entries(label.images)) {
    for (const scen of ['whole', 'crop']) {
      const r = await page.evaluate(([u, c]) => window.readImage(u, c), [`${server.url}bench/ocr/${img.file}`, scen === 'crop' ? img.crop : null]);
      const s = scoreText(r.text, label);
      rows.push({ name, variant, scen, ...s, ms: r.ms, confidence: r.confidence, foundStart: r.foundStart, text: r.text });
      console.log(
        `${name.padEnd(10)} ${variant.padEnd(5)} ${scen.padEnd(5)} recall ${String(Math.round(s.recall * 100)).padStart(3)}%  CER ${s.cer.toFixed(3)}  ${String(r.ms).padStart(6)} ms  conf ${r.confidence}`
        + (s.missing.length ? `  missing: ${s.missing.join(', ')}` : ''),
      );
    }
  }
}
await browser.close();
await server.close();

const groups = {};
for (const r of rows) (groups[`${r.variant}/${r.scen}`] ||= []).push(r);
const summary = {};
for (const [g, rs] of Object.entries(groups)) {
  summary[g] = {
    images: rs.length,
    recall: Math.round((rs.reduce((n, r) => n + r.recall, 0) / rs.length) * 1000) / 10,
    cer: Math.round((rs.reduce((n, r) => n + r.cer, 0) / rs.length) * 1000) / 1000,
    medianMs: median(rs.map((r) => r.ms)),
  };
}
console.log('\nGroup        images  recall   CER    median');
for (const [g, s] of Object.entries(summary)) {
  console.log(`${g.padEnd(12)} ${String(s.images).padStart(6)}  ${String(s.recall).padStart(5)}%  ${s.cer.toFixed(3)}  ${s.medianMs} ms`);
}

const result = { date: new Date().toISOString(), only: only || null, summary, rows };
mkdirSync(join(root, 'bench', 'results'), { recursive: true });
const out = join(root, 'bench', 'results', `ocr-${result.date.slice(0, 19).replace(/[:T]/g, '-')}.json`);
writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`);
console.log(`\nResults: ${out}`);

const baselinePath = join(here, 'baseline.json');
if (updateBaseline) {
  if (only) throw new Error('--update-baseline needs a full run (no --only)');
  writeFileSync(baselinePath, `${JSON.stringify({ date: result.date, summary }, null, 1)}\n`);
  console.log('Baseline updated.');
} else if (existsSync(baselinePath) && !only) {
  const base = JSON.parse(readFileSync(baselinePath, 'utf8')).summary;
  const drops = Object.entries(base)
    .filter(([g, b]) => summary[g] && summary[g].recall < b.recall - MAX_RECALL_DROP)
    .map(([g, b]) => `${g}: ${summary[g].recall}% (baseline ${b.recall}%)`);
  if (drops.length) {
    console.error(`\nRecall dropped more than ${MAX_RECALL_DROP} points:\n  ${drops.join('\n  ')}`);
    process.exit(1);
  }
  console.log('Recall within baseline.');
}
