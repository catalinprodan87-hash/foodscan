import { t } from '../lib/i18n.js';
import { SCORE_VERSION } from '../data/scoring.js';

/** Why each part got its points, in a few words. */
function partWhy(lang, p, general) {
  const d = p.detail || {};
  switch (p.id) {
    case 'ingredients': return t(lang, 'scoreWhy_ingredients', d);
    case 'nutrition': return t(lang, 'scoreWhy_grade', { grade: String(d.grade).toUpperCase() });
    case 'processing': return t(lang, 'scoreWhy_nova', d);
    case 'origin': return d.known ? t(lang, 'scoreWhy_originKnown', d) : t(lang, 'scoreWhy_originUnknown');
    case 'avoid': return general ? t(lang, 'scoreWhy_general') : '';
    case 'completeness': {
      if (d.count != null) return t(lang, 'scoreWhy_count', { n: d.count });
      const missing = ['nutrition', 'processing', 'origin'].filter((k) => !d[k]).map((k) => t(lang, 'scorePart_' + k));
      return missing.length ? t(lang, 'scoreWhy_missing', { list: missing.join(', ') }) : t(lang, 'scoreWhy_complete');
    }
    default: return '';
  }
}

/**
 * The overall score 1–100 (v3.8, docs/SCORING.md): the big number with its
 * band, the personal score when the avoid list is hit, the confidence, any
 * cap, and the breakdown. `otherProfile` (a family member's profile is
 * active): the big number is the general score.
 */
export default function ScoreCard({ lang, score, otherProfile = null }) {
  if (!score) return null;
  const title = t(lang, score.kind === 'food' ? 'scoreTitle' : 'scoreIngredientsTitle');
  if (score.insufficient) {
    return (
      <section className="card score-card score-none" aria-labelledby="score-h">
        <h2 id="score-h" className="card-title">{title}</h2>
        <p className="small">{t(lang, 'scoreInsufficient')}</p>
      </section>
    );
  }
  const personalShown = score.avoidHits > 0 && !otherProfile;
  const big = personalShown ? score.personal : score.general;
  const band = personalShown ? score.personalBand : score.band;
  const missingParts = score.kind === 'food' && score.parts.length < 5;

  return (
    <section className={`card score-card band-${band}`} aria-labelledby="score-h">
      <h2 id="score-h" className="card-title">{title}</h2>
      <p className="score-main">
        <span className="score-num">{big}</span>
        <span className="score-of">/100 <span className="sr-only">{t(lang, 'scoreOutOf')}</span></span>
        <span className="score-band">{t(lang, 'scoreBand_' + band)}</span>
      </p>
      {personalShown && <p className="small score-personal">{t(lang, 'scorePersonal', { personal: score.personal, general: score.general, n: score.avoidHits })}</p>}
      {otherProfile && score.avoidHits > 0 && (
        <p className="small score-personal">{t(lang, 'scoreOtherProfile', { name: otherProfile, personal: score.personal, n: score.avoidHits })}</p>
      )}
      {score.confidence !== 'high' && <p className="small score-estimated">⚠️ {t(lang, 'scoreEstimated')}</p>}
      <p className="muted small">{t(lang, 'scoreConfidence', { level: t(lang, 'scoreConf_' + score.confidence) })}</p>
      {score.caps.map((c) => (
        <p key={c.id} className="small score-cap">{t(lang, 'scoreCap_' + c.id, { codes: (c.codes || []).join(', ') })}</p>
      ))}
      <details className="score-how">
        <summary className="small">{t(lang, 'scoreHow')}</summary>
        <ul className="score-parts">
          {score.parts.map((p) => (
            <li key={p.id}>
              <span className="score-part-name">{t(lang, 'scorePart_' + p.id)}</span>
              <span className="score-bar" aria-hidden="true"><span style={{ width: `${p.points}%` }} /></span>
              <span className="small muted">{t(lang, 'scorePoints', { points: Math.round(p.points), weight: Math.round(p.share * 100) })} · {partWhy(lang, p, !personalShown)}</span>
            </li>
          ))}
        </ul>
        {missingParts && <p className="muted small">{t(lang, 'scoreMissingShare')}</p>}
        <p className="muted small">{t(lang, 'scoreNote', { v: SCORE_VERSION })}</p>
      </details>
    </section>
  );
}
