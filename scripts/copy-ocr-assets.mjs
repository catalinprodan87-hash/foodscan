/**
 * Self-hosted engines, copied from node_modules before `npm run dev` / `build`:
 *
 *   public/scan/zxing_reader.wasm     barcode decoder (ZXing-C++ → WebAssembly), 0.9 MB, precached
 *   public/ocr/ort/…                  ONNX Runtime Web (WebAssembly, CPU), 12 MB
 *   public/ocr/paddle/det.onnx        PaddleOCR PP-OCRv4 text detector, 4.7 MB
 *   public/ocr/paddle/rec.onnx        PaddleOCR PP-OCRv5 Latin recogniser (RO ă â î ș ț, HU, PL, CS…), 8.1 MB
 *   public/ocr/paddle/rec-cyrillic.onnx  PP-OCRv5 Cyrillic recogniser (BG…), 8.1 MB, fetched only when needed
 *   (both from vendor/paddleocr/, see its README)
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
// OCR_REC=en-v4: the previous English recogniser (benchmark comparisons only).
const V4 = process.env.OCR_REC === 'en-v4';
const files = {
  'ort/ort-wasm-simd-threaded.wasm': join(ort, 'ort-wasm-simd-threaded.wasm'),
  'ort/ort-wasm-simd-threaded.mjs': join(ort, 'ort-wasm-simd-threaded.mjs'),
  'paddle/det.onnx': join(models, 'ch_PP-OCRv4_det_infer.onnx'),
  'paddle/rec.onnx': !V4 ? join(root, 'vendor', 'paddleocr', 'latin_PP-OCRv5_mobile_rec_infer.onnx') : join(models, 'en_PP-OCRv4_rec.onnx'),
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
/**
 * PP-OCRv5 dictionaries (vendor/paddleocr): one character per line, starting
 * with an empty line that is not a model class; the worker adds the space.
 */
function writeV5Dict(source, target) {
  const lines = readFileSync(join(root, 'vendor', 'paddleocr', source), 'utf8').replace(/\r/g, '').split('\n');
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  if (lines[0] !== '') throw new Error(`${source}: expected an empty first line`);
  lines.shift();
  writeFileSync(join(out, 'paddle', target), lines.join('\n'));
  sizes[`paddle/${target}`] = statSync(join(out, 'paddle', target)).size;
}
if (!V4) {
  writeV5Dict('ppocrv5_latin_dict.txt', 'dict.txt');
  copyFileSync(join(root, 'vendor', 'paddleocr', 'cyrillic_PP-OCRv5_mobile_rec_infer.onnx'), join(out, 'paddle', 'rec-cyrillic.onnx'));
  sizes['paddle/rec-cyrillic.onnx'] = statSync(join(out, 'paddle', 'rec-cyrillic.onnx')).size;
  writeV5Dict('ppocrv5_cyrillic_dict.txt', 'dict-cyrillic.txt');
} else writeFileSync(join(out, 'paddle', 'dict.txt'), dict.join('\n'));
sizes['paddle/dict.txt'] = statSync(join(out, 'paddle', 'dict.txt')).size;

const ortVersion = JSON.parse(readFileSync(join(pkgDir('onnxruntime-web'), 'package.json'), 'utf8')).version;
writeFileSync(join(out, 'manifest.json'), JSON.stringify({ engine: V4 ? 'paddleocr-pp-ocrv4' : 'paddleocr-pp-ocrv5-latin', onnxruntime: ortVersion, sizes }, null, 2));
const mb = (n) => (n / 1048576).toFixed(1);
const total = Object.values(sizes).reduce((a, b) => a + b, 0);
console.log(`Engines → public/scan (barcode) + public/ocr (PaddleOCR, ONNX Runtime ${ortVersion}, ${mb(total)} MB)`);
