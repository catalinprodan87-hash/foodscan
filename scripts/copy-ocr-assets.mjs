/**
 * Self-hosted engines, copied from node_modules before `npm run dev` / `build`:
 *
 *   public/scan/zxing_reader.wasm     barcode decoder (ZXing-C++ → WebAssembly), 0.9 MB, precached
 *   public/ocr/ort/…                  ONNX Runtime Web (WebAssembly, CPU), 12 MB
 *   public/ocr/paddle/det.onnx        PaddleOCR PP-OCRv4 text detector, 4.7 MB
 *   public/ocr/paddle/rec.onnx        PaddleOCR PP-OCRv4 English/Latin recogniser, 7.7 MB
 *   public/ocr/paddle/cls.onnx        PaddleOCR text direction classifier (0°/180°), 0.6 MB
 *   public/ocr/paddle/dict.txt        recogniser character list
 *   public/ocr/manifest.json          file sizes for the download progress bar
 *
 * The OCR files are not precached; they download on the first photo and are
 * then kept by the service worker (CacheFirst, 90 days).
 */
import { copyFileSync, mkdirSync, rmSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = (name) => {
  try {
    return dirname(require.resolve(`${name}/package.json`));
  } catch {
    return join(root, 'node_modules', name); // packages whose "exports" hide package.json
  }
};

// Barcode decoder
const scanOut = join(root, 'public', 'scan');
mkdirSync(scanOut, { recursive: true });
copyFileSync(join(pkgDir('zxing-wasm'), 'dist', 'reader', 'zxing_reader.wasm'), join(scanOut, 'zxing_reader.wasm'));

// OCR engine
const out = join(root, 'public', 'ocr');
rmSync(out, { recursive: true, force: true }); // drop files of the previous engine
const ort = join(pkgDir('onnxruntime-web'), 'dist');
const models = join(pkgDir('paddle-ocr-onnx-models'), 'models');
const files = {
  'ort/ort-wasm-simd-threaded.wasm': join(ort, 'ort-wasm-simd-threaded.wasm'),
  'ort/ort-wasm-simd-threaded.mjs': join(ort, 'ort-wasm-simd-threaded.mjs'),
  'paddle/det.onnx': join(models, 'ch_PP-OCRv4_det_infer.onnx'),
  'paddle/rec.onnx': join(models, 'en_PP-OCRv4_rec.onnx'),
  // Text direction classifier (0° / 180°), for photos taken upside down.
  'paddle/cls.onnx': join(models, 'ch_ppocr_mobile_v2.0_cls_infer.onnx'),
};
const sizes = {};
for (const [target, source] of Object.entries(files)) {
  const dest = join(out, target);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(source, dest);
  sizes[target] = statSync(dest).size;
}

// PaddleOCR en_dict.txt: printable ASCII in the model's order, plus space (95 entries).
const dict = [
  ...'0123456789', ...':;<=>?@', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', ...'[\\]^_`',
  ...'abcdefghijklmnopqrstuvwxyz', ...'{|}~', ...'!"#$%&\'()*+,-./', ' ',
];
if (dict.length !== 95) throw new Error(`dictionary has ${dict.length} entries, expected 95`);
writeFileSync(join(out, 'paddle', 'dict.txt'), dict.join('\n'));
sizes['paddle/dict.txt'] = statSync(join(out, 'paddle', 'dict.txt')).size;

const ortVersion = JSON.parse(readFileSync(join(pkgDir('onnxruntime-web'), 'package.json'), 'utf8')).version;
writeFileSync(join(out, 'manifest.json'), JSON.stringify({ engine: 'paddleocr-pp-ocrv4', onnxruntime: ortVersion, sizes }, null, 2));
const mb = (n) => (n / 1048576).toFixed(1);
const total = Object.values(sizes).reduce((a, b) => a + b, 0);
console.log(`Engines → public/scan (barcode) + public/ocr (PaddleOCR, ONNX Runtime ${ortVersion}, ${mb(total)} MB)`);
