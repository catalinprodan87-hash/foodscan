import { useEffect, useState } from 'react';
import { t } from '../lib/i18n.js';
import { getThumbs } from '../lib/thumbStore.js';

const TYPE_ICON = { ingredients: '🧾', nutrition: '📊', origin: '🌍', front: '🏷️', other: '📄' };

/** The product's photo set as small thumbnails (on this phone only), with what each photo was used for. */
export default function PhotoStrip({ lang, barcode, version }) {
  const [thumbs, setThumbs] = useState([]);
  useEffect(() => {
    let alive = true;
    getThumbs(barcode).then((list) => { if (alive) setThumbs(list); });
    return () => { alive = false; };
  }, [barcode, version]);
  if (!thumbs.length) return null;
  return (
    <section className="photo-strip" aria-label={t(lang, 'stripTitle')}>
      <p className="small muted">{t(lang, 'stripTitle')}</p>
      <ul>
        {thumbs.map((th) => (
          <li key={th.id}>
            <img src={th.data} alt="" />
            <span className="small" aria-label={(th.types || []).map((x) => t(lang, 'photoType_' + x)).join(', ')}>
              {(th.types || []).map((x) => TYPE_ICON[x]).join('')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
