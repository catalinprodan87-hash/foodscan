/**
 * Copies the tesseract.js worker, the LSTM WASM cores and the ron/eng language
 * data from node_modules into public/ocr/, so the app self-hosts its OCR engine
 * (no third-party CDN; cached offline by the service worker).
 * Runs automatically before `npm run dev` and `npm run build`.
 */
import { copyFileSync, mkdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'ocr');
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));

const files = {
  'worker.min.js': join(pkgDir('tesseract.js'), 'dist', 'worker.min.js'),
  'core/tesseract-core-simd-lstm.wasm.js': join(pkgDir('tesseract.js-core'), 'tesseract-core-simd-lstm.wasm.js'),
  'core/tesseract-core-lstm.wasm.js': join(pkgDir('tesseract.js-core'), 'tesseract-core-lstm.wasm.js'),
  'lang/ron.traineddata.gz': join(pkgDir('@tesseract.js-data/ron'), '4.0.0_best_int', 'ron.traineddata.gz'),
  'lang/eng.traineddata.gz': join(pkgDir('@tesseract.js-data/eng'), '4.0.0_best_int', 'eng.traineddata.gz'),
};

const sizes = {};
for (const [target, source] of Object.entries(files)) {
  const dest = join(out, target);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(source, dest);
  sizes[target] = statSync(dest).size;
}
const version = JSON.parse(readFileSync(join(pkgDir('tesseract.js'), 'package.json'), 'utf8')).version;
writeFileSync(join(out, 'manifest.json'), JSON.stringify({ tesseract: version, sizes }, null, 2));
const mb = (n) => (n / 1048576).toFixed(1);
console.log(`OCR assets → public/ocr (tesseract.js ${version}): ${Object.entries(sizes).map(([k, v]) => `${k} ${mb(v)} MB`).join(', ')}`);
