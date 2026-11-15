/*
 * Runs the app's real OCR path in the browser: decode (EXIF applied) →
 * crop + downscale (prepareColour) → PaddleOCR worker → ingredient extraction.
 * Driven by bench/ocr/run.mjs through window.readImage().
 */
import { loadImage, prepareColour, rotateImage } from '/src/lib/imagePrep.js';
import { recognize, detectOrientation, suggestCrop } from '/src/lib/ocr.js';
import { readIngredients } from '/src/lib/readPhoto.js';

const baseUrl = `${location.origin}/`;

window.readImage = async (url, crop, { retry = true } = {}) => {
  const blob = await (await fetch(url)).blob();
  const file = new File([blob], url.split('/').pop(), { type: blob.type });
  const t0 = performance.now();
  const img = await loadImage(file);
  const rect = crop ? { x: crop[0], y: crop[1], w: crop[2], h: crop[3] } : null;
  const canvas = prepareColour(img, rect);
  // The app's reading step: OCR, extraction, word clean-up, retries for weak reads.
  const r = await readIngredients(canvas, { recognize: (im, o) => recognize(im, { ...o, baseUrl }), rotate: rotateImage, shouldStop: () => !retry, orientationChecked: true });
  const ms = Math.round(performance.now() - t0);
  img.close?.();
  return { raw: r.rawText, text: r.text, foundStart: r.foundStart, confidence: r.confidence, lines: r.lines, tries: r.tries, retried: r.retried, uncertain: r.uncertain, ms };
};

/**
 * The image turned by `quarterTurns` × 90° clockwise and re-encoded as JPEG on
 * a canvas – no EXIF orientation tag, like a photo the camera saved sideways.
 */
async function rotatedFile(url, quarterTurns) {
  const blob = await (await fetch(url)).blob();
  const img = await createImageBitmap(blob);
  const odd = quarterTurns % 2 === 1;
  const c = new OffscreenCanvas(odd ? img.height : img.width, odd ? img.width : img.height);
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((quarterTurns * Math.PI) / 2);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  img.close();
  const out = await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
  return new File([out], 'rotated.jpg', { type: 'image/jpeg' });
}

/**
 * The app's photo path for a photo saved rotated: decode → automatic
 * orientation → turn → crop (rect given for the upright image) → OCR.
 */
window.readRotated = async (url, quarterTurns, crop) => {
  const file = await rotatedFile(url, quarterTurns);
  let img = await loadImage(file);
  const t0 = performance.now();
  const o = await detectOrientation(img, { baseUrl });
  const orientMs = Math.round(performance.now() - t0);
  if (o.turns) img = rotateImage(img, o.turns);
  const correct = (quarterTurns + o.turns) % 4 === 0;
  const rect = crop && correct ? { x: crop[0], y: crop[1], w: crop[2], h: crop[3] } : null;
  const t1 = performance.now();
  const r = await readIngredients(prepareColour(img, rect), { recognize: (im, opt) => recognize(im, { ...opt, baseUrl }), rotate: rotateImage, orientationChecked: o.method !== 'none' });
  return {
    turns: o.turns, method: o.method, orientConfidence: Math.round(o.confidence * 100) / 100, correct, orientMs,
    text: r.text, confidence: r.confidence, ms: Math.round(performance.now() - t1),
  };
};

/** The app's crop suggestion for an (upright) image. */
window.suggestFor = async (url) => {
  const blob = await (await fetch(url)).blob();
  const img = await loadImage(new File([blob], 'x', { type: blob.type }));
  const t0 = performance.now();
  const s = await suggestCrop(img, { baseUrl });
  return s ? { rect: [s.rect.x, s.rect.y, s.rect.w, s.rect.h], kind: s.kind, ms: Math.round(performance.now() - t0) } : { rect: null, ms: Math.round(performance.now() - t0) };
};

window.benchReady = true;
document.getElementById('status').textContent = 'ready';
