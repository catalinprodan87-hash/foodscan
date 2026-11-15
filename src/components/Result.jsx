import PhotoButton from './PhotoButton.jsx';
import ReportProblem from './ReportProblem.jsx';
import HelpButton from './HelpButton.jsx';
import { ALLERGENS_BY_ID } from '../data/allergens.js';
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

/** Full NOVA explanation (in the "how these scores are worked out" section). */
export function NovaDetails({ lang, processing, why }) {
  const n = processing.nova;
  if (!n) return null;
  return (
    <div className="score-block">
      <h4>{t(lang, 'processing')}: {t(lang, 'novaOf', { n })}</h4>
      {why && <p><strong>{t(lang, 'novaWhyTitle', { n })}</strong> {t(lang, 'novaWhy_' + why.rule, { list: listOf(why.triggers) })}</p>}
      {why?.support && <p>{t(lang, 'novaWhy_' + why.support.rule, { list: listOf(why.support.triggers) })}</p>}
      {why?.higherEstimate && (
        <p className="score-note">{t(lang, 'novaMismatch', { n: why.higherEstimate.nova, list: listOf(why.higherEstimate.triggers) })}</p>
      )}
      <p className="muted small">{t(lang, 'novaNotRisk')}</p>
      <ol className="nova-groups">
        {[1, 2, 3, 4].map((g) => (
          <li key={g} className={g === n ? 'current' : ''}>
            <strong>{t(lang, 'nova_' + g)}.</strong> {t(lang, `nova_${g}_desc`)}
          </li>
        ))}
      </ol>
    </div>
  );
}

const NLEVEL_CLASS = { high: 'high', moderate: 'medium', low: 'none' };
const fmt = (v, lang) => v.toLocaleString(lang === 'ro' ? 'ro-RO' : 'en-GB', { maximumFractionDigits: 1 });

/** Full Nutri-Score explanation with the facts behind the grade. */
export function NutriDetails({ lang, grade, nutrition }) {
  if (!grade) return null;
  const poor = grade === 'd' || grade === 'e';
  const items = nutrition?.items || [];
  return (
    <div className="score-block">
      <h4>{t(lang, 'nutriTitle', { grade: grade.toUpperCase() })}</h4>
      {items.length > 0 && (
        <>
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
        </>
      )}
      <p className="muted small">{t(lang, 'nutriAbout')}</p>
      {poor && <p className="muted small">{t(lang, 'nutriVerdictNote')}</p>}
      <p className="muted small">{t(lang, 'nutriSource')}</p>
    </div>
  );
}

const NOVA_COLOR = { 1: 'nova-1', 2: 'nova-2', 3: 'nova-3', 4: 'nova-4' };

/** Design A: NOVA and Nutri-Score as two tiles side by side, full explanations folded below. */
export function ScoreTiles({ lang, processing, why, grade, nutrition }) {
  const n = processing?.nova;
  if (!n && !grade) return null;
  const basis = why?.rule === 'database' && why.support ? why.support : why;
  const novaShort = basis ? t(lang, 'novaShort_' + basis.rule, { list: listOf(basis.triggers, 3) }).replace('….', '…') : '';
  const highs = (nutrition?.items || []).filter((x) => x.level === 'high').map((x) => t(lang, 'nutrient_' + x.key).toLowerCase());
  const nutriShort = highs.length ? t(lang, 'nutriShort', { list: listOf(highs, 3) }).replace('….', '…') : t(lang, 'nutriShortNone');
  return (
    <>
      <div className="score-tiles">
        <section className="card score-tile" aria-labelledby="tile-nova">
          <span className="tile-head"><span id="tile-nova" className="tile-label">{t(lang, 'scoreProcessing')}</span><HelpButton lang={lang} term="nova" /></span>
          {n && <p className="sr-only">{t(lang, 'novaSentence', { n, name: t(lang, 'nova_' + n), why: novaShort })}</p>}
          {n ? (
            <>
              <p className="tile-value" aria-hidden="true"><span className={`tile-big ${NOVA_COLOR[n]}-text`}>NOVA {n}</span> <span className="muted small">/ 4</span></p>
              <div className="tile-scale" aria-hidden="true">
                {[1, 2, 3, 4].map((g) => <span key={g} className={g === n ? `on ${NOVA_COLOR[g]}` : ''} />)}
              </div>
              <p className="tile-name" aria-hidden="true">{t(lang, 'nova_' + n)}</p>
              <p className="tile-why" aria-hidden="true">{t(lang, 'whyShort', { text: novaShort })}</p>
            </>
          ) : <p className="muted">{t(lang, 'nova_null')}</p>}
        </section>
        <section className="card score-tile" aria-labelledby="tile-nutri">
          <span className="tile-head"><span id="tile-nutri" className="tile-label">{t(lang, 'scoreNutrition')}</span><HelpButton lang={lang} term="nutriscore" /></span>
          {grade && <p className="sr-only">{t(lang, 'nutriSentence', { grade: grade.toUpperCase(), name: t(lang, ['a', 'b'].includes(grade) ? 'nutriGood' : grade === 'c' ? 'nutriMid' : 'nutriPoor'), why: nutriShort })}</p>}
          {grade ? (
            <>
              <p className="tile-value" aria-hidden="true"><span className={`tile-big ns-text-${grade}`}>{grade.toUpperCase()}</span> <span className="muted small">Nutri-Score</span></p>
              <div className="tile-scale five" aria-hidden="true">
                {['a', 'b', 'c', 'd', 'e'].map((g) => <span key={g} className={g === grade ? `on ns-${g}` : ''} />)}
              </div>
              <p className="tile-name" aria-hidden="true">{t(lang, ['a', 'b'].includes(grade) ? 'nutriGood' : grade === 'c' ? 'nutriMid' : 'nutriPoor')}</p>
              <p className="tile-why" aria-hidden="true">{t(lang, 'whyShort', { text: nutriShort })}</p>
            </>
          ) : <p className="muted">{t(lang, 'nutriNone')}</p>}
        </section>
      </div>
      <p className="muted small scores-two">{t(lang, 'scoresTwo')}</p>
      <details className="card score-details">
        <summary>{t(lang, 'scoresDetails')}</summary>
        <NovaDetails lang={lang} processing={processing || {}} why={why} />
        <NutriDetails lang={lang} grade={grade} nutrition={nutrition} />
      </details>
    </>
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

/** Ingredients remembered for this barcode (from the user's photo or text). */
function SavedNote({ lang, saved, onRetake, onForget }) {
  const date = new Date(saved.date).toLocaleDateString(lang === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <section className="saved-note" aria-label={t(lang, 'savedTitle')}>
      <p>
        <span aria-hidden="true">📌 </span>
        {saved.fresh
          ? t(lang, 'savedFresh')
          : t(lang, saved.source === 'photo' ? 'savedFromPhoto' : 'savedFromText', { date })}
      </p>
      {!saved.fresh && (
        <div className="saved-actions">
          {onRetake && <PhotoButton lang={lang} onPhoto={onRetake} className="btn ghost small-btn" labelKey="savedRetake" />}
          {onForget && <button type="button" className="link-btn" onClick={onForget}>{t(lang, 'savedForget')}</button>}
        </div>
      )}
    </section>
  );
}

const allergenName = (id, lang) => pick(ALLERGENS_BY_ID[id].short, lang);

/**
 * Allergens: information only (never in the verdict). Says what the label
 * (or the database) mentions; never that a product is free of an allergen.
 */
function AllergenCard({ lang, allergens, diet, watched = [], fromPhoto }) {
  if (!allergens) return null;
  const { contains, traces } = allergens;
  const names = (list) => list.map((a) => (
    <span key={a.id} className={`allergen${watched.includes(a.id) ? ' watched' : ''}`}>
      {watched.includes(a.id) && <span aria-hidden="true">⚠ </span>}{allergenName(a.id, lang)}
      {watched.includes(a.id) && <span className="sr-only"> ({t(lang, 'allergenWatched')})</span>}
      {!a.sources.includes('label') && <span className="muted small"> ({t(lang, 'allergenFromDb')})</span>}
    </span>
  )).reduce((acc, el, i) => (i ? [...acc, ', ', el] : [el]), []);
  const watchedFound = [...contains, ...traces].some((a) => watched.includes(a.id));
  return (
    <section className={`card allergen-card${watchedFound ? ' has-watched' : ''}`} aria-labelledby="allergens-h">
      <h3 id="allergens-h" className="card-title">{t(lang, 'allergensTitle')} <HelpButton lang={lang} term="traces" /></h3>
      {contains.length > 0 && <p>{t(lang, 'allergensContains')} <strong>{names(contains)}</strong>.</p>}
      {traces.length > 0 && <p>{t(lang, 'allergensTraces')} {names(traces)}.</p>}
      {!contains.length && !traces.length && <p>{t(lang, 'allergensNone')}</p>}
      <DietChips lang={lang} diet={diet} />
      <p className="muted small">{t(lang, 'allergensNote')}{fromPhoto ? ` ${t(lang, 'allergensPhotoNote')}` : ''}</p>
    </section>
  );
}

function DietChips({ lang, diet }) {
  if (!diet) return null;
  const chips = [];
  const src = (d) => (d.source === 'database' ? t(lang, 'dietFromDb') : t(lang, 'dietFromLabel'));
  if (diet.vegan) chips.push({ key: 'vegan', icon: '🌱', text: t(lang, `vegan_${diet.vegan.status}`), src: src(diet.vegan) });
  if (diet.vegetarian && diet.vegan?.status !== 'yes') chips.push({ key: 'veg', icon: '🥕', text: t(lang, `vegetarian_${diet.vegetarian.status}`), src: src(diet.vegetarian) });
  if (diet.palm) chips.push({ key: 'palm', icon: '🌴', text: t(lang, `palm_${diet.palm.status}`), src: src(diet.palm) });
  if (!chips.length) return null;
  return (
    <ul className="diet-chips">
      {chips.map((c) => <li key={c.key}><span aria-hidden="true">{c.icon} </span>{c.text} <span className="muted">· {c.src}</span></li>)}
    </ul>
  );
}

/** One line at the top: "2 de evitat · alergeni: lapte · NOVA 4". */
export function summaryParts(result, lang) {
  const parts = [];
  if (result.avoidHits?.length) parts.push(t(lang, 'sumAvoid', { n: result.avoidHits.length }));
  if (result.counts?.high) parts.push(t(lang, 'sumHigh', { n: result.counts.high }));
  if (result.allergens?.contains?.length) {
    const ids = result.allergens.contains.map((a) => a.id);
    parts.push(t(lang, 'sumAllergens', { list: ids.slice(0, 3).map((id) => allergenName(id, lang)).join(', ') + (ids.length > 3 ? '…' : '') }));
  }
  if (result.processing?.nova) parts.push(`NOVA ${result.processing.nova}`);
  return parts;
}

export default function Result({
  lang, result, text, typeAuto, product, barcode, fromPhoto, onBack, backLabel: backLabelProp, notify,
  saved, onRetake, onForget, watchedAllergens = [], profiles, onProfile,
}) {
  const food = isFood(result);
  const backLabel = backLabelProp || 'back';
  return (
    <div className="result">
      <h1 className="sr-only page-title" tabIndex={-1}>{product?.name || t(lang, 'verdict_' + result.verdict)}</h1>
      <ProductHeader lang={lang} product={product} barcode={barcode} />
      {summaryParts(result, lang).length > 0 && <p className="summary-line">{summaryParts(result, lang).join(' · ')}</p>}
      <TypeBadge lang={lang} type={result.productType} auto={typeAuto} source={product?.source} />
      {fromPhoto && (
        <p className="photo-label" title={t(lang, 'readFromPhotoHint')}>
          <span className="photo-chip">📷 {t(lang, 'readFromPhoto')}</span>
          <span className="muted small">{t(lang, 'readFromPhotoHint')}</span>
        </p>
      )}
      {saved && <SavedNote lang={lang} saved={saved} onRetake={onRetake} onForget={onForget} />}
      {profiles?.profiles.length > 1 && onProfile && (
        <p className="profile-switch">
          <label htmlFor="result-profile">{t(lang, 'resultFor')}</label>{' '}
          <select id="result-profile" value={profiles.active} onChange={(e) => onProfile(e.target.value)}>
            {profiles.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </p>
      )}
      <VerdictBanner lang={lang} result={result} />
      {food && <AllergenCard lang={lang} allergens={result.allergens} diet={result.diet} watched={watchedAllergens} fromPhoto={fromPhoto} />}
      <SafetyTips lang={lang} tips={result.safetyTips} />
      {food && <ScoreTiles lang={lang} processing={result.processing} why={result.novaWhy} grade={result.nutriscore} nutrition={product?.nutrition} />}
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
      <ReportProblem lang={lang} screen="result" product={product ? { name: product.name, code: product.code || barcode } : (barcode ? { code: barcode } : null)} />
    </div>
  );
}
