import { t, pick } from '../lib/i18n.js';
import { NONFOOD_CATEGORIES } from '../data/nonFoodIngredients.js';
import { itemDomId } from '../lib/share.js';

const LEVEL_RANK = { high: 0, medium: 1, low: 2, unknown: 3, none: 4 };

function RiskPill({ lang, level }) {
  return <span className={`pill pill-${level}`}>{t(lang, 'level_' + level)}</span>;
}

function AdditiveItem({ lang, item, showCode }) {
  const name = item.name ? pick(item.name, lang) : t(lang, 'unknownAdditive');
  return (
    <li className={`additive additive-${item.level}`} id={itemDomId(item.code)}>
      <details>
        <summary>
          {showCode && <span className="code">{item.code}</span>}
          <span className="additive-name">
            {name}
            {showCode && <span className="muted small block">{t(lang, 'cat_' + item.category)}</span>}
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
