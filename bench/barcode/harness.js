/*
 * Runs the app's real photo barcode path (native BarcodeDetector when the
 * browser has one, else ZXing-C++ with its retry passes) for run.mjs.
 */
import { decodeImageFile } from '/src/lib/scanner.js';

window.decode = async (url) => {
  const blob = await (await fetch(url)).blob();
  const file = new File([blob], url.split('/').pop(), { type: blob.type });
  const t0 = performance.now();
  try {
    const r = await decodeImageFile(file);
    return { code: r.code, format: r.format, ms: Math.round(performance.now() - t0) };
  } catch (err) {
    return { code: null, error: String(err?.message || err), ms: Math.round(performance.now() - t0) };
  }
};
window.hasNativeDetector = 'BarcodeDetector' in window;
window.benchReady = true;
document.getElementById('status').textContent = 'ready';
