/**
 * zxing-based barcode reading. Loaded lazily (dynamic import) so the decoder
 * is not part of the first page load.
 *
 * TRY_HARDER is deliberately not used: in @zxing/browser 0.2.1 its rotation
 * pass is broken (HTMLCanvasElementLuminanceSource.rotate keeps the old
 * width/height). For photos we rotate the image ourselves instead.
 */
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { SCAN_FORMATS, CAMERA_CONSTRAINTS, vibrate } from './camera.js';

const MAX_PHOTO_SIDE = 1600;

function createReader() {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, SCAN_FORMATS.map((f) => BarcodeFormat[f]));
  return new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
}

function toScan(result) {
  return { code: result.getText(), format: BarcodeFormat[result.getBarcodeFormat()] };
}

/**
 * Starts the back camera on `videoEl` and calls `onDetect({code, format})`
 * once; the camera stops as soon as a code is read. Returns a stop handle
 * synchronously, so a screen that closes while the camera is still starting
 * can stop it too. Start-up failures go to `onError(err)`.
 * @returns {{stop: () => void}}
 */
export function startCameraScan(videoEl, onDetect, onError) {
  let stopped = false;
  let controls = null;
  const stopControls = () => {
    try { controls?.stop(); } catch { /* already stopped */ }
  };

  createReader()
    .decodeFromConstraints(CAMERA_CONSTRAINTS, videoEl, (result, _err, ctrl) => {
      if (!result || stopped) return;
      stopped = true;
      controls = controls || ctrl;
      stopControls();
      vibrate();
      onDetect(toScan(result));
    })
    .then((c) => {
      controls = c;
      if (stopped) stopControls(); // closed (or detected) while starting
    })
    .catch((err) => {
      if (!stopped) onError?.(err);
    });

  return {
    stop() {
      stopped = true;
      stopControls();
    },
  };
}

async function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* fall back to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Draws the image scaled down to MAX_PHOTO_SIDE and rotated by `angle` (0 or 90). */
function toCanvas(img, angle) {
  const w0 = img.width || img.naturalWidth;
  const h0 = img.height || img.naturalHeight;
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(w0, h0));
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);
  const canvas = document.createElement('canvas');
  canvas.width = angle ? h : w;
  canvas.height = angle ? w : h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (angle) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
  } else {
    ctx.drawImage(img, 0, 0, w, h);
  }
  return canvas;
}

/**
 * Reads a barcode from an image file (photo or screenshot), trying the image
 * as-is and rotated by 90° (barcode photographed sideways).
 * @returns {Promise<{code: string, format: string}>} rejects if none found
 */
export async function decodeImageFile(file) {
  const img = await loadImage(file);
  const reader = createReader();
  let lastError;
  for (const angle of [0, 90]) {
    try {
      return toScan(reader.decodeFromCanvas(toCanvas(img, angle)));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
