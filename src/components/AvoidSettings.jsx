import { presetsForType } from '../data/avoidPresets.js';
import { t, pick } from '../lib/i18n.js';

/** Avoid-list toggles; only the presets relevant to the current product type are shown. */
export default function AvoidSettings({ lang, state, onChange, type = 'food', onEditList }) {
  const presets = presetsForType(type);
  const toggle = (id) => {
    onChange({ ...state, presets: { ...state.presets, [id]: !state.presets[id] } });
  };
  const activeCount = presets.filter((p) => state.presets[p.id]).length;

  return (
    <details className="card avoid-settings">
      <summary>
        <span className="card-title">
          {t(lang, 'avoidSettings')} <span className="muted small">· {t(lang, 'type_' + type)}</span>
        </span>
        <span className="badge">{activeCount}</span>
      </summary>
      <p className="muted">{t(lang, 'avoidSettingsHint')}</p>
      <ul className="toggle-list">
        {presets.map((p) => (
          <li key={p.id}>
            <label className="toggle">
              <input type="checkbox" checked={!!state.presets[p.id]} onChange={() => toggle(p.id)} />
              <span className="switch" aria-hidden="true" />
              <span>{pick(p.label, lang)}</span>
            </label>
          </li>
        ))}
      </ul>
      {onEditList && (
        <button type="button" className="link-btn" onClick={onEditList}>{t(lang, 'editList')} →</button>
      )}
    </details>
  );
}
