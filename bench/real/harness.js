/*
 * Real-photo benchmark: the app's own steps on a phone photo (EXIF applied),
 * driven by bench/real/run.mjs.
 *   readAll(url)  – automatic orientation, then all the text of the photo
 *                   (no crop): what the reader can see at all
 *   appFlow(url)  – what the app does by itself: orientation → crop suggestion
 *                   → reading step (extraction, word clean-up, retries)
 */
import { loadImage, prepareColour, rotateImage } from '/src/lib/imagePrep.js';
import { recognize, detectOrientation, suggestCrop } from '/src/lib/ocr.js';
import { readIngredients } from '/src/lib/readPhoto.js';

const baseUrl = `${location.origin}/`;
const now = () => performance.now();

async function upright(url) {
  const blob = await (await fetch(url)).blob();
  const t0 = now();
  let img = await loadImage(new File([blob], url.split('/').pop(), { type: blob.type }));
  const t1 = now();
  const o = await detectOrientation(img, { baseUrl });
  if (o.turns) img = rotateImage(img, o.turns);
  return { img, turns: o.turns, method: o.method, decodeMs: Math.round(t1 - t0), orientMs: Math.round(now() - t1) };
}

window.readAll = async (url, { detMaxSide } = {}) => {
  const u = await upright(url);
  const t0 = now();
  const r = await recognize(prepareColour(u.img, null), { baseUrl, detMaxSide });
  const ocrMs = Math.round(now() - t0);
  return { text: r.text, confidence: r.confidence, lines: r.lines, turns: u.turns, method: u.method, decodeMs: u.decodeMs, orientMs: u.orientMs, ocrMs };
};

window.appFlow = async (url) => {
  const u = await upright(url);
  const t0 = now();
  const s = await suggestCrop(u.img, { baseUrl });
  const t1 = now();
  const rect = s?.rect || null;
  const r = await readIngredients(prepareColour(u.img, rect), {
    recognize: (im, o) => recognize(im, { ...o, baseUrl }), rotate: rotateImage, orientationChecked: u.method !== 'none',
  });
  return {
    text: r.text, raw: r.rawText, foundStart: r.foundStart, confidence: r.confidence, tries: r.tries,
    rect: rect && [rect.x, rect.y, rect.w, rect.h].map((x) => Math.round(x * 100) / 100), cropKind: s?.kind || null,
    turns: u.turns, decodeMs: u.decodeMs, orientMs: u.orientMs, suggestMs: Math.round(t1 - t0), readMs: Math.round(now() - t1),
  };
};

window.benchReady = true;
document.getElementById('status').textContent = 'ready';

/** Debug: the line boxes found on the upright photo, an overlay picture, and what the recogniser sees for some lines. */
window.debugLines = async (url, { pick = [] } = {}) => {
  const { recWidth, REC_HEIGHT } = await import('/src/lib/paddleCore.js');
  const u = await upright(url);
  const canvas = prepareColour(u.img, null);
  const r = await recognize(canvas, { baseUrl, debug: true });
  const k = 1400 / Math.max(canvas.width, canvas.height);
  const ov = document.createElement('canvas');
  ov.width = Math.round(canvas.width * k); ov.height = Math.round(canvas.height * k);
  const o = ov.getContext('2d');
  o.drawImage(canvas, 0, 0, ov.width, ov.height);
  o.strokeStyle = 'red'; o.lineWidth = 1.5; o.font = '11px sans-serif'; o.fillStyle = 'yellow';
  r.items.forEach((b, i) => {
    o.save(); o.translate(b.cx * k, b.cy * k); o.rotate(b.angle);
    o.strokeRect((-b.len / 2) * k, (-b.thick / 2) * k, b.len * k, b.thick * k);
    o.fillText(String(i), (-b.len / 2) * k, (-b.thick / 2) * k - 1);
    o.restore();
  });
  const crops = pick.map((i) => {
    const b = r.items[i];
    const W = recWidth(b, REC_HEIGHT);
    const c = document.createElement('canvas'); c.width = W; c.height = REC_HEIGHT;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, REC_HEIGHT);
    x.translate(W / 2, REC_HEIGHT / 2); x.scale(W / b.len, REC_HEIGHT / b.thick); x.rotate(-b.angle); x.translate(-b.cx, -b.cy);
    x.drawImage(canvas, 0, 0);
    return { i, text: b.text, W, url: c.toDataURL('image/png') };
  });
  return { width: canvas.width, height: canvas.height, items: r.items.map((b, i) => ({ i, ...b, cx: Math.round(b.cx), cy: Math.round(b.cy), len: Math.round(b.len), thick: Math.round(b.thick) })), overlay: ov.toDataURL('image/jpeg', 0.85), crops };
};
