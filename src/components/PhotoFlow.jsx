import { useEffect, useRef, useState } from 'react';
import { t } from '../lib/i18n.js';
import { loadImage, previewCanvas, prepareForOcr, imageSize } from '../lib/imagePrep.js';
import { extractIngredients, needsBetterPhoto } from '../lib/ocrText.js';
import CropBox from './CropBox.jsx';
import PhotoButton from './PhotoButton.jsx';
import ProductHeader from './ProductHeader.jsx';

const DEFAULT_RECT = { x: 0.04, y: 0.15, w: 0.92, h: 0.55 };
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
  const imgRef = useRef(null);

  // Decode the photo (EXIF orientation applied) and show the crop step.
  useEffect(() => {
    let cancelled = false;
    setStep('loading');
    setReview(null);
    setError(null);
    setRect(DEFAULT_RECT);
    loadImage(file)
      .then((img) => {
        if (cancelled) { img.close?.(); return; }
        imgRef.current?.close?.();
        imgRef.current = img;
        setPreview(previewCanvas(img, 1200).toDataURL('image/jpeg', 0.85));
        setStep('crop');
      })
      .catch(() => {
        if (!cancelled) { setError('photoLoadError'); setStep('error'); }
      });
    return () => { cancelled = true; };
  }, [file]);

  // Free the decoded photo when the flow closes.
  useEffect(() => () => imgRef.current?.close?.(), []);

  const read = async (cropRect) => {
    setStep('reading');
    setProgress({ phase: 'init', progress: 0 });
    try {
      const canvas = prepareForOcr(imgRef.current, cropRect);
      const thumb = previewCanvas(canvas, 600).toDataURL('image/jpeg', 0.8);
      const { recognize } = await import('../lib/ocr.js');
      const ocr = await recognize(canvas, { cropped: !!cropRect, onProgress: setProgress });
      const extracted = extractIngredients(ocr.text);
      setReview({ text: extracted.text, confidence: ocr.confidence, thumb, foundStart: extracted.foundStart });
      setStep('review');
    } catch (err) {
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
          <h2 className="card-title">{t(lang, 'cropTitle')}</h2>
          <p className="muted small">{t(lang, 'cropHint')}</p>
          <div className="crop-wrap" style={{ aspectRatio: `${width} / ${height}` }}>
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
    const label = downloading ? 'ocrDownloading' : progress.phase === 'recognize' ? 'ocrReading' : 'ocrPreparing';
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
