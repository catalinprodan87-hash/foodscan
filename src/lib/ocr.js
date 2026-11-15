/**
 * On-device OCR with PaddleOCR (PP-OCRv4 detector + English/Latin recogniser)
 * running on ONNX Runtime Web in a Web Worker.
 *
 * Everything is self-hosted under ./ocr/ (copied from npm by
 * scripts/copy-ocr-assets.mjs) and cached by the service worker (CacheFirst,
 * 90 days): ~24 MB download on the first photo, offline afterwards. The photo
 * never leaves the phone.
 *
 * `createWorker`, `fetchImpl` and `cachesImpl` are injectable for tests.
 */
import { pickRotation } from './orientation.js';
import { pickIngredientBlock } from './cropSuggest.js';
import { ORIENT_MAX_SIDE } from './paddleCore.js';

export const OCR_DIR = 'ocr/';

/** Absolute URLs of the self-hosted OCR files. */
export function ocrAssets(baseUrl) {
  const base = new URL(OCR_DIR, baseUrl).href;
  const ortDir = `${base}ort/`;
  const assets = {
    manifest: `${base}manifest.json`,
    ortDir,
    det: `${base}paddle/det.onnx`,
    rec: `${base}paddle/rec.onnx`,
    cls: `${base}paddle/cls.onnx`,
    dict: `${base}paddle/dict.txt`,
  };
  assets.downloads = [`${ortDir}ort-wasm-simd-threaded.wasm`, `${ortDir}ort-wasm-simd-threaded.mjs`, assets.det, assets.rec, assets.cls, assets.dict];
  return assets;
}

/**
 * Makes sure the engine files are downloaded (and cached by the service
 * worker), reporting byte progress. Files already in Cache Storage are skipped.
 * @param {(p: {phase: 'download', loaded: number, total: number}) => void} onProgress
 * @returns {Promise<{downloaded: boolean}>}
 */
export async function ensureOcrAssets(assets, { onProgress, fetchImpl = globalThis.fetch, cachesImpl = globalThis.caches } = {}) {
  const missing = [];
  for (const url of assets.downloads) {
    let cached = null;
    try { cached = await cachesImpl?.match(url); } catch { /* no Cache Storage */ }
    if (!cached) missing.push(url);
  }
  if (!missing.length) return { downloaded: false };

  // Sizes from the manifest written at build time (Content-Length is unreliable
  // when the server compresses responses).
  let sizes = {};
  try { sizes = (await (await fetchImpl(assets.manifest, { cache: 'no-cache' })).json()).sizes || {}; } catch { /* estimate */ }
  const sizeOf = (url) => sizes[url.split(OCR_DIR).pop()] || 0;
  const total = missing.reduce((n, u) => n + sizeOf(u), 0);
  let loaded = 0;
  onProgress?.({ phase: 'download', loaded, total });

  for (const url of missing) {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`OCR download failed: HTTP ${res.status}`);
    if (res.body?.getReader) {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        loaded += value.byteLength;
        onProgress?.({ phase: 'download', loaded, total: Math.max(total, loaded) });
      }
    } else {
      loaded += (await res.arrayBuffer()).byteLength;
      onProgress?.({ phase: 'download', loaded, total: Math.max(total, loaded) });
    }
  }
  return { downloaded: true };
}

const defaultCreateWorker = () => new Worker(new URL('../workers/ocrWorker.js', import.meta.url), { type: 'module' });

let enginePromise = null;
let progressListener = null;

/**
 * One worker per page, reused across photos.
 * @returns {Promise<{recognize: (bitmap) => Promise<{text, confidence, lines}>, terminate: () => void}>}
 */
export function getEngine({ createWorker = defaultCreateWorker, baseUrl = globalThis.document?.baseURI, onProgress, fetchImpl, cachesImpl } = {}) {
  progressListener = onProgress || null;
  if (!enginePromise) {
    enginePromise = (async () => {
      const assets = ocrAssets(baseUrl);
      await ensureOcrAssets(assets, { onProgress: (p) => progressListener?.(p), fetchImpl, cachesImpl });
      const worker = createWorker();
      const pending = new Map();
      let nextId = 1;
      let readyResolve;
      let readyReject;
      const ready = new Promise((res, rej) => { readyResolve = res; readyReject = rej; });
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'progress') progressListener?.({ phase: m.phase, progress: m.progress });
        else if (m.type === 'ready') readyResolve();
        else if (m.type === 'result') { pending.get(m.id)?.resolve(m); pending.delete(m.id); }
        else if (m.type === 'error') {
          if (m.id && pending.has(m.id)) { pending.get(m.id).reject(new Error(m.message)); pending.delete(m.id); }
          else readyReject(new Error(m.message));
        }
      };
      worker.onerror = (e) => {
        const err = new Error(e?.message || 'OCR worker failed');
        readyReject(err);
        pending.forEach((p) => p.reject(err));
        pending.clear();
      };
      worker.postMessage({ type: 'init', assets });
      await ready;
      return {
        recognize(bitmap, { detMaxSide, upscale, debug } = {}) {
          const id = nextId++;
          return new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject });
            worker.postMessage({ type: 'recognize', id, bitmap, assets, detMaxSide, upscale, debug }, bitmap && typeof bitmap.close === 'function' ? [bitmap] : []);
          });
        },
        suggest(bitmap) {
          const id = nextId++;
          return new Promise((resolve, reject) => {
            pending.set(id, { resolve: (m) => resolve(m.suggest), reject });
            worker.postMessage({ type: 'suggest', id, bitmap, assets }, bitmap && typeof bitmap.close === 'function' ? [bitmap] : []);
          });
        },
        orient(bitmap) {
          const id = nextId++;
          return new Promise((resolve, reject) => {
            pending.set(id, { resolve: (m) => resolve(m.orient), reject });
            worker.postMessage({ type: 'orient', id, bitmap, assets }, bitmap && typeof bitmap.close === 'function' ? [bitmap] : []);
          });
        },
        terminate() { worker.terminate(); },
      };
    })();
    enginePromise.catch(() => { enginePromise = null; }); // allow a retry after a failure
  }
  return enginePromise;
}

/**
 * Recognises text in an image (canvas or ImageBitmap).
 * @returns {Promise<{text: string, confidence: number, lines: number}>}
 */
export async function recognize(image, { onProgress, detMaxSide, upscale, debug, ...engineOptions } = {}) {
  const engine = await getEngine({ onProgress, ...engineOptions });
  const bitmap = typeof createImageBitmap === 'function' && image && typeof image.getContext === 'function'
    ? await createImageBitmap(image)
    : image;
  const r = await engine.recognize(bitmap, { detMaxSide, upscale, debug });
  // debug (benchmarks only): every line box with its text, in image coordinates.
  return { text: r.text || '', confidence: Math.round(r.confidence ?? 0), lines: r.lines ?? 0, uncertain: r.uncertain || [], ...(debug ? { items: r.items } : {}) };
}

/**
 * How many quarter turns (clockwise) make the photo's text upright. Works on
 * a small copy (long side 960 px); see src/lib/orientation.js for the rule.
 * @param image ImageBitmap / canvas / image of the whole photo
 * @returns {Promise<{turns: 0|1|2|3, method: string, confidence: number, ms: number}>}
 */
export async function detectOrientation(image, { onProgress, ...engineOptions } = {}) {
  const engine = await getEngine({ onProgress, ...engineOptions });
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let small = image;
  if (typeof OffscreenCanvas === 'function' && image && image.width) {
    const k = Math.min(1, ORIENT_MAX_SIDE / Math.max(image.width, image.height));
    const c = new OffscreenCanvas(Math.max(1, Math.round(image.width * k)), Math.max(1, Math.round(image.height * k)));
    c.getContext('2d').drawImage(image, 0, 0, c.width, c.height);
    small = typeof createImageBitmap === 'function' ? await createImageBitmap(c) : c;
  }
  const measured = await engine.orient(small);
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { ...pickRotation(measured), ms: Math.round(now - t0), measured };
}

export const SUGGEST_MAX_SIDE = 2400;

/**
 * Suggested crop around the ingredients list of an (upright) photo.
 * @returns {Promise<{rect: {x, y, w, h}, kind, marker, ms}|null>}
 */
export async function suggestCrop(image, engineOptions = {}) {
  const engine = await getEngine(engineOptions);
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let copy = image;
  if (typeof OffscreenCanvas === 'function' && image && image.width) {
    const k = Math.min(1, SUGGEST_MAX_SIDE / Math.max(image.width, image.height));
    const c = new OffscreenCanvas(Math.max(1, Math.round(image.width * k)), Math.max(1, Math.round(image.height * k)));
    c.getContext('2d').drawImage(image, 0, 0, c.width, c.height);
    copy = typeof createImageBitmap === 'function' ? await createImageBitmap(c) : c;
  }
  const measured = await engine.suggest(copy);
  const picked = pickIngredientBlock(measured);
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return picked ? { ...picked, ms: Math.round(now - t0) } : null;
}

/** Test helper: forget the engine singleton. */
export async function resetOcr() {
  const p = enginePromise;
  enginePromise = null;
  progressListener = null;
  try { (await p)?.terminate?.(); } catch { /* ignore */ }
}
