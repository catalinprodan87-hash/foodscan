import { useEffect, useRef, useState } from 'react';
import { t } from '../lib/i18n.js';
import { classifyCameraError } from '../lib/camera.js';
import { startCameraScan } from '../lib/scanner.js';
import BarcodeEntry from './BarcodeEntry.jsx';

const SLOW_HINT_MS = 10000;

/**
 * Full-screen camera scanner (lazy-loaded with the decoder). The camera stops
 * as soon as a code is accepted, when the overlay closes, and when the page
 * goes to the background.
 */
export default function ScannerOverlay({ lang, onCode, onClose }) {
  const videoRef = useRef(null);
  const scanRef = useRef(null);
  const [state, setState] = useState('starting'); // starting | scanning | error | manual
  const [errorKind, setErrorKind] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [torch, setTorch] = useState({ supported: false, on: false });
  const [slow, setSlow] = useState(false);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    if (state === 'manual') return undefined;
    const video = videoRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorKind(classifyCameraError(null));
      setState('error');
      return undefined;
    }
    setState('starting');
    setSlow(false);
    const scan = startCameraScan(
      video,
      ({ code, format }) => onCodeRef.current(code, format),
      (err) => {
        setErrorKind(classifyCameraError(err));
        setState('error');
      },
      {
        onReady: ({ torch: canTorch }) => {
          setState('scanning');
          setTorch({ supported: canTorch, on: false });
        },
      },
    );
    scanRef.current = scan;
    const slowTimer = setTimeout(() => setSlow(true), SLOW_HINT_MS);
    return () => {
      clearTimeout(slowTimer);
      scan.stop();
      scanRef.current = null;
    };
  }, [attempt, state === 'manual']); // eslint-disable-line react-hooks/exhaustive-deps

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

  const toggleTorch = async () => {
    const next = !torch.on;
    if (await scanRef.current?.setTorch(next)) setTorch({ ...torch, on: next });
  };

  const live = state === 'starting' || state === 'scanning';

  return (
    <div className="scanner" role="dialog" aria-modal="true" aria-label={t(lang, 'scanButton')}>
      <video ref={videoRef} className="scanner-video" muted playsInline autoPlay aria-hidden="true" />
      {live && (
        <>
          <div className="scan-frame" aria-hidden="true">
            <span className="scan-line" />
          </div>
          <div className="scanner-hint" aria-live="polite">
            <p>{t(lang, state === 'starting' ? 'cameraStarting' : 'scanHint')}</p>
            {slow && <p className="scanner-slow">{t(lang, 'scanSlowHint')}</p>}
            <div className="scanner-actions">
              {torch.supported && (
                <button type="button" className="scanner-pill" aria-pressed={torch.on} onClick={toggleTorch}>
                  🔦 {t(lang, torch.on ? 'torchOff' : 'torchOn')}
                </button>
              )}
              <button type="button" className="scanner-pill" onClick={() => setState('manual')}>
                ⌨️ {t(lang, 'typeCode')}
              </button>
            </div>
          </div>
        </>
      )}
      <button type="button" className="scanner-close" onClick={onClose} aria-label={t(lang, 'close')}>
        ✕
      </button>

      {(state === 'error' || state === 'manual') && (
        <div className="scanner-fallback card">
          {state === 'error' && <p className="camera-error" role="alert">{t(lang, 'camera_' + errorKind)}</p>}
          {(state === 'manual' || errorKind === 'busy' || errorKind === 'unknown') && (
            <button type="button" className="btn ghost block" onClick={() => { setState('starting'); setAttempt((n) => n + 1); }}>
              📷 {t(lang, state === 'manual' ? 'backToCamera' : 'tryAgain')}
            </button>
          )}
          <BarcodeEntry lang={lang} onCode={onCode} autoFocus />
        </div>
      )}
    </div>
  );
}
