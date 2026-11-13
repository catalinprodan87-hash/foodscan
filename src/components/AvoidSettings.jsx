import { AVOID_PRESETS } from '../data/avoidPresets.js';
import { t, pick } from '../lib/i18n.js';

export default function AvoidSettings({ lang, state, onChange }) {
  const toggle = (id) => {
    onChange({ ...state, presets: { ...state.presets, [id]: !state.presets[id] } });
  };
  const activeCount = AVOID_PRESETS.filter((p) => state.presets[p.id]).length;

  return (
    <details className="card avoid-settings">
      <summary>
        <span className="card-title">{t(lang, 'avoidSettings')}</span>
        <span className="badge">{activeCount}</span>
      </summary>
      <p className="muted">{t(lang, 'avoidSettingsHint')}</p>
      <ul className="toggle-list">
        {AVOID_PRESETS.map((p) => (
          <li key={p.id}>
            <label className="toggle">
              <input type="checkbox" checked={!!state.presets[p.id]} onChange={() => toggle(p.id)} />
              <span className="switch" aria-hidden="true" />
              <span>{pick(p.label, lang)}</span>
            </label>
          </li>
        ))}
      </ul>
    </details>
  );
}
