import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import Home from './components/Home.jsx';
import Result from './components/Result.jsx';
import Disclaimer from './components/Disclaimer.jsx';
import { LookupLoading, NotFound, NoIngredients, LookupFailed } from './components/LookupViews.jsx';
import { analyze, detectProductType } from './lib/analyze.js';
import { lookupProduct, analyzeInput } from './lib/lookup.js';
import { buildRequest } from './lib/request.js';
import { detectLang, t } from './lib/i18n.js';
import { getLang, setLang as saveLang, getAvoidState, setAvoidState, getFlag, setFlag } from './lib/storage.js';
import { createHistoryStore, makeEntry, entryRequest, entryTitle } from './lib/history.js';
import TabBar from './components/TabBar.jsx';
import { UpdateBanner, OfflineBanner, InstallCard, Toast } from './components/Banners.jsx';

// The scanner (and the zxing decoder) is only downloaded when it is opened.
const ScannerOverlay = lazy(() => import('./components/ScannerOverlay.jsx'));
// Photo → OCR flow (tesseract itself is a further dynamic import inside it).
const PhotoFlow = lazy(() => import('./components/PhotoFlow.jsx'));
// Secondary tabs and the first-run slides are split out to keep the first load small.
const HistoryView = lazy(() => import('./components/HistoryView.jsx'));
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
  const [lookup, setLookup] = useState(null); // { status, code, product?, kind? }
  // What is being analysed: see buildRequest() in lib/request.js
  const [submitted, setSubmitted] = useState(null);
  // Photo being read: { file, product, barcode }
  const [photo, setPhoto] = useState(null);
  const [tab, setTab] = useState('scan');
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(null); // request rebuilt from an entry
  const [onboarded, setOnboarded] = useState(() => getFlag('onboarded'));
  const [toast, setToast] = useState(null);
  const abortRef = useRef(null);
  const storeRef = useRef(null);
  const savedRef = useRef(null);
  const mainRef = useRef(null);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // History store (IndexedDB, or localStorage as a fallback).
  useEffect(() => {
    let alive = true;
    storeRef.current = createHistoryStore();
    storeRef.current.then((store) => store.all()).then((list) => { if (alive) setHistory(list); }).catch(() => {});
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

  const runLookup = useCallback(async (code) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSubmitted(null);
    setLookup({ status: 'loading', code });
    scrollTop();
    let res;
    try {
      res = await lookupProduct(code, { productType: chosenType, signal: ctrl.signal });
    } catch {
      return; // aborted by the user
    }
    if (ctrl.signal.aborted) return;
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

  // Barcode context to attach pasted / photographed ingredients to.
  const lookupContext = () => ({
    product: lookup?.status === 'no_ingredients' ? lookup.product : null,
    barcode: lookup?.code || null,
  });

  // Pasted ingredients, optionally attached to a looked-up / not-found barcode.
  const analyzeText = (value) => {
    setLookup(null);
    setSubmitted(buildRequest({ text: value, source: 'paste', chosenType, ...lookupContext() }));
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
    setSubmitted(buildRequest({ text: value, source: 'photo', chosenType, product, barcode, confidence }));
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
    if (next === tab && next === 'history') setHistoryOpen(null);
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

  let screen;
  if (tab === 'history') {
    screen = historyOpen && historyResult ? (
      <Result
        lang={lang} result={historyResult} text={historyOpen.product ? historyOpen.product.ingredientsText || historyOpen.text : historyOpen.text}
        typeAuto={false} product={historyOpen.product} barcode={historyOpen.barcode} fromPhoto={historyOpen.fromPhoto}
        onBack={() => setHistoryOpen(null)} backLabel="backToHistory" notify={notify}
      />
    ) : (
      <Suspense fallback={<Loading />}>
        <HistoryView
          lang={lang} entries={history} avoid={avoid}
          onOpen={(entry) => { setHistoryOpen(entryRequest(entry)); scrollTop(); }}
          onDelete={deleteEntry} onClear={clearHistory}
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
    screen = <Suspense fallback={<Loading />}><AboutView lang={lang} /></Suspense>;
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
    screen = <NotFound lang={lang} code={lookup.code} type={chosenType || 'food'} onAnalyze={analyzeText} onPhoto={startPhoto} onBack={goHome} />;
  } else if (lookup?.status === 'no_ingredients') {
    screen = (
      <NoIngredients
        lang={lang} product={lookup.product} partial={partial}
        onAnalyze={analyzeText} onPhoto={startPhoto} onBack={goHome}
      />
    );
  } else if (lookup?.status === 'error') {
    screen = (
      <LookupFailed
        lang={lang} code={lookup.code} kind={lookup.kind}
        onRetry={() => runLookup(lookup.code)} onAnalyze={analyzeText} onPhoto={startPhoto} onBack={goHome}
      />
    );
  } else if (result) {
    screen = (
      <Result
        lang={lang} result={result} typeAuto={submitted.auto} notify={notify}
        text={submitted.text?.trim() ? submitted.text : submitted.product?.ingredientsText || ''}
        product={submitted.product} barcode={submitted.barcode} fromPhoto={submitted.fromPhoto} onBack={goHome}
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
          <ScannerOverlay lang={lang} onCode={onCode} onClose={closeScanner} />
        </Suspense>
      )}
    </div>
  );
}
