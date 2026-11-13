import { t, LANGS } from '../lib/i18n.js';

export default function Header({ lang, onLang }) {
  return (
    <header className="app-header">
      <div className="brand">
        <img src="icons/icon.svg" alt="" width="36" height="36" className="brand-logo" />
        <div>
          <h1>{t(lang, 'appName')}</h1>
          <p className="tagline">{t(lang, 'tagline')}</p>
        </div>
      </div>
      <div className="lang-switch" role="group" aria-label={t(lang, 'langLabel')}>
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            className={l === lang ? 'active' : ''}
            aria-pressed={l === lang}
            onClick={() => onLang(l)}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
    </header>
  );
}
