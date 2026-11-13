import { t } from '../lib/i18n.js';

export default function Disclaimer({ lang }) {
  return (
    <footer className="disclaimer">
      <p>{t(lang, 'disclaimer')}</p>
      <p className="muted small">{t(lang, 'footerSources')}</p>
    </footer>
  );
}
