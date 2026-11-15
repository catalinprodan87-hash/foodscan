#!/usr/bin/env node
/** node bench/real/orient.mjs <dir/file>… [--stretch=N] → what the orientation check measured. */
import { chromium } from 'playwright';
import { startServer } from '../lib/server.mjs';

const args = process.argv.slice(2);
const stretch = Number(args.find((a) => a.startsWith('--stretch='))?.split('=')[1] || 0);
const server = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${server.url}bench/real/harness.html`);
await page.waitForFunction(() => window.benchReady);
if (stretch) await page.evaluate((n) => window.setStretch(n), stretch);
for (const f of args.filter((a) => !a.startsWith('--'))) {
  console.log(f, JSON.stringify(await page.evaluate((u) => window.debugOrient(u), `${server.url}tests/corpus/${f}`), null, 1));
}
await browser.close();
await server.close();
