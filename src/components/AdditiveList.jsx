import { t, pick } from '../lib/i18n.js';
import { NONFOOD_CATEGORIES } from '../data/nonFoodIngredients.js';
import { itemDomId } from '../lib/share.js';
import { REGIONS, regionShort } from '../data/restrictions.js';
import { sourcesFor, reviewedFor } from '../data/sources.js';
import { ADDITIVES_BY_CODE } from '../data/additives.js';
import { NONFOOD_BY_CODE } from '../data/nonFoodIngredients.js';

const LEVEL_RANK = { high: 0, medium: 1, low: 2, unknown: 3, none: 4 };

/** Risk pill; when a country outside the EU sets the (worse) rating, its name follows. */
function RiskPill({ lang, level, source }) {
  const elsewhere = source && source !== 'EU';
  return (
    <span className={`pill pill-${level}`}>
      {t(lang, 'level_' + level)}{elsewhere && <span className="pill-source"><span className="sr-only"> · </span>{regionShort(source, lang)}</span>}
    </span>
  );
}

function AdditiveItem({ lang, item, showCode }) {
  const name = item.name ? pick(item.name, lang) : t(lang, 'unknownAdditive');
  const restricted = item.restrictions?.length > 0;
  return (
    <li className={`additive additive-${item.level}`} id={itemDomId(item.code)}>
      <details>
        <summary>
          {showCode && <span className="code">{item.code}</span>}
          <span className="additive-name">
            {name}
            {showCode && <span className="muted small block">{t(lang, 'cat_' + item.category)}</span>}
            {restricted && <span className="restricted-flag small block">🌍 {t(lang, 'restrictedFlag')}</span>}
          </span>
          <RiskPill lang={lang} level={item.level} source={item.levelSource} />
          <span className="chevron" aria-hidden="true" />
        </summary>
        <div className="additive-body">
          {item.why && <p>{pick(item.why, lang)}</p>}
          {restricted && (
            <div className="restricted-box">
              <p><strong>🌍 {t(lang, 'restrictedTitle')}</strong></p>
              <ul>
                {item.restrictions.map((x) => (
                  <li key={x.region + x.status}>
                    <strong>{pick(REGIONS[x.region], lang)}</strong>{' '}
                    <span className={`rstatus rstatus-${x.status}`}>{t(lang, 'rstatus_' + x.status)}</span>{' '}
                    <span className={`pill pill-${x.level}`}>{t(lang, 'level_' + x.level)}</span>
                    <span className="block">{pick(x, lang)}</span>
                  </li>
                ))}
              </ul>
              <p className="muted small">
                {item.levelSource !== 'EU'
                  ? t(lang, 'ratingFrom', { region: pick(REGIONS[item.levelSource], lang), eu: t(lang, 'level_' + item.euLevel) })
                  : t(lang, 'ratingEu')}
              </p>
            </div>
          )}
          {item.matches.length > 0 && (
            <p className="muted small">
              {t(lang, 'foundAs')}: {item.matches.map((m) => `“${m}”`).join(', ')}
            </p>
          )}
          <Sources lang={lang} item={item} />
        </div>
      </details>
    </li>
  );
}

const fmtDate = (iso, lang) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(lang === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** "Surse: EFSA ↗ · Reg. 1333/2008 ↗ · verificat 14 nov. 2026" */
function Sources({ lang, item }) {
  const db = item.why ? (ADDITIVES_BY_CODE[item.code] || NONFOOD_BY_CODE[item.code]) : null;
  if (!db) return null;
  const sources = sourcesFor(db, item.restrictions || []);
  const reviewed = reviewedFor(db, ADDITIVES_BY_CODE[item.code] ? 'additives' : 'nonFood');
  return (
    <p className="muted small item-sources">
      {sources.length > 0 && <>{t(lang, 'sourcesLabel')}: {sources.map((s, i) => (
        <span key={s.id}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noopener noreferrer">{pick(s, lang).split(' – ')[0]} ↗</a></span>
      ))} · </>}
      {t(lang, 'reviewedOn', { date: fmtDate(reviewed, lang) })}
    </p>
  );
}

/** Groups items by category; groups with the riskiest items come first. */
function groupByCategory(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  }
  const worst = (list) => Math.min(...list.map((x) => LEVEL_RANK[x.level]));
  return [...groups.entries()].sort(
    ([ca, a], [cb, b]) => worst(a) - worst(b) || NONFOOD_CATEGORIES.indexOf(ca) - NONFOOD_CATEGORIES.indexOf(cb),
  );
}

/**
 * Food: flat list of E-numbers with code column.
 * Cosmetic / household (`grouped`): items grouped by category, no code column.
 */
export default function AdditiveList({ lang, additives, grouped = false, title: titleOverride }) {
  const title = titleOverride || (grouped ? t(lang, 'itemsTitle') : t(lang, 'additivesTitle'));
  const empty = grouped ? t(lang, 'itemsNone') : t(lang, 'additivesNone');

  return (
    <section className="card">
      <h3 className="card-title">
        {title} <span className="badge">{additives.length}</span>
      </h3>
      {additives.length === 0 && <p className="muted">{empty}</p>}
      {additives.length > 0 && !grouped && (
        <ul className="additive-list">
          {additives.map((a) => <AdditiveItem key={a.code} lang={lang} item={a} showCode />)}
        </ul>
      )}
      {additives.length > 0 && grouped && groupByCategory(additives).map(([category, list]) => (
        <div key={category} className="item-group">
          <h4 className="group-title">{t(lang, 'group_' + category)}</h4>
          <ul className="additive-list nocode">
            {list.map((a) => <AdditiveItem key={a.code} lang={lang} item={a} showCode={false} />)}
          </ul>
        </div>
      ))}
    </section>
  );
}
