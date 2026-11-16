import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../lib/i18n.js';
import { loadImage, prepareColour, rotateImage } from '../lib/imagePrep.js';
import { classifyPhoto, PHOTO_TYPES } from '../lib/photoType.js';
import { mergeByType, mergeTexts } from '../lib/photoSet.js';
import { correctWords } from '../lib/lexicon.js';
import { makeThumb } from '../lib/thumbStore.js';
import PhotoButton from './PhotoButton.jsx';
import ProductHeader from './ProductHeader.jsx';

const TYPE_ICON = { ingredients: '🧾', nutrition: '📊', origin: '🌍', front: '🏷️', other: '📄' };
let nextId = 0;

/**
 * Several photos of one product (v3.4): each is turned upright, read whole
 * and sorted by what it shows (ingredients, nutrition table, origin, front,
 * other – one tap changes it). Photos with an ingredients heading are read
 * first; "Oprește" stops after the current photo. The texts are merged per
 * type and the ingredients analysed.
 *
 * @param {{files: File[], existing?: Record<string,string>, onAnalyze: ({ingredients, texts, thumbs, confidence}) => void}} props
 */
export default function PhotoSetFlow({ lang, files, product, barcode, existing = {}, onAnalyze, onCancel }) {
  const [items, setItems] = useState(() => files.map((file) => ({ id: `p${Date.now().toString(36)}${nextId++}`, file, status: 'waiting', types: [], raw: '', thumb: null })));
  const [edited, setEdited] = useState(null); // ingredients text typed by the user
  const [stopped, setStopped] = useState(false);
  const stopRef = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const update = (id, patch) => alive.current && setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  // Read the photos: first a quick look for an ingredients heading (those are read first),
  // then each whole photo. Runs again when photos are added.
  const running = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const pending = items.filter((it) => it.status === 'waiting').length;
  useEffect(() => {
    if (!pending || running.current || stopRef.current) return;
    running.current = true;
    (async () => {
      const ocr = await import('../lib/ocr.js');
      const prepared = [];
      for (const it of itemsRef.current.filter((x) => x.status === 'waiting')) {
        if (!alive.current || stopRef.current) break;
        update(it.id, { status: 'preparing' });
        try {
          let img = await loadImage(it.file);
          const o = await ocr.detectOrientation(img);
          if (o.turns) img = rotateImage(img, o.turns);
          const sug = await ocr.suggestCrop(img).catch(() => null);
          update(it.id, { thumb: makeThumb(img), status: 'queued' });
          prepared.push({ it, img, first: sug && sug.kind ? 0 : 1 });
        } catch {
          update(it.id, { status: 'error' });
        }
      }
      prepared.sort((a, b) => a.first - b.first);
      for (const { it, img } of prepared) {
        if (!alive.current || stopRef.current) { update(it.id, { status: 'skipped' }); continue; }
        update(it.id, { status: 'reading' });
        try {
          const r = await ocr.recognize(prepareColour(img, null));
          const c = classifyPhoto(r.text);
          update(it.id, { status: 'done', raw: r.text, types: c.types, confidence: r.confidence });
        } catch {
          update(it.id, { status: 'error' });
        }
      }
      running.current = false;
      if (alive.current) setItems((list) => [...list]); // pick up photos added meanwhile
    })();
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = items.filter((it) => it.status === 'done');
  const texts = useMemo(() => mergeTexts(existing, mergeByType(done)), [done, existing]);
  const autoIngredients = texts.ingredients ? correctWords(texts.ingredients).text : '';
  const ingredients = edited ?? autoIngredients;
  const busy = items.some((it) => ['waiting', 'preparing', 'queued', 'reading'].includes(it.status)) && !stopped;

  const toggleType = (id, type) => setItems((list) => list.map((it) => (it.id !== id ? it
    : { ...it, types: it.types.includes(type) ? it.types.filter((x) => x !== type) : [...it.types, type] })));

  const addMore = (more) => {
    const extra = [].concat(more).map((file) => ({ id: `p${Date.now().toString(36)}${nextId++}`, file, status: 'waiting', types: [], raw: '', thumb: null }));
    stopRef.current = false;
    setStopped(false);
    setItems((list) => [...list, ...extra]);
  };

  const stop = () => { stopRef.current = true; setStopped(true); };
  const analyze = () => {
    stop();
    const conf = done.length ? Math.round(done.reduce((s, it) => s + (it.confidence || 0), 0) / done.length) : null;
    onAnalyze({
      ingredients,
      texts: { ...texts, ...(ingredients ? { ingredients } : {}) },
      thumbs: done.map((it) => ({ id: it.id, types: it.types, date: new Date().toISOString(), data: it.thumb })).filter((x) => x.data),
      confidence: conf,
    });
  };

  return (
    <div className="result photo-set">
      <ProductHeader lang={lang} product={product} barcode={barcode} />
      <section className="card" aria-labelledby="set-title">
        <h2 id="set-title" className="card-title page-title" tabIndex={-1}>📚 {t(lang, 'setTitle', { n: items.length })}</h2>
        <p className="muted small">{t(lang, 'setHint')}</p>
        <ul className="set-list">
          {items.map((it, i) => (
            <li key={it.id} className={`set-item set-${it.status}`}>
              {it.thumb ? <img src={it.thumb} alt="" className="set-thumb" /> : <span className="set-thumb placeholder" aria-hidden="true" />}
              <div className="set-body">
                <p className="small set-status" aria-live="polite">
                  {t(lang, 'setPhoto', { n: i + 1 })} · {t(lang, 'setStatus_' + it.status)}
                  {['waiting', 'preparing', 'queued', 'reading'].includes(it.status) && !stopped && <span className="spinner tiny" aria-hidden="true" />}
                </p>
                {it.status === 'done' && (
                  <div className="chip-row set-types" role="group" aria-label={t(lang, 'setTypesLabel', { n: i + 1 })}>
                    {PHOTO_TYPES.map((type) => (
                      <button key={type} type="button" className={`chip-btn small${it.types.includes(type) ? ' active' : ''}`} aria-pressed={it.types.includes(type)} onClick={() => toggleType(it.id, type)}>
                        {TYPE_ICON[type]} {t(lang, 'photoType_' + type)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="actions">
          {busy && <button type="button" className="btn ghost small-btn" onClick={stop}>⏹ {t(lang, 'setStop')}</button>}
          <PhotoButton lang={lang} onPhoto={addMore} className="btn ghost small-btn" labelKey="setAddMore" multiple />
        </div>
      </section>

      <section className="card review-card" aria-labelledby="set-ingr-title">
        <h3 id="set-ingr-title" className="card-title">🧾 {t(lang, 'setIngredients')}</h3>
        {!ingredients && <p className="muted small">{t(lang, busy ? 'setWaiting' : 'setNoIngredients')}</p>}
        <label htmlFor="set-ingr-text" className="sr-only">{t(lang, 'setIngredients')}</label>
        <textarea id="set-ingr-text" rows={7} value={ingredients} onChange={(e) => setEdited(e.target.value)} spellCheck={false} />
        {['nutrition', 'origin'].filter((k) => texts[k]).map((k) => (
          <details key={k} className="set-other-text">
            <summary className="small">{TYPE_ICON[k]} {t(lang, 'photoType_' + k)}</summary>
            <p className="small muted">{texts[k]}</p>
          </details>
        ))}
        <div className="actions">
          <button type="button" className="btn primary" disabled={!ingredients.trim()} onClick={analyze}>{t(lang, 'analyze')}</button>
          <button type="button" className="btn ghost" onClick={() => { stop(); onCancel(); }}>{t(lang, 'cancel')}</button>
        </div>
      </section>
    </div>
  );
}
