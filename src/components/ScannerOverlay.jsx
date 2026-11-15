import { useEffect, useRef, useState } from 'react';
import { t } from '../lib/i18n.js';
import { classifyCameraError } from '../lib/camera.js';
import { startCameraScan } from '../lib/scanner.js';
import BarcodeEntry from './BarcodeEntry.jsx';
import { IDLE_STOP_MS } from '../lib/shopping.js';

const SLOW_HINT_MS = 10000;
const VERDICT_ICON = { bad: '✕', warn: '!', ok: '✓', unknown: '?' };

/** One scanned product in shopping mode. */
function ShopCard({ lang, item, onOpen }) {
  const badge = { saved: 'shopSaved', no_ingredients: 'shopNoIngredients', not_found: 'shopNotFound', in_store: 'shopInStore', error: 'shopError' }[item.state];
  return (
    <li>
      <button type="button" className={`shop-card verdict-dot-border-${item.verdict || 'none'}`} onClick={() => onOpen(item)}>
        <span className={`shop-verdict verdict-dot-${item.verdict || 'unknown'}`} aria-hidden="true">{item.state === 'loading' ? '…' : VERDICT_ICON[item.verdict] || '?'}</span>
        <span className="shop-text">
          <span className="shop-name">{item.name || item.code}</span>
          <span className="shop-sub">
            {item.state === 'loading' ? t(lang, 'shopLooking') : [item.verdict && t(lang, 'verdict_' + item.verdict), item.reason].filter(Boolean).join(' · ')}
          </span>
          {badge && <span className={`shop-badge shop-badge-${item.state}`}>{t(lang, badge)}</span>}
        </span>
      </button>
    </li>
  );
}

/**
 * Full-screen camera scanner (lazy-loaded with the decoder). The camera stops
 * as soon as a code is accepted, when the overlay closes, and when the page
 * goes to the background.
 */
export default function ScannerOverlay({ lang, onCode, onClose, shopping = false, onShopping, items = [], onOpenItem }) {
  const videoRef = useRef(null);
  const scanRef = useRef(null);
  const [state, setState] = useState('starting'); // starting | scanning | error | manual
  const [errorKind, setErrorKind] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [torch, setTorch] = useState({ supported: false, on: false });
  const [slow, setSlow] = useState(false);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const [paused, setPaused] = useState(false); // shopping mode: camera off after 5 min without a new code
  const lastAt = items[0]?.at || 0;

  // Shopping mode: stop the camera after IDLE_STOP_MS without a new product (battery, heat).
  useEffect(() => {
    if (!shopping || paused) return undefined;
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - Math.max(lastAt, started) > IDLE_STOP_MS) {
        scanRef.current?.stop();
        setPaused(true);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [shopping, paused, lastAt, attempt]);

  useEffect(() => {
    if (state === 'manual' || paused) return undefined;
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
        continuous: shopping,
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
  }, [attempt, state === 'manual', shopping, paused]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const live = (state === 'starting' || state === 'scanning') && !paused;

  return (
    <div className={`scanner${shopping ? ' shopping' : ''}`} role="dialog" aria-modal="true" aria-label={t(lang, 'scanButton')}>
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
              {onShopping && (
                <button type="button" className="scanner-pill shop-toggle" aria-pressed={shopping} onClick={() => onShopping(!shopping)}>
                  🛒 {t(lang, 'shopMode')}
                </button>
              )}
            </div>
          </div>
        </>
      )}
      {shopping && paused && (
        <div className="scanner-hint">
          <p className="scanner-slow">{t(lang, 'shopPaused')}</p>
          <button type="button" className="scanner-pill" onClick={() => { setPaused(false); setAttempt((n) => n + 1); }}>📷 {t(lang, 'shopResume')}</button>
        </div>
      )}
      {shopping && (
        <section className="shop-sheet" aria-label={t(lang, 'shopListTitle')}>
          <h2 className="shop-title">{t(lang, 'shopListTitle')} <span className="badge">{items.length}</span></h2>
          {items.length === 0 ? <p className="shop-empty">{t(lang, 'shopEmpty')}</p> : (
            <ul className="shop-list" aria-live="polite">
              {items.map((item) => <ShopCard key={item.code} lang={lang} item={item} onOpen={onOpenItem} />)}
            </ul>
          )}
        </section>
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
