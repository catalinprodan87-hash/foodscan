#!/usr/bin/env node
/**
 * Renders the barcode benchmark: one EAN-13 per variant in variants.json
 * (fixed seed), turned into a synthetic phone photo by bench/lib/photoize.js.
 * Writes images/<variant>.jpg and truth.json (file → code).
 *   npm run bench:barcodes:make
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const imgDir = join(here, 'images');
mkdirSync(imgDir, { recursive: true });
const { variants } = JSON.parse(readFileSync(join(here, 'variants.json'), 'utf8'));
const photoize = readFileSync(join(here, '..', 'lib', 'photoize.js'), 'utf8');

let s = 20261114;
const rand = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
function ean13() {
  // First digit 3–8: avoids the 20–29 in-store range and 0/1 (UPC-A as EAN-13).
  const d = [3 + Math.floor(rand() * 6), ...Array.from({ length: 11 }, () => Math.floor(rand() * 10))];
  const sum = d.reduce((n, x, i) => n + x * (i % 2 ? 3 : 1), 0);
  return d.join('') + ((10 - (sum % 10)) % 10);
}

const drawEan = (code) => {
  const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const G = L.map((p) => p.split('').reverse().map((b) => (b === '1' ? '0' : '1')).join(''));
  const R = L.map((p) => p.split('').map((b) => (b === '1' ? '0' : '1')).join(''));
  const PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
  const d = code.split('').map(Number);
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (PAR[d[0]][i - 1] === 'L' ? L : G)[d[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[d[i]];
  bits += '101';
  const m = 5;
  const c = document.createElement('canvas');
  c.width = bits.length * m + 120;
  c.height = 420;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#000';
  [...bits].forEach((b, i) => { if (b === '1') ctx.fillRect(60 + i * m, 30, m, 320); });
  ctx.font = '40px monospace';
  ctx.fillText(code, 80, 395);
  return c.toDataURL('image/png');
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body></body>');
await page.addScriptTag({ content: photoize });
const truth = {};
let seed = 101;
for (const [name, opts] of Object.entries(variants)) {
  const code = ean13();
  const flat = await page.evaluate(drawEan, code);
  const photo = await page.evaluate(([src, o]) => window.photoize(src, o), [flat, { sceneW: 1600, sceneH: 1200, ...opts, seed: seed++ }]);
  const buf = Buffer.from(photo.jpeg.split(',')[1], 'base64');
  writeFileSync(join(imgDir, `${name}.jpg`), buf);
  truth[`images/${name}.jpg`] = code;
  console.log(name.padEnd(22), code, `${Math.round(buf.length / 1024)} KB`);
}
writeFileSync(join(here, 'truth.json'), `${JSON.stringify(truth, null, 1)}\n`);
await browser.close();
