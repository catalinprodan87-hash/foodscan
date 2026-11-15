#!/usr/bin/env node
/** Debug one photo: node bench/real/debug.mjs <file in tests/corpus/own> [line indexes…] → overlay + line crops in bench/results/debug/ */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, root } from '../lib/server.mjs';

const [file, ...pick] = process.argv.slice(2);
const out = join(root, 'bench', 'results', 'debug');
mkdirSync(out, { recursive: true });
const server = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${server.url}bench/real/harness.html`);
await page.waitForFunction(() => window.benchReady);
const r = await page.evaluate(([u, p]) => window.debugLines(u, { pick: p }), [`${server.url}tests/corpus/own/${file}`, pick.map(Number)]);
const save = (name, dataUrl) => writeFileSync(join(out, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
save('overlay.jpg', r.overlay);
for (const c of r.crops) save(`line-${c.i}.png`, c.url);
console.log(`${r.width}×${r.height}`);
for (const it of r.items) console.log(`${String(it.i).padStart(3)} len ${String(it.len).padStart(5)} thick ${String(it.thick).padStart(4)} conf ${it.conf?.toFixed?.(2)}  ${it.text}`);
await browser.close();
await server.close();
