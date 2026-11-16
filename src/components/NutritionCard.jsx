import { useState } from 'react';
import { t } from '../lib/i18n.js';
import { NUTRIENT_KEYS } from '../lib/nutritionText.js';
import { NUTRI_CATEGORIES } from '../lib/nutritionInfo.js';

const fmt = (v, lang) => (v == null ? '–' : Number(v).toLocaleString(lang === 'ro' ? 'ro-RO' : 'en-GB', { maximumFractionDigits: 2 }));
const UNIT = { energyKj: 'kJ', energyKcal: 'kcal' };

/**
 * Nutrition values per 100 g / 100 ml (v3.5): where they come from, the
 * sanity-check problems, the Nutri-Score category (one tap), editing, and
 * the grade computed by the app when the database has none.
 */
export default function NutritionCard({ lang, info, onSave, onAddPhotos }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  if (!info) return null;
  const { values, source, problems, category, score, fvl } = info;
  const per = info.basis === '100ml' || category === 'drink' || category === 'water' ? '100 ml' : '100 g';

  const start = () => { setDraft(Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, values?.[k] ?? '']))); setEditing(true); };
  const save = () => {
    const v = Object.fromEntries(Object.entries(draft).filter(([, x]) => String(x).trim() !== '' && Number.isFinite(Number(String(x).replace(',', '.')))).map(([k, x]) => [k, Number(String(x).replace(',', '.'))]));
    onSave?.({ values: v, category: info.categoryAuto ? undefined : category });
    setEditing(false);
  };

  return (
    <section className="card nutrition-card" aria-labelledby="nutri-h">
      <h3 id="nutri-h" className="card-title">📊 {t(lang, 'nutriTitle', { per })}</h3>
      {source && <p className="muted small">{t(lang, 'nutriSource_' + source)}</p>}
      {!values && !editing && (
        <>
          <p className="small">{t(lang, 'nutriNoValues')}</p>
          <div className="actions">
            {onAddPhotos && <span className="small muted">{t(lang, 'nutriAddPhotoHint')}</span>}
            {onSave && <button type="button" className="btn ghost small-btn" onClick={start}>✏️ {t(lang, 'nutriType')}</button>}
          </div>
        </>
      )}
      {values && !editing && (
        <table className="nutri-table">
          <tbody>
            {NUTRIENT_KEYS.map((k) => (
              <tr key={k} className={problems.some((p) => p === k || (p === 'energy' && k.startsWith('energy'))) ? 'nutri-bad' : ''}>
                <th scope="row" className={k === 'saturatedFat' || k === 'sugars' ? 'sub' : ''}>{t(lang, 'nutriRow_' + k)}</th>
                <td>{fmt(values[k], lang)} {values[k] != null ? (UNIT[k] || 'g') : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {problems.length > 0 && !editing && (
        <ul className="small nutri-problems" role="alert">
          {problems.map((p) => <li key={p}>⚠️ {t(lang, 'nutriProblem_' + p)}</li>)}
        </ul>
      )}
      {editing && (
        <form className="nutri-edit" onSubmit={(e) => { e.preventDefault(); save(); }}>
          {NUTRIENT_KEYS.map((k) => (
            <label key={k} className="nutri-field small">
              <span>{t(lang, 'nutriRow_' + k)} ({UNIT[k] || 'g'})</span>
              <input type="text" inputMode="decimal" value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
            </label>
          ))}
          <div className="actions">
            <button type="submit" className="btn primary small-btn">{t(lang, 'reanalyze')}</button>
            <button type="button" className="btn ghost small-btn" onClick={() => setEditing(false)}>{t(lang, 'cancel')}</button>
          </div>
        </form>
      )}
      {values && !editing && onSave && <button type="button" className="link-btn small" onClick={start}>✏️ {t(lang, 'nutriEdit')}</button>}

      {(values || score) && onSave && (
        <div className="nutri-category">
          <p className="small">{t(lang, 'nutriCategory')}{info.categoryAuto ? ` (${t(lang, 'nutriCategoryAuto')})` : ''}</p>
          <div className="chip-row" role="group" aria-label={t(lang, 'nutriCategory')}>
            {NUTRI_CATEGORIES.map((c) => (
              <button key={c} type="button" className={`chip-btn small${c === category ? ' active' : ''}`} aria-pressed={c === category} onClick={() => onSave({ values: info.source === 'edited' ? values : undefined, category: c })}>
                {t(lang, 'nutriCat_' + c)}
              </button>
            ))}
          </div>
        </div>
      )}
      {score?.computed && (
        <p className="small nutri-computed">
          {t(lang, 'nutriComputed', { grade: score.grade.toUpperCase() })}
          {score.fvlEstimated ? ` ${t(lang, 'nutriFvlUnknown')}` : fvl != null ? ` ${t(lang, 'nutriFvl', { n: fmt(fvl, lang) })}` : ''}
        </p>
      )}
    </section>
  );
}
