import { useMemo, useState } from 'react';
import { t } from '../lib/i18n.js';
import { collectSpans, highlightSegments, shareSummary } from '../lib/share.js';

/** Ingredients text with flagged words highlighted; tap jumps to the explanation. */
/** Splits plain text around words that were left untranslated (highlighted). */
function markUnknown(str, unknown, keyBase) {
  if (!unknown?.length) return str;
  const esc = unknown.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length);
  const re = new RegExp(`(?<!\\p{L})(${esc.join('|')})(?!\\p{L})`, 'gu');
  const parts = str.split(re);
  return parts.map((p, i) => (i % 2 === 1 ? <mark key={`${keyBase}-${i}`} className="untranslated" title="?">{p}</mark> : p));
}

export function IngredientsText({ lang, text, result, unknown = [] }) {
  const segments = useMemo(() => highlightSegments(text, collectSpans(text, result)), [text, result]);
  if (!text?.trim()) return null;
  const levels = new Set(segments.filter((s) => s.level).map((s) => s.level));

  const jump = (target) => {
    const el = document.getElementById(target);
    if (!el) return;
    const details = el.querySelector('details');
    if (details) details.open = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (el.querySelector('summary') || el).focus({ preventScroll: true });
  };

  return (
    <section className="card ingredients-text" aria-labelledby="ingr-text-title">
      <h3 id="ingr-text-title" className="card-title">{t(lang, 'ingredientsTextTitle')}</h3>
      {levels.size > 0 && <p className="muted small">{t(lang, 'ingredientsTextHint')}</p>}
      <p className="ingr-body">
        {segments.map((s, i) => (s.level ? (
          <button key={i} type="button" className={`hl hl-${s.level}`} onClick={() => jump(s.target)}>{s.text}</button>
        ) : (
          <span key={i}>{markUnknown(s.text, unknown, i)}</span>
        )))}
      </p>
      {levels.size > 0 && (
        <p className="hl-legend small" aria-hidden="true">
          {['high', 'medium', 'avoid', 'low'].filter((l) => levels.has(l)).map((l) => (
            <span key={l} className={`hl hl-${l}`}>{t(lang, 'legend' + l[0].toUpperCase() + l.slice(1))}</span>
          ))}
        </p>
      )}
    </section>
  );
}

/** "Distribuie": Web Share API, or copy a text summary. */
export function ShareButton({ lang, result, product, barcode, text, notify }) {
  const [busy, setBusy] = useState(false);
  const share = async () => {
    const appUrl = new URL('./', document.baseURI).href;
    const data = shareSummary(result, { lang, product, barcode, appUrl, text });
    setBusy(true);
    try {
      if (navigator.share) {
        await navigator.share(data);
      } else {
        await navigator.clipboard.writeText(`${data.text}`);
        notify(t(lang, 'copied'));
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        try { await navigator.clipboard.writeText(data.text); notify(t(lang, 'copied')); } catch { /* nothing else to do */ }
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className="btn ghost" onClick={share} disabled={busy}>
      <span aria-hidden="true">↗</span> {t(lang, 'share')}
    </button>
  );
}
