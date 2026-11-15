/**
 * PaddleOCR in a Web Worker: ONNX Runtime Web (WebAssembly, CPU) runs the
 * PP-OCRv4 text detector, the English/Latin recogniser and the text direction
 * classifier on the photo. The photo never leaves the phone.
 *
 * Messages in:  {type: 'init', assets}
 *               {type: 'recognize', id, bitmap, assets, detMaxSide?, upscale?}
 *               {type: 'orient', id, bitmap, assets}     (small copy, ≤ 960 px)
 * Messages out: {type: 'progress', phase, progress}  {type: 'ready'}
 *               {type: 'result', id, text, confidence, lines}
 *               {type: 'result', id, orient: {base, lines, vote, texts, ms}}
 *               {type: 'error', id?, message}
 */
import * as ort from 'onnxruntime-web/wasm';
import {
  detSize, componentsFromProbMap, recWidth, ctcDecode, joinLines, REC_HEIGHT, DET_MAX_SIDE,
  orientationBase, topLines, rotateBox180, clsWidth, clsVote, lineSegments, CLS_HEIGHT, CLS_WIDTH, CLS_SURE, ORIENT_MAX_SIDE,
} from '../lib/paddleCore.js';

const SESSION_OPTS = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
let det = null;
let rec = null;
let dict = null;
let initPromise = null;
let clsPromise = null;

function init(assets) {
  if (!initPromise) {
    initPromise = (async () => {
      ort.env.wasm.wasmPaths = assets.ortDir; // self-hosted ort-wasm-simd-threaded.{mjs,wasm}
      ort.env.wasm.numThreads = 1; // GitHub Pages cannot enable cross-origin isolation
      [det, rec, dict] = await Promise.all([
        ort.InferenceSession.create(assets.det, SESSION_OPTS),
        ort.InferenceSession.create(assets.rec, SESSION_OPTS),
        fetch(assets.dict).then((r) => r.text()).then((t) => [...t.split('\n'), ' ']),
      ]);
    })();
    initPromise.catch(() => { initPromise = null; });
  }
  return initPromise;
}

/** The direction classifier, loaded on first use; null if it cannot load (orientation then reads the text). */
function loadCls(assets) {
  if (!clsPromise) {
    clsPromise = assets.cls
      ? ort.InferenceSession.create(assets.cls, SESSION_OPTS).catch(() => null)
      : Promise.resolve(null);
  }
  return clsPromise;
}

/** Planar BGR float tensor, (x/255 − mean) / std per channel; with outW > w the extra columns are 0 (padding). */
function tensor(ctx, w, h, mean, std, outW = w) {
  const d = ctx.getImageData(0, 0, w, h).data;
  const n = outW * h;
  const out = new Float32Array(3 * n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const i = y * outW + x;
      out[i] = (d[p + 2] / 255 - mean[0]) / std[0];
      out[n + i] = (d[p + 1] / 255 - mean[1]) / std[1];
      out[2 * n + i] = (d[p] / 255 - mean[2]) / std[2];
    }
  }
  return new ort.Tensor('float32', out, [1, 3, h, outW]);
}

async function detect(image, maxSide = DET_MAX_SIDE, upscale = false) {
  const { w, h } = detSize(image.width, image.height, maxSide, upscale);
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);
  const out = await det.run({ [det.inputNames[0]]: tensor(ctx, w, h, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]) });
  const prob = out[det.outputNames[0]].data;
  return componentsFromProbMap(prob, w, h, image.width / w, image.height / h);
}

/** Draws one line box, straightened, into a W×H canvas. */
function cutLine(image, box, W, H) {
  const c = new OffscreenCanvas(W, H);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  // Cut the line along its own angle (labels are rarely perfectly straight).
  ctx.translate(W / 2, H / 2);
  ctx.scale(W / box.len, H / box.thick);
  ctx.rotate(-box.angle);
  ctx.translate(-box.cx, -box.cy);
  ctx.drawImage(image, 0, 0);
  return ctx;
}

async function readLine(image, box) {
  const H = REC_HEIGHT;
  const W = recWidth(box, H);
  const ctx = cutLine(image, box, W, H);
  const out = await rec.run({ [rec.inputNames[0]]: tensor(ctx, W, H, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]) });
  const t = out[rec.outputNames[0]];
  const [, T, C] = t.dims;
  return ctcDecode(t.data, T, C, dict);
}

/** Probability that the line is upside down (classifier labels: 0°, 180°). */
async function classify(cls, image, box) {
  const W = clsWidth(box);
  const ctx = cutLine(image, box, W, CLS_HEIGHT);
  const out = await cls.run({ [cls.inputNames[0]]: tensor(ctx, W, CLS_HEIGHT, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5], CLS_WIDTH) });
  const p = out[cls.outputNames[0]].data;
  return p[1] / (p[0] + p[1]);
}

/** The image turned clockwise by quarterTurns × 90°. */
function turned(image, quarterTurns) {
  const odd = quarterTurns % 2 === 1;
  const c = new OffscreenCanvas(odd ? image.height : image.width, odd ? image.width : image.height);
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((quarterTurns * Math.PI) / 2);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  return c;
}

/** Measures what pickRotation() (src/lib/orientation.js) needs to decide the orientation. */
async function orient(bitmap, assets) {
  const t0 = performance.now();
  const all = await detect(bitmap, ORIENT_MAX_SIDE);
  const base = orientationBase(all);
  let image = bitmap;
  let lines = all.filter((c) => !c.vertical);
  if (base === 1) {
    image = turned(bitmap, 1); // sideways: make the lines horizontal, then decide up / down
    lines = (await detect(image, ORIENT_MAX_SIDE)).filter((c) => !c.vertical);
  }
  const top = topLines(lines, 8);
  if (!top.length) return { base, lines: 0, vote: null, texts: null, ms: Math.round(performance.now() - t0) };

  let vote = null;
  const cls = await loadCls(assets);
  if (cls) {
    const votes = [];
    for (const box of top) {
      for (const piece of lineSegments(box)) votes.push({ p180: await classify(cls, image, piece), weight: piece.len });
    }
    vote = clsVote(votes);
  }
  let texts = null;
  if (!vote || vote.confidence < CLS_SURE) {
    // Unsure: read short pieces of the main lines both ways; the way that gives words wins.
    const flipped = turned(image, 2);
    const pieces = top.slice(0, 4).flatMap((box) => lineSegments(box, { maxRatio: 12, maxSegments: 1 }));
    const up = [];
    const down = [];
    for (const box of pieces) {
      up.push(await readLine(image, box));
      down.push(await readLine(flipped, rotateBox180(box, image.width, image.height)));
    }
    texts = { up, down };
  }
  return { base, lines: top.length, vote, texts, ms: Math.round(performance.now() - t0) };
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      self.postMessage({ type: 'progress', phase: 'init', progress: 0 });
      await init(msg.assets);
      self.postMessage({ type: 'ready' });
    } else if (msg.type === 'orient') {
      await init(msg.assets);
      const result = await orient(msg.bitmap, msg.assets);
      msg.bitmap.close?.();
      self.postMessage({ type: 'result', id: msg.id, orient: result });
    } else if (msg.type === 'recognize') {
      await init(msg.assets);
      const bitmap = msg.bitmap;
      self.postMessage({ type: 'progress', phase: 'detect', progress: 0 });
      const boxes = (await detect(bitmap, msg.detMaxSide || DET_MAX_SIDE, !!msg.upscale)).filter((c) => !c.vertical);
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
