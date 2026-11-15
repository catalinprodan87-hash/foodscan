import { useEffect, useState } from 'react';
import { t } from '../lib/i18n.js';
import { useInstallPrompt, useNeedRefresh, useOnline } from '../lib/hooks.js';
import { promptInstall } from '../lib/installPrompt.js';
import { applyUpdate, onUpdateFailed } from '../lib/pwa.js';
import { installMode, isIos, isStandalone } from '../lib/install.js';
import { getFlag, setFlag } from '../lib/storage.js';

/** "Versiune nouă disponibilă — Reîncarcă" */
export function UpdateBanner({ lang }) {
  const need = useNeedRefresh();
  const [busy, setBusy] = useState(false);
  useEffect(() => onUpdateFailed(() => setBusy(false)), []);
  if (!need) return null;
  const go = () => { setBusy(true); applyUpdate(); };
  return (
    <div className="update-banner" role="status">
      <span>✨ {t(lang, busy ? 'updating' : 'updateAvailable')}</span>
      <button type="button" className="btn small-btn" onClick={go} disabled={busy}>{t(lang, 'reload')}</button>
    </div>
  );
}

/** "Ce e nou în v3.x", once after an update. */
export function WhatsNew({ lang, version, items, onClose }) {
  return (
    <section className="card whats-new" aria-labelledby="whats-new-h">
      <h2 id="whats-new-h" className="card-title">🎉 {t(lang, 'whatsNewTitle', { version })}</h2>
      <ul className="small">
        {items.map((x) => <li key={x}>{x}</li>)}
      </ul>
      <button type="button" className="btn ghost small-btn" onClick={onClose}>{t(lang, 'whatsNewOk')}</button>
    </section>
  );
}

export function OfflineBanner({ lang }) {
  const online = useOnline();
  if (online) return null;
  return <div className="offline-banner" role="status">📴 {t(lang, 'offline')}</div>;
}

/** Android/desktop install button, or the one-time iPhone hint. */
export function InstallCard({ lang }) {
  const { canInstall, installed } = useInstallPrompt();
  const [iosDismissed, setIosDismissed] = useState(() => getFlag('iosHint'));
  const mode = installMode({
    standalone: installed || isStandalone(),
    ios: isIos(),
    hasPrompt: canInstall,
    iosHintDismissed: iosDismissed,
  });
  if (mode === 'prompt') {
    return (
      <button type="button" className="btn ghost block install-btn" onClick={promptInstall}>
        <span aria-hidden="true">⬇️</span> {t(lang, 'installButton')}
      </button>
    );
  }
  if (mode === 'ios') {
    return (
      <section className="card install-ios" aria-labelledby="ios-install-title">
        <h2 id="ios-install-title" className="card-title">📲 {t(lang, 'installIosTitle')}</h2>
        <p>{t(lang, 'installIosText')}</p>
        <button type="button" className="btn ghost" onClick={() => { setFlag('iosHint'); setIosDismissed(true); }}>
          {t(lang, 'dismiss')}
        </button>
      </section>
    );
  }
  return null;
}

/** Small transient message with an optional action (e.g. "Anulează"). */
export function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{toast.text}</span>
      {toast.actionLabel && (
        <button type="button" className="toast-action" onClick={() => { toast.onAction?.(); onClose(); }}>
          {toast.actionLabel}
        </button>
      )}
    </div>
  );
}
