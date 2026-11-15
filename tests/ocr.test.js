import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { extractIngredients, cleanOcrText, findStart, needsBetterPhoto } from '../src/lib/ocrText.js';
import { buildRequest } from '../src/lib/request.js';
import { ocrAssets, ensureOcrAssets, getEngine, recognize, resetOcr } from '../src/lib/ocr.js';
import { detSize, linesFromProbMap, ctcDecode, joinLines } from '../src/lib/paddleCore.js';
import { correctWords } from '../src/lib/lexicon.js';
import { fitSize, cropPixels } from '../src/lib/imagePrep.js';
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

// ───────────────────────── OCR engine (mocked worker) ─────────────────────
describe('OCR engine with a mocked PaddleOCR worker', () => {
  const BASE = 'https://example.github.io/foodscan/';
  let workers;
  let fetched;

  /** Fake Web Worker speaking the ocrWorker.js protocol. */
  function mockWorker({ text = FOOD_RO_HU_BG, confidence = 91.6, failInit = false } = {}) {
    return () => {
      const w = {
        posted: [],
        terminated: false,
        postMessage(msg, transfer) {
          w.posted.push({ msg, transfer });
          queueMicrotask(() => {
            if (msg.type === 'init') {
              w.onmessage({ data: { type: 'progress', phase: 'init', progress: 0 } });
              w.onmessage({ data: failInit ? { type: 'error', message: 'wasm failed' } : { type: 'ready' } });
            } else if (msg.type === 'recognize') {
              w.onmessage({ data: { type: 'progress', phase: 'detect', progress: 0 } });
              w.onmessage({ data: { type: 'progress', phase: 'recognize', progress: 0.5 } });
              w.onmessage({ data: { type: 'result', id: msg.id, text, confidence, lines: 7 } });
            }
          });
        },
        terminate() { w.terminated = true; },
      };
      workers.push(w);
      return w;
    };
  }

  const sizes = {
    'ort/ort-wasm-simd-threaded.wasm': 50,
    'ort/ort-wasm-simd-threaded.mjs': 2,
    'paddle/det.onnx': 20,
    'paddle/rec.onnx': 26,
    'paddle/dict.txt': 2,
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
    workers = [];
    fetched = [];
  });

  test('self-hosted asset URLs (no third-party CDN)', () => {
    const a = ocrAssets(BASE);
    assert.equal(a.ortDir, 'https://example.github.io/foodscan/ocr/ort/');
    assert.equal(a.det, 'https://example.github.io/foodscan/ocr/paddle/det.onnx');
    assert.equal(a.rec, 'https://example.github.io/foodscan/ocr/paddle/rec.onnx');
    assert.equal(a.dict, 'https://example.github.io/foodscan/ocr/paddle/dict.txt');
    assert.equal(a.cls, 'https://example.github.io/foodscan/ocr/paddle/cls.onnx');
    assert.equal(a.downloads.length, 6);
    assert.ok(a.downloads.every((u) => u.startsWith(BASE)));
  });

  test('first use: downloads the engine with byte progress, then recognises in the worker', async () => {
    const progress = [];
    const r = await recognize({ fake: 'bitmap' }, {
      createWorker: mockWorker(), baseUrl: BASE, fetchImpl: mockFetch(), cachesImpl: emptyCache, onProgress: (p) => progress.push(p),
    });
    assert.equal(r.confidence, 92);
    assert.equal(r.lines, 7);
    assert.ok(r.text.includes('Ingrediente'));
    const downloads = progress.filter((p) => p.phase === 'download');
    assert.deepEqual(downloads[0], { phase: 'download', loaded: 0, total: 100 });
    assert.deepEqual(downloads.at(-1), { phase: 'download', loaded: 100, total: 100 });
    assert.deepEqual(progress.filter((p) => p.phase !== 'download').map((p) => p.phase), ['init', 'detect', 'recognize']);
    assert.deepEqual(fetched.filter((u) => !u.endsWith('manifest.json')), ocrAssets(BASE).downloads);
    const [init, rec] = workers[0].posted.map((x) => x.msg);
    assert.equal(init.type, 'init');
    assert.equal(init.assets.det, ocrAssets(BASE).det);
    assert.equal(rec.type, 'recognize');
    assert.deepEqual(rec.bitmap, { fake: 'bitmap' });
  });

  test('cached engine: no download and no download progress', async () => {
    const progress = [];
    await recognize({}, { createWorker: mockWorker(), baseUrl: BASE, fetchImpl: mockFetch(), cachesImpl: fullCache, onProgress: (p) => progress.push(p) });
    assert.deepEqual(fetched, []);
    assert.ok(!progress.some((p) => p.phase === 'download'));
  });

  test('the worker is created once and reused for later photos', async () => {
    const opts = { createWorker: mockWorker(), baseUrl: BASE, fetchImpl: mockFetch(), cachesImpl: fullCache };
    await recognize({}, opts);
    await recognize({}, opts);
    assert.equal(workers.length, 1);
    assert.deepEqual(workers[0].posted.map((x) => x.msg.type), ['init', 'recognize', 'recognize']);
  });

  test('ImageBitmaps are transferred to the worker, not copied', async () => {
    const bitmap = { close() {} };
    await recognize(bitmap, { createWorker: mockWorker(), baseUrl: BASE, fetchImpl: mockFetch(), cachesImpl: fullCache });
    assert.deepEqual(workers[0].posted[1].transfer, [bitmap]);
  });

  test('a failed start can be retried', async () => {
    const opts = { baseUrl: BASE, fetchImpl: mockFetch(), cachesImpl: fullCache };
    await assert.rejects(getEngine({ ...opts, createWorker: mockWorker({ failInit: true }) }), /wasm failed/);
    await new Promise((r) => setTimeout(r, 0));
    const engine = await getEngine({ ...opts, createWorker: mockWorker() });
    assert.ok(engine.recognize);
  });

  test('download errors are reported', async () => {
    const bad = async (url) => (url.endsWith('manifest.json') ? { ok: true, json: async () => ({ sizes }) } : { ok: false, status: 404 });
    await assert.rejects(ensureOcrAssets(ocrAssets(BASE), { fetchImpl: bad, cachesImpl: emptyCache }), /HTTP 404/);
  });
});

// ─────────────────────────── PaddleOCR pipeline maths ─────────────────────
describe('PaddleOCR pipeline (pure parts)', () => {
  /** Probability map with filled parallelograms = slanted text lines. */
  function mapWithLines(w, h, lines) {
    const prob = new Float32Array(w * h);
    for (const { x0, x1, y0, thick, slope } of lines) {
      for (let x = x0; x <= x1; x++) {
        const yc = y0 + (x - x0) * slope;
        for (let y = Math.round(yc); y < Math.round(yc) + thick; y++) prob[y * w + x] = 0.9;
      }
    }
    return prob;
  }

  test('detector input: long side ≤ 1920 and multiples of 32', () => {
    assert.deepEqual(detSize(4000, 3000), { w: 1920, h: 1440 });
    assert.deepEqual(detSize(1000, 333), { w: 1024, h: 352 });
  });

  test('three tilted lines stay three separate, slanted boxes (not one tall box)', () => {
    // 4° tilt over 300 px = 21 px rise > line pitch 14 px: upright boxes would overlap
    const slope = Math.tan((4 * Math.PI) / 180);
    const prob = mapWithLines(400, 120, [
      { x0: 40, x1: 340, y0: 20, thick: 6, slope },
      { x0: 40, x1: 340, y0: 34, thick: 6, slope },
      { x0: 40, x1: 260, y0: 48, thick: 6, slope },
    ]);
    const boxes = linesFromProbMap(prob, 400, 120, 1, 1);
    assert.equal(boxes.length, 3);
    for (const b of boxes) {
      assert.ok(Math.abs(b.angle - Math.atan(slope)) < 0.01, `angle ${b.angle}`);
      // the detector marks a shrunk core; "unclip" grows it back to text height,
      // but the box stays far thinner than an upright box (6 + 21 px rise)
      assert.ok(b.thick < 6 + 21, `thick ${b.thick}`);
    }
    const centres = boxes.map((b) => b.cy).sort((a, b) => a - b);
    assert.ok(Math.abs(centres[1] - centres[0] - 14) < 1.5, 'each box is centred on its own line');
    assert.ok(boxes[0].len > 300 && boxes[2].len < boxes[0].len);
  });

  test('map → source scaling and noise filtering', () => {
    const prob = mapWithLines(200, 60, [{ x0: 10, x1: 190, y0: 20, thick: 8, slope: 0 }]);
    prob[5] = 0.9; // a lone speck
    const boxes = linesFromProbMap(prob, 200, 60, 2, 2);
    assert.equal(boxes.length, 1);
    assert.ok(Math.abs(boxes[0].cx - 200) < 3 && Math.abs(boxes[0].cy - 47) < 3);
  });

  test('CTC decoding: blanks dropped, repeats collapsed, dictionary offset by one', () => {
    const dict = ['a', 'b', 'c', ' '];
    const seq = [1, 1, 0, 1, 2, 2, 0, 4, 3]; // a a _ a b b _ ' ' c → "aab c"
    const C = 5;
    const probs = new Float32Array(seq.length * C);
    seq.forEach((c, t) => { probs[t * C + c] = 0.9; });
    const r = ctcDecode(probs, seq.length, C, dict);
    assert.equal(r.text, 'aab c');
    assert.ok(Math.abs(r.conf - 0.9) < 1e-6);
  });

  test('reading order: lines top to bottom, pieces left to right, low confidence dropped', () => {
    const item = (cx, cy, text, conf = 0.9) => ({ cx, cy, angle: 0, len: 100, thick: 20, text, conf });
    const r = joinLines([item(300, 52, 'de grâu,'), item(150, 50, 'făină'), item(150, 90, 'zahăr'), item(400, 92, '???', 0.2)]);
    assert.equal(r.text, 'făină de grâu,\nzahăr');
    assert.equal(r.confidence, 90);
  });
});

// ─────────────────────────────── word correction ──────────────────────────
describe('ingredient word correction', () => {
  test('"masa de cacao" is not turned into "maia" (found by the OCR benchmark)', () => {
    assert.equal(correctWords('zahăr, unt de cacao, masa de cacao').text, 'zahăr, unt de cacao, masă de cacao');
    assert.equal(correctWords('masă de cacao').text, 'masă de cacao');
  });

  test('fixes one-edit OCR slips and restores diacritics', () => {
    assert.equal(correctWords('concentrat de tomate, apa, sore. Produs posteurizat.').text, 'concentrat de tomate, apă, sare. Produs pasteurizat.');
    assert.equal(correctWords('faina de grau, zahar, ulei de palmier').text, 'făină de grâu, zahăr, ulei de palmier');
    assert.equal(correctWords('METHYLISOTHIAZOLlNONE, LINALOOL').text, 'METHYLISOTHIAZOLINONE, LINALOOL');
  });

  test('splits two known words glued together where ", " was lost', () => {
    assert.equal(
      correctWords('sirop de glucoză-fructozacacao, maltodextrinapotentiatori de aromă (glutamat monosodicinozinat disodic)').text,
      'sirop de glucoză-fructoză cacao, maltodextrină potențiatori de aromă (glutamat monosodic inozinat disodic)',
    );
  });

  test('never changes real words or short codes (no invented additives)', () => {
    const t = 'nitrat de tomate, BHA, E471, lapte, ouă';
    assert.equal(correctWords(t).text, t);
  });

  test('ambiguous slips are left alone', () => {
    const r = correctWords('xqzt');
    assert.deepEqual(r.changes, []);
  });
});

// ───────────────────────────── preprocessing ──────────────────────────────
describe('image preprocessing (pure parts)', () => {
  test('downscale the long side to 3000 px, never upscale', () => {
    assert.deepEqual(fitSize(4000, 3000), { width: 3000, height: 2250, scale: 0.75 });
    assert.deepEqual(fitSize(3024, 4032), { width: 2250, height: 3000, scale: 3000 / 4032 });
    assert.deepEqual(fitSize(800, 600), { width: 800, height: 600, scale: 1 });
  });

  test('crop rectangle in pixels, clamped to the image', () => {
    assert.deepEqual(cropPixels({ x: 0.1, y: 0.2, w: 0.5, h: 0.5 }, 1000, 2000), { sx: 100, sy: 400, sw: 500, sh: 1000 });
    assert.deepEqual(cropPixels({ x: 0.8, y: -0.1, w: 0.5, h: 2 }, 1000, 1000), { sx: 800, sy: 0, sw: 200, sh: 1000 });
    assert.deepEqual(cropPixels(null, 640, 480), { sx: 0, sy: 0, sw: 640, sh: 480 });
  });

});
