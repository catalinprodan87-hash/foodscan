import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import Home from './components/Home.jsx';
import Result from './components/Result.jsx';
import Disclaimer from './components/Disclaimer.jsx';
import { LookupLoading, NotFound, NoIngredients, LookupFailed } from './components/LookupViews.jsx';
import { analyze, detectProductType } from './lib/analyze.js';
import { lookupProduct, analyzeInput } from './lib/lookup.js';
import { detectLang } from './lib/i18n.js';
import { getLang, setLang as saveLang, getAvoidState, setAvoidState } from './lib/storage.js';

// The scanner (and the zxing decoder) is only downloaded when it is opened.
const ScannerOverlay = lazy(() => import('./components/ScannerOverlay.jsx'));

/*
 * Screens:
 *   home                          – scan / manual barcode / paste
 *   lookup: loading | not_found | error | no_ingredients
 *   result                        – analysis (pasted text or looked-up product)
 * The scanner is an overlay on top of home.
 */
export default function App() {
  const [lang, setLang] = useState(() => getLang() || detectLang());
  const [avoid, setAvoid] = useState(() => getAvoidState());
  const [text, setText] = useState('');
  const [chosenType, setChosenType] = useState(null); // null = auto
  const [scanning, setScanning] = useState(false);
  const [lookup, setLookup] = useState(null); // { status, code, product?, kind? }
  // What is being analysed: { text, type, auto, product?, barcode? }
  const [submitted, setSubmitted] = useState(null);
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

  // Pasted ingredients, optionally attached to a looked-up / not-found barcode.
  const analyzeText = (value) => {
    const product = lookup?.status === 'no_ingredients' ? lookup.product : null;
    const barcode = lookup?.code || null;
    const pastedType = product ? product.productType : chosenType ?? detectProductType(value);
    setLookup(null);
    setSubmitted({ text: value, type: pastedType, auto: !product && chosenType == null, product, barcode });
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
  if (lookup?.status === 'loading') {
    screen = <LookupLoading lang={lang} code={lookup.code} onCancel={goHome} />;
  } else if (lookup?.status === 'not_found') {
    screen = <NotFound lang={lang} code={lookup.code} onAnalyze={analyzeText} onBack={goHome} />;
  } else if (lookup?.status === 'no_ingredients') {
    screen = <NoIngredients lang={lang} product={lookup.product} partial={partial} onAnalyze={analyzeText} onBack={goHome} />;
  } else if (lookup?.status === 'error') {
    screen = (
      <LookupFailed
        lang={lang} code={lookup.code} kind={lookup.kind}
        onRetry={() => runLookup(lookup.code)} onAnalyze={analyzeText} onBack={goHome}
      />
    );
  } else if (result) {
    screen = (
      <Result
        lang={lang} result={result} typeAuto={submitted.auto}
        product={submitted.product} barcode={submitted.barcode} onBack={goHome}
      />
    );
  } else {
    screen = (
      <Home
        lang={lang} type={type} typeAuto={chosenType == null} onType={setChosenType}
        onScan={() => setScanning(true)} onCode={onCode}
        text={text} onText={changeText} onAnalyze={analyzeText}
        avoid={avoid} onAvoid={changeAvoid}
      />
    );
  }

  const footerType = result?.productType || lookup?.product?.productType || type;

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
