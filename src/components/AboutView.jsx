import { t, pick } from '../lib/i18n.js';
import { DATABASES_REVIEWED, PRODUCT_SOURCES, REFERENCES } from '../data/meta.js';

const fmt = (iso, lang) => new Date(iso + 'T12:00:00Z').toLocaleDateString(lang === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export default function AboutView({ lang }) {
  /* global __APP_VERSION__, __BUILD_DATE__ */
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
  const built = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : null;
  return (
    <div className="result about-view">
      <section className="card">
        <h1 className="card-title page-title" tabIndex={-1}>{t(lang, 'aboutTitle')}</h1>
        <p>{t(lang, 'aboutText')}</p>
        <p className="muted small">
          {t(lang, 'aboutVersion', { version, date: built ? fmt(built, lang) : '–' })}
        </p>
      </section>

      <section className="card" aria-labelledby="about-products">
        <h2 id="about-products" className="card-title">{t(lang, 'aboutProducts')}</h2>
        <p className="small">{t(lang, 'aboutProductsText')}</p>
        <ul className="link-list">
          {PRODUCT_SOURCES.map((s) => (
            <li key={s.name}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.name} ↗</a> <span className="muted small">({s.licence})</span></li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="about-refs">
        <h2 id="about-refs" className="card-title">{t(lang, 'aboutReferences')}</h2>
        <ul className="link-list">
          {REFERENCES.map((r) => (
            <li key={r.id}><a href={r.url} target="_blank" rel="noopener noreferrer">{pick(r, lang)} ↗</a></li>
          ))}
        </ul>
        <p className="muted small">
          {t(lang, 'aboutReviewed', { additives: fmt(DATABASES_REVIEWED.additives, lang), nonFood: fmt(DATABASES_REVIEWED.nonFood, lang) })}
        </p>
      </section>

      <section className="card" aria-labelledby="about-privacy">
        <h2 id="about-privacy" className="card-title">🔒 {t(lang, 'aboutPrivacy')}</h2>
        <p className="small">{t(lang, 'aboutPrivacyText')}</p>
      </section>

      <section className="card" aria-labelledby="about-disclaimer">
        <h2 id="about-disclaimer" className="card-title">{t(lang, 'disclaimerTitle')}</h2>
        <p className="small">{t(lang, 'disclaimer')}</p>
        <p className="small">{t(lang, 'disclaimer_nonfood')}</p>
      </section>
    </div>
  );
}
