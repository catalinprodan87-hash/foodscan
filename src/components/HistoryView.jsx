import { useMemo, useRef, useState } from 'react';
import { t } from '../lib/i18n.js';
import { analyze } from '../lib/analyze.js';
import { entryAnalyzeInput, entryTitle, filterEntries } from '../lib/history.js';

const TYPES = ['all', 'food', 'cosmetic', 'household'];
const VERDICTS = ['all', 'bad', 'warn', 'ok'];
const VERDICT_ICON = { bad: '✕', warn: '!', ok: '✓', unknown: '?' };
const TYPE_ICON = { food: '🍎', cosmetic: '🧴', household: '🧽' };
const LONG_PRESS_MS = 600;

function verdictLabel(lang, v, type) {
  return t(lang, type !== 'food' && v === 'warn' ? 'verdict_warn_nonfood' : 'verdict_' + v);
}

/**
 * One history row: tap to open, swipe left or long-press to delete.
 * A delete button is also reachable by keyboard / screen reader.
 */
function HistoryRow({ lang, entry, verdict, onOpen, onDelete }) {
  const [dx, setDx] = useState(0);
  const g = useRef(null);
  const rowRef = useRef(null);
  const title = entryTitle(entry);
  const date = new Date(entry.date);

  const cancelTimer = () => { clearTimeout(g.current?.timer); };
  const down = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const timer = setTimeout(() => {
      if (g.current && !g.current.moved) {
        g.current.fired = true;
        navigator.vibrate?.(30);
        onDelete(entry);
      }
    }, LONG_PRESS_MS);
    g.current = { x: e.clientX, y: e.clientY, moved: false, swiping: false, fired: false, timer, id: e.pointerId };
  };
  const move = (e) => {
    const s = g.current;
    if (!s) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (!s.moved && Math.hypot(mx, my) > 8) { s.moved = true; cancelTimer(); }
    if (!s.swiping && Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.5) {
      s.swiping = true;
      e.currentTarget.setPointerCapture?.(s.id);
    }
    if (s.swiping) setDx(Math.min(0, mx));
  };
  const up = () => {
    const s = g.current;
    cancelTimer();
    if (!s) return;
    const width = rowRef.current?.offsetWidth || 300;
    if (s.swiping && dx < -width * 0.35) onDelete(entry);
    else if (!s.moved && !s.fired) onOpen(entry);
    setDx(0);
    g.current = null;
  };
  const cancel = () => { cancelTimer(); setDx(0); g.current = null; };

  return (
    <li className="history-row" ref={rowRef}>
      <div className="history-row-bg" aria-hidden="true">🗑 {t(lang, 'customDelete')}</div>
      <div
        className="history-row-main"
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          type="button"
          className="history-open"
          onClick={(e) => { if (e.detail === 0) onOpen(entry); }} /* keyboard activation; pointer handled above */
          aria-label={`${title}, ${t(lang, 'type_' + entry.productType)}, ${verdictLabel(lang, verdict, entry.productType)}`}
        >
          {entry.image ? (
            <img className="history-thumb" src={entry.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <span className="history-thumb placeholder" aria-hidden="true">{TYPE_ICON[entry.productType]}</span>
          )}
          <span className="history-info">
            <span className="history-name">{title}</span>
            <span className="history-meta muted small">
              {entry.brand && <>{entry.brand} · </>}
              <span className={`type-pill type-pill-${entry.productType}`}>{t(lang, 'type_' + entry.productType)}</span>
              {' · '}{date.toLocaleDateString(lang === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'short' })}
              {' · '}{t(lang, 'source_' + entry.source)}
            </span>
          </span>
          <span className={`history-verdict verdict-dot-${verdict}`} title={verdictLabel(lang, verdict, entry.productType)} aria-hidden="true">
            {VERDICT_ICON[verdict]}
          </span>
        </button>
        <button
          type="button"
          className="history-delete"
          onPointerDown={(e) => e.stopPropagation()} /* not a tap on the row */
          onPointerUp={(e) => e.stopPropagation()}
          onClick={() => onDelete(entry)}
          aria-label={t(lang, 'deleteEntry', { name: title })}
        >
          🗑
        </button>
      </div>
    </li>
  );
}

export default function HistoryView({ lang, entries, avoid, onOpen, onDelete, onClear }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [verdict, setVerdict] = useState('all');

  // Verdicts with the CURRENT avoid list (changes apply to old scans).
  const verdicts = useMemo(() => {
    const map = new Map();
    for (const e of entries) map.set(e.id, e.text ? analyze(entryAnalyzeInput(e), avoid).verdict : e.verdict);
    return map;
  }, [entries, avoid]);
  const verdictOf = (e) => verdicts.get(e.id) || e.verdict;
  const shown = filterEntries(entries, { query, type, verdict }, verdictOf);

  return (
    <div className="result history-view">
      <section className="card">
        <h1 className="card-title page-title" tabIndex={-1}>{t(lang, 'historyTitle')}</h1>
        {entries.length === 0 ? (
          <p className="muted">{t(lang, 'historyEmpty')}</p>
        ) : (
          <>
            <label htmlFor="history-search" className="sr-only">{t(lang, 'historySearch')}</label>
            <input
              id="history-search"
              className="search-input"
              type="search"
              placeholder={t(lang, 'historySearch')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            <div className="chip-row" role="group" aria-label={t(lang, 'filterType')}>
              {TYPES.map((x) => (
                <button key={x} type="button" className={`chip-btn${type === x ? ' active' : ''}`} aria-pressed={type === x} onClick={() => setType(x)}>
                  {x === 'all' ? t(lang, 'filterAll') : `${TYPE_ICON[x]} ${t(lang, 'type_' + x)}`}
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor="verdict-filter">{t(lang, 'filterVerdict')}</label>
            <select id="verdict-filter" className="select" value={verdict} onChange={(e) => setVerdict(e.target.value)}>
              {VERDICTS.map((v) => (
                <option key={v} value={v}>{v === 'all' ? t(lang, 'verdictAll') : `${VERDICT_ICON[v]} ${t(lang, 'verdict_' + v)}`}</option>
              ))}
            </select>
            <p className="muted small history-hint">{t(lang, 'historyCount', { count: shown.length })} · {t(lang, 'historyHint')}</p>
          </>
        )}
      </section>

      {entries.length > 0 && (shown.length === 0 ? (
        <p className="muted center">{t(lang, 'historyNoMatch')}</p>
      ) : (
        <ul className="history-list">
          {shown.map((e) => (
            <HistoryRow key={e.id} lang={lang} entry={e} verdict={verdictOf(e)} onOpen={onOpen} onDelete={onDelete} />
          ))}
        </ul>
      ))}

      {entries.length > 0 && (
        <button
          type="button"
          className="btn ghost block danger"
          onClick={() => { if (window.confirm(t(lang, 'clearAllConfirm'))) onClear(); }}
        >
          {t(lang, 'clearAll')}
        </button>
      )}
    </div>
  );
}
