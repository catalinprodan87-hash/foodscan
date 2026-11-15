#!/usr/bin/env node
/**
 * Real-photo benchmark: phone photos of real labels (tests/corpus/*), read by
 * the app's own steps in Chromium, scored against hand-made transcripts.
 *
 *   npm run bench:real                          all photos
 *   npm run bench:real -- --only=ro-06          photos whose name starts with this
 *   npm run bench:real -- --throttle=4          CPU slowed down 4× (rough mid-range phone)
 *   npm run bench:real -- --det=2560            detector input long side (default 1920)
 *   npm run bench:real -- --update-baseline     store the result as bench/real/baseline.json
 *
 * Per text block: character and word error rate, strict (diacritics count)
 * and folded (as the analysis sees it, see score.js); nutrition tables: row
 * names and values found. Plus what the app does by itself (crop suggestion
 * + reading step) on each photo's ingredients, and time per photo.
 * Writes bench/results/real.json and bench/results/real.md.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, root } from '../lib/server.mjs';
import { scoreProse, scoreTable, rate } from './score.js';
import { mergeOcrTexts, extractIngredients } from '../../src/lib/ocrText.js';
import { correctWords } from '../../src/lib/lexicon.js';

const args = process.argv.slice(2);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const only = opt('only');
const throttle = Number(opt('throttle') || 1);
const detMaxSide = opt('det') ? Number(opt('det')) : undefined;
const updateBaseline = args.includes('--update-baseline');

// Every corpus folder with a truth.json (own photos; later Open Food Facts photos).
const corpusRoot = join(root, 'tests', 'corpus');
const corpora = readdirSync(corpusRoot).filter((d) => existsSync(join(corpusRoot, d, 'truth.json')));
const photos = [];
const pairs = [];
for (const dir of corpora) {
  const t = JSON.parse(readFileSync(join(corpusRoot, dir, 'truth.json'), 'utf8'));
  for (const p of t.photos) if (!only || p.file.startsWith(only)) photos.push({ ...p, dir });
  for (const p of t.pairs || []) if (!only) pairs.push({ ...p, dir });
}

const server = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`${server.url}bench/real/harness.html`);
await page.waitForFunction(() => window.benchReady);
if (throttle > 1) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
}
const url = (p) => `${server.url}tests/corpus/${p.dir}/${p.file}`;
// Warm-up: engine download from the dev server and model start-up (not timed).
await page.evaluate((u) => window.readAll(u), url(photos[0]));

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
const rows = [];
for (const p of photos) {
  const all = await page.evaluate(([u, d]) => window.readAll(u, { detMaxSide: d }), [url(p), detMaxSide]);
  const app = await page.evaluate((u) => window.appFlow(u), url(p));
  const blocks = p.blocks.map((b) => ({ kind: b.kind, lang: b.lang, ...(b.kind === 'nutrition' ? { table: scoreTable(b, all.text) } : { prose: scoreProse(b.text, all.text) }) }));
  // The app's own result vs. the ingredients it should have picked (Romanian first).
  const target = p.blocks.find((b) => b.kind === 'ingredients' && b.lang === 'ro') || p.blocks.find((b) => b.kind === 'ingredients');
  const appScore = target ? scoreProse(target.text, app.text) : null;
  rows.push({ file: p.file, product: p.product, turns: all.turns, all: { ms: all.orientMs + all.ocrMs, ...all, text: undefined }, allText: all.text, blocks, app: { ...app, lang: target?.lang || null, score: appScore } });
  const prose = blocks.filter((b) => b.prose);
  const s = (k) => prose.reduce((a, b) => a + b.prose[k].charEdits, 0);
  const n = (k) => prose.reduce((a, b) => a + b.prose[k].chars, 0);
  console.log(`${p.file.padEnd(34)} turned ${all.turns}×90°  all text: CER strict ${String(rate(s('strict'), n('strict'))).padStart(5)}%  folded ${String(rate(s('folded'), n('folded'))).padStart(5)}%  `
    + `${all.orientMs + all.ocrMs} ms  | app: ${appScore ? `CER folded ${rate(appScore.folded.charEdits, appScore.folded.chars)}% (${target.lang})` : '–'}  ${app.orientMs + app.suggestMs + app.readMs} ms`);
}

// Two photos of one label, merged as "Adaugă o fotografie" does.
const pairRows = [];
for (const pr of pairs) {
  const reads = [];
  for (const f of pr.photos) reads.push(await page.evaluate((u) => window.appFlow(u), `${server.url}tests/corpus/${pr.dir}/${f}`));
  let raw = '';
  for (const r of reads) ({ text: raw } = mergeOcrTexts(raw, r.raw));
  const merged = correctWords(extractIngredients(raw).text).text;
  const singles = reads.map((r) => scoreProse(pr.text, r.text).folded);
  const m = scoreProse(pr.text, merged).folded;
  pairRows.push({ name: pr.name, singles: singles.map((x) => rate(x.charEdits, x.chars)), merged: rate(m.charEdits, m.chars), text: merged });
  console.log(`pair ${pr.name}: alone ${singles.map((x) => `${rate(x.charEdits, x.chars)}%`).join(' / ')}  merged ${rate(m.charEdits, m.chars)}% CER folded`);
}

// ───── Totals per language and per kind ─────
function totals(filter) {
  const t = { strict: { c: 0, ce: 0, w: 0, we: 0 }, folded: { c: 0, ce: 0, w: 0, we: 0 }, blocks: 0 };
  for (const r of rows) {
    for (const b of r.blocks.filter((x) => x.prose && filter(x))) {
      t.blocks++;
      for (const m of ['strict', 'folded']) {
        t[m].c += b.prose[m].chars; t[m].ce += b.prose[m].charEdits; t[m].w += b.prose[m].words; t[m].we += b.prose[m].wordEdits;
      }
    }
  }
  return {
    blocks: t.blocks, chars: t.folded.c,
    cerStrict: rate(t.strict.ce, t.strict.c), cerFolded: rate(t.folded.ce, t.folded.c),
    werStrict: rate(t.strict.we, t.strict.w), werFolded: rate(t.folded.we, t.folded.w),
  };
}
const langs = [...new Set(rows.flatMap((r) => r.blocks.filter((b) => b.prose).map((b) => b.lang)))].sort();
const byLang = Object.fromEntries(langs.map((l) => [l, totals((b) => b.lang === l)]));
const byKind = Object.fromEntries(['ingredients', 'origin', 'other'].map((k) => [k, totals((b) => b.kind === k)]));
const tables = { labels: 0, labelsFound: 0, values: 0, valuesFound: 0 };
for (const r of rows) for (const b of r.blocks.filter((x) => x.table)) for (const k of Object.keys(tables)) tables[k] += b.table[k];
const app = rows.filter((r) => r.app.score);
const appT = app.reduce((a, r) => ({ c: a.c + r.app.score.folded.chars, e: a.e + r.app.score.folded.charEdits, sc: a.sc + r.app.score.strict.chars, se: a.se + r.app.score.strict.charEdits }), { c: 0, e: 0, sc: 0, se: 0 });
const summary = {
  date: new Date().toISOString().slice(0, 10), throttle, detMaxSide: detMaxSide || 1920, photos: rows.length,
  byLang, byKind, all: totals(() => true),
  tables: { ...tables, labelRecall: pct(tables.labelsFound, tables.labels), valueRecall: pct(tables.valuesFound, tables.values) },
  app: { photos: app.length, cerFolded: rate(appT.e, appT.c), cerStrict: rate(appT.se, appT.sc), foundStart: app.filter((r) => r.app.foundStart).length },
  timeMs: {
    allTextMedian: median(rows.map((r) => r.all.ms)), allTextMax: Math.max(...rows.map((r) => r.all.ms)),
    appMedian: median(rows.map((r) => r.app.orientMs + r.app.suggestMs + r.app.readMs)), appMax: Math.max(...rows.map((r) => r.app.orientMs + r.app.suggestMs + r.app.readMs)),
  },
  pairs: pairRows.map(({ text, ...x }) => x),
};

console.log('\nPer language (all text of the photo, prose blocks):');
for (const [l, t] of Object.entries(byLang)) console.log(`  ${l}  blocks ${t.blocks}  chars ${String(t.chars).padStart(5)}  CER strict ${t.cerStrict}%  folded ${t.cerFolded}%  WER strict ${t.werStrict}%  folded ${t.werFolded}%`);
console.log(`Nutrition tables: row names ${summary.tables.labelRecall}%  values ${summary.tables.valueRecall}%`);
console.log(`App by itself (crop suggestion + reading, ingredients): CER folded ${summary.app.cerFolded}%  strict ${summary.app.cerStrict}%  heading found ${summary.app.foundStart}/${summary.app.photos}`);
console.log(`Time per photo: all text median ${summary.timeMs.allTextMedian} ms (max ${summary.timeMs.allTextMax}); app median ${summary.timeMs.appMedian} ms (max ${summary.timeMs.appMax})${throttle > 1 ? ` – CPU throttled ${throttle}×` : ''}`);

const out = join(root, 'bench', 'results');
mkdirSync(out, { recursive: true });
const tag = `${throttle > 1 ? `-throttle${throttle}` : ''}${detMaxSide ? `-det${detMaxSide}` : ''}`;
writeFileSync(join(out, `real${tag}.json`), JSON.stringify({ summary, rows }, null, 1));
const md = [
  `# Real-photo benchmark – ${summary.date}`, '',
  `${rows.length} photos, detector ${summary.detMaxSide} px${throttle > 1 ? `, CPU throttled ${throttle}×` : ''}. CER/WER: character/word error rate; strict = diacritics count, folded = as the analysis sees it.`, '',
  '| Language | Blocks | Characters | CER strict | CER folded | WER strict | WER folded |', '|---|---:|---:|---:|---:|---:|---:|',
  ...Object.entries(byLang).map(([l, t]) => `| ${l} | ${t.blocks} | ${t.chars} | ${t.cerStrict}% | ${t.cerFolded}% | ${t.werStrict}% | ${t.werFolded}% |`), '',
  '| Photo | Turned | CER folded (all blocks) | App: ingredients CER folded | Time all text | Time app |', '|---|---:|---:|---:|---:|---:|',
  ...rows.map((r) => {
    const pr = r.blocks.filter((b) => b.prose);
    const e = pr.reduce((a, b) => a + b.prose.folded.charEdits, 0);
    const c = pr.reduce((a, b) => a + b.prose.folded.chars, 0);
    return `| ${r.file} | ${r.turns * 90}° | ${rate(e, c)}% | ${r.app.score ? `${rate(r.app.score.folded.charEdits, r.app.score.folded.chars)}% (${r.app.lang})` : '–'} | ${r.all.ms} ms | ${r.app.orientMs + r.app.suggestMs + r.app.readMs} ms |`;
  }), '',
  `Nutrition tables: row names found ${summary.tables.labelRecall}%, values found ${summary.tables.valueRecall}%.`,
].join('\n');
writeFileSync(join(out, `real${tag}.md`), `${md}\n`);
if (updateBaseline) writeFileSync(join(root, 'bench', 'real', 'baseline.json'), `${JSON.stringify(summary, null, 1)}\n`);

await browser.close();
await server.close();
