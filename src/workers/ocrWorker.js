/**
 * PaddleOCR in a Web Worker: ONNX Runtime Web (WebAssembly, CPU) runs the
 * PP-OCRv4 text detector and the English/Latin recogniser on the photo. The
 * photo never leaves the phone.
 *
 * Messages in:  {type: 'init', assets}  {type: 'recognize', id, bitmap}
 * Messages out: {type: 'progress', phase, progress}  {type: 'ready'}
 *               {type: 'result', id, text, confidence, lines}  {type: 'error', id?, message}
 */
import * as ort from 'onnxruntime-web/wasm';
import { detSize, linesFromProbMap, recWidth, ctcDecode, joinLines, REC_HEIGHT } from '../lib/paddleCore.js';

let det = null;
let rec = null;
let dict = null;
let initPromise = null;

function init(assets) {
  if (!initPromise) {
    initPromise = (async () => {
      ort.env.wasm.wasmPaths = assets.ortDir; // self-hosted ort-wasm-simd-threaded.{mjs,wasm}
      ort.env.wasm.numThreads = 1; // GitHub Pages cannot enable cross-origin isolation
      const opts = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
      [det, rec, dict] = await Promise.all([
        ort.InferenceSession.create(assets.det, opts),
        ort.InferenceSession.create(assets.rec, opts),
        fetch(assets.dict).then((r) => r.text()).then((t) => [...t.split('\n'), ' ']),
      ]);
    })();
    initPromise.catch(() => { initPromise = null; });
  }
  return initPromise;
}

/** Planar BGR float tensor, (x/255 − mean) / std per channel. */
function tensor(ctx, w, h, mean, std) {
  const d = ctx.getImageData(0, 0, w, h).data;
  const n = w * h;
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    out[i] = (d[p + 2] / 255 - mean[0]) / std[0];
    out[n + i] = (d[p + 1] / 255 - mean[1]) / std[1];
    out[2 * n + i] = (d[p] / 255 - mean[2]) / std[2];
  }
  return new ort.Tensor('float32', out, [1, 3, h, w]);
}

async function detectLines(bitmap) {
  const { w, h } = detSize(bitmap.width, bitmap.height);
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  const out = await det.run({ [det.inputNames[0]]: tensor(ctx, w, h, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]) });
  const prob = out[det.outputNames[0]].data;
  return linesFromProbMap(prob, w, h, bitmap.width / w, bitmap.height / h);
}

async function readLine(bitmap, box) {
  const H = REC_HEIGHT;
  const W = recWidth(box, H);
  const c = new OffscreenCanvas(W, H);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  // Cut the line along its own angle (labels are rarely perfectly straight).
  ctx.translate(W / 2, H / 2);
  ctx.scale(W / box.len, H / box.thick);
  ctx.rotate(-box.angle);
  ctx.translate(-box.cx, -box.cy);
  ctx.drawImage(bitmap, 0, 0);
  const out = await rec.run({ [rec.inputNames[0]]: tensor(ctx, W, H, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]) });
  const t = out[rec.outputNames[0]];
  const [, T, C] = t.dims;
  return ctcDecode(t.data, T, C, dict);
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      self.postMessage({ type: 'progress', phase: 'init', progress: 0 });
      await init(msg.assets);
      self.postMessage({ type: 'ready' });
    } else if (msg.type === 'recognize') {
      await init(msg.assets);
      const bitmap = msg.bitmap;
      self.postMessage({ type: 'progress', phase: 'detect', progress: 0 });
      const boxes = await detectLines(bitmap);
      const items = [];
      for (let i = 0; i < boxes.length; i++) {
        const r = await readLine(bitmap, boxes[i]);
        items.push({ ...boxes[i], ...r });
        self.postMessage({ type: 'progress', phase: 'recognize', progress: (i + 1) / boxes.length });
      }
      bitmap.close?.();
      const { text, confidence } = joinLines(items);
      self.postMessage({ type: 'result', id: msg.id, text, confidence, lines: items.length });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.id, message: String(err?.message || err) });
  }
};
