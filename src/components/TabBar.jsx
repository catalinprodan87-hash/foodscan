import { t } from '../lib/i18n.js';

const TABS = [
  { id: 'scan', icon: '⌁', label: 'tabScan', svg: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13 8v8M16 8v8' },
  { id: 'history', label: 'tabHistory', svg: 'M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7M3 4v4h4' },
  { id: 'list', label: 'tabList', svg: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2' },
  { id: 'about', label: 'tabAbout', svg: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5' },
];

/** Bottom navigation (one tab per main screen). */
export default function TabBar({ lang, tab, onTab, badge }) {
  return (
    <nav className="tabbar" aria-label={t(lang, 'mainNav')}>
      {TABS.map((x) => (
        <button
          key={x.id}
          type="button"
          className={tab === x.id ? 'active' : ''}
          aria-current={tab === x.id ? 'page' : undefined}
          onClick={() => onTab(x.id)}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={x.svg} />
          </svg>
          <span>{t(lang, x.label)}</span>
          {x.id === 'history' && badge > 0 && <span className="tab-badge" aria-hidden="true">{badge > 99 ? '99+' : badge}</span>}
        </button>
      ))}
    </nav>
  );
}
