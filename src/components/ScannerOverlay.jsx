import { useEffect, useRef, useState } from 'react';
import { t } from '../lib/i18n.js';
import { classifyCameraError } from '../lib/camera.js';
import { normalizeBarcode } from '../lib/lookup.js';
import { startCameraScan } from '../lib/scanner.js';
import BarcodeEntry from './BarcodeEntry.jsx';

/**
 * Full-screen camera scanner. Loaded lazily (React.lazy) together with zxing.
 * The camera stops as soon as a code is read and when the overlay closes.
 */
export default function ScannerOverlay({ lang, onCode, onClose }) {
  const videoRef = useRef(null);
  const [state, setState] = useState('starting'); // starting | scanning | error
  const [errorKind, setErrorKind] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    const video = videoRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorKind(classifyCameraError(null));
      setState('error');
      return undefined;
    }
    setState('starting');
    const onPlaying = () => setState('scanning');
    video.addEventListener('playing', onPlaying);

    const scan = startCameraScan(
      video,
      ({ code, format }) => {
        const normalized = normalizeBarcode(code, format);
        if (normalized) onCodeRef.current(normalized, format);
        else setAttempt((n) => n + 1); // unusable read: the camera stopped, start again
      },
      (err) => {
        setErrorKind(classifyCameraError(err));
        setState('error');
      },
    );
    return () => {
      video.removeEventListener('playing', onPlaying);
      scan.stop();
    };
  }, [attempt]);

  // While open: lock page scroll, close on Escape, and close (camera off)
  // when the page goes to the background (app switch, screen lock).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose();
    const onHide = () => document.visibilityState === 'hidden' && onClose();
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [onClose]);

  return (
    <div className="scanner" role="dialog" aria-modal="true" aria-label={t(lang, 'scanButton')}>
      <video ref={videoRef} className="scanner-video" muted playsInline autoPlay />
      {state !== 'error' && (
        <>
          <div className="scan-frame" aria-hidden="true">
            <span className="scan-line" />
          </div>
          <p className="scanner-hint" aria-live="polite">
            {t(lang, state === 'starting' ? 'cameraStarting' : 'scanHint')}
          </p>
        </>
      )}
      <button type="button" className="scanner-close" onClick={onClose} aria-label={t(lang, 'close')}>
        ✕
      </button>

      {state === 'error' && (
        <div className="scanner-fallback card">
          <p className="camera-error" role="alert">{t(lang, 'camera_' + errorKind)}</p>
          {(errorKind === 'busy' || errorKind === 'unknown') && (
            <button type="button" className="btn ghost block" onClick={() => setAttempt((n) => n + 1)}>
              {t(lang, 'tryAgain')}
            </button>
          )}
          <BarcodeEntry lang={lang} onCode={onCode} autoFocus />
        </div>
      )}
    </div>
  );
}
