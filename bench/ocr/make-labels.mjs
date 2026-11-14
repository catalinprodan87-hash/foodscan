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
const { labels } = JSON.parse(readFileSync(join(here, 'labels.json'), 'utf8'));
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
writeFileSync(join(here, 'truth.json'), `${JSON.stringify(truth, null, 1)}\n`);
await browser.close();
