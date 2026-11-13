/** Camera helpers without any zxing dependency (kept in the main bundle, testable in Node). */

/** Barcode formats the scanner accepts (zxing BarcodeFormat names). */
export const SCAN_FORMATS = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E'];

/** Back camera preferred; `ideal` so laptops with a single camera still work. */
export const CAMERA_CONSTRAINTS = {
  audio: false,
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
};

/**
 * Turns a getUserMedia / zxing error into an i18n key suffix:
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
