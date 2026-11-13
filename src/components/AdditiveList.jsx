import { t, pick } from '../lib/i18n.js';

function RiskPill({ lang, level }) {
  return <span className={`pill pill-${level}`}>{t(lang, 'level_' + level)}</span>;
}

function AdditiveItem({ lang, item }) {
  const name = item.name ? pick(item.name, lang) : t(lang, 'unknownAdditive');
  return (
    <li className={`additive additive-${item.level}`}>
      <details>
        <summary>
          <span className="code">{item.code}</span>
          <span className="additive-name">
            {name}
            <span className="muted small block">{t(lang, 'cat_' + item.category)}</span>
          </span>
          <RiskPill lang={lang} level={item.level} />
          <span className="chevron" aria-hidden="true" />
        </summary>
        <div className="additive-body">
          {item.why && <p>{pick(item.why, lang)}</p>}
          {item.matches.length > 0 && (
            <p className="muted small">
              {t(lang, 'foundAs')}: {item.matches.map((m) => `“${m}”`).join(', ')}
            </p>
          )}
        </div>
      </details>
    </li>
  );
}

export default function AdditiveList({ lang, additives }) {
  return (
    <section className="card">
      <h3 className="card-title">
        {t(lang, 'additivesTitle')} <span className="badge">{additives.length}</span>
      </h3>
      {additives.length === 0 ? (
        <p className="muted">{t(lang, 'additivesNone')}</p>
      ) : (
        <ul className="additive-list">
          {additives.map((a) => <AdditiveItem key={a.code} lang={lang} item={a} />)}
        </ul>
      )}
    </section>
  );
}
