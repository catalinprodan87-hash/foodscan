import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import Home from './components/Home.jsx';
import { analyze, detectProductType } from './lib/analyze.js';
import { lookupProduct, analyzeInput, isInStoreCode, createNotFoundCache } from './lib/lookup.js';
import { createRepeatFilter, addScan, updateScan } from './lib/shopping.js';
import { vibrate } from './lib/camera.js';
import { summaryParts } from './lib/summary.js';
import { buildBackup, backupFileName, historyToRestore, mergeSaved, clearLocalData, requestPersistence } from './lib/backup.js';
import { buildRequest } from './lib/request.js';
import { detectLang, t, pick } from './lib/i18n.js';
import { getLang, setLang as saveLang, getProfiles, setProfiles as saveProfiles, getFlag, setFlag } from './lib/storage.js';
import { activeAvoid, updateActive, addProfile, setActive } from './lib/profiles.js';
import { decodeList } from './lib/shareList.js';
import { isShareLaunch, takeShared } from './lib/shareTarget.js';
import { createHistoryStore, makeEntry, entryRequest, entryTitle } from './lib/history.js';
import { createSavedStore, savedFromRequest, requestFromSaved, productSnapshot } from './lib/savedIngredients.js';
import { chooseIngredients, editedRecord, revertRecord, completeText, migrateSaved } from './lib/ingredientText.js';
import { mergeTexts } from './lib/photoSet.js';
import { buildNutrition } from './lib/nutritionInfo.js';
import { createNutritionStore } from './lib/nutritionStore.js';
import { saveAutoBackup } from './lib/autoBackup.js';
import TabBar from './components/TabBar.jsx';
import { UpdateBanner, OfflineBanner, InstallCard, Toast, WhatsNew } from './components/Banners.jsx';
import { checkAfterStart } from './lib/updateStatus.js';
import { onUpdateFailed } from './lib/pwa.js';
import { WHATS_NEW, shortVersion } from './data/whatsNew.js';

/* global __APP_VERSION__ */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
/* global __BUILD_ID__ */
const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

// Result and lookup screens load on demand (first-load budget); precached for offline use.
const Result = lazy(() => import('./components/Result.jsx'));
const lookupView = (name) => lazy(() => import('./components/LookupViews.jsx').then((m) => ({ default: m[name] })));
const LookupLoading = lookupView('LookupLoading');
const NotFound = lookupView('NotFound');
const NoIngredients = lookupView('NoIngredients');
const LookupFailed = lookupView('LookupFailed');
const InStore = lookupView('InStore');

// The scanner (and the zxing decoder) is only downloaded when it is opened.
const ScannerOverlay = lazy(() => import('./components/ScannerOverlay.jsx'));
// Photo → OCR flow (the OCR engine runs in a Web Worker, loaded on the first photo).
const PhotoFlow = lazy(() => import('./components/PhotoFlow.jsx'));
// Several photos of one product (v3.4), and their thumbnails on the result.
const PhotoSetFlow = lazy(() => import('./components/PhotoSetFlow.jsx'));
// Secondary tabs and the first-run slides are split out to keep the first load small.
const HistoryView = lazy(() => import('./components/HistoryView.jsx'));
const CompareView = lazy(() => import('./components/CompareView.jsx'));
const AvoidListView = lazy(() => import('./components/AvoidListView.jsx'));
const AboutView = lazy(() => import('./components/AboutView.jsx'));
const Onboarding = lazy(() => import('./components/Onboarding.jsx'));
const GlossaryDialog = lazy(() => import('./components/GlossaryDialog.jsx'));

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
  // Family profiles; `avoid` is the active profile's list (presets, custom, allergens).
  const [profiles, setProfilesState] = useState(() => getProfiles(getLang() || detectLang()));
  const avoid = useMemo(() => activeAvoid(profiles), [profiles]);
  const changeProfiles = useCallback((next) => { setProfilesState(next); saveProfiles(next); }, []);
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
  // Several photos of one product: { files, product, barcode, existing, dbText }
  const [photoSet, setPhotoSet] = useState(null);
  const [thumbVersion, setThumbVersion] = useState(0);
  const [tab, setTab] = useState('scan');
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(null); // request rebuilt from an entry
  const [compare, setCompare] = useState(null); // two history entries
  const [onboarded, setOnboarded] = useState(() => getFlag('onboarded'));
  const [toast, setToast] = useState(null);
  const [glossary, setGlossary] = useState(null); // term id while the glossary is open
  const [news, setNews] = useState(null); // version whose "what's new" is shown
  const [incoming, setIncoming] = useState(null); // { name, avoid } from an #import= link, or { error }
  const [scanFirst, setScanFirstState] = useState(() => getFlag('scanFirst'));
  const abortRef = useRef(null);
  const storeRef = useRef(null);
  const savedRef = useRef(null);
  const persistAskedRef = useRef(false);
  // Ingredients the user photographed / pasted for a barcode, remembered for the next scan.
  const savedStoreRef = useRef(null);
  if (!savedStoreRef.current) savedStoreRef.current = createSavedStore();
  // Barcodes no database knew (24 h), so a second scan answers at once.
  const notFoundRef = useRef(null);
  // The user's own nutrition values / category per barcode (v3.5).
  const nutritionStoreRef = useRef(null);
  if (!nutritionStoreRef.current) nutritionStoreRef.current = createNutritionStore();
  const [nutritionVersion, setNutritionVersion] = useState(0);
  if (!notFoundRef.current) notFoundRef.current = createNotFoundCache();
  const mainRef = useRef(null);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // After "Reîncarcă": did the update work? And "what's new" once per version.
  useEffect(() => {
    const { outcome, news: v } = checkAfterStart({ build: BUILD_ID, version: APP_VERSION }, getFlag('onboarded'));
    const l = getLang() || detectLang();
    if (outcome === 'success') notify(t(l, 'updateOk', { version: APP_VERSION }));
    if (outcome === 'failed') notify(t(l, 'updateFailed'));
    if (v && WHATS_NEW[v]) setNews(v);
    return onUpdateFailed(() => notify(t(getLang() || detectLang(), 'updateFailed')));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // "?" buttons anywhere open the glossary.
  useEffect(() => {
    const onGlossary = (e) => setGlossary(e.detail || 'nova');
    window.addEventListener('ingrediscan:glossary', onGlossary);
    return () => window.removeEventListener('ingrediscan:glossary', onGlossary);
  }, []);

  // A list sent by link (#import=…): ask before adding it as a new profile.
  useEffect(() => {
    const check = async () => {
      try {
        const list = await decodeList(window.location.hash);
        if (list) setIncoming(list);
      } catch {
        setIncoming({ error: true });
      }
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);
  const closeIncoming = useCallback(() => {
    setIncoming(null);
    try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch { /* ignore */ }
  }, []);

  // Opened from Android's share sheet (?share=1): a photo goes to the photo
  // flow, text into the ingredients box. Otherwise "open the scanner on start".
  useEffect(() => {
    if (isShareLaunch()) {
      try { window.history.replaceState(null, '', window.location.pathname + window.location.hash); } catch { /* ignore */ }
      takeShared().then((shared) => {
        if (shared?.files?.length) {
          setFlag('onboarded');
          setOnboarded(true);
          if (shared.files.length > 1) setPhotoSet({ files: shared.files, product: null, barcode: null, existing: {} });
          else setPhoto({ file: shared.files[0], product: null, barcode: null });
        } else if (shared?.text) {
          setText(shared.text);
          notify(t(getLang() || detectLang(), 'shareTextReady'));
        } else {
          notify(t(getLang() || detectLang(), 'shareEmpty'));
        }
      });
      return;
    }
    if (getFlag('scanFirst') && getFlag('onboarded') && !window.location.hash) setScanning(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const changeScanFirst = (on) => { setFlag('scanFirst', on); setScanFirstState(on); };

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
      // v3.3: remembered ingredients get a new schema; keep a copy of everything first.
      if (!getFlag('migrated33')) {
        const before = savedStoreRef.current.all();
        if (Object.keys(before).length || list.length) {
          saveAutoBackup(buildBackup({ history: list, saved: before, profiles: getProfiles(getLang() || detectLang()) }), 'v3.3');
        }
        const { map, changed } = migrateSaved(before);
        if (changed) savedStoreRef.current.replaceAll(map);
        setFlag('migrated33');
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

  // Nutrition values and the Nutri-Score (the database's or computed on the phone), v3.5.
  const nutrition = useMemo(() => {
    if (!submitted) return null;
    const code = submitted.barcode || submitted.product?.code || null;
    const rec = code ? savedStoreRef.current.get(code) : null;
    const own = code ? nutritionStoreRef.current.get(code) : submitted.ownNutrition || null;
    const ingredients = submitted.text?.trim() ? submitted.text : submitted.product?.ingredientsText || '';
    return buildNutrition({ product: submitted.product, saved: { texts: rec?.texts, nutrition: own }, ingredients });
  }, [submitted, nutritionVersion]);

  const result = useMemo(() => {
    if (!submitted) return null;
    const input = submitted.product
      ? analyzeInput(submitted.product, submitted.text)
      : { text: submitted.text, productType: submitted.type };
    if (input.productType === 'food' && !input.nutriscore && nutrition?.score?.computed) input.nutriscore = nutrition.score.grade;
    return analyze(input, avoid);
  }, [submitted, avoid, nutrition]);

  /** Nutrition values typed / corrected, or another Nutri-Score category chosen. */
  const saveNutrition = ({ values, category }) => {
    const code = submitted?.barcode || submitted?.product?.code || null;
    const entry = { ...(values ? { values } : {}), ...(category ? { category } : {}) };
    if (code) nutritionStoreRef.current.save(code, entry);
    else setSubmitted((s) => ({ ...s, ownNutrition: { ...(s.ownNutrition || {}), ...entry } }));
    setNutritionVersion((v) => v + 1);
  };

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
    const data = buildBackup({ history, saved: savedStoreRef.current.all(), profiles, nutrition: nutritionStoreRef.current.all() });
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, [history, profiles]);

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
    if (backup.nutrition) nutritionStoreRef.current.replaceAll({ ...nutritionStoreRef.current.all(), ...backup.nutrition });
    if (backup.profiles) changeProfiles(backup.profiles);
    else if (backup.avoid) changeProfiles(updateActive(profiles, backup.avoid));
    return { history: toWrite.length, saved: savedAdded, avoid: !!(backup.avoid || backup.profiles) };
  }, [history, profiles, changeProfiles]);

  const deleteAllData = useCallback(async () => {
    try { await (await storeRef.current).clear(); } catch { /* ignore */ }
    clearLocalData();
    try { (await import('./lib/thumbStore.js')).clearThumbs(); } catch { /* ignore */ }
    // Cached product lookups also record what was scanned. The OCR engine is kept (no personal data).
    try { await globalThis.caches?.delete('openfacts-api'); } catch { /* ignore */ }
    setHistory([]);
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
    setPhotoSet(null);
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
        // The database now has the Romanian list and the user did not choose their own text: use it.
        if (chooseIngredients({ product: res.product, saved }).origin === 'database') {
          setSubmitted((prev) => (prev?.saved && prev.barcode === code
            ? { text: '', type: res.product.productType, auto: false, product: res.product, barcode: code } : prev));
          return;
        }
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
    try {
      res = await lookupProduct(code, { productType: chosenType, signal: ctrl.signal });
    } catch {
      return; // aborted by the user
    }
    if (ctrl.signal.aborted) return;
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
    const res = await lookupProduct(code, { productType: chosenType });
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
    setPhoto((prev) => (prev ? { ...prev, file, queued: [] } : { file, ...lookupContext() }));
    setLookup(null);
    setSubmitted(null);
    scrollTop();
  };
  const analyzePhotoText = (value, confidence) => {
    const { product, barcode, mode, baseText } = photo;
    setPhoto(null);
    if (mode && barcode) {
      // "Înlocuiește" / "Completează" the database's ingredients with the photo.
      const text = mode === 'complete' ? completeText(baseText, value) : value;
      const rec = { ...editedRecord(savedStoreRef.current.get(barcode), {
        barcode, text, currentText: baseText, currentOrigin: 'database', productType: product?.productType, product: productSnapshot(product), source: 'photo',
      }), confidence };
      savedStoreRef.current.save(rec);
      setSubmitted({ text, type: product?.productType || 'food', auto: false, product, barcode, fromPhoto: true, confidence, saved: { date: rec.date, source: 'photo', edited: true, hasOriginal: !!rec.original, fresh: true } });
      scrollTop();
      return;
    }
    setSubmitted(remember(buildRequest({ text: value, source: 'photo', chosenType, product, barcode, confidence })));
    scrollTop();
  };

  // ───── v3.4: several photos of one product ─────
  /** From home / a lookup screen: photos for the current barcode context (if any). */
  const startPhotoSet = (files) => {
    const ctx = lookupContext();
    setPhotoSet({ files: [].concat(files), product: ctx.product, barcode: ctx.barcode, existing: ctx.barcode ? savedStoreRef.current.get(ctx.barcode)?.texts || {} : {} });
    setLookup(null);
    setSubmitted(null);
    scrollTop();
  };
  /** "Adaugă poze" on a result: more photos of the same product; the texts read before are kept. */
  const addPhotosToResult = (files) => {
    const cur = submitted;
    const barcode = cur.barcode || cur.product?.code || null;
    const rec = barcode ? savedStoreRef.current.get(barcode) : null;
    setPhotoSet({
      files: [].concat(files), product: cur.product, barcode,
      existing: { ...(rec?.texts || {}), ingredients: shownText(cur) },
      origin: originOf(cur), baseText: shownText(cur),
    });
    setSubmitted(null);
    scrollTop();
  };
  const analyzePhotoSet = async ({ ingredients, texts, thumbs, confidence }) => {
    const { product, barcode, origin, baseText } = photoSet;
    setPhotoSet(null);
    let req = buildRequest({ text: ingredients, source: 'photo', chosenType, product, barcode, confidence });
    if (req.barcode) {
      const prev = savedStoreRef.current.get(req.barcode);
      const replacesDb = (origin === 'database' || (!origin && product?.hasIngredients)) && ingredients.trim() !== (baseText || '').trim();
      let rec = replacesDb
        ? editedRecord(prev, { barcode: req.barcode, text: ingredients, currentText: baseText || product?.ingredientsText, currentOrigin: 'database', productType: req.type, product: productSnapshot(product), source: 'photo' })
        : { ...(prev || {}), ...savedFromRequest(req), explicit: !!prev?.explicit && origin === 'edited', original: prev?.original || null, source: prev?.explicit && origin === 'edited' ? prev.source : 'photo' };
      rec = { ...rec, texts: mergeTexts(prev?.texts, texts), photos: [...(prev?.photos || []), ...thumbs.map(({ id, types, date }) => ({ id, types, date }))].slice(-30) };
      savedStoreRef.current.save(rec);
      const sameText = ingredients.trim() === (baseText || '').trim();
      // Only the nutrition table / origin were added: the result stays as it was (database text, no note).
      if (sameText && origin === 'database') req = { ...req, text: '', fromPhoto: false };
      else if (sameText && origin === 'edited') req = { ...req, saved: { date: rec.date, source: prev?.source || 'edit', edited: true, hasOriginal: !!rec.original } };
      else req = { ...req, saved: { date: rec.date, source: 'photo', edited: !!rec.explicit, hasOriginal: !!rec.original, fresh: true } };
      if (thumbs.length) {
        const { saveThumbs } = await import('./lib/thumbStore.js');
        saveThumbs(req.barcode, thumbs).then(() => setThumbVersion((v) => v + 1));
      }
    }
    setSubmitted(req);
    scrollTop();
  };

  // ───── v3.3: the user's own ingredients text ─────
  const shownText = (req) => (req?.text?.trim() ? req.text : req?.product?.ingredientsText || '');
  const originOf = (req) => (req?.saved?.edited ? 'edited' : req?.saved ? 'user' : req?.product && !req?.text?.trim() ? 'database' : 'user');
  /** "Re-analizează": the edited text replaces the current one, remembered for the barcode. */
  const editIngredients = (value) => {
    const cur = submitted;
    if (!cur || !value.trim()) return;
    const barcode = cur.barcode || cur.product?.code || null;
    if (!barcode) { setSubmitted({ ...cur, text: value }); return; }
    const rec = editedRecord(savedStoreRef.current.get(barcode), {
      barcode, text: value, currentText: shownText(cur), currentOrigin: originOf(cur), productType: cur.type, product: productSnapshot(cur.product),
    });
    savedStoreRef.current.save(rec);
    setSubmitted({ ...cur, text: value, fromPhoto: false, saved: { date: rec.date, source: 'edit', edited: true, hasOriginal: !!rec.original, fresh: true } });
  };
  /** "Revino la textul original": the database's text (looked up again) or the earlier photo / paste. */
  const revertIngredients = () => {
    const barcode = submitted?.barcode;
    if (!barcode) return;
    const r = revertRecord(savedStoreRef.current.get(barcode));
    if (r.remove) {
      savedStoreRef.current.remove(barcode);
      runLookup(barcode, { force: true });
    } else {
      savedStoreRef.current.save(r.record);
      setSubmitted(requestFromSaved(r.record, submitted.product));
    }
    notify(t(lang, 'editReverted'));
  };
  /** A new photo that replaces or completes the database's ingredients. */
  const photoForIngredients = (mode) => (file) => {
    const cur = submitted;
    setPhoto({ file, product: cur.product, barcode: cur.barcode || cur.product?.code || null, mode, baseText: shownText(cur) });
    setSubmitted(null);
    scrollTop();
  };

  const changeLang = (l) => {
    setLang(l);
    saveLang(l);
  };
  const changeAvoid = (s) => changeProfiles(updateActive(profiles, s));
  const addIncoming = () => {
    const name = incoming.name || t(lang, 'profileShared');
    const next = addProfile(profiles, name, incoming.avoid);
    changeProfiles(next);
    notify(t(lang, 'importAdded', { name }));
    closeIncoming();
    setTab('list');
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
        profiles={profiles} onProfile={(id) => changeProfiles(setActive(profiles, id))}
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
        <AvoidListView lang={lang} avoid={avoid} onChange={changeAvoid} history={history} notify={notify} profiles={profiles} onProfiles={changeProfiles} />
      </Suspense>
    );
  } else if (tab === 'about') {
    screen = (
      <Suspense fallback={<Loading />}>
        <AboutView lang={lang} onExport={exportData} onImport={importData} onDeleteAll={deleteAllData} scanFirst={scanFirst} onScanFirst={changeScanFirst} />
      </Suspense>
    );
  } else if (photoSet) {
    screen = (
      <Suspense fallback={<Loading />}>
        <PhotoSetFlow
          lang={lang} files={photoSet.files} product={photoSet.product} barcode={photoSet.barcode} existing={photoSet.existing}
          onAnalyze={analyzePhotoSet} onCancel={goHome}
        />
      </Suspense>
    );
  } else if (photo) {
    screen = (
      <Suspense fallback={<section className="card ocr-progress" aria-busy="true"><div className="spinner" aria-hidden="true" /></section>}>
        <PhotoFlow
          lang={lang} file={photo.file} queued={photo.queued} product={photo.product} barcode={photo.barcode}
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
        onAnalyze={analyzeText} onPhoto={startPhoto} onPhotoSet={startPhotoSet} onBack={leave} backLabel={leaveLabel} onRetry={() => runLookup(lookup.code, { force: true })}
      />
    );
  } else if (lookup?.status === 'in_store') {
    screen = <InStore lang={lang} code={lookup.code} onAnalyze={analyzeText} onPhoto={startPhoto} onPhotoSet={startPhotoSet} onBack={leave} backLabel={leaveLabel} />;
  } else if (lookup?.status === 'no_ingredients') {
    screen = (
      <NoIngredients
        lang={lang} product={lookup.product} partial={partial}
        onAnalyze={analyzeText} onPhoto={startPhoto} onPhotoSet={startPhotoSet} onBack={leave} backLabel={leaveLabel}
      />
    );
  } else if (lookup?.status === 'error') {
    screen = (
      <LookupFailed
        lang={lang} code={lookup.code} kind={lookup.kind}
        onRetry={() => runLookup(lookup.code, { force: true })} onAnalyze={analyzeText} onPhoto={startPhoto} onPhotoSet={startPhotoSet} onBack={leave} backLabel={leaveLabel}
      />
    );
  } else if (result) {
    screen = (
      <Result
        lang={lang} result={result} typeAuto={submitted.auto} notify={notify}
        text={submitted.text?.trim() ? submitted.text : submitted.product?.ingredientsText || ''}
        product={submitted.product} barcode={submitted.barcode} fromPhoto={submitted.fromPhoto} onBack={leave} backLabel={leaveLabel}
        saved={submitted.saved} onRetake={retakeSaved} onForget={() => forgetSaved(submitted.barcode)}
        onEdit={editIngredients} onRevert={revertIngredients} onAddPhotos={addPhotosToResult} thumbVersion={thumbVersion}
        nutritionInfo={nutrition} onNutritionSave={saveNutrition}
        onReplacePhoto={submitted.barcode && originOf(submitted) === 'database' ? photoForIngredients('replace') : undefined}
        onCompletePhoto={submitted.barcode && originOf(submitted) === 'database' ? photoForIngredients('complete') : undefined}
        watchedAllergens={avoid.allergens} profiles={profiles} onProfile={(id) => changeProfiles(setActive(profiles, id))}
      />
    );
  } else {
    screen = (
      <Home
        lang={lang} type={type} typeAuto={chosenType == null} onType={setChosenType}
        onScan={() => setScanning(true)} onCode={onCode} onPhoto={startPhoto} onPhotoSet={startPhotoSet}
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


  return (
    <div className="app">
      <a className="skip-link" href="#main">{t(lang, 'skipToContent')}</a>
      <UpdateBanner lang={lang} />
      <OfflineBanner lang={lang} />
      <Header lang={lang} onLang={changeLang} />
      {tab === 'scan' && !photo && !lookup && !result && <InstallCard lang={lang} />}
      <main id="main" ref={mainRef} tabIndex={-1}>
        {news && <WhatsNew lang={lang} version={shortVersion(news)} items={pick(WHATS_NEW[news], lang)} onClose={() => setNews(null)} />}
        {incoming && <ImportCard lang={lang} incoming={incoming} full={profiles.profiles.length >= 8} onAdd={addIncoming} onClose={closeIncoming} />}
        <Suspense fallback={<Loading />}>{screen}</Suspense>
      </main>
      <TabBar lang={lang} tab={tab} onTab={changeTab} badge={0} />
      <Toast toast={toast} onClose={() => setToast(null)} />
      {!onboarded && (
        <Suspense fallback={null}>
          <Onboarding lang={lang} onLang={changeLang} onDone={finishOnboarding} onExample={(sample) => { finishOnboarding(); setTab('scan'); analyzeText(sample); }} />
        </Suspense>
      )}
      {glossary && (
        <Suspense fallback={null}>
          <GlossaryDialog lang={lang} term={glossary} onClose={() => setGlossary(null)} />
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

/** A list someone sent by link: preview, then add as a new profile or dismiss. */
function ImportCard({ lang, incoming, full, onAdd, onClose }) {
  if (incoming.error) {
    return (
      <section className="card import-card" role="alert">
        <p>{t(lang, 'importInvalid')}</p>
        <button type="button" className="btn ghost small-btn" onClick={onClose}>{t(lang, 'close')}</button>
      </section>
    );
  }
  const { avoid } = incoming;
  const presets = Object.values(avoid.presets || {}).filter(Boolean).length;
  return (
    <section className="card import-card" aria-labelledby="import-h">
      <h2 id="import-h" className="card-title">📨 {t(lang, 'importTitle', { name: incoming.name || t(lang, 'profileShared') })}</h2>
      <p className="small">{t(lang, 'importSummary', { presets, custom: avoid.custom?.length || 0, allergens: avoid.allergens?.length || 0 })}</p>
      {full && <p className="small form-error">{t(lang, 'importFull')}</p>}
      <div className="actions">
        <button type="button" className="btn primary small-btn" disabled={full} onClick={onAdd}>{t(lang, 'importAdd')}</button>
        <button type="button" className="btn ghost small-btn" onClick={onClose}>{t(lang, 'importDismiss')}</button>
      </div>
    </section>
  );
}
