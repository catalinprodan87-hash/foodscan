import { t, pick } from '../lib/i18n.js';
import { normalize } from '../lib/analyze.js';
import AdditiveList from './AdditiveList.jsx';
import ProductHeader from './ProductHeader.jsx';

const VERDICT_ICON = { bad: '✕', warn: '!', ok: '✓', unknown: '?' };

const isFood = (result) => result.productType === 'food';

function reasonText(lang, r, food) {
  if (r.type === 'nutriscore') return t(lang, 'reason_nutriscore', { grade: r.grade.toUpperCase() });
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
  const sub = !food && v !== 'unknown' ? `verdictSub_${v}_nonfood` : 'verdictSub_' + v;
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

export function NovaCard({ lang, processing, nutriscore }) {
  const n = processing.nova;
  return (
    <section className="card nova-card">
      <div className="nova-row">
        <div className={`nova-badge nova-${n ?? 'x'}`} aria-hidden="true">{n ?? '?'}</div>
        <div>
          <h3 className="card-title">{t(lang, 'processing')}: NOVA {n ?? '–'}</h3>
          <p>{t(lang, 'nova_' + (n ?? 'null'))}</p>
          {processing.source && (
            <p className="muted small">
              {t(lang, processing.source === 'database' ? 'novaDatabase' : 'novaEstimated')}
            </p>
          )}
        </div>
      </div>
      {processing.markers.length > 0 && (
        <p className="small markers">
          <span className="muted">{t(lang, 'novaMarkers')}</span>{' '}
          {processing.markers.map((m) => <span key={m} className="chip">{m}</span>)}
        </p>
      )}
      {nutriscore && <NutriScore lang={lang} grade={nutriscore} />}
    </section>
  );
}

export function AvoidHits({ lang, hits }) {
  return (
    <section className="card">
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

export default function Result({ lang, result, typeAuto, product, barcode, fromPhoto, onBack }) {
  const food = isFood(result);
  return (
    <div className="result">
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
      {food && <NovaCard lang={lang} processing={result.processing} nutriscore={result.nutriscore} />}
      <AvoidHits lang={lang} hits={result.avoidHits} />
      <AdditiveList lang={lang} additives={result.items} grouped={!food} />
      <button type="button" className="btn primary block" onClick={onBack}>
        {t(lang, 'back')}
      </button>
    </div>
  );
}
