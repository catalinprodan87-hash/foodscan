import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  lookupProduct, fetchProduct, lookupOrder, mapProduct, analyzeInput, apiUrl, productPageUrl,
  cleanBarcode, isValidGtin, upcEToUpcA, normalizeBarcode, LookupError,
} from '../src/lib/lookup.js';
import { analyze } from '../src/lib/analyze.js';
import { classifyCameraError, SCAN_FORMATS, CAMERA_CONSTRAINTS } from '../src/lib/camera.js';

const HOST_TYPE = {
  'world.openfoodfacts.org': 'food',
  'world.openbeautyfacts.org': 'cosmetic',
  'world.openproductsfacts.org': 'household',
};

const json = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const found = (product) => json(200, { status: 1, status_verbose: 'product found', product });
const notFound = () => json(404, { status: 0, status_verbose: 'product not found' });

/**
 * Mock fetch. `routes` maps a product type to a response, a function
 * returning one, 'network' (rejects), 'hang' (never answers until aborted).
 */
function mockFetch(routes) {
  const calls = [];
  const fetchImpl = (url, opts = {}) => {
    const u = new URL(url);
    const type = HOST_TYPE[u.host];
    calls.push({ type, url, signal: opts.signal });
    const route = routes[type] ?? notFound();
    if (route === 'network') return Promise.reject(new TypeError('Failed to fetch'));
    if (route === 'hang') {
      return new Promise((_, reject) => {
        opts.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      });
    }
    return Promise.resolve(typeof route === 'function' ? route(u) : route);
  };
  return { fetchImpl, calls };
}

const NUTELLA = {
  code: '3017620422003',
  product_name_ro: 'Cremă de alune cu cacao',
  product_name: 'Nutella',
  product_name_en: 'Hazelnut spread',
  brands: 'Ferrero',
  quantity: '400 g',
  image_front_small_url: 'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_ro.200.jpg',
  ingredients_text_ro: 'Zahăr, ulei de palmier, alune de pădure 13%, cacao degresată 7,4%, lapte praf degresat 6,6%, emulgatori: lecitine (soia), vanilină.',
  ingredients_text: 'Sugar, palm oil, hazelnuts 13%…',
  additives_tags: ['en:e322', 'en:e322i'],
  nova_group: 4,
  nutriscore_grade: 'e',
};

const SHAMPOO = {
  code: '3600523614455',
  product_name: 'Elseve shampoo',
  brands: "L'Oréal",
  ingredients_text: 'Aqua, Sodium Laureth Sulfate, Parfum, Methylisothiazolinone',
};

// ──────────────────────────────── routing ─────────────────────────────────
describe('lookupProduct() routing', () => {
  test('auto: tries OFF → OBF → OPF and stops at the first match', async () => {
    const { fetchImpl, calls } = mockFetch({ cosmetic: found(SHAMPOO) });
    const r = await lookupProduct('3600523614455', { fetchImpl });
    assert.equal(r.status, 'found');
    assert.deepEqual(calls.map((c) => c.type), ['food', 'cosmetic']);
    assert.deepEqual(r.tried, ['food', 'cosmetic']);
    assert.equal(r.product.productType, 'cosmetic');
    assert.equal(r.product.source, 'Open Beauty Facts');
  });

  test('auto: falls through to Open Products Facts', async () => {
    const { fetchImpl, calls } = mockFetch({ household: found({ product_name: 'Domestos', ingredients_text: '<5% înălbitori pe bază de clor' }) });
    const r = await lookupProduct('8710447283028', { fetchImpl });
    assert.equal(r.product.productType, 'household');
    assert.deepEqual(calls.map((c) => c.type), ['food', 'cosmetic', 'household']);
  });

  test('chosen type is queried first', async () => {
    for (const [chosen, order] of [
      ['cosmetic', ['cosmetic', 'food', 'household']],
      ['household', ['household', 'food', 'cosmetic']],
      ['food', ['food', 'cosmetic', 'household']],
    ]) {
      assert.deepEqual(lookupOrder(chosen), order);
      const { fetchImpl, calls } = mockFetch({});
      await lookupProduct('5941234567892', { productType: chosen, fetchImpl });
      assert.deepEqual(calls.map((c) => c.type), order, chosen);
    }
    assert.deepEqual(lookupOrder(null), ['food', 'cosmetic', 'household']);
  });

  test('chosen type found → only one request', async () => {
    const { fetchImpl, calls } = mockFetch({ household: found({ product_name: 'Ariel' }) });
    const r = await lookupProduct('8001090000000', { productType: 'household', fetchImpl });
    assert.equal(r.status, 'found');
    assert.equal(calls.length, 1);
  });

  test('chosen type not found → falls back to the others; the finder sets the type', async () => {
    const { fetchImpl } = mockFetch({ food: found(NUTELLA) });
    const r = await lookupProduct('3017620422003', { productType: 'cosmetic', fetchImpl });
    assert.equal(r.product.productType, 'food');
    assert.deepEqual(r.tried, ['cosmetic', 'food']);
  });

  test("the product's own product_type wins over the database that served it", async () => {
    const { fetchImpl } = mockFetch({ food: found({ ...SHAMPOO, product_type: 'beauty' }) });
    const r = await lookupProduct('3600523614455', { fetchImpl });
    assert.equal(r.product.productType, 'cosmetic');
    assert.equal(r.product.url, 'https://world.openbeautyfacts.org/product/3600523614455');
  });

  test('not found anywhere', async () => {
    const { fetchImpl, calls } = mockFetch({});
    const r = await lookupProduct('5940000000007', { fetchImpl });
    assert.deepEqual(r, { status: 'not_found', code: '5940000000007', tried: ['food', 'cosmetic', 'household'] });
    assert.equal(calls.length, 3);
  });

  test('status 0 with HTTP 200 also counts as not found', async () => {
    const { fetchImpl } = mockFetch({ food: json(200, { status: 0 }), cosmetic: json(200, { status: 1 }) });
    assert.equal((await lookupProduct('5940000000007', { fetchImpl })).status, 'not_found');
  });

  test('network error and nothing found → error (retry), not "not found"', async () => {
    const { fetchImpl } = mockFetch({ food: 'network', cosmetic: 'network', household: 'network' });
    const r = await lookupProduct('5940000000007', { fetchImpl });
    assert.equal(r.status, 'error');
    assert.equal(r.kind, 'network');
  });

  test('an error in one database does not hide a match in another', async () => {
    const { fetchImpl } = mockFetch({ food: 'network', cosmetic: found(SHAMPOO) });
    assert.equal((await lookupProduct('3600523614455', { fetchImpl })).status, 'found');
  });

  test('HTTP 5xx → error kind "http"', async () => {
    const { fetchImpl } = mockFetch({ food: json(503, {}) });
    const r = await lookupProduct('5940000000007', { productType: 'food', fetchImpl });
    assert.equal(r.status, 'error');
    assert.equal(r.kind, 'http');
  });

  test('timeout: the request is aborted and reported as "timeout"', async () => {
    const { fetchImpl, calls } = mockFetch({ food: 'hang', cosmetic: 'hang', household: 'hang' });
    const started = Date.now();
    const r = await lookupProduct('5940000000007', { fetchImpl, timeoutMs: 30 });
    assert.equal(r.status, 'error');
    assert.equal(r.kind, 'timeout');
    assert.ok(calls.every((c) => c.signal.aborted), 'every request was aborted');
    assert.ok(Date.now() - started < 1000);
  });

  test('timeout on one database, match on the next', async () => {
    const { fetchImpl } = mockFetch({ food: 'hang', cosmetic: found(SHAMPOO) });
    const r = await lookupProduct('3600523614455', { fetchImpl, timeoutMs: 30 });
    assert.equal(r.status, 'found');
  });

  test('default timeout is 8 seconds', async () => {
    const { fetchImpl, calls } = mockFetch({ food: found(NUTELLA) });
    await fetchProduct('food', '3017620422003', { fetchImpl });
    assert.ok(calls[0].signal instanceof AbortSignal);
    const { DEFAULT_TIMEOUT_MS } = await import('../src/lib/lookup.js');
    assert.equal(DEFAULT_TIMEOUT_MS, 8000);
  });

  test('caller abort propagates as LookupError("aborted")', async () => {
    const { fetchImpl } = mockFetch({ food: 'hang' });
    const ctrl = new AbortController();
    const p = lookupProduct('5940000000007', { fetchImpl, signal: ctrl.signal, timeoutMs: 5000 });
    ctrl.abort();
    await assert.rejects(p, (err) => err instanceof LookupError && err.kind === 'aborted');
  });
});

// ───────────────────────────── field mapping ──────────────────────────────
describe('field mapping', () => {
  test('API URLs request only the needed fields; food adds additives, NOVA, Nutri-Score', () => {
    const food = new URL(apiUrl('food', '3017620422003'));
    assert.equal(food.origin + food.pathname, 'https://world.openfoodfacts.org/api/v2/product/3017620422003.json');
    const fields = food.searchParams.get('fields').split(',');
    for (const f of ['product_name_ro', 'product_name', 'product_name_en', 'brands', 'quantity', 'image_front_small_url',
      'ingredients_text_ro', 'ingredients_text', 'ingredients_text_en', 'additives_tags', 'nova_group', 'nutriscore_grade']) {
      assert.ok(fields.includes(f), f);
    }
    const beauty = new URL(apiUrl('cosmetic', '1')).searchParams.get('fields').split(',');
    assert.ok(!beauty.includes('nova_group') && !beauty.includes('additives_tags'));
    assert.equal(new URL(apiUrl('household', '1')).host, 'world.openproductsfacts.org');
    assert.equal(productPageUrl('food', '123'), 'https://world.openfoodfacts.org/product/123');
  });

  test('Romanian name and ingredients are preferred, then generic, then English', () => {
    const p = mapProduct(NUTELLA, 'food', '3017620422003');
    assert.equal(p.name, 'Cremă de alune cu cacao');
    assert.ok(p.ingredientsText.startsWith('Zahăr'));
    assert.equal(mapProduct({ product_name: 'Nutella', product_name_en: 'X' }, 'food', '1').name, 'Nutella');
    assert.equal(mapProduct({ product_name: '  ', product_name_en: 'Spread' }, 'food', '1').name, 'Spread');
    assert.equal(mapProduct({ ingredients_text_en: 'sugar' }, 'food', '1').ingredientsText, 'sugar');
  });

  test('maps brand, quantity, image, scores and link', () => {
    const p = mapProduct(NUTELLA, 'food', '3017620422003');
    assert.equal(p.brands, 'Ferrero');
    assert.equal(p.quantity, '400 g');
    assert.ok(p.image.startsWith('https://images.openfoodfacts.org/'));
    assert.deepEqual(p.additiveTags, ['en:e322', 'en:e322i']);
    assert.equal(p.nova, 4);
    assert.equal(p.nutriscore, 'e');
    assert.equal(p.hasIngredients, true);
    assert.equal(p.source, 'Open Food Facts');
    assert.equal(p.url, 'https://world.openfoodfacts.org/product/3017620422003');
  });

  test('missing or invalid values become empty/null', () => {
    const p = mapProduct({ nova_group: '', nutriscore_grade: 'not-applicable' }, 'food', '5940000000007');
    assert.equal(p.code, '5940000000007');
    assert.equal(p.name, '');
    assert.equal(p.image, null);
    assert.equal(p.nova, null);
    assert.equal(p.nutriscore, null);
    assert.equal(p.hasIngredients, false);
    assert.deepEqual(p.additiveTags, []);
  });

  test('non-food products carry no food scores', () => {
    const p = mapProduct(SHAMPOO, 'cosmetic', SHAMPOO.code);
    assert.equal('nova' in p, false);
    assert.equal('additiveTags' in p, false);
    assert.equal(p.source, 'Open Beauty Facts');
  });

  test('found but no ingredients: name, image and food scores are still available', async () => {
    const { fetchImpl } = mockFetch({ food: found({ product_name: 'Biscuiți', image_front_small_url: 'https://x/y.jpg', nova_group: 4, nutriscore_grade: 'd' }) });
    const r = await lookupProduct('5940000000007', { fetchImpl });
    assert.equal(r.status, 'found');
    assert.equal(r.product.hasIngredients, false);
    assert.equal(r.product.name, 'Biscuiți');
    assert.equal(r.product.nova, 4);
    assert.equal(r.product.nutriscore, 'd');
  });

  test('looked-up products feed analyze() with the right productType', () => {
    const food = analyze(analyzeInput(mapProduct(NUTELLA, 'food', NUTELLA.code)));
    assert.equal(food.productType, 'food');
    assert.deepEqual(food.processing, { nova: 4, source: 'database', markers: [] });
    assert.equal(food.nutriscore, 'e');
    assert.ok(food.additives.some((a) => a.code === 'E322'));
    assert.deepEqual(food.avoidHits.map((h) => h.id), ['palm']);

    const cos = analyze(analyzeInput(mapProduct(SHAMPOO, 'cosmetic', SHAMPOO.code)));
    assert.equal(cos.productType, 'cosmetic');
    assert.ok(cos.items.some((i) => i.code === 'MIT'));
  });

  test('pasted ingredients replace a missing ingredients list', () => {
    const product = mapProduct({ product_name: 'X', nova_group: 3 }, 'food', '1');
    const r = analyze(analyzeInput(product, 'zahăr, E250'));
    assert.ok(r.additives.some((a) => a.code === 'E250'));
    assert.equal(r.processing.source, 'database');
  });
});

// ─────────────────────────────── barcodes ─────────────────────────────────
describe('barcodes', () => {
  test('cleanBarcode keeps digits only', () => {
    assert.equal(cleanBarcode(' 5 941234-567892 '), '5941234567892');
  });

  test('GTIN check digit', () => {
    assert.ok(isValidGtin('3017620422003'));
    assert.ok(isValidGtin('96385074')); // EAN-8
    assert.ok(isValidGtin('042100005264')); // UPC-A
    assert.ok(!isValidGtin('3017620422004'));
    assert.ok(!isValidGtin('12345'));
  });

  test('UPC-E is expanded to UPC-A', () => {
    assert.equal(upcEToUpcA('04252614'), '042100005264');
    assert.equal(upcEToUpcA('01234565'), '012345000065');
    assert.equal(upcEToUpcA('01234505'), '012000003455');
    assert.equal(upcEToUpcA('22345678'), null); // number system must be 0 or 1
    assert.equal(normalizeBarcode('04252614', 'UPC_E'), '042100005264');
    assert.ok(isValidGtin(normalizeBarcode('04252614', 'UPC_E')));
  });

  test('normalizeBarcode accepts 8–14 digits, rejects the rest', () => {
    assert.equal(normalizeBarcode('3017620422003', 'EAN_13'), '3017620422003');
    assert.equal(normalizeBarcode('96385074'), '96385074');
    assert.equal(normalizeBarcode('1234'), null);
    assert.equal(normalizeBarcode('abc'), null);
  });
});

// ──────────────────────────────── camera ──────────────────────────────────
describe('camera helpers', () => {
  const env = { isSecureContext: true, navigator: { mediaDevices: { getUserMedia() {} } } };

  test('only retail barcode formats, back camera', () => {
    assert.deepEqual(SCAN_FORMATS, ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E']);
    assert.deepEqual(CAMERA_CONSTRAINTS.video.facingMode, { ideal: 'environment' });
  });

  test('classifies camera errors', () => {
    assert.equal(classifyCameraError({ name: 'NotAllowedError' }, env), 'denied');
    assert.equal(classifyCameraError({ name: 'NotFoundError' }, env), 'notFound');
    assert.equal(classifyCameraError({ name: 'OverconstrainedError' }, env), 'notFound');
    assert.equal(classifyCameraError({ name: 'NotReadableError' }, env), 'busy');
    assert.equal(classifyCameraError(new Error('x'), env), 'unknown');
    assert.equal(classifyCameraError({}, { isSecureContext: false, navigator: env.navigator }), 'insecure');
    assert.equal(classifyCameraError({}, { isSecureContext: true, navigator: {} }), 'unsupported');
  });
});
