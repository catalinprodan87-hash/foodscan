import { t } from '../lib/i18n.js';
import { PRODUCT_TYPES } from '../lib/analyze.js';

const ICONS = { food: '🍎', cosmetic: '🧴', household: '🧽' };

/**
 * 3-way product type selector (Alimente / Cosmetice / Curățenie).
 * `value` is the effective type; `auto` tells whether it was detected (no
 * explicit choice). onChange(null) returns to auto-detection.
 */
export default function TypeSelector({ lang, value, auto, onChange }) {
  return (
    <div className="type-selector">
      <div className="segmented" role="radiogroup" aria-label={t(lang, 'productType')}>
        {PRODUCT_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={!auto && type === value}
            className={type === value ? (auto ? 'suggested' : 'active') : ''}
            onClick={() => onChange(type)}
          >
            <span aria-hidden="true">{ICONS[type]}</span> {t(lang, 'type_' + type)}
          </button>
        ))}
      </div>
      <p className="muted small type-hint">
        {t(lang, 'productType')}: {t(lang, 'type_' + value)} · {t(lang, auto ? 'typeAuto' : 'typeChosen')}
        {!auto && (
          <>
            {' · '}
            <button type="button" className="link-btn" onClick={() => onChange(null)}>
              {t(lang, 'typeAutoReset')}
            </button>
          </>
        )}
      </p>
    </div>
  );
}
