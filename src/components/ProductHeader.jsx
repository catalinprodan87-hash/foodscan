import { t } from '../lib/i18n.js';

/** Product card for looked-up products: image, name, brand, barcode, source link. */
export default function ProductHeader({ lang, product, barcode }) {
  if (!product) {
    if (!barcode) return null;
    return (
      <p className="barcode-chip">
        <span className="muted small">{t(lang, 'barcode')}:</span> <span className="mono">{barcode}</span>
      </p>
    );
  }
  const subtitle = [product.brands, product.quantity].filter(Boolean).join(' · ');
  return (
    <section className="card product-header">
      {product.image ? (
        <img className="product-image" src={product.image} alt={product.name || ''} loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <div className="product-image placeholder" aria-hidden="true">📦</div>
      )}
      <div className="product-info">
        <h2 className="product-name">{product.name || t(lang, 'barcode') + ' ' + product.code}</h2>
        {subtitle && <p className="muted small">{subtitle}</p>}
        <p className="small">
          <span className="muted">{t(lang, 'barcode')}:</span> <span className="mono">{product.code}</span>
        </p>
        <a className="small source-link" href={product.url} target="_blank" rel="noopener noreferrer">
          {t(lang, 'viewOn', { source: product.source })} ↗
        </a>
      </div>
    </section>
  );
}
