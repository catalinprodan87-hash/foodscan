import { t, pick } from '../lib/i18n.js';
import { normalize } from '../lib/analyze.js';
import AdditiveList from './AdditiveList.jsx';
import ProductHeader from './ProductHeader.jsx';
import { IngredientsText, ShareButton, AddProductLinks, CompleteProductCard } from './ResultExtras.jsx';

const VERDICT_ICON = { bad: '✕', warn: '!', ok: '✓', unknown: '?' };

const isFood = (result) => result.productType === 'food';

function reasonText(lang, r, food) {
  if (r.type === 'nutriscore') return t(lang, 'reason_nutriscore_long', { grade: r.grade.toUpperCase() });
  const suffix = !food && (r.type === 'high' || r.type === 'medium') ? '_nonfood' : '';
  return t(lang, 'reason_' + r.type + suffix, { count: r.count });
}

export function TypeBadge({ lang, type, auto, source }) {
  const note = source ? t(lang, 'fromSource', { source }) : t(lang, auto ? 'typeAuto' : 'typeChosen');
  return (
    <p className={`type-badge type-${type}`}>
      <span className="type-badge-label">{t(lang, 'type_' + type)}</span>
      <span className="muted small">{note}</span>
    </p>
  );
}

const NUTRI_GRADES = ['a', 'b', 'c', 'd', 'e'];

export function NutriScore({ lang, grade }) {
  return (
    <div className="nutriscore" role="img" aria-label={`${t(lang, 'nutriscore')} ${grade.toUpperCase()}`}>
      <span className="nutriscore-label">{t(lang, 'nutriscore')}</span>
      <span className="nutriscore-scale" aria-hidden="true">
        {NUTRI_GRADES.map((g) => (
          <span key={g} className={`ns ns-${g}${g === grade ? ' current' : ''}`}>{g.toUpperCase()}</span>
        ))}
      </span>
    </div>
  );
}

export function SafetyTips({ lang, tips }) {
  if (!tips?.length) return null;
  return tips.map((tip) => {
    const key = tip.type === 'mixCaution' ? `safety_mixCaution_${tip.kind}` : 'safety_' + tip.type;
    const params = {
      chlorine: tip.chlorine?.join(', '),
      partners: tip.partners?.join(', '),
      substances: tip.substances?.join(', '),
    };
    return (
      <section key={tip.type} className={`safety-tip safety-${tip.type}`} role="alert">
        <h3>⚠ {t(lang, 'safety_' + tip.type + '_title')}</h3>
        <p>{t(lang, key, params)}</p>
      </section>
    );
  });
}

export function VerdictBanner({ lang, result }) {
  const v = result.verdict;
  const food = isFood(result);
  // Caution only because of NOVA 4 / Nutri-Score: say that the ingredients are fine.
  const profileOnly = food && v === 'warn' && result.reasons.every((r) => r.type === 'nova4' || r.type === 'nutriscore');
  const sub = profileOnly ? 'verdictSub_warn_profile'
    : !food && v !== 'unknown' ? `verdictSub_${v}_nonfood` : 'verdictSub_' + v;
  const title = !food && v === 'warn' ? 'verdict_warn_nonfood' : 'verdict_' + v;
  return (
    <section className={`verdict verdict-${v}`} aria-live="polite">
      <div className="verdict-icon" aria-hidden="true">{VERDICT_ICON[v]}</div>
      <div>
        <h2>{t(lang, title)}</h2>
        <p>{t(lang, sub)}</p>
        {result.reasons.length > 0 && (
          <ul className="reasons">
            {result.reasons.map((r) => <li key={r.type}>{reasonText(lang, r, food)}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

const listOf = (items, max = 8) => (items.length > max ? `${items.slice(0, max).join(', ')}…` : items.join(', '));

/** Processing level (NOVA 1–4) with the reason for this product. */
export function NovaCard({ lang, processing, why }) {
  const n = processing.nova;
  return (
    <section className="card nova-card" aria-labelledby="nova-title">
      <div className="nova-row">
        <div className={`nova-badge nova-${n ?? 'x'}`} aria-hidden="true">{n ?? '?'}</div>
        <div>
          <h3 id="nova-title" className="card-title">{t(lang, 'processing')}: {n ? t(lang, 'novaOf', { n }) : 'NOVA –'}</h3>
          <p>{t(lang, 'nova_' + (n ?? 'null'))}</p>
          {processing.source && (
            <p className="muted small">
              {t(lang, processing.source === 'database' ? 'novaDatabase' : 'novaEstimated')}
            </p>
          )}
        </div>
      </div>
      {n && (
        <div className="nova-scale" aria-hidden="true">
          {[1, 2, 3, 4].map((g) => <span key={g} className={`nova-step nova-${g}${g === n ? ' current' : ''}`}>{g}</span>)}
        </div>
      )}
      {n && why && (
        <div className="score-why">
          <p><strong>{t(lang, 'novaWhyTitle', { n })}</strong> {t(lang, 'novaWhy_' + why.rule, { list: listOf(why.triggers) })}</p>
          {why.higherEstimate && (
            <p className="score-note">
              {t(lang, 'novaMismatch', { n: why.higherEstimate.nova, list: listOf(why.higherEstimate.triggers) })}
            </p>
          )}
        </div>
      )}
      <p className="muted small">{t(lang, 'novaNotRisk')}</p>
      <details className="score-details">
        <summary>{t(lang, 'novaScaleTitle')}</summary>
        <ol className="nova-groups">
          {[1, 2, 3, 4].map((g) => (
            <li key={g} className={g === n ? 'current' : ''}>
              <strong>{t(lang, 'nova_' + g)}.</strong> {t(lang, `nova_${g}_desc`)}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

const NLEVEL_CLASS = { high: 'high', moderate: 'medium', low: 'none' };
const fmt = (v, lang) => v.toLocaleString(lang === 'ro' ? 'ro-RO' : 'en-GB', { maximumFractionDigits: 1 });

/** Nutri-Score in its own card (it is unrelated to NOVA) with the facts behind the grade. */
export function NutriCard({ lang, grade, nutrition }) {
  if (!grade) return null;
  const poor = grade === 'd' || grade === 'e';
  const items = nutrition?.items || [];
  return (
    <section className="card nutri-card" aria-labelledby="nutri-title">
      <h3 id="nutri-title" className="card-title">{t(lang, 'nutriTitle', { grade: grade.toUpperCase() })}</h3>
      <NutriScore lang={lang} grade={grade} />
      {items.length > 0 && (
        <div className="score-why">
          <p><strong>{t(lang, 'nutriWhy')}</strong></p>
          <ul className="nutrient-list">
            {items.map((x) => (
              <li key={x.key}>
                <span>{t(lang, 'nutrient_' + x.key)}{x.per100 != null && <span className="muted"> · {fmt(x.per100, lang)} g</span>}</span>
                {x.level && <span className={`pill pill-${NLEVEL_CLASS[x.level]}`}>{t(lang, 'nlevel_' + x.level)}</span>}
              </li>
            ))}
          </ul>
          {nutrition.kcal != null && <p className="muted small">{t(lang, 'nutrientKcal', { value: fmt(nutrition.kcal, lang) })}</p>}
        </div>
      )}
      <p className="muted small">{t(lang, 'nutriAbout')}</p>
      {poor && <p className="muted small">{t(lang, 'nutriVerdictNote')}</p>}
      <p className="muted small">{t(lang, 'nutriSource')}</p>
    </section>
  );
}

export function AvoidHits({ lang, hits }) {
  return (
    <section className="card" id="avoid-hits" tabIndex={-1}>
      <h3 className="card-title">{t(lang, 'avoidTitle')}</h3>
      {hits.length === 0 ? (
        <p className="muted">{t(lang, 'avoidNone')}</p>
      ) : (
        <ul className="avoid-hits">
          {hits.map((h) => {
            const label = pick(h.label, lang);
            const same = (s) => normalize(s) === normalize(label);
            const extra = h.matches.filter((m) => !same(m));
            return (
              <li key={h.id}>
                <strong>{label}</strong>
                {extra.length > 0 && <span className="muted"> — {extra.join(', ')}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function Result({
  lang, result, text, typeAuto, product, barcode, fromPhoto, onBack, backLabel = 'back', notify,
}) {
  const food = isFood(result);
  return (
    <div className="result">
      <h1 className="sr-only page-title" tabIndex={-1}>{product?.name || t(lang, 'verdict_' + result.verdict)}</h1>
      <ProductHeader lang={lang} product={product} barcode={barcode} />
      <TypeBadge lang={lang} type={result.productType} auto={typeAuto} source={product?.source} />
      {fromPhoto && (
        <p className="photo-label" title={t(lang, 'readFromPhotoHint')}>
          <span className="photo-chip">📷 {t(lang, 'readFromPhoto')}</span>
          <span className="muted small">{t(lang, 'readFromPhotoHint')}</span>
        </p>
      )}
      <VerdictBanner lang={lang} result={result} />
      <SafetyTips lang={lang} tips={result.safetyTips} />
      {food && <NovaCard lang={lang} processing={result.processing} why={result.novaWhy} />}
      {food && <NutriCard lang={lang} grade={result.nutriscore} nutrition={product?.nutrition} />}
      <AvoidHits lang={lang} hits={result.avoidHits} />
      <AdditiveList lang={lang} additives={result.items} grouped={!food} />
      <IngredientsText lang={lang} text={text} result={result} />
      {barcode && !product && <AddProductLinks lang={lang} code={barcode} type={result.productType} />}
      <CompleteProductCard lang={lang} product={product} text={text} notify={notify} />
      <div className="actions result-actions">
        <ShareButton lang={lang} result={result} product={product} barcode={barcode} text={text} notify={notify} />
      </div>
      <button type="button" className="btn primary block" onClick={onBack}>
        {t(lang, backLabel)}
      </button>
    </div>
  );
}
