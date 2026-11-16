import { useMemo } from 'react';
import { t } from '../lib/i18n.js';
import '../lib/strings/origin.js';
import { assessOrigin } from '../lib/origin.js';
import { COUNTRY_BY_ISO } from '../data/countries.js';
import { RULES, SOURCES, FAO_AREAS } from '../data/origin.js';

const STAGE_ICON = { origin: '🌱', caught: '🎣', farmed: '🐟', processed: '🏭', sold: '🛒' };
const WHERE = { eu: 'whereEu', nonEu: 'whereNonEu', both: 'whereBoth' };

const countryName = (iso, lang) => COUNTRY_BY_ISO[iso]?.name[lang === 'ro' ? 'ro' : 'en'] || iso;
const areaName = (fao, lang) => (fao ? `FAO ${fao}${FAO_AREAS[fao] ? ` – ${FAO_AREAS[fao][lang === 'ro' ? 'ro' : 'en']}` : ''}` : '');

/** One statement, with its numbers and names filled in. */
function sentence(point, lang) {
  const rule = RULES[point.id];
  const p = point.params || {};
  const fill = {
    km: p.km != null ? p.km.toLocaleString(lang === 'ro' ? 'ro-RO' : 'en-GB') : '',
    n: p.n ?? '',
    country: (p.countries || []).map((iso) => countryName(iso, lang)).join(', '),
    area: p.fao ? ` (${t(lang, 'originArea')} ${areaName(p.fao, lang)})` : '',
    list: (p.list || []).map((x) => `${x.ingredient}: ${t(lang, WHERE[x.where] || 'whereEu')}`).join('; '),
  };
  return rule[lang === 'ro' ? 'ro' : 'en'].replace(/\{(\w+)\}/g, (_, k) => fill[k] ?? '');
}

/**
 * Where it comes from (v3.7): the supply chain from the label text and the
 * database, the approximate distance, and what that means – only documented
 * facts, each with its source. Never a rating of a country.
 */
export default function OriginCard({ lang, text = '', originText = '', product = null, saleCountry = 'RO', assessment = null }) {
  const own = useMemo(() => (assessment ? null : assessOrigin({ text: `${originText}\n${text}`, product: product?.origin || null, saleCountry })), [assessment, text, originText, product, saleCountry]);
  const o = assessment || own;
  const groups = ['plus', 'minus', 'info'].map((kind) => [kind, o.points.filter((p) => p.kind === kind)]).filter(([, list]) => list.length);
  const L = lang === 'ro' ? 'ro' : 'en';

  return (
    <section className="card origin-card" aria-labelledby="origin-h">
      <h3 id="origin-h" className="card-title">🌍 {t(lang, 'originTitle')}</h3>
      {o.known ? (
        <ol className="origin-chain" aria-label={t(lang, 'originChain')}>
          {o.chain.map((s, i) => (
            <li key={i}>
              <span aria-hidden="true">{STAGE_ICON[s.stage]} </span>
              <strong>{t(lang, 'originStage_' + s.stage)}:</strong>{' '}
              {s.iso ? countryName(s.iso, lang) : ''}
              {s.fao ? ` (${areaName(s.fao, lang)})` : ''}
            </li>
          ))}
        </ol>
      ) : (
        <p className="small">
          {t(lang, 'originUnknown')}{' '}
          <span className="muted">{t(lang, 'originSoldIn', { country: countryName(saleCountry, lang) })}</span>
        </p>
      )}
      {o.km > 0 && <p className="muted small">{t(lang, 'originDistance', { km: o.km.toLocaleString(lang === 'ro' ? 'ro-RO' : 'en-GB') })}</p>}
      {groups.map(([kind, list]) => (
        <div key={kind} className={`origin-group origin-${kind}`}>
          <h4 className="small">{t(lang, 'originGroup_' + kind)}</h4>
          <ul className="small">
            {list.map((p) => (
              <li key={p.id}>
                {sentence(p, lang)}{' '}
                <a className="muted" href={SOURCES[p.source].url} target="_blank" rel="noopener noreferrer" title={SOURCES[p.source][L]}>
                  [{t(lang, 'originSource')}]
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="muted small">{t(lang, 'originNote')}</p>
    </section>
  );
}
