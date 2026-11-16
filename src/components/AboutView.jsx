import { t, pick } from '../lib/i18n.js';
import { DATABASES_REVIEWED, PRODUCT_SOURCES, REFERENCES, SOFTWARE, NOTICE_URL } from '../data/meta.js';
import { ADDITIVES } from '../data/additives.js';
import { NONFOOD_INGREDIENTS } from '../data/nonFoodIngredients.js';
import { RESTRICTIONS } from '../data/restrictions.js';
import { ALLERGENS } from '../data/allergens.js';
import SettingsCard from './SettingsCard.jsx';
import { openGlossary } from '../data/glossary.js';
import { shareHintKind } from '../lib/shareTarget.js';
import { isStandalone } from '../lib/install.js';

const fmt = (iso, lang) => new Date(iso + 'T12:00:00Z').toLocaleDateString(lang === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export default function AboutView({ lang, onExport, onImport, onDeleteAll, scanFirst, onScanFirst, saleCountry, onSaleCountry }) {
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
        <button type="button" className="btn ghost small-btn" onClick={() => openGlossary('nova')}>📖 {t(lang, 'glossaryTitle')}</button>
      </section>

      <section className="card" aria-labelledby="about-privacy">
        <h2 id="about-privacy" className="card-title">🔒 {t(lang, 'aboutPrivacy')}</h2>
        <p className="small">{t(lang, 'aboutPrivacyText')}</p>
        <h3 className="settings-sub">{t(lang, 'privacyLeavesTitle')}</h3>
        <ul className="small privacy-list">
          <li>{t(lang, 'privacyLeaves1')}</li>
          <li>{t(lang, 'privacyLeaves2')}</li>
          <li>{t(lang, 'privacyLeaves3')}</li>
        </ul>
        <h3 className="settings-sub">{t(lang, 'privacyStaysTitle')}</h3>
        <ul className="small privacy-list">
          <li>{t(lang, 'privacyStays1')}</li>
          <li>{t(lang, 'privacyStays2')}</li>
          <li>{t(lang, 'privacyStays3')}</li>
        </ul>
      </section>

      <ShareHint lang={lang} />

      <SettingsCard lang={lang} onExport={onExport} onImport={onImport} onDeleteAll={onDeleteAll} scanFirst={scanFirst} onScanFirst={onScanFirst} saleCountry={saleCountry} onSaleCountry={onSaleCountry} />

      <section className="card" aria-labelledby="about-products">
        <h2 id="about-products" className="card-title">{t(lang, 'aboutProducts')}</h2>
        <p className="small">{t(lang, 'aboutProductsText')}</p>
        <p className="small">{t(lang, 'dictCredit')}</p>
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
        <ul className="small db-counts">
          <li>{t(lang, 'dbAdditives', { n: ADDITIVES.length, date: fmt(DATABASES_REVIEWED.additives, lang) })}</li>
          <li>{t(lang, 'dbNonFood', { n: NONFOOD_INGREDIENTS.length, date: fmt(DATABASES_REVIEWED.nonFood, lang) })}</li>
          <li>{t(lang, 'dbRestrictions', { n: Object.keys(RESTRICTIONS).length, date: fmt(DATABASES_REVIEWED.restrictions, lang) })}</li>
          <li>{t(lang, 'dbAllergens', { n: ALLERGENS.length, date: fmt(DATABASES_REVIEWED.allergens, lang) })}</li>
        </ul>
      </section>

      <section className="card" aria-labelledby="about-software">
        <h2 id="about-software" className="card-title">{t(lang, 'aboutSoftware')}</h2>
        <p className="small">{t(lang, 'aboutSoftwareText')}</p>
        <ul className="link-list">
          {SOFTWARE.map((s) => (
            <li key={s.name}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.name} ↗</a> <span className="muted small">({s.licence})</span></li>
          ))}
        </ul>
        <p className="small"><a className="source-link" href={NOTICE_URL} target="_blank" rel="noopener noreferrer">{t(lang, 'noticeLink')} ↗</a></p>
      </section>

      <section className="card" aria-labelledby="about-disclaimer">
        <h2 id="about-disclaimer" className="card-title">{t(lang, 'disclaimerTitle')}</h2>
        <p className="small">{t(lang, 'disclaimer')}</p>
        <p className="small">{t(lang, 'disclaimer_nonfood')}</p>
      </section>
    </div>
  );
}

/** How to share photos into the app – or why it is not possible on this phone. */
function ShareHint({ lang }) {
  const kind = shareHintKind({ standalone: isStandalone() });
  if (!kind) return null;
  return (
    <section className="card share-hint" aria-labelledby="about-share">
      <h2 id="about-share" className="card-title">📤 {t(lang, 'shareHintTitle')}</h2>
      <p className="small">{t(lang, 'shareHint_' + kind)}</p>
      {kind === 'android' && <p className="small">{t(lang, 'shareHintReinstall')}</p>}
    </section>
  );
}
