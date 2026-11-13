import { useEffect, useRef, useState } from 'react';
import { t, LANGS } from '../lib/i18n.js';

const SLIDES = [
  { icon: '🔍', title: 'onb1Title', text: 'onb1Text' },
  { icon: 'ℹ️', title: 'onb2Title', text: 'onb2Text' },
  { icon: '📷', title: 'onb3Title', text: 'onb3Text' },
];

/** First-run slides: what it does, disclaimer, camera & privacy. */
export default function Onboarding({ lang, onLang, onDone }) {
  const [i, setI] = useState(0);
  const titleRef = useRef(null);
  const last = i === SLIDES.length - 1;
  const s = SLIDES[i];

  useEffect(() => { titleRef.current?.focus(); }, [i]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onb-title">
      <div className="onboarding-top">
        <div className="lang-switch" role="group" aria-label={t(lang, 'langLabel')}>
          {LANGS.map((l) => (
            <button key={l} type="button" className={l === lang ? 'active' : ''} aria-pressed={l === lang} onClick={() => onLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        {!last && <button type="button" className="link-btn" onClick={onDone}>{t(lang, 'onbSkip')}</button>}
      </div>
      <div className="onboarding-slide">
        <div className="onboarding-icon" aria-hidden="true">{s.icon}</div>
        <h1 id="onb-title" ref={titleRef} tabIndex={-1}>{t(lang, s.title)}</h1>
        <p>{t(lang, s.text)}</p>
      </div>
      <div className="onboarding-bottom">
        <div className="dots" aria-label={t(lang, 'onbStep', { n: i + 1, total: SLIDES.length })} role="img">
          {SLIDES.map((_, n) => <span key={n} className={n === i ? 'dot active' : 'dot'} />)}
        </div>
        <button type="button" className="btn primary block" onClick={() => (last ? onDone() : setI(i + 1))}>
          {t(lang, last ? 'onbStart' : 'onbNext')}
        </button>
      </div>
    </div>
  );
}
