import { useEffect, useRef, useState } from 'react';
import { t } from '../lib/i18n.js';
import { loadImage, previewCanvas, prepareColour, imageSize, rotateImage } from '../lib/imagePrep.js';
import { needsBetterPhoto } from '../lib/ocrText.js';
import { readIngredients } from '../lib/readPhoto.js';
import CropBox from './CropBox.jsx';
import PhotoButton from './PhotoButton.jsx';
import ProductHeader from './ProductHeader.jsx';
import ReportProblem from './ReportProblem.jsx';
import { recordTiming } from '../lib/diagnostics.js';

const DEFAULT_RECT = { x: 0.04, y: 0.15, w: 0.92, h: 0.55 };
const ORIENT_LIMIT_MS = 3000; // after the engine is ready; then the photo stays as it is
const mb = (n) => (n / 1048576).toFixed(1);

/**
 * Photo → (optional crop) → on-device OCR → editable review → analyse.
 * Steps: loading | crop | reading | review | error
 */
export default function PhotoFlow({ lang, file, product, barcode, onAnalyze, onRetake, onCancel }) {
  const [step, setStep] = useState('loading');
  const [preview, setPreview] = useState(null); // data URL of the oriented photo
  const [rect, setRect] = useState(DEFAULT_RECT);
  const [progress, setProgress] = useState({ phase: 'init', progress: 0 });
  const [review, setReview] = useState(null); // { text, confidence, thumb, foundStart }
  const [error, setError] = useState(null);
  // Automatic orientation: { state: 'checking'|'download'|'turned'|'off', turns?, loaded?, total? }
  const [auto, setAuto] = useState({ state: 'off' });
  const orientChecked = useRef(false); // the automatic check finished for this photo (turned or not)
  const imgRef = useRef(null);
  const orientToken = useRef(null); // the running orientation check; null = cancelled
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  // Decode the photo (EXIF orientation applied) and show the crop step.
  useEffect(() => {
    let cancelled = false;
    setStep('loading');
    setReview(null);
    setError(null);
    setRect(DEFAULT_RECT);
    manualTurns.current = 0;
    loadImage(file)
      .then((img) => {
        if (cancelled) { img.close?.(); return; }
        imgRef.current?.close?.();
        imgRef.current = img;
        setPreview(previewCanvas(img, 1200).toDataURL('image/jpeg', 0.85));
        setStep('crop');
        autoOrient(img);
      })
      .catch(() => {
        if (!cancelled) { setError('photoLoadError'); setStep('error'); }
      });
    return () => { cancelled = true; };
  }, [file]);

  // Turn the working copy clockwise (EXIF did not fix the photo). OCR reads
  // exactly what is shown; the crop box starts again.
  const turnPhoto = (quarterTurns) => {
    const src = imgRef.current;
    if (!src || !quarterTurns) return;
    const turned = rotateImage(src, quarterTurns);
    src.close?.();
    imgRef.current = turned;
    setPreview(previewCanvas(turned, 1200).toDataURL('image/jpeg', 0.85));
    setRect(DEFAULT_RECT);
  };

  // ⟳ Rotește: the user decides; a running automatic check is ignored.
  const manualTurns = useRef(0);
  const rotate = () => {
    manualTurns.current++;
    orientToken.current = null;
    setAuto({ state: 'off' });
    turnPhoto(1);
  };

  /**
   * Automatic orientation (photos saved sideways / upside down without an EXIF
   * tag): measured on a small copy while the crop step is shown. On the first
   * photo the reading engine downloads first. Ignored after ORIENT_LIMIT_MS, or
   * once the user rotates or starts reading.
   */
  const autoOrient = async (img) => {
    const token = {};
    orientToken.current = token;
    orientChecked.current = false;
    setAuto({ state: 'checking' });
    const current = () => alive.current && orientToken.current === token;
    try {
      const { getEngine, detectOrientation } = await import('../lib/ocr.js');
      await getEngine({ onProgress: (p) => { if (current() && p.phase === 'download') setAuto({ state: 'download', loaded: p.loaded, total: p.total }); } });
      if (!current()) return;
      setAuto({ state: 'checking' });
      const o = await Promise.race([
        detectOrientation(img),
        new Promise((resolve) => { setTimeout(() => resolve(null), ORIENT_LIMIT_MS); }),
      ]);
      if (!current()) return;
      orientToken.current = null;
      if (!o) { recordTiming('orient', ORIENT_LIMIT_MS, false, 'time limit'); setAuto({ state: 'off' }); return; }
      recordTiming('orient', o.ms, true, `${o.method} turns ${o.turns}`);
      orientChecked.current = o.method !== 'none';
      if (o.turns && imgRef.current === img) {
        turnPhoto(o.turns);
        setAuto({ state: 'turned', turns: o.turns });
      } else {
        setAuto({ state: 'off' });
      }
    } catch {
      if (current()) { orientToken.current = null; setAuto({ state: 'off' }); }
    }
  };

  // Free the decoded photo when the flow closes.
  useEffect(() => () => imgRef.current?.close?.(), []);

  const read = async (cropRect) => {
    orientToken.current = null; // reading now: an orientation answer would come too late
    setAuto((a) => (a.state === 'turned' ? a : { state: 'off' }));
    setStep('reading');
    setProgress({ phase: 'init', progress: 0 });
    const t0 = performance.now();
    try {
      const canvas = prepareColour(imgRef.current, cropRect);
      const thumb = previewCanvas(canvas, 600).toDataURL('image/jpeg', 0.8);
      const { recognize } = await import('../lib/ocr.js');
      // A weak read gets up to two more chances (upside down, larger detector) – see readPhoto.js.
      const best = await readIngredients(canvas, {
        recognize,
        rotate: rotateImage,
        onProgress: setProgress,
        onRetry: () => setProgress({ phase: 'retry', progress: null }),
        shouldStop: () => !alive.current,
        // After a manual turn the user has set the orientation; after the automatic check, the app has.
        orientationChecked: orientChecked.current || manualTurns.current > 0,
      });
      if (!alive.current) return;
      recordTiming('ocr', performance.now() - t0, true, `${cropRect ? 'crop' : 'whole'} ${canvas.width}×${canvas.height} conf ${best.confidence} lines ${best.lines} tries ${best.tries}`);
      setReview({ text: best.text, rawText: best.rawText, confidence: best.confidence, thumb, foundStart: best.foundStart, retried: best.retried });
      setStep('review');
    } catch (err) {
      recordTiming('ocr', performance.now() - t0, false, String(err?.message || err).slice(0, 60));
      setError(navigator.onLine === false ? 'ocrErrorOffline' : 'ocrError');
      setStep('error');
    }
  };

  const header = <ProductHeader lang={lang} product={product} barcode={barcode} />;

  if (step === 'loading') {
    return <section className="card ocr-progress" aria-busy="true"><div className="spinner" aria-hidden="true" /><p>{t(lang, 'loading')}</p></section>;
  }

  if (step === 'crop') {
    const { width, height } = imgRef.current ? imageSize(imgRef.current) : { width: 1, height: 1 };
    return (
      <div className="result photo-flow">
        {header}
        <section className="card">
          <div className="crop-head">
            <h2 className="card-title">{t(lang, 'cropTitle')}</h2>
            <button type="button" className="btn ghost small-btn rotate-btn" onClick={rotate} aria-label={t(lang, 'rotateLabel')}>
              <span aria-hidden="true">⟳</span> {t(lang, 'rotate')}
            </button>
          </div>
          <p className="muted small">{t(lang, 'cropHint')}</p>
          {auto.state === 'checking' && <p className="muted small auto-orient" role="status"><span className="spinner tiny" aria-hidden="true" /> {t(lang, 'orientChecking')}</p>}
          {auto.state === 'download' && (
            <p className="muted small auto-orient" role="status">
              <span className="spinner tiny" aria-hidden="true" /> {t(lang, 'orientDownloading', { loaded: mb(auto.loaded || 0), total: mb(auto.total || 0) })}
            </p>
          )}
          {auto.state === 'turned' && <p className="small auto-orient turned" role="status">↻ {t(lang, 'orientTurned', { deg: auto.turns * 90 })}</p>}
          {/* The frame keeps the photo's exact shape (narrower for tall photos, so it fits
              in 70vh): the crop box is measured against the frame, so it must be the photo. */}
          <div className="crop-wrap" style={{ aspectRatio: `${width} / ${height}`, width: `min(100%, calc(70vh * ${(width / height).toFixed(4)}))` }}>
            <CropBox src={preview} alt={t(lang, 'photoButton')} rect={rect} onChange={setRect} />
          </div>
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => read(rect)}>{t(lang, 'cropUse')}</button>
            <button type="button" className="btn ghost" onClick={() => read(null)}>{t(lang, 'cropSkip')}</button>
          </div>
          <p className="muted small privacy-note">🔒 {t(lang, 'photoPrivacy')}</p>
        </section>
        <button type="button" className="btn ghost block" onClick={onCancel}>{t(lang, 'cancel')}</button>
      </div>
    );
  }

  if (step === 'reading') {
    const downloading = progress.phase === 'download';
    const pct = downloading
      ? (progress.total ? progress.loaded / progress.total : 0)
      : progress.phase === 'recognize' ? progress.progress : null;
    const label = downloading ? 'ocrDownloading'
      : progress.phase === 'retry' ? 'ocrRetry'
      : progress.phase === 'recognize' ? 'ocrReading'
      : progress.phase === 'detect' ? 'ocrDetecting' : 'ocrPreparing';
    return (
      <div className="result photo-flow">
        {header}
        <section className="card ocr-progress" aria-live="polite" aria-busy="true">
          <h2 className="card-title">{t(lang, label)}</h2>
          <div
            className={`progress${pct == null ? ' indeterminate' : ''}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct == null ? undefined : Math.round(pct * 100)}
          >
            <span style={pct == null ? undefined : { width: `${Math.round(pct * 100)}%` }} />
          </div>
          <p className="muted small">
            {downloading
              ? t(lang, 'ocrMb', { loaded: mb(progress.loaded), total: mb(progress.total) })
              : pct != null ? `${Math.round(pct * 100)}%` : ' '}
          </p>
          <p className="muted small privacy-note">🔒 {t(lang, 'photoPrivacy')}</p>
        </section>
        <button type="button" className="btn ghost block" onClick={onCancel}>{t(lang, 'cancel')}</button>
      </div>
    );
  }

  if (step === 'review' && review) {
    const tip = needsBetterPhoto(review);
    return (
      <div className="result photo-flow">
        {header}
        <form
          className="card review-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (review.text.trim()) onAnalyze(review.text, review.confidence);
          }}
        >
          <h2 className="card-title">{t(lang, 'reviewTitle')}</h2>
          <img className="ocr-thumb" src={review.thumb} alt="" />
          {tip && (
            <div className="photo-tip" role="note">
              <strong>💡 {t(lang, 'photoTipTitle')}</strong>
              <p>{t(lang, 'photoTip')}</p>
            </div>
          )}
          <p className="muted small">{t(lang, review.foundStart ? 'reviewHint' : 'reviewNoMarker')}</p>
          {review.retried && <p className="muted small">{t(lang, 'ocrRetried')}</p>}
          <label htmlFor="ocr-text" className="sr-only">{t(lang, 'reviewTitle')}</label>
          <textarea
            id="ocr-text"
            rows={8}
            value={review.text}
            onChange={(e) => setReview({ ...review, text: e.target.value })}
            spellCheck={false}
            autoCapitalize="off"
          />
          <p className="muted small">{t(lang, 'ocrConfidence', { value: review.confidence })}</p>
          <div className="actions">
            <button type="submit" className="btn primary" disabled={!review.text.trim()}>{t(lang, 'analyze')}</button>
            <PhotoButton lang={lang} onPhoto={onRetake} className="btn ghost" labelKey="retakePhoto" />
          </div>
        </form>
        <ReportProblem lang={lang} screen="photo-review" ocr={{ confidence: review.confidence, text: review.rawText || review.text }} product={product} />
        <button type="button" className="btn ghost block" onClick={onCancel}>{t(lang, 'cancel')}</button>
      </div>
    );
  }

  // error
  return (
    <div className="result photo-flow">
      {header}
      <section className="card notice notice-error" role="alert">
        <h2 className="card-title">📷 {t(lang, error || 'ocrError')}</h2>
        <div className="actions">
          {imgRef.current && <button type="button" className="btn primary" onClick={() => read(rect)}>{t(lang, 'retry')}</button>}
          <PhotoButton lang={lang} onPhoto={onRetake} className="btn ghost" labelKey="retakePhoto" />
        </div>
      </section>
      <button type="button" className="btn ghost block" onClick={onCancel}>{t(lang, 'cancel')}</button>
    </div>
  );
}
