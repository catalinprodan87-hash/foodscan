import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import Home from './components/Home.jsx';
import Result from './components/Result.jsx';
import Disclaimer from './components/Disclaimer.jsx';
import { LookupLoading, NotFound, NoIngredients, LookupFailed, InStore } from './components/LookupViews.jsx';
import { analyze, detectProductType } from './lib/analyze.js';
import { lookupProduct, analyzeInput, isInStoreCode, createNotFoundCache } from './lib/lookup.js';
import { recordTiming } from './lib/diagnostics.js';
import { createRepeatFilter, addScan, updateScan } from './lib/shopping.js';
import { vibrate } from './lib/camera.js';
import { summaryParts } from './components/Result.jsx';
import { buildBackup, backupFileName, historyToRestore, mergeSaved, clearLocalData, requestPersistence } from './lib/backup.js';
import { defaultAvoidState } from './data/avoidPresets.js';
import { buildRequest } from './lib/request.js';
import { detectLang, t } from './lib/i18n.js';
import { getLang, setLang as saveLang, getAvoidState, setAvoidState, getFlag, setFlag } from './lib/storage.js';
import { createHistoryStore, makeEntry, entryRequest, entryTitle } from './lib/history.js';
import { createSavedStore, savedFromRequest, requestFromSaved } from './lib/savedIngredients.js';
import TabBar from './components/TabBar.jsx';
import { UpdateBanner, OfflineBanner, InstallCard, Toast } from './components/Banners.jsx';

// The scanner (and the zxing decoder) is only downloaded when it is opened.
const ScannerOverlay = lazy(() => import('./components/ScannerOverlay.jsx'));
// Photo → OCR flow (the OCR engine runs in a Web Worker, loaded on the first photo).
const PhotoFlow = lazy(() => import('./components/PhotoFlow.jsx'));
// Secondary tabs and the first-run slides are split out to keep the first load small.
const HistoryView = lazy(() => import('./components/HistoryView.jsx'));
const CompareView = lazy(() => import('./components/CompareView.jsx'));
const AvoidListView = lazy(() => import('./components/AvoidListView.jsx'));
const AboutView = lazy(() => import('./components/AboutView.jsx'));
const Onboarding = lazy(() => import('./components/Onboarding.jsx'));

const Loading = () => <section className="card ocr-progress" aria-busy="true"><div className="spinner" aria-hidden="true" /></section>;

/*
 * Screens:
 *   home                          – scan / manual barcode / paste
 *   lookup: loading | not_found | error | no_ingredients
 *   photo                         – crop → on-device OCR → review (optionally for a barcode)
 *   result                        – analysis (pasted text, photo or looked-up product)
 * The scanner is an overlay on top of home. Tabs: scan | history | list | about.
 * Every analysis is saved to the history; opening a history entry re-runs
 * analyze() with the current avoid list.
 */
export default function App() {
  const [lang, setLang] = useState(() => getLang() || detectLang());
  const [avoid, setAvoid] = useState(() => getAvoidState());
  const [text, setText] = useState('');
  const [chosenType, setChosenType] = useState(null); // null = auto
  const [scanning, setScanning] = useState(false);
  // Shopping mode: camera stays on, each product becomes a card ({ on, items }).
  const [shop, setShop] = useState({ on: false, items: [] });
  const repeatRef = useRef(createRepeatFilter());
  const shopItemsRef = useRef([]); // the list, updated synchronously (several codes can arrive quickly)
  const [lookup, setLookup] = useState(null); // { status, code, product?, kind? }
  // What is being analysed: see buildRequest() in lib/request.js
  const [submitted, setSubmitted] = useState(null);
  // Photo being read: { file, product, barcode }
  const [photo, setPhoto] = useState(null);
  const [tab, setTab] = useState('scan');
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(null); // request rebuilt from an entry
  const [compare, setCompare] = useState(null); // two history entries
  const [onboarded, setOnboarded] = useState(() => getFlag('onboarded'));
  const [toast, setToast] = useState(null);
  const abortRef = useRef(null);
  const storeRef = useRef(null);
  const savedRef = useRef(null);
  const persistAskedRef = useRef(false);
  // Ingredients the user photographed / pasted for a barcode, remembered for the next scan.
  const savedStoreRef = useRef(null);
  if (!savedStoreRef.current) savedStoreRef.current = createSavedStore();
  // Barcodes no database knew (24 h), so a second scan answers at once.
  const notFoundRef = useRef(null);
  if (!notFoundRef.current) notFoundRef.current = createNotFoundCache();
  const mainRef = useRef(null);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // History store (IndexedDB, or localStorage as a fallback).
  useEffect(() => {
    let alive = true;
    storeRef.current = createHistoryStore();
    storeRef.current.then((store) => store.all()).then((list) => {
      // One-off: photos / pasted lists from before v1.4 are remembered too.
      if (!getFlag('savedSeeded')) {
        savedStoreRef.current.seed(list);
        setFlag('savedSeeded');
      }
      if (alive) setHistory(list);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const notify = useCallback((text, extra = {}) => setToast({ text, ...extra, key: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), toast.actionLabel ? 6000 : 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const detectedType = useMemo(() => detectProductType(text), [text]);
  const type = chosenType ?? detectedType;

  const result = useMemo(() => {
    if (!submitted) return null;
    const input = submitted.product
      ? analyzeInput(submitted.product, submitted.text)
      : { text: submitted.text, productType: submitted.type };
    return analyze(input, avoid);
  }, [submitted, avoid]);

  // Save each new analysis (not re-runs caused by avoid-list changes).
  useEffect(() => {
    if (!submitted || !result || savedRef.current === submitted) return;
    savedRef.current = submitted;
    const entry = makeEntry(submitted, result);
    storeRef.current?.then((store) => store.save(entry, 200)).then(setHistory).catch(() => {});
    // Once there is something worth keeping, ask the browser not to evict it.
    if (!persistAskedRef.current) {
      persistAskedRef.current = true;
      requestPersistence();
    }
  }, [submitted, result]);

  const historyResult = useMemo(() => {
    if (!historyOpen) return null;
    const input = historyOpen.product
      ? analyzeInput(historyOpen.product, historyOpen.text)
      : { text: historyOpen.text, productType: historyOpen.type };
    return analyze(input, avoid);
  }, [historyOpen, avoid]);

  const deleteEntry = useCallback(async (entry) => {
    const store = await storeRef.current;
    await store.remove(entry.id);
    setHistory(await store.all());
    notify(`${t(lang, 'deleted')}: ${entryTitle(entry)}`, {
      actionLabel: t(lang, 'undo'),
      onAction: async () => { setHistory(await store.save(entry, 200)); },
    });
  }, [notify, lang]);

  // ───── Settings: backup, restore, delete everything ─────
  const exportData = useCallback(() => {
    const data = buildBackup({ history, saved: savedStoreRef.current.all(), avoid });
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, [history, avoid]);

  /** Adds new / newer history and remembered ingredients; the avoid list is replaced. */
  const importData = useCallback(async (backup) => {
    const store = await storeRef.current;
    const toWrite = historyToRestore(history, backup.history);
    for (const entry of toWrite) await store.save(entry, 200);
    setHistory(await store.all());
    const before = savedStoreRef.current.all();
    const merged = mergeSaved(before, backup.saved);
    savedStoreRef.current.replaceAll(merged);
    const savedAdded = Object.keys(merged).filter((c) => merged[c] !== before[c]).length;
    if (backup.avoid) { setAvoid(backup.avoid); setAvoidState(backup.avoid); }
    return { history: toWrite.length, saved: savedAdded, avoid: !!backup.avoid };
  }, [history]);

  const deleteAllData = useCallback(async () => {
    try { await (await storeRef.current).clear(); } catch { /* ignore */ }
    clearLocalData();
    // Cached product lookups also record what was scanned. The OCR engine is kept (no personal data).
    try { await globalThis.caches?.delete('openfacts-api'); } catch { /* ignore */ }
    setHistory([]);
    setAvoid(defaultAvoidState());
    window.location.reload();
  }, []);

  const clearHistory = useCallback(async () => {
    const store = await storeRef.current;
    await store.clear();
    setHistory([]);
  }, []);

  // Partial food data (NOVA, Nutri-Score, additive tags) for products without ingredients.
  const partial = useMemo(() => {
    const p = lookup?.status === 'no_ingredients' ? lookup.product : null;
    return p && p.productType === 'food' ? analyze(analyzeInput(p), avoid) : null;
  }, [lookup, avoid]);

  const scrollTop = () => window.scrollTo?.({ top: 0, behavior: 'smooth' });

  const goHome = useCallback(() => {
    abortRef.current?.abort();
    setLookup(null);
    setSubmitted(null);
    setPhoto(null);
  }, []);

  /** @param {{force?: boolean}} opts force: ignore the not-found cache ("Caută din nou"). */
  const runLookup = useCallback(async (code, { force = false } = {}) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSubmitted(null);
    scrollTop();

    // Ingredients remembered from an earlier photo / paste: show them at once
    // (works offline), then refresh the product details in the background.
    const saved = savedStoreRef.current.get(code);
    if (saved) {
      setLookup(null);
      setSubmitted(requestFromSaved(saved));
      if (isInStoreCode(code)) return; // no database knows in-store codes
      try {
        const res = await lookupProduct(code, { productType: saved.productType, signal: ctrl.signal });
        if (ctrl.signal.aborted || res.status !== 'found') return;
        const fresh = requestFromSaved(saved, res.product);
        savedStoreRef.current.save({ ...saved, product: fresh.product });
        setSubmitted((prev) => (prev?.saved && prev.barcode === code ? fresh : prev));
      } catch { /* offline or aborted: the remembered details are enough */ }
      return;
    }

    // Weighed / packed in store (EAN-13 20–29): no public database knows it.
    if (isInStoreCode(code)) {
      setLookup({ status: 'in_store', code });
      return;
    }
    if (force) notFoundRef.current.remove(code);
    else if (notFoundRef.current.has(code)) {
      setLookup({ status: 'not_found', code, cached: true });
      return;
    }

    setLookup({ status: 'loading', code });
    let res;
    const t0 = performance.now();
    try {
      res = await lookupProduct(code, { productType: chosenType, signal: ctrl.signal });
    } catch {
      return; // aborted by the user
    }
    if (ctrl.signal.aborted) return;
    recordTiming('lookup', performance.now() - t0, res.status !== 'error', `${res.status} ${res.tried?.join('>') || ''}`);
    if (res.status === 'not_found') notFoundRef.current.add(code);
    if (res.status === 'found' && res.product.hasIngredients) {
      setLookup(null);
      setSubmitted({ text: '', type: res.product.productType, auto: false, product: res.product, barcode: code });
    } else if (res.status === 'found') {
      setLookup({ status: 'no_ingredients', code, product: res.product });
    } else {
      setLookup(res); // not_found | error (keeps the barcode)
    }
  }, [chosenType]);

  const onCode = useCallback((code) => {
    setScanning(false);
    runLookup(code);
  }, [runLookup]);

  const closeScanner = useCallback(() => setScanning(false), []);

  // ───── Shopping mode ─────
  /** What a code leads to, without changing the screen (saved → database → not found). */
  const lookupQuietly = useCallback(async (code) => {
    const saved = savedStoreRef.current.get(code);
    if (saved) return { state: 'saved', request: requestFromSaved(saved) };
    if (isInStoreCode(code)) return { state: 'in_store' };
    if (notFoundRef.current.has(code)) return { state: 'not_found' };
    const t0 = performance.now();
    const res = await lookupProduct(code, { productType: chosenType });
    recordTiming('lookup', performance.now() - t0, res.status !== 'error', `shop ${res.status}`);
    if (res.status === 'found' && res.product.hasIngredients) {
      return { state: 'found', request: { text: '', type: res.product.productType, auto: false, product: res.product, barcode: code } };
    }
    if (res.status === 'found') return { state: 'no_ingredients', product: res.product };
    if (res.status === 'not_found') { notFoundRef.current.add(code); return { state: 'not_found' }; }
    return { state: 'error' };
  }, [chosenType]);

  const onShopCode = useCallback(async (code) => {
    if (!repeatRef.current(code)) return; // the same box still in front of the camera
    const r = addScan(shopItemsRef.current, code);
    shopItemsRef.current = r.items;
    setShop((s) => ({ ...s, items: r.items }));
    if (!r.isNew) return;
    vibrate();
    let out;
    try { out = await lookupQuietly(code); } catch { out = { state: 'error' }; }
    let patch = { state: out.state, product: out.product || out.request?.product || null, request: out.request || null };
    patch.name = patch.product?.name || '';
    if (out.request) {
      const input = out.request.product ? analyzeInput(out.request.product, out.request.text) : { text: out.request.text, productType: out.request.type };
      const result = analyze(input, avoid);
      patch = { ...patch, verdict: result.verdict, reason: summaryParts(result, lang)[0] || '' };
      // Shopping scans go to the history too (for comparing later).
      const entry = makeEntry(out.request, result);
      storeRef.current?.then((store) => store.save(entry, 200)).then(setHistory).catch(() => {});
    }
    shopItemsRef.current = updateScan(shopItemsRef.current, code, patch);
    setShop((s) => ({ ...s, items: shopItemsRef.current }));
  }, [lookupQuietly, avoid, lang]);

  const openShopItem = useCallback((item) => {
    setScanning(false);
    setPhoto(null);
    if (item.request) { setLookup(null); setSubmitted(item.request); scrollTop(); return; }
    setSubmitted(null);
    if (item.state === 'no_ingredients') setLookup({ status: 'no_ingredients', code: item.code, product: item.product });
    else if (item.state === 'not_found') setLookup({ status: 'not_found', code: item.code, cached: true });
    else if (item.state === 'in_store') setLookup({ status: 'in_store', code: item.code });
    else runLookup(item.code, { force: true });
  }, [runLookup]);

  // From a product opened in shopping mode back to the camera, list intact.
  const backToShopping = useCallback(() => {
    abortRef.current?.abort();
    setLookup(null);
    setSubmitted(null);
    setPhoto(null);
    setScanning(true);
  }, []);

  // Barcode context to attach pasted / photographed ingredients to.
  const lookupContext = () => ({
    product: lookup?.status === 'no_ingredients' ? lookup.product : null,
    barcode: lookup?.code || null,
  });

  // Pasted ingredients, optionally attached to a looked-up / not-found barcode.
  const analyzeText = (value) => {
    setLookup(null);
    setSubmitted(remember(buildRequest({ text: value, source: 'paste', chosenType, ...lookupContext() })));
    scrollTop();
  };

  // Ingredients typed or photographed for a barcode are remembered for the next scan.
  const remember = (req) => {
    const saved = savedFromRequest(req);
    if (!saved) return req;
    savedStoreRef.current.save(saved);
    return { ...req, saved: { date: saved.date, source: saved.source, fresh: true } };
  };
  const forgetSaved = (code) => {
    savedStoreRef.current.remove(code);
    notify(t(lang, 'savedForgotten'));
    runLookup(code);
  };
  // New photo for a product whose ingredients were remembered (replaces them).
  const retakeSaved = (file) => {
    const p = submitted?.product;
    setPhoto({ file, product: p ? { ...p, hasIngredients: false } : null, barcode: submitted?.barcode || null });
    setSubmitted(null);
    scrollTop();
  };

  // Photo of the ingredients: keeps the barcode context of the current screen.
  const startPhoto = (file) => {
    setPhoto((prev) => (prev ? { ...prev, file } : { file, ...lookupContext() }));
    setLookup(null);
    setSubmitted(null);
    scrollTop();
  };
  const analyzePhotoText = (value, confidence) => {
    const { product, barcode } = photo;
    setPhoto(null);
    setSubmitted(remember(buildRequest({ text: value, source: 'photo', chosenType, product, barcode, confidence })));
    scrollTop();
  };

  const changeLang = (l) => {
    setLang(l);
    saveLang(l);
  };
  const changeAvoid = (s) => {
    setAvoid(s);
    setAvoidState(s);
  };
  const changeTab = (next) => {
    if (next === tab && next === 'history') { setHistoryOpen(null); setCompare(null); }
    if (next === tab && next === 'scan' && !scanning) goHome();
    setTab(next);
  };
  const finishOnboarding = () => {
    setFlag('onboarded');
    setOnboarded(true);
  };

  const changeText = (value) => {
    setText(value);
    if (!value.trim() && chosenType && !lookup) setChosenType(null); // clearing goes back to auto
  };

  // In shopping mode, "back" from a product returns to the camera.
  const shopping = shop.on && shop.items.length > 0;
  const leave = shopping ? backToShopping : goHome;
  const leaveLabel = shopping ? 'backToShopping' : undefined;

  let screen;
  if (tab === 'history' && compare) {
    screen = (
      <Suspense fallback={<Loading />}>
        <CompareView lang={lang} entries={compare} avoid={avoid} onBack={() => setCompare(null)} />
      </Suspense>
    );
  } else if (tab === 'history') {
    screen = historyOpen && historyResult ? (
      <Result
        lang={lang} result={historyResult} text={historyOpen.product ? historyOpen.product.ingredientsText || historyOpen.text : historyOpen.text}
        typeAuto={false} product={historyOpen.product} barcode={historyOpen.barcode} fromPhoto={historyOpen.fromPhoto}
        onBack={() => setHistoryOpen(null)} backLabel="backToHistory" notify={notify} watchedAllergens={avoid.allergens}
      />
    ) : (
      <Suspense fallback={<Loading />}>
        <HistoryView
          lang={lang} entries={history} avoid={avoid}
          onOpen={(entry) => { setHistoryOpen(entryRequest(entry)); scrollTop(); }}
          onDelete={deleteEntry} onClear={clearHistory} onCompare={(pair) => { setCompare(pair); scrollTop(); }}
        />
      </Suspense>
    );
  } else if (tab === 'list') {
    screen = (
      <Suspense fallback={<Loading />}>
        <AvoidListView lang={lang} avoid={avoid} onChange={changeAvoid} history={history} notify={notify} />
      </Suspense>
    );
  } else if (tab === 'about') {
    screen = (
      <Suspense fallback={<Loading />}>
        <AboutView lang={lang} onExport={exportData} onImport={importData} onDeleteAll={deleteAllData} />
      </Suspense>
    );
  } else if (photo) {
    screen = (
      <Suspense fallback={<section className="card ocr-progress" aria-busy="true"><div className="spinner" aria-hidden="true" /></section>}>
        <PhotoFlow
          lang={lang} file={photo.file} product={photo.product} barcode={photo.barcode}
          onAnalyze={analyzePhotoText} onRetake={startPhoto} onCancel={goHome}
        />
      </Suspense>
    );
  } else if (lookup?.status === 'loading') {
    screen = <LookupLoading lang={lang} code={lookup.code} onCancel={goHome} />;
  } else if (lookup?.status === 'not_found') {
    screen = (
      <NotFound
        lang={lang} code={lookup.code} type={chosenType || 'food'} cached={lookup.cached}
        onAnalyze={analyzeText} onPhoto={startPhoto} onBack={leave} backLabel={leaveLabel} onRetry={() => runLookup(lookup.code, { force: true })}
      />
    );
  } else if (lookup?.status === 'in_store') {
    screen = <InStore lang={lang} code={lookup.code} onAnalyze={analyzeText} onPhoto={startPhoto} onBack={leave} backLabel={leaveLabel} />;
  } else if (lookup?.status === 'no_ingredients') {
    screen = (
      <NoIngredients
        lang={lang} product={lookup.product} partial={partial}
        onAnalyze={analyzeText} onPhoto={startPhoto} onBack={leave} backLabel={leaveLabel}
      />
    );
  } else if (lookup?.status === 'error') {
    screen = (
      <LookupFailed
        lang={lang} code={lookup.code} kind={lookup.kind}
        onRetry={() => runLookup(lookup.code, { force: true })} onAnalyze={analyzeText} onPhoto={startPhoto} onBack={leave} backLabel={leaveLabel}
      />
    );
  } else if (result) {
    screen = (
      <Result
        lang={lang} result={result} typeAuto={submitted.auto} notify={notify}
        text={submitted.text?.trim() ? submitted.text : submitted.product?.ingredientsText || ''}
        product={submitted.product} barcode={submitted.barcode} fromPhoto={submitted.fromPhoto} onBack={leave} backLabel={leaveLabel}
        saved={submitted.saved} onRetake={retakeSaved} onForget={() => forgetSaved(submitted.barcode)}
        watchedAllergens={avoid.allergens}
      />
    );
  } else {
    screen = (
      <Home
        lang={lang} type={type} typeAuto={chosenType == null} onType={setChosenType}
        onScan={() => setScanning(true)} onCode={onCode} onPhoto={startPhoto}
        text={text} onText={changeText} onAnalyze={analyzeText}
        avoid={avoid} onAvoid={changeAvoid} onEditList={() => setTab('list')}
      />
    );
  }

  // Screen readers: move focus to the new screen's heading when the screen changes.
  const screenKey = `${tab}:${historyOpen ? 'open' : ''}:${photo ? 'photo' : ''}:${lookup?.status || ''}:${result ? 'result' : ''}`;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const heading = mainRef.current?.querySelector('.page-title, h1, h2');
    if (heading) {
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }, [screenKey]);

  const footerType = (tab === 'history' && historyResult?.productType)
    || result?.productType || lookup?.product?.productType || photo?.product?.productType || type;

  return (
    <div className="app">
      <a className="skip-link" href="#main">{t(lang, 'skipToContent')}</a>
      <UpdateBanner lang={lang} />
      <OfflineBanner lang={lang} />
      <Header lang={lang} onLang={changeLang} />
      {tab === 'scan' && !photo && !lookup && !result && <InstallCard lang={lang} />}
      <main id="main" ref={mainRef} tabIndex={-1}>{screen}</main>
      {tab !== 'about' && <Disclaimer lang={lang} type={footerType} />}
      <TabBar lang={lang} tab={tab} onTab={changeTab} badge={0} />
      <Toast toast={toast} onClose={() => setToast(null)} />
      {!onboarded && (
        <Suspense fallback={null}>
          <Onboarding lang={lang} onLang={changeLang} onDone={finishOnboarding} />
        </Suspense>
      )}
      {scanning && (
        <Suspense fallback={<div className="scanner scanner-loading" aria-busy="true" />}>
          <ScannerOverlay
            lang={lang} onCode={shop.on ? onShopCode : onCode} onClose={closeScanner}
            shopping={shop.on} onShopping={(on) => setShop((s) => ({ ...s, on }))} items={shop.items} onOpenItem={openShopItem}
          />
        </Suspense>
      )}
    </div>
  );
}
