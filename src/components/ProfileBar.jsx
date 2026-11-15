import { useState } from 'react';
import { t } from '../lib/i18n.js';
import { addProfile, renameProfile, removeProfile, setActive, activeProfile, activeAvoid, MAX_PROFILES } from '../lib/profiles.js';
import { encodeList } from '../lib/shareList.js';

/**
 * "Lista mea" header: one list per person (Eu, Copil…). Switch, add, rename,
 * delete, and send the active list to someone as a link.
 */
export default function ProfileBar({ lang, profiles, onChange, notify }) {
  const [mode, setMode] = useState(null); // null | 'add' | 'rename' | 'delete'
  const [name, setName] = useState('');
  const current = activeProfile(profiles);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onChange(mode === 'add' ? addProfile(profiles, name) : renameProfile(profiles, current.id, name));
    setMode(null);
    setName('');
  };

  const send = async () => {
    const hash = await encodeList(current.name, activeAvoid(profiles));
    const url = `${location.origin}${location.pathname}#${hash}`;
    const text = t(lang, 'sendListText', { name: current.name });
    try {
      if (navigator.share) { await navigator.share({ title: 'IngrediScan', text, url }); return; }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      notify?.(t(lang, 'sendListCopied'));
    } catch {
      notify?.(t(lang, 'reportCopyFailed'));
    }
  };

  return (
    <section className="card profile-bar" aria-labelledby="profiles-title">
      <h2 id="profiles-title" className="card-title">👪 {t(lang, 'profilesTitle')}</h2>
      <div className="chip-row" role="group" aria-label={t(lang, 'profilesTitle')}>
        {profiles.profiles.map((p) => (
          <button key={p.id} type="button" className={`chip-btn${p.id === profiles.active ? ' active' : ''}`} aria-pressed={p.id === profiles.active} onClick={() => onChange(setActive(profiles, p.id))}>
            {p.name}
          </button>
        ))}
        {profiles.profiles.length < MAX_PROFILES && (
          <button type="button" className="chip-btn add-profile-btn" onClick={() => { setMode('add'); setName(''); }}>＋ {t(lang, 'profileAdd')}</button>
        )}
      </div>
      <p className="muted small">{t(lang, 'profilesHint', { name: current.name })}</p>

      {(mode === 'add' || mode === 'rename') && (
        <form className="barcode-form profile-form" onSubmit={submit}>
          <label htmlFor="profile-name" className="sr-only">{t(lang, 'profileName')}</label>
          <input id="profile-name" type="text" value={name} maxLength={24} autoFocus placeholder={t(lang, 'profileName')} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn primary" disabled={!name.trim()}>{t(lang, mode === 'add' ? 'profileCreate' : 'profileSave')}</button>
          <button type="button" className="link-btn" onClick={() => setMode(null)}>{t(lang, 'cancel')}</button>
        </form>
      )}
      {mode === 'delete' && (
        <div className="confirm-box" role="alertdialog" aria-labelledby="del-profile-q">
          <p id="del-profile-q" className="small"><strong>{t(lang, 'profileDeleteConfirm', { name: current.name })}</strong></p>
          <div className="actions">
            <button type="button" className="btn primary small-btn danger-fill" onClick={() => { onChange(removeProfile(profiles, current.id)); setMode(null); }}>{t(lang, 'customDelete')}</button>
            <button type="button" className="btn ghost small-btn" onClick={() => setMode(null)}>{t(lang, 'cancel')}</button>
          </div>
        </div>
      )}
      {!mode && (
        <div className="actions profile-actions">
          <button type="button" className="btn ghost small-btn" onClick={send}>📨 {t(lang, 'sendList')}</button>
          <button type="button" className="btn ghost small-btn" onClick={() => { setMode('rename'); setName(current.name); }}>✏️ {t(lang, 'profileRename')}</button>
          {profiles.profiles.length > 1 && (
            <button type="button" className="btn ghost small-btn danger" onClick={() => setMode('delete')}>🗑 {t(lang, 'profileDelete')}</button>
          )}
        </div>
      )}
    </section>
  );
}
