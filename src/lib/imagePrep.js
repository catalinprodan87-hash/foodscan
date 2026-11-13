/**
 * Photo preprocessing for OCR: EXIF rotation, crop, downscale, grayscale,
 * contrast stretch. The pixel maths are pure functions (unit-tested); the
 * canvas wrappers run in the browser only.
 */

export const OCR_MAX_SIDE = 2000;

/** Output size so the long side is at most `max` (never upscales). */
export function fitSize(width, height, max = OCR_MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
}

/** Normalised crop rect {x, y, w, h} (0–1) → pixel rect inside the image. */
export function cropPixels(rect, width, height) {
  if (!rect) return { sx: 0, sy: 0, sw: width, sh: height };
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const x = clamp(rect.x);
  const y = clamp(rect.y);
  const w = Math.max(0.02, Math.min(1 - x, rect.w));
  const h = Math.max(0.02, Math.min(1 - y, rect.h));
  return { sx: Math.round(x * width), sy: Math.round(y * height), sw: Math.max(1, Math.round(w * width)), sh: Math.max(1, Math.round(h * height)) };
}

/**
 * In place: RGBA → grayscale (Rec. 601 luma) with a contrast stretch that maps
 * the 2nd–98th percentile to 0–255 (robust to glare spots and dark edges).
 * @param {Uint8ClampedArray} rgba
 */
export function grayscaleContrast(rgba, { low = 0.02, high = 0.98 } = {}) {
  const n = rgba.length / 4;
  const gray = new Uint8Array(n);
  const hist = new Uint32Array(256);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const g = (rgba[p] * 299 + rgba[p + 1] * 587 + rgba[p + 2] * 114) / 1000;
    gray[i] = g;
    hist[gray[i]]++;
  }
  const percentile = (q) => {
    const target = q * n;
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= target) return v;
    }
    return 255;
  };
  let lo = percentile(low);
  let hi = percentile(high);
  if (hi - lo < 16) { lo = 0; hi = 255; } // flat image: leave as is
  const span = hi - lo;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const v = Math.max(0, Math.min(255, ((gray[i] - lo) * 255) / span));
    rgba[p] = rgba[p + 1] = rgba[p + 2] = v;
    rgba[p + 3] = 255;
  }
  return { lo, hi };
}

// ───────────────────────────── browser only ──────────────────────────────

/**
 * Decodes a photo with its EXIF orientation applied (phones store portrait
 * photos as rotated landscape pixels).
 * @returns {Promise<ImageBitmap|HTMLImageElement>}
 */
export async function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* fall back to <img>, which applies EXIF orientation in current browsers */ }
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

export function imageSize(img) {
  return { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
}

/** Downscaled colour copy for showing the photo (crop step, thumbnail). */
export function previewCanvas(img, max = 1200) {
  const { width, height } = imageSize(img);
  const size = fitSize(width, height, max);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext('2d').drawImage(img, 0, 0, size.width, size.height);
  return canvas;
}

/**
 * Crop → downscale (long side ≤ 2000 px) → grayscale + contrast.
 * @param {{x, y, w, h}|null} rect normalised crop, or null for the whole photo
 * @returns {HTMLCanvasElement}
 */
export function prepareForOcr(img, rect = null) {
  const { width, height } = imageSize(img);
  const { sx, sy, sw, sh } = cropPixels(rect, width, height);
  const out = fitSize(sw, sh);
  const canvas = document.createElement('canvas');
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
  const data = ctx.getImageData(0, 0, out.width, out.height);
  grayscaleContrast(data.data);
  ctx.putImageData(data, 0, 0);
  return canvas;
}
