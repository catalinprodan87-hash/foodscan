import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assessOrigin, originFromText, originFromProduct, findCountries, markCountry, distanceKm } from '../src/lib/origin.js';
import { RULES, SOURCES, FAO_AREAS } from '../src/data/origin.js';
import { COUNTRIES, COUNTRY_BY_ISO } from '../src/data/countries.js';
import { mapProduct, fieldsFor } from '../src/lib/lookup.js';
import { STRINGS } from '../src/lib/i18n.js';
import '../src/lib/strings/origin.js';

const ids = (r) => r.points.map((p) => p.id);

describe('v3.7 origin data', () => {
  it('every rule has RO + EN text and a source with a link', () => {
    for (const [id, r] of Object.entries(RULES)) {
      assert.ok(r.ro && r.en, id);
      assert.ok(['plus', 'minus', 'info'].includes(r.kind), id);
      assert.ok(SOURCES[r.source]?.url?.startsWith('https://'), id);
    }
  });
  it('no rule rates a country or talks about unsafe food', () => {
    for (const r of Object.values(RULES)) assert.doesNotMatch(`${r.ro} ${r.en}`, /nesigur|periculos|unsafe|dangerous|poor quality|calitate slabă/i);
  });
  it('countries: unique ISO codes, coordinates, RO + EN names', () => {
    assert.equal(new Set(COUNTRIES.map((c) => c.iso)).size, COUNTRIES.length);
    for (const c of COUNTRIES) {
      assert.match(c.iso, /^[A-Z]{2}$/);
      assert.ok(Math.abs(c.lat) <= 90 && Math.abs(c.lon) <= 180, c.iso);
      assert.ok(c.name.ro && c.name.en, c.iso);
    }
    assert.equal(COUNTRIES.filter((c) => c.eu).length, 27);
  });
  it('FAO areas have both names', () => {
    for (const a of Object.values(FAO_AREAS)) assert.ok(a.ro && a.en);
  });
  it('UI strings exist in both languages', () => {
    for (const k of ['originTitle', 'originGroup_plus', 'originGroup_minus', 'originGroup_info', 'originStage_sold', 'saleCountryLabel']) {
      assert.ok(STRINGS.ro[k] && STRINGS.en[k], k);
    }
  });
});

describe('v3.7 finding countries', () => {
  it('names in several languages, with and without diacritics', () => {
    assert.deepEqual(findCountries('Țara de origine: România'), ['RO']);
    assert.deepEqual(findCountries('Hergestellt in Deutschland'), ['DE']);
    assert.deepEqual(findCountries('Произведено в България'), ['BG']);
    assert.deepEqual(findCountries('Made in Italy and France'), ['IT', 'FR']);
  });
  it('a longer name wins (Africa de Sud is not two countries)', () => {
    assert.deepEqual(findCountries('Origine: Africa de Sud'), ['ZA']);
  });
  it('not inside other words', () => {
    assert.deepEqual(findCountries('ulei de palmier, sare iodata'), []);
  });
  it('identification marks', () => {
    assert.equal(markCountry('RO 1234 CE'), 'RO');
    assert.equal(markCountry('fr-12-345-678-ec'), 'FR');
    assert.equal(markCountry('UK AB123 EC'), 'GB');
    assert.equal(markCountry('emb 123'), null);
  });
  it('distance between capitals', () => {
    assert.equal(distanceKm('RO', 'RO'), 0);
    const d = distanceKm('RO', 'IT');
    assert.ok(d > 1000 && d < 1300, String(d));
  });
});

describe('v3.7 label text', () => {
  it('fish: area, wild-caught, thawed, origin and processing', () => {
    const f = originFromText('Somon. Pescuit în zona FAO 27. Țara de origine: Norvegia. Procesat în China. Produs decongelat.');
    assert.equal(f.fao, 27);
    assert.equal(f.wild, true);
    assert.equal(f.thawed, true);
    assert.deepEqual(f.origin, ['NO']);
    assert.deepEqual(f.processed, ['CN']);
  });
  it('farmed fish', () => {
    const f = originFromText('Păstrăv curcubeu crescut în acvacultură, Turcia');
    assert.equal(f.farmed, true);
    assert.equal(f.wild, false);
  });
  it('ingredient origins (EU / non-EU) and "produs în UE"', () => {
    const f = originFromText('apă, zahăr 21,2% (din UE și din afara UE), pastă de tomate* 15,2% (din afara UE). Produs și ambalat în UE');
    assert.deepEqual(f.ingredientOrigins.map((x) => x.where), ['both', 'nonEu']);
    assert.equal(f.processedEu, true);
  });
});

describe('v3.7 assessment', () => {
  it('local product: plus, no distance', () => {
    const r = assessOrigin({ text: 'Produs în România din semințe de floarea-soarelui origine România.' });
    assert.deepEqual(ids(r), ['local']);
    assert.equal(r.km, 0);
  });
  it('the full chain ends in the country where it is sold', () => {
    const r = assessOrigin({ text: 'Pescuit în zona FAO 27. Țara de origine: Norvegia. Procesat în China.', saleCountry: 'RO' });
    assert.deepEqual(r.chain.map((s) => [s.stage, s.iso]), [['caught', 'NO'], ['processed', 'CN'], ['sold', 'RO']]);
    assert.ok(r.km > 10000);
    assert.ok(ids(r).includes('far'));
    assert.ok(ids(r).includes('outsideEu'));
    assert.ok(ids(r).includes('wild'));
  });
  it('outside the EU is stated as information (imports meet EU rules), never as a minus', () => {
    const r = assessOrigin({ text: 'Produs în Turcia.' });
    assert.equal(r.points.find((p) => p.id === 'outsideEu').kind, 'info');
    assert.match(RULES.outsideEu.ro, /aceleași reguli/);
  });
  it('another sale country changes the chain', () => {
    const r = assessOrigin({ text: 'Produs în Polonia.', saleCountry: 'PL' });
    assert.ok(ids(r).includes('local'));
    assert.deepEqual(r.chain.map((s) => s.iso), ['PL', 'PL']);
  });
  it('near and many countries', () => {
    assert.ok(ids(assessOrigin({ text: 'Produs în Bulgaria.' })).includes('near'));
    const r = assessOrigin({ text: 'Origine cacao: Coasta de Fildeș, Ghana. Fabricat în Germania.' });
    assert.ok(ids(r).includes('manyCountries'));
  });
  it('nothing known: says the origin is not stated', () => {
    assert.deepEqual(ids(assessOrigin({ text: 'apă, zahăr, sare' })), ['unknown']);
  });
  it('database: origins, manufacturing places, PDO, organic, marks (not the countries it is sold in)', () => {
    const r = assessOrigin({ product: { origins: 'Made in Italy', manufacturingPlaces: 'Italy', labels: ['en:pdo', 'en:organic'], embCodes: [] } });
    assert.deepEqual(r.chain.map((s) => s.iso), ['IT', 'RO']);
    assert.ok(ids(r).includes('pdo') && ids(r).includes('organic') && ids(r).includes('insideEu') === false);
    const m = assessOrigin({ product: { embCodes: ['de-by-123-eg'] } });
    assert.ok(ids(m).includes('mark'));
    assert.deepEqual(originFromProduct({}).origin, []);
  });
  it('lookup keeps the origin fields', () => {
    for (const f of ['origins', 'manufacturing_places', 'labels_tags', 'emb_codes_tags']) assert.ok(fieldsFor('food').includes(f), f);
    const p = mapProduct({ origins: 'Italia', manufacturing_places: 'Italy', labels_tags: ['en:pdo'], emb_codes_tags: ['it-123'], countries_tags: ['en:romania'] }, 'food', '8001234567890');
    assert.deepEqual(p.origin, { origins: 'Italia', manufacturingPlaces: 'Italy', labels: ['en:pdo'], embCodes: ['it-123'] });
    assert.ok(COUNTRY_BY_ISO.IT.eu);
  });
});
