import { t } from '../lib/i18n.js';
import TypeSelector from './TypeSelector.jsx';
import BarcodeEntry from './BarcodeEntry.jsx';
import IngredientInput from './IngredientInput.jsx';
import AvoidSettings from './AvoidSettings.jsx';
import PhotoButton from './PhotoButton.jsx';

/** Home: scan (main action) → manual barcode / photo → paste ingredients. */
export default function Home({
  lang, type, typeAuto, onType, onScan, onCode, onPhoto, text, onText, onAnalyze, avoid, onAvoid,
}) {
  return (
    <>
      <section className="card scan-card">
        <h2 className="card-title">{t(lang, 'homeTitle')}</h2>
        <p className="muted small">{t(lang, 'homeHint')}</p>
        <TypeSelector lang={lang} value={type} auto={typeAuto} onChange={onType} />
        <button type="button" className="btn primary scan-btn" onClick={onScan}>
          <span className="scan-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
              <path d="M7 8v8M10 8v8M13 8v8M16 8v8" />
            </svg>
          </span>
          {t(lang, 'scanButton')}
        </button>
        <PhotoButton lang={lang} onPhoto={onPhoto} className="btn photo-main-btn" />
        <p className="muted small privacy-note">🔒 {t(lang, 'photoPrivacy')}</p>
        <div className="divider"><span>{t(lang, 'or')}</span></div>
        <BarcodeEntry lang={lang} onCode={onCode} />
      </section>
      <IngredientInput lang={lang} value={text} onChange={onText} onAnalyze={onAnalyze} type={type} />
      <AvoidSettings lang={lang} state={avoid} onChange={onAvoid} type={type} />
    </>
  );
}
