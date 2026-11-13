/**
 * On-device OCR with tesseract.js v5 (Romanian + English) in a Web Worker.
 *
 * Everything is self-hosted under ./ocr/ (copied from npm by
 * scripts/copy-ocr-assets.mjs) and cached by the service worker (CacheFirst,
 * 90 days), so after the first download OCR works offline and the photo never
 * leaves the phone. tesseract.js itself is loaded with a dynamic import, only
 * when the user takes a photo.
 *
 * `loadTesseract`, `fetchImpl`, `cachesImpl` and `simdImpl` are injectable for tests.
 */
export const OCR_LANGS = ['ron', 'eng'];
export const OCR_DIR = 'ocr/';

/** Absolute URLs of the self-hosted OCR files, for this device's core variant. */
export function ocrAssets(baseUrl, simd) {
  const base = new URL(OCR_DIR, baseUrl).href;
  const core = `${base}core/tesseract-core-${simd ? 'simd-' : ''}lstm.wasm.js`;
  const langPath = `${base}lang`;
  return {
    manifest: `${base}manifest.json`,
    worker: `${base}worker.min.js`,
    core,
    langPath,
    downloads: [core, ...OCR_LANGS.map((l) => `${langPath}/${l}.traineddata.gz`)],
  };
}

async function detectSimd() {
  try {
    const { simd } = await import('wasm-feature-detect');
    return await simd();
  } catch {
    return false;
  }
}

/**
 * Makes sure the engine and language data are downloaded (and cached by the
 * service worker), reporting byte progress. Files already in Cache Storage are
 * skipped, so a cached device reports `{phase: 'download'}` only if needed.
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

let workerPromise = null;
let progressListener = null;

/** Maps tesseract logger messages to app progress. */
export function mapTesseractProgress(m) {
  if (m?.status === 'recognizing text') return { phase: 'recognize', progress: m.progress || 0 };
  return { phase: 'init', status: m?.status, progress: m?.progress || 0 };
}

/**
 * One worker per page, reused across photos.
 * @returns {Promise<object>} tesseract worker
 */
export function getWorker({ loadTesseract = () => import('tesseract.js'), baseUrl = globalThis.document?.baseURI, simdImpl = detectSimd, onProgress, fetchImpl, cachesImpl } = {}) {
  progressListener = onProgress || null;
  if (!workerPromise) {
    workerPromise = (async () => {
      const assets = ocrAssets(baseUrl, await simdImpl());
      await ensureOcrAssets(assets, { onProgress: (p) => progressListener?.(p), fetchImpl, cachesImpl });
      const mod = await loadTesseract();
      const Tesseract = mod.default || mod;
      return Tesseract.createWorker(OCR_LANGS, 1 /* OEM LSTM_ONLY */, {
        workerPath: assets.worker,
        workerBlobURL: false, // same-origin worker, so the service worker caches its requests
        corePath: assets.core,
        langPath: assets.langPath,
        gzip: true,
        cacheMethod: 'none', // the service worker cache is the single copy
        logger: (m) => progressListener?.(mapTesseractProgress(m)),
      });
    })();
    workerPromise.catch(() => { workerPromise = null; }); // allow a retry after a failure
  }
  return workerPromise;
}

/**
 * Recognises text in an image (canvas / blob / URL).
 * @param {{cropped?: boolean}} options cropped images use a single-block layout
 * @returns {Promise<{text: string, confidence: number}>}
 */
export async function recognize(image, { cropped = false, onProgress, ...workerOptions } = {}) {
  const worker = await getWorker({ onProgress, ...workerOptions });
  // PSM 6 = one uniform block of text (a cropped ingredients box); 3 = automatic layout.
  await worker.setParameters({ tessedit_pageseg_mode: cropped ? '6' : '3', preserve_interword_spaces: '0' });
  const { data } = await worker.recognize(image);
  return { text: data?.text || '', confidence: Math.round(data?.confidence ?? 0) };
}

/** Test helper: forget the worker singleton. */
export async function resetOcr() {
  const w = workerPromise;
  workerPromise = null;
  progressListener = null;
  try { await (await w)?.terminate?.(); } catch { /* ignore */ }
}
