/*
 * Runs the app's real OCR path in the browser: decode (EXIF applied) →
 * crop + downscale (prepareColour) → PaddleOCR worker → ingredient extraction.
 * Driven by bench/ocr/run.mjs through window.readImage().
 */
import { loadImage, prepareColour } from '/src/lib/imagePrep.js';
import { recognize } from '/src/lib/ocr.js';
import { extractIngredients } from '/src/lib/ocrText.js';

const baseUrl = `${location.origin}/`;

window.readImage = async (url, crop) => {
  const blob = await (await fetch(url)).blob();
  const file = new File([blob], url.split('/').pop(), { type: blob.type });
  const t0 = performance.now();
  const img = await loadImage(file);
  const rect = crop ? { x: crop[0], y: crop[1], w: crop[2], h: crop[3] } : null;
  const canvas = prepareColour(img, rect);
  const ocr = await recognize(canvas, { baseUrl });
  const extracted = extractIngredients(ocr.text);
  const ms = Math.round(performance.now() - t0);
  img.close?.();
  return { raw: ocr.text, text: extracted.text, foundStart: extracted.foundStart, confidence: ocr.confidence, lines: ocr.lines, ms };
};

window.benchReady = true;
document.getElementById('status').textContent = 'ready';
