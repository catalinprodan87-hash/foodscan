import { useRef } from 'react';
import { t } from '../lib/i18n.js';

/** "Fotografiază ingredientele": opens the back camera (or the gallery). */
/**
 * With `multiple`, the gallery opens and several photos can be picked; onPhoto then gets File[].
 */
export default function PhotoButton({ lang, onPhoto, className = 'btn ghost block', big = false, labelKey = 'photoButton', multiple = false }) {
  const ref = useRef(null);
  return (
    <>
      <button type="button" className={`${className}${big ? ' photo-main-btn' : ''}`} onClick={() => ref.current?.click()}>
        <span aria-hidden="true">📷</span> {t(lang, labelKey)}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        {...(multiple ? { multiple: true } : { capture: 'environment' })}
        hidden
        onChange={(e) => {
          const list = [...(e.target.files || [])];
          e.target.value = ''; // the same photo can be chosen again
          if (!list.length) return;
          onPhoto(multiple ? list : list[0]);
        }}
      />
    </>
  );
}
