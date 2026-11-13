import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import Home from './components/Home.jsx';
import Result from './components/Result.jsx';
import Disclaimer from './components/Disclaimer.jsx';
import { LookupLoading, NotFound, NoIngredients, LookupFailed } from './components/LookupViews.jsx';
import { analyze, detectProductType } from './lib/analyze.js';
import { lookupProduct, analyzeInput } from './lib/lookup.js';
import { buildRequest } from './lib/request.js';
import { detectLang } from './lib/i18n.js';
import { getLang, setLang as saveLang, getAvoidState, setAvoidState } from './lib/storage.js';

// The scanner (and the zxing decoder) is only downloaded when it is opened.
const ScannerOverlay = lazy(() => import('./components/ScannerOverlay.jsx'));
// Photo → OCR flow (tesseract itself is a further dynamic import inside it).
const PhotoFlow = lazy(() => import('./components/PhotoFlow.jsx'));

/*
 * Screens:
 *   home                          – scan / manual barcode / paste
 *   lookup: loading | not_found | error | no_ingredients
 *   photo                         – crop → on-device OCR → review (optionally for a barcode)
 *   result                        – analysis (pasted text, photo or looked-up product)
 * The scanner is an overlay on top of home.
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
  const abortRef = useRef(null);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const detectedType = useMemo(() => detectProductType(text), [text]);
  const type = chosenType ?? detectedType;

  const result = useMemo(() => {
    if (!submitted) return null;
    const input = submitted.product
      ? analyzeInput(submitted.product, submitted.text)
      : { text: submitted.text, productType: submitted.type };
    return analyze(input, avoid);
  }, [submitted, avoid]);

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
  const changeText = (value) => {
    setText(value);
    if (!value.trim() && chosenType && !lookup) setChosenType(null); // clearing goes back to auto
  };

  let screen;
  if (photo) {
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
    screen = <NotFound lang={lang} code={lookup.code} onAnalyze={analyzeText} onPhoto={startPhoto} onBack={goHome} />;
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
        lang={lang} result={result} typeAuto={submitted.auto}
        product={submitted.product} barcode={submitted.barcode} fromPhoto={submitted.fromPhoto} onBack={goHome}
      />
    );
  } else {
    screen = (
      <Home
        lang={lang} type={type} typeAuto={chosenType == null} onType={setChosenType}
        onScan={() => setScanning(true)} onCode={onCode} onPhoto={startPhoto}
        text={text} onText={changeText} onAnalyze={analyzeText}
        avoid={avoid} onAvoid={changeAvoid}
      />
    );
  }

  const footerType = result?.productType || lookup?.product?.productType || photo?.product?.productType || type;

  return (
    <div className="app">
      <Header lang={lang} onLang={changeLang} />
      <main>{screen}</main>
      <Disclaimer lang={lang} type={footerType} />
      {scanning && (
        <Suspense fallback={<div className="scanner scanner-loading" aria-busy="true" />}>
          <ScannerOverlay lang={lang} onCode={onCode} onClose={closeScanner} />
        </Suspense>
      )}
    </div>
  );
}
