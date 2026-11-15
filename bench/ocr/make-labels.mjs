#!/usr/bin/env node
/**
 * Renders the synthetic OCR benchmark images from bench/ocr/labels.json:
 *   images/<name>-flat.png    the label as printed (sharp, straight)
 *   images/<name>-photo.jpg   a synthetic phone photo of it (curve, perspective,
 *                             tilt, blur, glare, noise, dim light)
 * and bench/ocr/truth.json with the expected text, key words and the exact
 * crop box of the ingredients paragraph in each image.
 *
 * Deterministic (seeded); the images are committed, so this only needs to run
 * after labels.json changes:  npm run bench:labels
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const imgDir = join(here, 'images');
mkdirSync(imgDir, { recursive: true });
const { labels, pairs = {} } = JSON.parse(readFileSync(join(here, 'labels.json'), 'utf8'));
const photoize = readFileSync(join(here, '..', 'lib', 'photoize.js'), 'utf8');
const MAX_BYTES = 450 * 1024;

const dataUrl = (buf, type) => `data:${type};base64,${buf.toString('base64')}`;
const fromDataUrl = (url) => Buffer.from(url.split(',')[1], 'base64');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2.2, viewport: { width: 900, height: 700 } });
const scene = await browser.newPage();
await scene.setContent('<body></body>');
await scene.addScriptTag({ content: photoize });

const truth = {};
let seed = 11;
for (const [name, l] of Object.entries(labels)) {
  await page.setContent(`<body style="margin:0;background:#fff"><div id="l" style="${l.style};padding:18px 22px;line-height:1.3">${l.html}</div></body>`);
  const label = await page.$('#l');
  const flat = await label.screenshot();
  const flatCrop = await page.evaluate(() => {
    const L = document.querySelector('#l').getBoundingClientRect();
    const r = document.querySelector('#l .ing').getBoundingClientRect();
    const k = (v) => Math.round(v * 10000) / 10000;
    return [k((r.left - L.left) / L.width), k((r.top - L.top) / L.height), k(r.width / L.width), k(r.height / L.height)];
  });
  await page.addStyleTag({ content: '#l, #l * { color: transparent !important; background: transparent !important; } #l .ing { background: #f00 !important; }' });
  const mask = await label.screenshot({ omitBackground: true });

  const photo = await scene.evaluate(
    ([src, opts]) => window.photoize(src, opts),
    [dataUrl(flat, 'image/png'), { ...l.photo, mask: dataUrl(mask, 'image/png'), seed: seed++ }],
  );
  const jpg = fromDataUrl(photo.jpeg);
  if (jpg.length > MAX_BYTES) throw new Error(`${name}-photo.jpg is ${jpg.length} bytes (max ${MAX_BYTES})`);
  writeFileSync(join(imgDir, `${name}-flat.png`), flat);
  writeFileSync(join(imgDir, `${name}-photo.jpg`), jpg);
  truth[name] = {
    truth: l.truth,
    terms: l.terms,
    images: {
      flat: { file: `images/${name}-flat.png`, crop: flatCrop },
      photo: { file: `images/${name}-photo.jpg`, crop: photo.crop },
    },
  };
  console.log(name.padEnd(10), 'flat', String(flat.length).padStart(7), 'B · photo', String(jpg.length).padStart(7), 'B', `${photo.width}×${photo.height}`, 'crop', photo.crop?.join(' '));
}
// Pairs: one label, two photos of overlapping parts (the two sides of a jar).
const pairTruth = {};
for (const [name, l] of Object.entries(pairs)) {
  await page.setContent(`<body style="margin:0;background:#fff"><div id="l" style="${l.style};padding:18px 22px;line-height:1.3">${l.html}</div></body>`);
  const flat = await (await page.$('#l')).screenshot();
  const files = [];
  for (const [i, [from, to]] of l.split.entries()) {
    const part = await scene.evaluate(async ([src, a, b]) => {
      const img = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = src; });
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * (b - a));
      c.height = img.height;
      c.getContext('2d').drawImage(img, -Math.round(img.width * a), 0);
      return c.toDataURL('image/png');
    }, [dataUrl(flat, 'image/png'), from, to]);
    const photo = await scene.evaluate(([src, opts]) => window.photoize(src, opts), [part, { ...l.photo, seed: seed++ }]);
    const file = `images/${name}-${'ab'[i]}.jpg`;
    writeFileSync(join(here, file), fromDataUrl(photo.jpeg));
    files.push(file);
    console.log(`${name}-${'ab'[i]}`, fromDataUrl(photo.jpeg).length, 'B');
  }
  pairTruth[name] = { truth: l.truth, terms: l.terms, images: files };
}
truth._pairs = pairTruth;
writeFileSync(join(here, 'truth.json'), `${JSON.stringify(truth, null, 1)}\n`);
await browser.close();
