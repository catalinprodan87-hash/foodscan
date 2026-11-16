import { useEffect, useRef, useState } from 'react';
import { t } from '../lib/i18n.js';
import '../lib/strings/origin.js';
import { parseBackup, storageStatus, requestPersistence, backupFileName } from '../lib/backup.js';
import { getAutoBackup, removeAutoBackup } from '../lib/autoBackup.js';

const mb = (n) => (n == null ? '–' : (n / 1048576).toFixed(1));

/**
 * About → "Datele tale": storage status, OCR engine download, backup
 * (export / import) and "delete all data".
 */
export default function SettingsCard({ lang, onExport, onImport, onDeleteAll, scanFirst = false, onScanFirst, saleCountry = 'RO', onSaleCountry }) {
  const [countries, setCountries] = useState(null);
  useEffect(() => {
    if (!onSaleCountry) return;
    import('../data/countries.js').then((m) => setCountries(m.COUNTRIES)).catch(() => {});
  }, [onSaleCountry]);
  const [status, setStatus] = useState(null);
  const [ocr, setOcr] = useState({ state: 'checking' }); // checking | missing | ready | downloading | error
  const [pending, setPending] = useState(null); // parsed backup waiting for confirmation
  const [message, setMessage] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef(null);
  const [auto, setAuto] = useState(() => getAutoBackup());
  const downloadAuto = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(auto.backup, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName(new Date(auto.date)).replace('backup-', 'backup-auto-');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

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

      {onScanFirst && (
        <>
          <h3 className="settings-sub">{t(lang, 'startTitle')}</h3>
          <label className="check-row small">
            <input type="checkbox" checked={scanFirst} onChange={(e) => onScanFirst(e.target.checked)} />
            <span>{t(lang, 'scanFirst')}</span>
          </label>
        </>
      )}

      {onSaleCountry && (
        <>
          <h3 className="settings-sub">{t(lang, 'saleCountryTitle')}</h3>
          <label className="small" htmlFor="sale-country">{t(lang, 'saleCountryLabel')}</label>{' '}
          <select id="sale-country" value={saleCountry} onChange={(e) => onSaleCountry(e.target.value)}>
            {(countries || [{ iso: saleCountry, name: { ro: saleCountry, en: saleCountry } }])
              .slice().sort((a, b) => a.name[lang === 'ro' ? 'ro' : 'en'].localeCompare(b.name[lang === 'ro' ? 'ro' : 'en'], lang))
              .map((c) => <option key={c.iso} value={c.iso}>{c.name[lang === 'ro' ? 'ro' : 'en']}</option>)}
          </select>
        </>
      )}

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
            {pending.avoid || pending.profiles ? ` ${t(lang, 'backupAvoidWillReplace')}` : ''}
          </p>
          <div className="actions">
            <button type="button" className="btn primary small-btn" onClick={confirmImport}>{t(lang, 'backupRestore')}</button>
            <button type="button" className="btn ghost small-btn" onClick={() => setPending(null)}>{t(lang, 'cancel')}</button>
          </div>
        </div>
      )}
      {message && <p className={`small${message.error ? ' form-error' : ''}`} role="status">{message.text}</p>}
      {auto && (
        <div className="auto-backup">
          <h3 className="settings-sub">{t(lang, 'autoBackupTitle')}</h3>
          <p className="muted small">{t(lang, 'autoBackupText', { date: new Date(auto.date).toLocaleDateString(lang === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>
          <div className="actions">
            <button type="button" className="btn ghost small-btn" onClick={downloadAuto}>📥 {t(lang, 'autoBackupDownload')}</button>
            <button type="button" className="btn ghost small-btn danger" onClick={() => { removeAutoBackup(); setAuto(null); }}>🗑 {t(lang, 'autoBackupDelete')}</button>
          </div>
        </div>
      )}

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
