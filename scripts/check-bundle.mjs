#!/usr/bin/env node
/**
 * Bundle budget: the JavaScript loaded by index.html (the first screen) must
 * stay small. Lazy chunks (scanner, OCR worker, secondary views) don't count.
 * Run after `npm run build`.
 */
import { readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAIN_JS_BUDGET = 420 * 1024; // raw bytes (≈ 130 KB gzip)

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]+src="\.?\/?([^"]+\.js)"/g)].map((m) => m[1]);
const preloads = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\.?\/?([^"]+\.js)"/g)].map((m) => m[1]);
const files = [...new Set([...scripts, ...preloads])];
if (!files.length) throw new Error('No entry script found in dist/index.html – run npm run build first');

let total = 0;
for (const f of files) {
  const size = statSync(join(dist, f)).size;
  total += size;
  console.log(`${f.padEnd(40)} ${(size / 1024).toFixed(1)} KB`);
}
console.log(`First-load JS: ${(total / 1024).toFixed(1)} KB (budget ${MAIN_JS_BUDGET / 1024} KB)`);
if (total > MAIN_JS_BUDGET) {
  console.error('Over budget: move code behind a lazy import() or raise the budget deliberately.');
  process.exit(1);
}
