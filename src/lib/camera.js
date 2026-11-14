/**
 * Camera and barcode helpers without decoder dependencies (main bundle,
 * unit-tested in Node).
 */

/** App format names (used by normalizeBarcode for UPC-E expansion). */
export const SCAN_FORMATS = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E'];

/** Native BarcodeDetector names. */
export const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

/** zxing-wasm names. */
export const ZXING_FORMATS = ['EAN13', 'EAN8', 'UPCA', 'UPCE'];

/** 'ean_13' / 'EAN13' / 'EAN-13' / 'EAN_13' → 'EAN_13' (null if not retail). */
export function appFormat(format) {
  const f = String(format || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return { EAN13: 'EAN_13', EAN8: 'EAN_8', UPCA: 'UPC_A', UPCE: 'UPC_E' }[f] || null;
}

/**
 * Back camera, high resolution (small barcodes need pixels) and continuous
 * autofocus where the browser supports it.
 */
export const CAMERA_CONSTRAINTS = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    advanced: [{ focusMode: 'continuous' }],
  },
};

const NOT_MAIN = /ultra|wide|tele|depth|macro|infrared|\bir\b|front|user|selfie/i;
const BACK = /back|rear|environment|spate|arrière|rück/i;

/**
 * Picks the main back camera. Phones with several back lenses (e.g. Samsung)
 * often open the ultra-wide one, which cannot focus close enough for a
 * barcode. On Android the main lens is usually "camera2 0, facing back".
 * @param {MediaDeviceInfo[]} devices
 * @returns {string|null} deviceId to switch to, or null to keep the current one
 */
export function pickMainBackCamera(devices, currentId = null) {
  const backs = devices.filter((d) => d.kind === 'videoinput' && BACK.test(d.label || ''));
  if (backs.length < 2) return null;
  const byLabel = backs.find((d) => /camera2 0\b|\bcamera 0\b|\b0, facing back/i.test(d.label) && !NOT_MAIN.test(d.label))
    || backs.find((d) => !NOT_MAIN.test(d.label));
  if (!byLabel || byLabel.deviceId === currentId) return null;
  return byLabel.deviceId;
}

/**
 * Live scanning: a code is accepted when the same value is read in `needed`
 * frames within `windowMs` (filters rare misreads of blurry frames).
 */
export function createFrameVoter({ needed = 2, windowMs = 1500 } = {}) {
  const seen = new Map();
  return (code, now = Date.now()) => {
    for (const [k, v] of seen) if (now - v.last > windowMs) seen.delete(k);
    const v = seen.get(code) || { count: 0, last: now };
    v.count += 1;
    v.last = now;
    seen.set(code, v);
    return v.count >= needed;
  };
}

/**
 * Photos: reads from several decoding passes. Accept a code read by two
 * passes, or a single read from a plain pass when it is the only code seen.
 * @param {{code: string, plain: boolean}[]} reads
 */
export function pickConfirmedRead(reads) {
  const counts = new Map();
  for (const r of reads) counts.set(r.code, (counts.get(r.code) || 0) + 1);
  for (const [code, n] of counts) if (n >= 2) return code;
  if (counts.size === 1 && reads[0].plain) return reads[0].code;
  return null;
}

/**
 * Turns a getUserMedia error into an i18n key suffix:
 * 'denied' | 'notFound' | 'busy' | 'insecure' | 'unsupported' | 'unknown'.
 */
export function classifyCameraError(err, env = globalThis) {
  if (env && env.isSecureContext === false) return 'insecure';
  if (!env?.navigator?.mediaDevices?.getUserMedia) return 'unsupported';
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'notFound';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'busy';
  return 'unknown';
}

/** Short vibration on a successful scan (ignored where unsupported, e.g. iOS Safari). */
export function vibrate(nav = globalThis.navigator) {
  try {
    nav?.vibrate?.(120);
  } catch {
    /* ignore */
  }
}
