import { t } from '../lib/i18n.js';

export default function Disclaimer({ lang, type = 'food' }) {
  const suffix = type === 'food' ? '' : '_nonfood';
  return (
    <footer className="disclaimer">
      <p>{t(lang, 'disclaimer' + suffix)}</p>
      <p className="muted small">{t(lang, 'footerSources' + suffix)}</p>
    </footer>
  );
}
