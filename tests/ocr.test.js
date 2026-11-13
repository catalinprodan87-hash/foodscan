import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { extractIngredients, cleanOcrText, findStart, needsBetterPhoto } from '../src/lib/ocrText.js';
import { buildRequest } from '../src/lib/request.js';
import { ocrAssets, ensureOcrAssets, getWorker, recognize, resetOcr, mapTesseractProgress, OCR_LANGS } from '../src/lib/ocr.js';
import { fitSize, cropPixels, grayscaleContrast } from '../src/lib/imagePrep.js';
import { mapProduct, analyzeInput } from '../src/lib/lookup.js';
import { analyze } from '../src/lib/analyze.js';

// ─────────────────────────── realistic label texts ────────────────────────
// Line breaks, hyphenation and OCR slips as Tesseract returns them.

const FOOD_RO_HU_BG = `BISCUIȚI CU CREMĂ DE CACAO
RO: Ingrediente: făină de grâu, zahăr, grăsime vegetală de palmier, sirop de glucoză-fruc-
toză, cacao degresată 4%, emulgatori: lecitine (soia), E471; agenți de afânare: carbonați
de sodiu, carbonați de amoniu; sare, arome, colorant: E15Od. Poate conține urme de lapte și alune.
A se păstra la loc uscat și răcoros.
HU: Összetevők: búzaliszt, cukor, növényi zsír (pálma), glükóz-fruktóz szirup, zsírszegény kakaó 4%.
BG: Съставки: пшенично брашно, захар, растителна мазнина (палмова), глюкозо-фруктозен сироп.`;

const FOOD_NUTRITION = `Napolitane cu cremă de alune
Ingrediente: zahăr, făină de grâu, ulei de floarea-
soarelui, alune de pădure 10%, lapte praf degresat, zer praf, emul-
gator: lecitină de floarea-soarelui, sare, aromă naturală de vanilie
Valori nutriționale medii la 100 g
Valoare energetică 2130 kJ / 510 kcal
Grăsimi 28 g, din care acizi grași saturați 6,5 g`;

const FOOD_NUTRITION_NO_HEADING = `Ingrediente: lapte pasteurizat, culturi lactice, cheag microbian, sare
2150 kJ / 515 kcal
Grăsimi 28 g`;

const COSMETIC_INCI = `Mod de utilizare: aplicați pe părul umed, masați, clătiți.
INGREDIENTS: AQUA / WATER, SODIUM LAURETH SULFATE, COCAMIDOPROPYL BETAINE, GLYCERIN,
SODIUM CHLORIDE, PARFUM / FRAGRANCE, CITRIC ACID, SODIUM BENZOATE, METHYLCHLOROISO-
THIAZOLINONE, METHYLISOTHIAZOLINONE, LIMONENE, LINALOOL, CI 42090. (F.I.L. C123456/1)
Fabricat în Franța. 250 ml`;

const COSMETIC_RO_EN = `Ingredients: Aqua, Glycerin, Cetearyl Alcohol, Parfum.
RO: Compoziție: Aqua, Glycerin, Cetearyl Alcohol, Phenoxyethanol, Parfum, Linalool.
A nu se lăsa la îndemâna copiilor.`;

const DETERGENT = `Detergent lichid pentru rufe colorate
Conține: 5-15% agenți de suprafață anionici, <5% agenți de suprafață neionici, săpun,
fosfonați, enzime, parfumuri, Benzisothiazolinone, Methylisothiazolinone, Limonene.
Mod de utilizare: dozați în funcție de duritatea apei.
PERICOL: Provoacă iritarea gravă a ochilor (H319). A nu se lăsa la îndemâna copiilor (P102).`;

const BLEACH_HAZARD = `Conține: <5% înălbitori pe bază de clor (hipoclorit de sodiu), agenți de
suprafață neionici, hidroxid de sodiu. H315 Provoacă iritarea pielii. EUH206 Atenție! Nu utilizați
împreună cu alte produse.`;

// ─────────────────────────────── extraction ───────────────────────────────
describe('extractIngredients()', () => {
  test('Romanian food label: starts at "Ingrediente:", stops before allergen note, storage, HU and BG', () => {
    const r = extractIngredients(FOOD_RO_HU_BG);
    assert.equal(r.foundStart, true);
    assert.equal(r.startKind, 'ro');
    assert.equal(
      r.text,
      'făină de grâu, zahăr, grăsime vegetală de palmier, sirop de glucoză-fructoză, cacao degresată 4%, ' +
      'emulgatori: lecitine (soia), E471; agenți de afânare: carbonați de sodiu, carbonați de amoniu; ' +
      'sare, arome, colorant: E150d.',
    );
    assert.ok(!/Összetevők|búzaliszt|Съставки|păstra|urme/i.test(r.text));
  });

  test('without the allergen note, the cut happens before the Hungarian block', () => {
    const text = 'Ingrediente: zahăr, cacao, lecitină de soia.\nHU: Összetevők: cukor, kakaó.';
    assert.equal(extractIngredients(text).text, 'zahăr, cacao, lecitină de soia.');
    const noCode = 'Ingrediente: zahăr, cacao.\nÖsszetevők: cukor, kakaó.';
    assert.equal(extractIngredients(noCode).text, 'zahăr, cacao.');
  });

  test('a Bulgarian block is cut even without a language code', () => {
    const r = extractIngredients('Ingrediente: apă, zahăr, acid citric\nСъставки: вода, захар');
    assert.equal(r.text, 'apă, zahăr, acid citric');
    assert.equal(r.stopReason, 'language');
  });

  test('stops before the nutrition table; joins lines and undoes hyphenation', () => {
    const r = extractIngredients(FOOD_NUTRITION);
    assert.equal(
      r.text,
      'zahăr, făină de grâu, ulei de floarea-soarelui, alune de pădure 10%, lapte praf degresat, zer praf, ' +
      'emulgator: lecitină de floarea-soarelui, sare, aromă naturală de vanilie',
    );
    assert.equal(r.stopReason, 'phrase');
  });

  test('a nutrition table without a heading is cut at the kJ/kcal line', () => {
    const r = extractIngredients(FOOD_NUTRITION_NO_HEADING);
    assert.equal(r.text, 'lapte pasteurizat, culturi lactice, cheag microbian, sare');
  });

  test('cosmetic INCI list: skips usage text, keeps hyphenated INCI names, stops at F.I.L. code', () => {
    const r = extractIngredients(COSMETIC_INCI);
    assert.equal(r.startKind, 'en');
    assert.equal(
      r.text,
      'AQUA / WATER, SODIUM LAURETH SULFATE, COCAMIDOPROPYL BETAINE, GLYCERIN, SODIUM CHLORIDE, ' +
      'PARFUM / FRAGRANCE, CITRIC ACID, SODIUM BENZOATE, METHYLCHLOROISOTHIAZOLINONE, ' +
      'METHYLISOTHIAZOLINONE, LIMONENE, LINALOOL, CI 42090.',
    );
  });

  test('a Romanian "Compoziție:" block is preferred over an English one', () => {
    const r = extractIngredients(COSMETIC_RO_EN);
    assert.equal(r.startKind, 'ro');
    assert.equal(r.text, 'Aqua, Glycerin, Cetearyl Alcohol, Phenoxyethanol, Parfum, Linalool.');
  });

  test('"INCI:" marker', () => {
    assert.equal(extractIngredients('INCI: Aqua, Glycerin, Parfum').text, 'Aqua, Glycerin, Parfum');
    assert.equal(extractIngredients('Ingredients (INCI): Aqua, Parfum').text, 'Aqua, Parfum');
  });

  test('detergent: starts at "Conține:", stops before usage text and hazard statements', () => {
    const r = extractIngredients(DETERGENT);
    assert.equal(r.startKind, 'contains');
    assert.equal(
      r.text,
      '5-15% agenți de suprafață anionici, <5% agenți de suprafață neionici, săpun, fosfonați, enzime, ' +
      'parfumuri, Benzisothiazolinone, Methylisothiazolinone, Limonene.',
    );
  });

  test('bleach: hazard codes (H315, EUH206) end the list', () => {
    const r = extractIngredients(BLEACH_HAZARD);
    assert.equal(r.text, '<5% înălbitori pe bază de clor (hipoclorit de sodiu), agenți de suprafață neionici, hidroxid de sodiu.');
    assert.equal(r.stopReason, 'hazard');
  });

  test('"Poate conține urme" is not mistaken for the detergent "Conține:" marker', () => {
    assert.equal(findStart('Ciocolată. Poate conține urme de alune.'), null);
  });

  test('OCR misreads of the marker ("lngrediente", "1NGREDIENTS")', () => {
    assert.equal(extractIngredients('lngrediente: lapte, zahăr').text, 'lapte, zahăr');
    assert.equal(extractIngredients('1NGREDIENTS: AQUA, GLYCERIN').text, 'AQUA, GLYCERIN');
  });

  test('no marker: the whole text is kept (minus what follows the list)', () => {
    const r = extractIngredients('apă, zahăr, acid citric, arome\nA se păstra la rece');
    assert.equal(r.foundStart, false);
    assert.equal(r.text, 'apă, zahăr, acid citric, arome');
  });

  test('marker followed directly by a stop: falls back to the whole text so the user can edit', () => {
    const r = extractIngredients('Ingrediente:\nValori nutriționale 100 g');
    assert.ok(r.text.length > 3);
  });
});

describe('cleanOcrText()', () => {
  test('keeps compound hyphens, joins split words, fixes E-codes and punctuation', () => {
    assert.equal(cleanOcrText('sirop de glucoză-\nfructoză'), 'sirop de glucoză-fructoză');
    assert.equal(cleanOcrText('emul-\ngatori'), 'emulgatori');
    assert.equal(cleanOcrText('mono-\n și digliceride'), 'mono- și digliceride');
    assert.equal(cleanOcrText('acid citric (E33O) , E 2l1 ,, sare'), 'acid citric (E330), E 211, sare');
    assert.equal(cleanOcrText('zahăr ,lapte | sare'), 'zahăr, lapte sare');
    assert.equal(cleanOcrText('  : făină'), 'făină');
  });
});

describe('needsBetterPhoto()', () => {
  test('low confidence or very short text → tip', () => {
    assert.equal(needsBetterPhoto({ confidence: 40, text: 'a long enough ingredients list, sugar, salt' }), true);
    assert.equal(needsBetterPhoto({ confidence: 90, text: 'zahăr' }), true);
    assert.equal(needsBetterPhoto({ confidence: 80, text: 'zahăr, făină de grâu, ulei de palmier, sare' }), false);
  });
});

// ──────────────────────────── merge & routing ─────────────────────────────
describe('buildRequest(): photo text into the analysis', () => {
  const foodNoIngredients = mapProduct(
    { code: '5941234567892', product_name: 'Biscuiți', image_front_small_url: 'https://x/y.jpg', nova_group: 4, nutriscore_grade: 'd', additives_tags: ['en:e471'] },
    'food', '5941234567892',
  );

  test('attaches OCR text to a barcode product: keeps name, image, scores and type', () => {
    const ocrText = extractIngredients(FOOD_RO_HU_BG).text;
    const req = buildRequest({ text: ocrText, source: 'photo', product: foodNoIngredients, confidence: 81 });
    assert.equal(req.type, 'food');
    assert.equal(req.auto, false);
    assert.equal(req.barcode, '5941234567892');
    assert.equal(req.fromPhoto, true);
    assert.equal(req.confidence, 81);
    assert.equal(req.product.name, 'Biscuiți');
    assert.equal(req.product.image, 'https://x/y.jpg');

    const result = analyze(analyzeInput(req.product, req.text));
    assert.deepEqual(result.processing, { nova: 4, source: 'database', markers: [] });
    assert.equal(result.nutriscore, 'd');
    for (const code of ['E150d', 'E471', 'E322']) assert.ok(result.additives.some((a) => a.code === code), code);
    assert.ok(result.avoidHits.some((h) => h.id === 'palm'));
    assert.ok(result.avoidHits.some((h) => h.id === 'gfs'));
  });

  test('not-found barcode: keeps the barcode, detects the type from the photo text', () => {
    const req = buildRequest({ text: extractIngredients(COSMETIC_INCI).text, source: 'photo', barcode: '3600523614455' });
    assert.equal(req.type, 'cosmetic');
    assert.equal(req.auto, true);
    assert.equal(req.barcode, '3600523614455');
    assert.equal(req.product, null);
    const result = analyze({ text: req.text, productType: req.type });
    assert.ok(result.items.some((i) => i.code === 'MCI/MI'));
  });

  test('detergent photo is detected as household', () => {
    assert.equal(buildRequest({ text: extractIngredients(DETERGENT).text, source: 'photo' }).type, 'household');
  });

  test("the user's chosen type wins over detection; the lookup's type wins over both", () => {
    const text = extractIngredients(COSMETIC_INCI).text;
    assert.equal(buildRequest({ text, source: 'photo', chosenType: 'household' }).type, 'household');
    assert.equal(buildRequest({ text, source: 'photo', chosenType: 'household', product: foodNoIngredients }).type, 'food');
  });

  test('pasted text is not marked as read from a photo', () => {
    const req = buildRequest({ text: 'zahăr', source: 'paste' });
    assert.equal(req.fromPhoto, false);
    assert.equal(req.confidence, null);
  });
});

// ─────────────────────────── OCR engine (mocked) ──────────────────────────
describe('OCR engine with mocked tesseract', () => {
  const BASE = 'https://example.github.io/foodscan/';
  let created;
  let recognized;
  let fetched;

  function mockTesseract({ text = FOOD_RO_HU_BG, confidence = 78.4 } = {}) {
    return async () => ({
      default: {
        createWorker: async (langs, oem, options) => {
          created.push({ langs, oem, options });
          options.logger?.({ status: 'loading tesseract core', progress: 1 });
          return {
            setParameters: async (p) => { recognized.push({ params: p }); },
            recognize: async (image) => {
              options.logger?.({ status: 'recognizing text', progress: 0.5 });
              recognized.push({ image });
              return { data: { text, confidence } };
            },
            terminate: async () => {},
          };
        },
      },
    });
  }

  const sizes = {
    'core/tesseract-core-simd-lstm.wasm.js': 40,
    'core/tesseract-core-lstm.wasm.js': 40,
    'lang/ron.traineddata.gz': 20,
    'lang/eng.traineddata.gz': 30,
  };
  function mockFetch() {
    return async (url) => {
      fetched.push(url);
      if (url.endsWith('manifest.json')) return { ok: true, json: async () => ({ sizes }) };
      const n = sizes[url.split('/ocr/').pop()] || 0;
      const chunks = [new Uint8Array(Math.ceil(n / 2)), new Uint8Array(Math.floor(n / 2))];
      return { ok: true, body: { getReader: () => ({ read: async () => (chunks.length ? { done: false, value: chunks.shift() } : { done: true }) }) } };
    };
  }
  const emptyCache = { match: async () => undefined };
  const fullCache = { match: async () => ({}) };

  beforeEach(async () => {
    await resetOcr();
    created = [];
    recognized = [];
    fetched = [];
  });

  test('self-hosted asset URLs per core variant', () => {
    const a = ocrAssets(BASE, true);
    assert.equal(a.worker, 'https://example.github.io/foodscan/ocr/worker.min.js');
    assert.equal(a.core, 'https://example.github.io/foodscan/ocr/core/tesseract-core-simd-lstm.wasm.js');
    assert.equal(a.langPath, 'https://example.github.io/foodscan/ocr/lang');
    assert.deepEqual(a.downloads.slice(1), [
      'https://example.github.io/foodscan/ocr/lang/ron.traineddata.gz',
      'https://example.github.io/foodscan/ocr/lang/eng.traineddata.gz',
    ]);
    assert.ok(ocrAssets(BASE, false).core.endsWith('/tesseract-core-lstm.wasm.js'));
  });

  test('first use: downloads engine + ron/eng with byte progress, then recognises', async () => {
    const progress = [];
    const r = await recognize('IMAGE', {
      loadTesseract: mockTesseract(), baseUrl: BASE, simdImpl: async () => true,
      fetchImpl: mockFetch(), cachesImpl: emptyCache, onProgress: (p) => progress.push(p),
    });
    assert.equal(r.confidence, 78);
    assert.ok(r.text.includes('Ingrediente'));
    const downloads = progress.filter((p) => p.phase === 'download');
    assert.deepEqual(downloads[0], { phase: 'download', loaded: 0, total: 90 });
    assert.deepEqual(downloads.at(-1), { phase: 'download', loaded: 90, total: 90 });
    assert.ok(progress.some((p) => p.phase === 'recognize' && p.progress === 0.5));
    assert.deepEqual(fetched.filter((u) => !u.endsWith('manifest.json')), ocrAssets(BASE, true).downloads);

    assert.equal(created.length, 1);
    const { langs, oem, options } = created[0];
    assert.deepEqual(langs, ['ron', 'eng']);
    assert.deepEqual(OCR_LANGS, ['ron', 'eng']);
    assert.equal(oem, 1);
    assert.equal(options.workerBlobURL, false);
    assert.equal(options.workerPath, 'https://example.github.io/foodscan/ocr/worker.min.js');
    assert.equal(options.cacheMethod, 'none');
    assert.equal(recognized.at(-1).image, 'IMAGE');
  });

  test('cached engine: no download, no download progress', async () => {
    const progress = [];
    await recognize('IMG', {
      loadTesseract: mockTesseract(), baseUrl: BASE, simdImpl: async () => false,
      fetchImpl: mockFetch(), cachesImpl: fullCache, onProgress: (p) => progress.push(p),
    });
    assert.deepEqual(fetched, []);
    assert.ok(!progress.some((p) => p.phase === 'download'));
  });

  test('the worker is created once and reused for later photos', async () => {
    const opts = { loadTesseract: mockTesseract(), baseUrl: BASE, simdImpl: async () => true, fetchImpl: mockFetch(), cachesImpl: fullCache };
    await recognize('A', opts);
    await recognize('B', { ...opts, cropped: true });
    assert.equal(created.length, 1);
    const params = recognized.filter((x) => x.params).map((x) => x.params.tessedit_pageseg_mode);
    assert.deepEqual(params, ['3', '6']);
  });

  test('a failed start can be retried', async () => {
    const failing = async () => { throw new Error('offline'); };
    const opts = { baseUrl: BASE, simdImpl: async () => true, fetchImpl: mockFetch(), cachesImpl: fullCache };
    await assert.rejects(getWorker({ ...opts, loadTesseract: failing }));
    await new Promise((r) => setTimeout(r, 0));
    const w = await getWorker({ ...opts, loadTesseract: mockTesseract() });
    assert.ok(w.recognize);
  });

  test('download errors are reported', async () => {
    const bad = async (url) => (url.endsWith('manifest.json') ? { ok: true, json: async () => ({ sizes }) } : { ok: false, status: 404 });
    await assert.rejects(
      ensureOcrAssets(ocrAssets(BASE, true), { fetchImpl: bad, cachesImpl: emptyCache }),
      /HTTP 404/,
    );
  });

  test('tesseract logger mapping', () => {
    assert.deepEqual(mapTesseractProgress({ status: 'recognizing text', progress: 0.3 }), { phase: 'recognize', progress: 0.3 });
    assert.equal(mapTesseractProgress({ status: 'initializing api', progress: 1 }).phase, 'init');
  });
});

// ───────────────────────────── preprocessing ──────────────────────────────
describe('image preprocessing (pure parts)', () => {
  test('downscale the long side to ~2000 px, never upscale', () => {
    assert.deepEqual(fitSize(4000, 3000), { width: 2000, height: 1500, scale: 0.5 });
    assert.deepEqual(fitSize(3024, 4032), { width: 1500, height: 2000, scale: 2000 / 4032 });
    assert.deepEqual(fitSize(800, 600), { width: 800, height: 600, scale: 1 });
  });

  test('crop rectangle in pixels, clamped to the image', () => {
    assert.deepEqual(cropPixels({ x: 0.1, y: 0.2, w: 0.5, h: 0.5 }, 1000, 2000), { sx: 100, sy: 400, sw: 500, sh: 1000 });
    assert.deepEqual(cropPixels({ x: 0.8, y: -0.1, w: 0.5, h: 2 }, 1000, 1000), { sx: 800, sy: 0, sw: 200, sh: 1000 });
    assert.deepEqual(cropPixels(null, 640, 480), { sx: 0, sy: 0, sw: 640, sh: 480 });
  });

  test('grayscale + contrast stretch maps the 2–98 % range to 0–255', () => {
    // 100 pixels: a dull grey image between 100 and 150 (low contrast photo)
    const px = [];
    for (let i = 0; i < 100; i++) {
      const v = 100 + Math.round((i / 99) * 50);
      px.push(v, v, v, 255);
    }
    const rgba = new Uint8ClampedArray(px);
    const { lo, hi } = grayscaleContrast(rgba);
    assert.ok(lo <= 102 && hi >= 148);
    assert.equal(rgba[0], 0); // darkest → black
    assert.equal(rgba[rgba.length - 4], 255); // brightest → white
    assert.equal(rgba[1], rgba[0]); // grey: R = G = B
  });

  test('colour is converted with luma weights', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255]);
    grayscaleContrast(rgba, { low: 0, high: 1 });
    assert.ok(rgba[4] > rgba[0] && rgba[0] > rgba[8]); // green brighter than red brighter than blue
  });
});
