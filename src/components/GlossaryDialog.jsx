import { useEffect, useRef } from 'react';
import { t, pick } from '../lib/i18n.js';
import { GLOSSARY } from '../data/glossary.js';

/** The glossary as a dialog, scrolled to the asked term. Esc or the button closes it. */
export default function GlossaryDialog({ lang, term, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current?.querySelector(`#gl-${term}`) || ref.current?.querySelector('h2');
    el?.scrollIntoView?.({ block: 'start' });
    ref.current?.querySelector('h2')?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [term, onClose]);
  return (
    <div className="glossary-backdrop" onClick={onClose}>
      <div className="glossary card" role="dialog" aria-modal="true" aria-labelledby="gl-title" ref={ref} onClick={(e) => e.stopPropagation()}>
        <h2 id="gl-title" className="card-title" tabIndex={-1}>📖 {t(lang, 'glossaryTitle')}</h2>
        <dl>
          {GLOSSARY.map((g) => (
            <div key={g.id} id={`gl-${g.id}`} className={`gl-item${g.id === term ? ' current' : ''}`}>
              <dt>{pick(g.term, lang)}</dt>
              <dd>{pick(g.text, lang)}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="btn primary block" onClick={onClose}>{t(lang, 'close')}</button>
      </div>
    </div>
  );
}
