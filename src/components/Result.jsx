import { t, pick } from '../lib/i18n.js';
import { normalize } from '../lib/analyze.js';
import AdditiveList from './AdditiveList.jsx';

const VERDICT_ICON = { bad: '✕', warn: '!', ok: '✓', unknown: '?' };

function reasonText(lang, r) {
  if (r.type === 'nutriscore') return t(lang, 'reason_nutriscore', { grade: r.grade.toUpperCase() });
  return t(lang, 'reason_' + r.type, { count: r.count });
}

export function VerdictBanner({ lang, result }) {
  const v = result.verdict;
  return (
    <section className={`verdict verdict-${v}`} aria-live="polite">
      <div className="verdict-icon" aria-hidden="true">{VERDICT_ICON[v]}</div>
      <div>
        <h2>{t(lang, 'verdict_' + v)}</h2>
        <p>{t(lang, 'verdictSub_' + v)}</p>
        {result.reasons.length > 0 && (
          <ul className="reasons">
            {result.reasons.map((r) => <li key={r.type}>{reasonText(lang, r)}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

export function NovaCard({ lang, processing }) {
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

export default function Result({ lang, result, onBack }) {
  return (
    <div className="result">
      <VerdictBanner lang={lang} result={result} />
      <NovaCard lang={lang} processing={result.processing} />
      <AvoidHits lang={lang} hits={result.avoidHits} />
      <AdditiveList lang={lang} additives={result.additives} />
      <button type="button" className="btn primary block" onClick={onBack}>
        {t(lang, 'back')}
      </button>
    </div>
  );
}
