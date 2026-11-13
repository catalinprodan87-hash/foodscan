import { useRef } from 'react';
import { t } from '../lib/i18n.js';

/** "Fotografiază ingredientele": opens the back camera (or the gallery). */
export default function PhotoButton({ lang, onPhoto, className = 'btn ghost block', big = false, labelKey = 'photoButton' }) {
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
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // the same photo can be chosen again
          if (file) onPhoto(file);
        }}
      />
    </>
  );
}
