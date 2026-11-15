import { useEffect, useRef, useState } from 'react';
import { t } from '../lib/i18n.js';
import { parseBackup, storageStatus, requestPersistence } from '../lib/backup.js';

const mb = (n) => (n == null ? '–' : (n / 1048576).toFixed(1));

/**
 * About → "Datele tale": storage status, OCR engine download, backup
 * (export / import) and "delete all data".
 */
export default function SettingsCard({ lang, onExport, onImport, onDeleteAll }) {
  const [status, setStatus] = useState(null);
  const [ocr, setOcr] = useState({ state: 'checking' }); // checking | missing | ready | downloading | error
  const [pending, setPending] = useState(null); // parsed backup waiting for confirmation
  const [message, setMessage] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef(null);

  const refresh = () => storageStatus().then(setStatus);
  useEffect(() => { refresh(); }, []);

  // Is the OCR engine already in the cache?
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { ocrAssets } = await import('../lib/ocr.js');
        const assets = ocrAssets(document.baseURI);
        const hits = await Promise.all(assets.downloads.map((u) => globalThis.caches?.match(u)));
        if (alive) setOcr({ state: hits.every(Boolean) ? 'ready' : 'missing' });
      } catch {
        if (alive) setOcr({ state: 'missing' });
      }
    })();
    return () => { alive = false; };
  }, []);

  const downloadOcr = async () => {
    setOcr({ state: 'downloading', loaded: 0, total: 0 });
    try {
      const { ocrAssets, ensureOcrAssets } = await import('../lib/ocr.js');
      await ensureOcrAssets(ocrAssets(document.baseURI), { onProgress: (p) => setOcr({ state: 'downloading', ...p }) });
      setOcr({ state: 'ready' });
      refresh();
    } catch {
      setOcr({ state: 'error' });
    }
  };

  const keep = async () => {
    await requestPersistence();
    refresh();
  };

  const chooseFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMessage(null);
    try {
      setPending(parseBackup(await file.text()));
    } catch (err) {
      setPending(null);
      setMessage({ error: true, text: t(lang, err.message === 'newer' ? 'backupNewer' : 'backupInvalid') });
    }
  };

  const confirmImport = async () => {
    const r = await onImport(pending);
    setPending(null);
    setMessage({ text: t(lang, 'backupRestored', { history: r.history, saved: r.saved }) + (r.avoid ? ` ${t(lang, 'backupAvoidReplaced')}` : '') });
    refresh();
  };

  const pct = ocr.state === 'downloading' && ocr.total ? Math.round((ocr.loaded / ocr.total) * 100) : null;

  return (
    <section className="card settings-card" aria-labelledby="about-data">
      <h2 id="about-data" className="card-title">💾 {t(lang, 'dataTitle')}</h2>

      <h3 className="settings-sub">{t(lang, 'storageTitle')}</h3>
      <p className="small">
        {status?.persisted === true ? `✅ ${t(lang, 'storageKept')}` : status?.persisted === false ? `⚠️ ${t(lang, 'storageNotKept')}` : t(lang, 'storageUnknown')}
      </p>
      {status?.persisted === false && (
        <button type="button" className="btn ghost small-btn" onClick={keep}>{t(lang, 'storageKeep')}</button>
      )}
      {status?.usage != null && <p className="muted small">{t(lang, 'storageUsed', { mb: mb(status.usage) })}</p>}

      <h3 className="settings-sub">{t(lang, 'ocrEngineTitle')}</h3>
      {ocr.state === 'ready' && <p className="small">✅ {t(lang, 'ocrEngineReady')}</p>}
      {ocr.state === 'missing' && (
        <>
          <p className="small">{t(lang, 'ocrEngineMissing')}</p>
          <button type="button" className="btn ghost small-btn" onClick={downloadOcr}>⬇️ {t(lang, 'ocrEngineDownload')}</button>
        </>
      )}
      {ocr.state === 'downloading' && (
        <div aria-live="polite">
          <div className={`progress${pct == null ? ' indeterminate' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}>
            <span style={pct == null ? undefined : { width: `${pct}%` }} />
          </div>
          <p className="muted small">{t(lang, 'ocrMb', { loaded: mb(ocr.loaded), total: mb(ocr.total) })}</p>
        </div>
      )}
      {ocr.state === 'error' && (
        <p className="small form-error" role="alert">
          {t(lang, 'ocrEngineError')}{' '}
          <button type="button" className="link-btn" onClick={downloadOcr}>{t(lang, 'retry')}</button>
        </p>
      )}

      <h3 className="settings-sub">{t(lang, 'backupTitle')}</h3>
      <p className="muted small">{t(lang, 'backupHint')}</p>
      <div className="actions">
        <button type="button" className="btn ghost small-btn" onClick={onExport}>📤 {t(lang, 'backupExport')}</button>
        <button type="button" className="btn ghost small-btn" onClick={() => fileRef.current?.click()}>📥 {t(lang, 'backupImport')}</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={chooseFile} />
      </div>
      {pending && (
        <div className="confirm-box" role="alertdialog" aria-labelledby="restore-q">
          <p id="restore-q" className="small">
            {t(lang, 'backupContains', { history: pending.history.length, saved: Object.keys(pending.saved).length })}
            {pending.avoid ? ` ${t(lang, 'backupAvoidWillReplace')}` : ''}
          </p>
          <div className="actions">
            <button type="button" className="btn primary small-btn" onClick={confirmImport}>{t(lang, 'backupRestore')}</button>
            <button type="button" className="btn ghost small-btn" onClick={() => setPending(null)}>{t(lang, 'cancel')}</button>
          </div>
        </div>
      )}
      {message && <p className={`small${message.error ? ' form-error' : ''}`} role="status">{message.text}</p>}

      <h3 className="settings-sub">{t(lang, 'deleteAllTitle')}</h3>
      <p className="muted small">{t(lang, 'deleteAllHint')}</p>
      {!confirmDelete ? (
        <button type="button" className="btn ghost small-btn danger" onClick={() => setConfirmDelete(true)}>🗑 {t(lang, 'deleteAll')}</button>
      ) : (
        <div className="confirm-box" role="alertdialog" aria-labelledby="delete-q">
          <p id="delete-q" className="small"><strong>{t(lang, 'deleteAllConfirm')}</strong></p>
          <div className="actions">
            <button type="button" className="btn primary small-btn danger-fill" onClick={onDeleteAll}>{t(lang, 'deleteAllYes')}</button>
            <button type="button" className="btn ghost small-btn" onClick={() => setConfirmDelete(false)}>{t(lang, 'cancel')}</button>
          </div>
        </div>
      )}
    </section>
  );
}
