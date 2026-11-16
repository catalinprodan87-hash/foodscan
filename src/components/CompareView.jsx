import { t, pick } from '../lib/i18n.js';
import { compareEntries, NUTRIENTS } from '../lib/compare.js';
import { entryTitle } from '../lib/history.js';
import { ALLERGENS_BY_ID } from '../data/allergens.js';

const VERDICT_ICON = { bad: '✕', warn: '!', ok: '✓', unknown: '?' };
const NLEVEL = { low: 'none', moderate: 'medium', high: 'high' };

/** Two products from the history, row by row (stacked label, then two cells). */
export default function CompareView({ lang, entries, avoid, saleCountry = 'RO', onBack }) {
  const { a, b, shared } = compareEntries(entries[0], entries[1], avoid, saleCountry);
  const row = (key, label, render) => (
    <div className="cmp-row" key={key} role="row">
      <div className="cmp-label" role="rowheader">{label}</div>
      <div className="cmp-cell" role="cell">{render(a)}</div>
      <div className="cmp-cell" role="cell">{render(b)}</div>
    </div>
  );
  const dash = <span className="muted">–</span>;
  const list = (items, sharedIds, show) => (items.length
    ? <ul className="cmp-list">{items.map((x) => <li key={x.code || x.id || x} className={sharedIds.includes(x.code || x.id || x) ? 'shared' : ''}>{show(x)}</li>)}</ul>
    : <span className="muted">{t(lang, 'cmpNone')}</span>);
  const food = a.productType === 'food' || b.productType === 'food';

  return (
    <div className="result compare-view">
      <section className="card">
        <h1 className="card-title page-title" tabIndex={-1}>{t(lang, 'cmpTitle')}</h1>
        <p className="muted small">{t(lang, 'cmpHint')}</p>
        <div className="cmp-table" role="table" aria-label={t(lang, 'cmpTitle')}>
          <div className="cmp-row cmp-head" role="row">
            <div className="cmp-label" role="rowheader" />
            {[a, b].map((s) => <div key={s.entry.id} className="cmp-cell cmp-name" role="columnheader">{entryTitle(s.entry)}</div>)}
          </div>
          {row('verdict', t(lang, 'cmpVerdict'), (s) => (
            <span className="cmp-verdict"><span className={`history-verdict verdict-dot-${s.verdict}`} aria-hidden="true">{VERDICT_ICON[s.verdict]}</span> {t(lang, 'verdict_' + s.verdict)}</span>
          ))}
          {row('score', t(lang, 'scoreCmp'), (s) => (s.score && !s.score.insufficient
            ? <span className={`history-score band-${s.score.band}`}>{s.score.general}<span className="muted small">/100</span></span> : dash))}
          {food && row('nova', 'NOVA', (s) => (s.nova ? `NOVA ${s.nova}` : dash))}
          {food && row('nutri', 'Nutri-Score', (s) => (s.nutriscore ? <span className={`tile-big ns-text-${s.nutriscore} cmp-ns`}>{s.nutriscore.toUpperCase()}</span> : dash))}
          {food && NUTRIENTS.map((k) => row(k, t(lang, 'nutrient_' + k), (s) => (s.nutrients[k]
            ? <span className={`pill pill-${NLEVEL[s.nutrients[k]]}`}>{t(lang, 'nlevel_' + s.nutrients[k])}</span> : dash)))}
          {row('flagged', t(lang, 'cmpFlagged'), (s) => list(s.flagged, shared.flagged, (x) => (
            <><span className={`pill pill-${x.level}`}>{x.code.startsWith('E') ? x.code : t(lang, 'level_' + x.level)}</span> {pick(x.name, lang)}</>
          )))}
          {row('avoid', t(lang, 'cmpAvoid'), (s) => list(s.avoid, shared.avoid, (x) => pick(x.label, lang)))}
          {food && row('allergens', t(lang, 'allergensTitle'), (s) => list(s.allergens, shared.allergens, (id) => pick(ALLERGENS_BY_ID[id].short, lang)))}
        </div>
        <p className="muted small">{t(lang, 'cmpShared')}</p>
      </section>
      <button type="button" className="btn primary block" onClick={onBack}>{t(lang, 'backToHistory')}</button>
    </div>
  );
}
