import { useState } from 'react';
import { t } from '../lib/i18n.js';
import { buildReport, getTimings } from '../lib/diagnostics.js';

/* global __APP_VERSION__ */
const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

/**
 * "Raportează o problemă": an editable plain-text report (version, device,
 * last timings, OCR text if any) that the user shares themselves – WhatsApp,
 * e-mail… through the share sheet, or copies. Never a photo, never automatic.
 */
export default function ReportProblem({ lang, screen, ocr = null, product = null }) {
  const [text, setText] = useState(null);
  const [status, setStatus] = useState(null);

  const open = (e) => {
    if (e.currentTarget.open && text == null) {
      setText(buildReport({ version, userAgent: navigator.userAgent, lang, screen, timings: getTimings(), ocr, product }));
    }
  };

  const share = async () => {
    setStatus(null);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'IngrediScan – raport problemă', text });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return; // the user closed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus(t(lang, 'reportCopied'));
    } catch {
      setStatus(t(lang, 'reportCopyFailed'));
    }
  };

  return (
    <details className="card report-problem" onToggle={open}>
      <summary>🐞 {t(lang, 'reportTitle')}</summary>
      <p className="muted small">{t(lang, 'reportHint')}</p>
      <label htmlFor={`report-${screen}`} className="sr-only">{t(lang, 'reportTitle')}</label>
      <textarea id={`report-${screen}`} rows={9} value={text ?? ''} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      <div className="actions">
        <button type="button" className="btn primary small-btn" onClick={share} disabled={!text}>{t(lang, 'reportSend')}</button>
      </div>
      {status && <p className="small" role="status">{status}</p>}
    </details>
  );
}
