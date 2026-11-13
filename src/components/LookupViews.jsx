import { useState } from 'react';
import { t } from '../lib/i18n.js';
import ProductHeader from './ProductHeader.jsx';
import { NovaCard } from './Result.jsx';
import AdditiveList from './AdditiveList.jsx';

export function LookupLoading({ lang, code, onCancel }) {
  return (
    <section className="card lookup-loading" aria-live="polite" aria-busy="true">
      <div className="spinner" aria-hidden="true" />
      <h2 className="card-title">{t(lang, 'lookupLoading')}</h2>
      <p className="mono">{code}</p>
      <p className="muted small">{t(lang, 'lookupSources')}</p>
      <button type="button" className="btn ghost" onClick={onCancel}>{t(lang, 'cancel')}</button>
    </section>
  );
}

/** "Paste the ingredients" prompt used when a lookup has no ingredients list. */
export function PastePrompt({ lang, onAnalyze, placeholderKey = 'inputPlaceholder' }) {
  const [text, setText] = useState('');
  return (
    <form
      className="paste-prompt"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onAnalyze(text);
      }}
    >
      <label htmlFor="paste-ingredients" className="card-title">{t(lang, 'inputTitle')}</label>
      <textarea
        id="paste-ingredients"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t(lang, placeholderKey)}
        spellCheck={false}
        autoCapitalize="off"
      />
      <p className="muted small">{t(lang, 'photoOcrSoon')}</p>
      <button type="submit" className="btn primary" disabled={!text.trim()}>{t(lang, 'analyze')}</button>
    </form>
  );
}

export function NotFound({ lang, code, onAnalyze, onBack }) {
  return (
    <div className="result">
      <section className="card notice">
        <h2 className="card-title">🔍 {t(lang, 'notFoundTitle')}</h2>
        <p>{t(lang, 'notFoundText', { code })}</p>
        <PastePrompt lang={lang} onAnalyze={onAnalyze} />
      </section>
      <button type="button" className="btn ghost block" onClick={onBack}>{t(lang, 'back')}</button>
    </div>
  );
}

/** Product found but without ingredients: show what is available + paste prompt. */
export function NoIngredients({ lang, product, partial, onAnalyze, onBack }) {
  const food = product.productType === 'food';
  const placeholderKey = food ? 'inputPlaceholder' : 'inputPlaceholder_' + product.productType;
  return (
    <div className="result">
      <ProductHeader lang={lang} product={product} />
      <section className="card notice">
        <h2 className="card-title">📝 {t(lang, 'noIngredientsTitle')}</h2>
        <p>{t(lang, 'noIngredientsText', { source: product.source })}</p>
        <PastePrompt lang={lang} onAnalyze={onAnalyze} placeholderKey={placeholderKey} />
      </section>
      {food && partial && (product.nova || product.nutriscore) && (
        <NovaCard lang={lang} processing={partial.processing} nutriscore={partial.nutriscore} />
      )}
      {food && partial && partial.additives.length > 0 && (
        <AdditiveList lang={lang} additives={partial.additives} title={t(lang, 'tagsAdditives')} />
      )}
      <button type="button" className="btn ghost block" onClick={onBack}>{t(lang, 'back')}</button>
    </div>
  );
}

export function LookupFailed({ lang, code, kind, onRetry, onAnalyze, onBack }) {
  return (
    <div className="result">
      <section className="card notice notice-error" role="alert">
        <h2 className="card-title">📡 {t(lang, 'errorTitle')}</h2>
        <p>{t(lang, 'error_' + (kind || 'network'))}</p>
        <p className="mono small">{code}</p>
        <button type="button" className="btn primary" onClick={onRetry}>{t(lang, 'retry')}</button>
      </section>
      <section className="card">
        <PastePrompt lang={lang} onAnalyze={onAnalyze} />
      </section>
      <button type="button" className="btn ghost block" onClick={onBack}>{t(lang, 'back')}</button>
    </div>
  );
}
