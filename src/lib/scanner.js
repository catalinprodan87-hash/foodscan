/**
 * Barcode reading for the camera and for photos. Loaded lazily.
 *
 * 1. The browser's own BarcodeDetector where it exists (Chrome on Android:
 *    Google's ML Kit detector – fast and very tolerant).
 * 2. Otherwise ZXing-C++ compiled to WebAssembly (zxing-wasm), self-hosted at
 *    ./scan/zxing_reader.wasm – much stronger than the old zxing-js on blurry,
 *    small, rotated or noisy barcodes.
 *
 * Misreads are filtered: the camera needs the same code in two frames, photos
 * need two agreeing decoding passes (see camera.js), and every code must pass
 * its check digit.
 */
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import {
  CAMERA_CONSTRAINTS, NATIVE_FORMATS, ZXING_FORMATS, appFormat, createFrameVoter, pickConfirmedRead,
  pickMainBackCamera, vibrate,
} from './camera.js';
import { normalizeBarcode, isValidGtin } from './lookup.js';
import { loadImage } from './imagePrep.js';

let zxingReady = false;
function ensureZxing() {
  if (zxingReady) return;
  const wasmUrl = new URL('scan/zxing_reader.wasm', document.baseURI).href;
  prepareZXingModule({
    overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
    fireImmediately: false,
  });
  zxingReady = true;
}

let nativePromise = null;
/** Native BarcodeDetector for retail formats, or null. */
export function getNativeDetector() {
  if (!nativePromise) {
    nativePromise = (async () => {
      const BD = globalThis.BarcodeDetector;
      if (!BD) return null;
      try {
        const supported = await BD.getSupportedFormats();
        const formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
        return formats.includes('ean_13') ? new BD({ formats }) : null;
      } catch {
        return null;
      }
    })();
  }
  return nativePromise;
}

const ZXING_OPTS = {
  formats: ZXING_FORMATS,
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
  maxNumberOfSymbols: 1,
};

/** Barcode → normalised code that passes its check digit, or null. */
function accept(raw, format) {
  const f = appFormat(format);
  if (!f) return null;
  const code = normalizeBarcode(raw, f);
  return code && isValidGtin(code) ? { code, format: f } : null;
}

async function zxingRead(canvas, extra = {}) {
  ensureZxing();
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const results = await readBarcodes(ctx.getImageData(0, 0, canvas.width, canvas.height), { ...ZXING_OPTS, ...extra });
  for (const r of results) {
    if (!r.isValid) continue;
    const ok = accept(r.text, r.format);
    if (ok) return ok;
  }
  return null;
}

async function nativeRead(detector, source) {
  try {
    const found = await detector.detect(source);
    for (const b of found) {
      const ok = accept(b.rawValue, b.format);
      if (ok) return ok;
    }
  } catch { /* fall back to zxing */ }
  return null;
}

// ─────────────────────────────── camera ──────────────────────────────────

function frameCanvas(video, maxSide = 1280) {
  const w = video.videoWidth;
  const h = video.videoHeight;
  // Region of interest: the middle of the picture, where the scan frame is.
  const sw = Math.round(w * 0.9);
  const sh = Math.round(h * 0.7);
  const k = Math.min(1, maxSide / Math.max(sw, sh));
  const c = frameCanvas.c || (frameCanvas.c = document.createElement('canvas'));
  c.width = Math.round(sw * k);
  c.height = Math.round(sh * k);
  c.getContext('2d', { willReadFrequently: true }).drawImage(video, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, c.width, c.height);
  return c;
}

async function openCamera() {
  let stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
  try {
    // Labels are only available after permission; switch to the main lens if needed.
    const devices = await navigator.mediaDevices.enumerateDevices();
    const current = stream.getVideoTracks()[0]?.getSettings?.().deviceId || null;
    const better = pickMainBackCamera(devices, current);
    if (better) {
      const next = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { ...CAMERA_CONSTRAINTS.video, facingMode: undefined, deviceId: { exact: better } },
      });
      stream.getTracks().forEach((t) => t.stop());
      stream = next;
    }
  } catch { /* keep the first camera */ }
  return stream;
}

async function tuneTrack(track) {
  const caps = track.getCapabilities?.() || {};
  const advanced = [];
  if (caps.focusMode?.includes('continuous')) advanced.push({ focusMode: 'continuous' });
  // A little zoom lets people hold the phone a bit farther away, where the
  // lens can focus, while the barcode still fills the frame.
  if (caps.zoom && caps.zoom.max >= 1.5) advanced.push({ zoom: Math.min(1.6, caps.zoom.max) });
  if (advanced.length) {
    try { await track.applyConstraints({ advanced }); } catch { /* not supported */ }
  }
  return { torch: !!caps.torch };
}

/**
 * Starts the back camera on `videoEl` and calls `onDetect({code, format})`
 * once (the same code must be read in two frames). The camera stops as soon
 * as a code is accepted. Returns synchronously, so a screen that closes while
 * the camera is starting can stop it.
 * @param {{onReady?: (info: {torch: boolean, engine: string}) => void}} options
 * @returns {{stop: () => void, setTorch: (on: boolean) => Promise<boolean>}}
 */
/**
 * @param {{onReady?: Function, continuous?: boolean}} opts continuous: keep scanning
 *   after a code (shopping mode); the caller ignores repeats of the same code.
 */
export function startCameraScan(videoEl, onDetect, onError, { onReady, continuous = false } = {}) {
  let stopped = false;
  let stream = null;
  let timer = null;
  const vote = createFrameVoter({ needed: 2, windowMs: 1500 });

  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    stream?.getTracks().forEach((t) => t.stop());
    if (videoEl) videoEl.srcObject = null;
  };

  (async () => {
    try {
      stream = await openCamera();
      if (stopped) { stop(); return; }
      videoEl.srcObject = stream;
      videoEl.setAttribute('playsinline', '');
      videoEl.muted = true;
      await videoEl.play().catch(() => {});
      const track = stream.getVideoTracks()[0];
      const { torch } = await tuneTrack(track);
      const native = await getNativeDetector();
      onReady?.({ torch, engine: native ? 'native' : 'zxing' });

      // Without a native detector, cycle through decoding strategies frame by
      // frame: fast, full resolution with every option, then tilted ±30°.
      const strategies = [
        () => zxingRead(frameCanvas(videoEl, 1280), { tryRotate: false, tryDownscale: false }),
        () => zxingRead(frameCanvas(videoEl, 1920)),
        () => zxingRead(rotated(frameCanvas(videoEl, 1280), 30), { tryDownscale: false }),
        () => zxingRead(frameCanvas(videoEl, 1280), { tryRotate: false, tryDownscale: false }),
        () => zxingRead(frameCanvas(videoEl, 1920)),
        () => zxingRead(rotated(frameCanvas(videoEl, 1280), -30), { tryDownscale: false }),
      ];
      let frame = 0;

      const tick = async () => {
        if (stopped) return;
        if (videoEl.readyState >= 2 && videoEl.videoWidth) {
          const hit = native
            ? await nativeRead(native, videoEl)
            : await strategies[frame++ % strategies.length]();
          if (stopped) return;
          if (hit && vote(hit.code)) {
            if (!continuous) {
              stop();
              vibrate();
              onDetect(hit);
              return;
            }
            onDetect(hit); // shopping mode: the caller vibrates for new products only
          }
        }
        timer = setTimeout(tick, native ? 80 : 120);
      };
      tick();
    } catch (err) {
      if (!stopped) onError?.(err);
    }
  })();

  return {
    stop,
    async setTorch(on) {
      const track = stream?.getVideoTracks()[0];
      if (!track) return false;
      try {
        await track.applyConstraints({ advanced: [{ torch: !!on }] });
        return true;
      } catch {
        return false;
      }
    },
  };
}

// ─────────────────────────────── photos ──────────────────────────────────

function drawScaled(img, maxSide, crop) {
  const [sx, sy, sw, sh] = crop || [0, 0, img.width, img.height];
  const k = Math.min(1, maxSide / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * k));
  c.height = Math.max(1, Math.round(sh * k));
  c.getContext('2d', { willReadFrequently: true }).drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}

function rotated(src, deg) {
  const a = (deg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(a));
  const sin = Math.abs(Math.sin(a));
  const r = document.createElement('canvas');
  r.width = Math.round(src.width * cos + src.height * sin);
  r.height = Math.round(src.width * sin + src.height * cos);
  const x = r.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff';
  x.fillRect(0, 0, r.width, r.height);
  x.translate(r.width / 2, r.height / 2);
  x.rotate(a);
  x.drawImage(src, -src.width / 2, -src.height / 2);
  return r;
}

/** Unsharp mask: helps with slightly out-of-focus photos. */
function sharpened(src, amount = 1.6) {
  const { width: w, height: h } = src;
  const b = document.createElement('canvas');
  b.width = w;
  b.height = h;
  const bx = b.getContext('2d', { willReadFrequently: true });
  bx.filter = 'blur(2px)';
  bx.drawImage(src, 0, 0);
  const out = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h);
  const blur = bx.getImageData(0, 0, w, h).data;
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    for (let k = 0; k < 3; k++) d[i + k] = d[i + k] + amount * (d[i + k] - blur[i + k]);
  }
  const r = document.createElement('canvas');
  r.width = w;
  r.height = h;
  r.getContext('2d').putImageData(out, 0, 0);
  return r;
}

/**
 * Reads a barcode from a photo or screenshot. Tries the native detector, then
 * ZXing-C++ on several scales, crops, sharpened and rotated versions, and
 * accepts a code only when two passes agree (or a plain pass is unambiguous).
 * @returns {Promise<{code: string, format: string}>} rejects if none found
 */
export async function decodeImageFile(file) {
  const img = await loadImage(file);
  try {
    const native = await getNativeDetector();
    if (native) {
      const hit = (await nativeRead(native, img)) || (await nativeRead(native, drawScaled(img, 1600)));
      if (hit) return hit;
    }
    const W = img.width;
    const H = img.height;
    const crops = [
      [W * 0.2, H * 0.2, W * 0.6, H * 0.6],
      [0, 0, W * 0.6, H * 0.6], [W * 0.4, 0, W * 0.6, H * 0.6],
      [0, H * 0.4, W * 0.6, H * 0.6], [W * 0.4, H * 0.4, W * 0.6, H * 0.6],
    ];
    const passes = [
      { plain: true, run: () => zxingRead(drawScaled(img, 2400)) },
      { plain: true, run: () => zxingRead(drawScaled(img, 1400)) },
      ...crops.map((c) => ({ plain: true, run: () => zxingRead(drawScaled(img, 2000, c)) })),
      { plain: false, run: () => zxingRead(drawScaled(img, 1600), { binarizer: 'GlobalHistogram' }) },
      { plain: false, run: () => zxingRead(sharpened(drawScaled(img, 1600))) },
      { plain: false, run: () => zxingRead(sharpened(drawScaled(img, 1600, crops[0]), 2.5)) },
      ...[30, -30, 45, -45, 60, -60].map((deg) => ({ plain: false, run: () => zxingRead(rotated(drawScaled(img, 1600), deg)) })),
      { plain: false, run: () => zxingRead(rotated(sharpened(drawScaled(img, 1400)), 30)) },
      { plain: false, run: () => zxingRead(rotated(sharpened(drawScaled(img, 1400)), -30)) },
      { plain: true, run: () => zxingRead(drawScaled(img, 900)) },
      { plain: false, run: () => zxingRead(sharpened(drawScaled(img, 900), 2)) },
    ];
    const reads = [];
    const formats = new Map();
    for (const pass of passes) {
      const hit = await pass.run();
      if (!hit) continue;
      reads.push({ code: hit.code, plain: pass.plain });
      formats.set(hit.code, hit.format);
      const counts = reads.filter((r) => r.code === hit.code).length;
      if (counts >= 2) return hit;
    }
    const code = pickConfirmedRead(reads);
    if (code) return { code, format: formats.get(code) };
    throw new Error('No barcode found');
  } finally {
    img.close?.();
  }
}
