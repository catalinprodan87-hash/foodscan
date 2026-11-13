import { useMemo, useRef, useState } from 'react';
import { t, pick } from '../lib/i18n.js';
import { presetsForType } from '../data/avoidPresets.js';
import {
  addCustom, updateCustom, removeCustom, setPreset, exportAvoidList, importAvoidList, previewCounts,
} from '../lib/avoidList.js';

const TYPES = ['food', 'cosmetic', 'household'];
const TYPE_ICON = { food: '🍎', cosmetic: '🧴', household: '🧽' };
const GROUP_LABEL = { food: 'groupFood', cosmetic: 'groupCosmetic', household: 'groupHousehold' };

function TypeChips({ lang, types }) {
  return (
    <span className="type-chips" aria-label={`${t(lang, 'appliesTo')}: ${types.map((x) => t(lang, 'type_' + x)).join(', ')}`}>
      {types.map((x) => (
        <span key={x} className={`type-pill type-pill-${x}`} aria-hidden="true">{TYPE_ICON[x]} {t(lang, 'type_' + x)}</span>
      ))}
    </span>
  );
}

function TypeCheckboxes({ lang, value, onChange, idPrefix }) {
  return (
    <fieldset className="type-checks">
      <legend className="small muted">{t(lang, 'customTypes')}</legend>
      {TYPES.map((x) => (
        <label key={x} htmlFor={`${idPrefix}-${x}`} className="check">
          <input
            id={`${idPrefix}-${x}`}
            type="checkbox"
            checked={value.includes(x)}
            onChange={(e) => onChange(e.target.checked ? [...value, x] : value.filter((v) => v !== x))}
          />
          <span>{TYPE_ICON[x]} {t(lang, 'type_' + x)}</span>
        </label>
      ))}
    </fieldset>
  );
}

function CustomForm({ lang, initial, submitLabel, onSubmit, onCancel, idPrefix }) {
  const [terms, setTerms] = useState(initial?.terms.join(' / ') || '');
  const [types, setTypes] = useState(initial?.types || TYPES);
  return (
    <form
      className="custom-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!terms.trim() || !types.length) return;
        onSubmit({ terms, types });
        if (!initial) { setTerms(''); setTypes(TYPES); }
      }}
    >
      <label htmlFor={`${idPrefix}-terms`} className="sr-only">{t(lang, 'customPlaceholder')}</label>
      <div className="barcode-form">
        <input
          id={`${idPrefix}-terms`}
          type="text"
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          placeholder={t(lang, 'customPlaceholder')}
          autoComplete="off"
          autoCapitalize="off"
        />
        <button type="submit" className="btn primary" disabled={!terms.trim() || !types.length}>{submitLabel}</button>
      </div>
      <TypeCheckboxes lang={lang} value={types} onChange={setTypes} idPrefix={idPrefix} />
      {onCancel && <button type="button" className="link-btn" onClick={onCancel}>{t(lang, 'cancel')}</button>}
    </form>
  );
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "Lista mea": presets per product type, custom entries, export / import. */
export default function AvoidListView({ lang, avoid, onChange, history, notify }) {
  const [editing, setEditing] = useState(null);
  const fileRef = useRef(null);
  const counts = useMemo(() => previewCounts(history, avoid), [history, avoid]);
  const countText = (id) => (history.length ? t(lang, 'wouldFlag', { count: counts[id] ?? 0 }) : null);

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const next = importAvoidList(await file.text());
      if (window.confirm(t(lang, 'importConfirm'))) {
        onChange(next);
        notify(t(lang, 'importDone'));
      }
    } catch {
      notify(t(lang, 'importError'));
    }
  };

  return (
    <div className="result list-view">
      <section className="card">
        <h1 className="card-title page-title" tabIndex={-1}>{t(lang, 'listTitle')}</h1>
        <p className="muted small">{t(lang, 'listIntro')}</p>
      </section>

      {TYPES.map((type) => (
        <section key={type} className="card" aria-labelledby={`group-${type}`}>
          <h2 id={`group-${type}`} className="card-title">{TYPE_ICON[type]} {t(lang, GROUP_LABEL[type])}</h2>
          <ul className="toggle-list">
            {presetsForType(type).map((p) => (
              <li key={p.id}>
                <label className="toggle" htmlFor={`preset-${type}-${p.id}`}>
                  <input
                    id={`preset-${type}-${p.id}`}
                    type="checkbox"
                    checked={!!avoid.presets[p.id]}
                    onChange={(e) => onChange(setPreset(avoid, p.id, e.target.checked))}
                  />
                  <span className="switch" aria-hidden="true" />
                  <span className="toggle-text">
                    <span>{pick(p.label, lang)}</span>
                    <span className="toggle-sub">
                      <TypeChips lang={lang} types={p.types} />
                      {countText(p.id) && <span className="muted small">{countText(p.id)}</span>}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="card" aria-labelledby="custom-title">
        <h2 id="custom-title" className="card-title">✏️ {t(lang, 'customTitle')}</h2>
        <p className="muted small">{t(lang, 'customHint')}</p>
        <CustomForm lang={lang} submitLabel={t(lang, 'customAdd')} idPrefix="new" onSubmit={(v) => onChange(addCustom(avoid, v))} />
        {avoid.custom.length === 0 ? (
          <p className="muted small">{t(lang, 'customNone')}</p>
        ) : (
          <ul className="custom-list">
            {avoid.custom.map((c) => (
              <li key={c.id}>
                {editing === c.id ? (
                  <CustomForm
                    lang={lang}
                    initial={c}
                    idPrefix={`edit-${c.id}`}
                    submitLabel={t(lang, 'customSave')}
                    onSubmit={(v) => { onChange(updateCustom(avoid, c.id, v)); setEditing(null); }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <div className="custom-row">
                    <div className="custom-info">
                      <strong>{c.terms.join(' / ')}</strong>
                      <span className="toggle-sub">
                        <TypeChips lang={lang} types={c.types} />
                        {countText('custom:' + c.id) && <span className="muted small">{countText('custom:' + c.id)}</span>}
                      </span>
                    </div>
                    <div className="custom-actions">
                      <button type="button" className="btn ghost small-btn" onClick={() => setEditing(c.id)} aria-label={`${t(lang, 'customEdit')}: ${c.terms.join(' / ')}`}>
                        {t(lang, 'customEdit')}
                      </button>
                      <button type="button" className="btn ghost small-btn danger" onClick={() => onChange(removeCustom(avoid, c.id))} aria-label={`${t(lang, 'customDelete')}: ${c.terms.join(' / ')}`}>
                        {t(lang, 'customDelete')}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="export-title">
        <h2 id="export-title" className="card-title">📤 {t(lang, 'exportTitle')}</h2>
        <p className="muted small">{t(lang, 'exportHint')}</p>
        <div className="actions">
          <button type="button" className="btn primary" onClick={() => download('ingrediscan-lista-mea.json', exportAvoidList(avoid))}>
            {t(lang, 'exportButton')}
          </button>
          <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>{t(lang, 'importButton')}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
        </div>
      </section>
    </div>
  );
}
