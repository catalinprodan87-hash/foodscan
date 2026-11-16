/**
 * Where a product comes from (v3.7): origin facts from Open Food Facts and
 * from the label text, the supply chain ("Pescuit: Norvegia (FAO 27) →
 * Procesat: China → Vândut în: România") and the explained assessment.
 * Rules and sources: src/data/origin.js. Pure, unit-tested.
 */
import { normalize } from './analyze.js';
import { COUNTRIES, COUNTRY_BY_ISO } from '../data/countries.js';
import { RULES, FAO_AREAS, LABEL_TAGS, NEAR_KM, FAR_KM, MANY_COUNTRIES } from '../data/origin.js';

const fold = (s) => normalize(String(s || '')).replace(/\s+/g, ' ').trim();

// Name → ISO, all spellings, in one regex (longest names first, so "south africa" wins over "africa").
const NAMES = COUNTRIES.flatMap((x) => [x.name.ro, x.name.en, ...x.aliases].map((n) => [fold(n), x.iso]))
  .filter(([n]) => n.length >= 2)
  .sort((a, b) => b[0].length - a[0].length);
const ISO_BY_NAME = new Map(NAMES.map(([n, iso]) => [n, iso]));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NAME_RE = new RegExp(`(?<![\\p{L}])(?:${NAMES.map(([n]) => esc(n)).join('|')})(?![\\p{L}])`, 'gu');

/** Countries named in a text, in order of appearance (ISO codes, no repeats). */
export function findCountries(text) {
  const out = [];
  for (const m of fold(text).matchAll(NAME_RE)) {
    const iso = ISO_BY_NAME.get(m[0]);
    if (iso && !out.includes(iso)) out.push(iso);
  }
  return out;
}

/** Packer / health mark "RO 1234 CE", "DE BY-123 EG", OFF tag "fr-12-345-678-ec" → ISO. */
export function markCountry(code) {
  const m = String(code || '').trim().match(/^([a-z]{2})[\s-]/i);
  const iso = m && m[1].toUpperCase().replace('UK', 'GB').replace('EL', 'GR');
  return iso && COUNTRY_BY_ISO[iso] ? iso : null;
}

const after = (t, re) => { const m = t.match(re); return m ? m[1] : null; };

/**
 * Facts from a label's text (photo of the origin / ingredients text).
 * @returns {{origin: string[], processed: string[], packed: string[], fao: number|null, wild: boolean, farmed: boolean, thawed: boolean, ingredientOrigins: {ingredient, where}[], eu: 'eu'|'nonEu'|'both'|null}}
 */
export function originFromText(text) {
  const t = fold(text);
  const seg = (re) => { const s = after(t, re); return s ? findCountries(s.slice(0, 60)) : []; };
  const origin = [
    ...seg(/(?:tara de origine|tara de provenienta|origine|country of origin|origin|zemlja porekla|ursprungsland|pays d'origine|paese d'origine)\s*[:-]?\s*([^.;\n]{2,80})/),
    ...seg(/(?:materie prima|lapte|carne|fructe|legume|seminte|cacao|ingredientul principal)[^.;\n]{0,30}?\s(?:din|origine|provenienta)\s+([^.;\n]{2,60})/),
  ];
  const processed = [
    ...seg(/(?:produs|fabricat|procesat|prelucrat|made|produced|manufactured|hergestellt|fabrique|prodotto)\s+(?:si ambalat\s+)?(?:in|en|w)\s+([^.;\n]{2,60})/),
    ...seg(/(?:produs de|fabricat de|producator|manufacturer|proizvodjac)\s*[:]?\s*[^.;\n]{0,80}?,\s*([^.;\n]{2,60})/),
  ];
  const packed = seg(/ambalat\s+(?:in|de)\s+([^.;\n]{2,60})/);
  const fao = Number(after(t, /(?:zona|area|zone)?\s*fao\s*(?:nr\.?\s*)?(\d{2})/)) || null;
  const wild = /pescuit|capturat|salbatic|wild[- ]caught|caught in|peche|gefangen/.test(t) && !/crescut|acvacultura|crescatorie|farmed|aquaculture/.test(t);
  const farmed = /crescut|acvacultura|de crescatorie|farmed|aquaculture|elevage|aquakultur/.test(t);
  const thawed = /decongelat|defrosted|previously frozen|decongele|aufgetaut/.test(t);
  const ingredientOrigins = [];
  for (const m of t.matchAll(/([a-z][a-z\s-]{2,30}?)\s*\*?\s*(?:\d+(?:[.,]\d+)?\s*%)?\s*\*?\s*\((din (?:ue|afara ue)[^)]*|eu and non-eu|non-eu|eu)\)/g)) {
    const where = /afara|non/.test(m[2]) ? (/\bdin ue\b|eu and/.test(m[2]) ? 'both' : 'nonEu') : 'eu';
    ingredientOrigins.push({ ingredient: m[1].trim().split(/,\s*/).pop(), where });
  }
  const processedEu = /(?:produs|fabricat|procesat|ambalat|made|produced|packed)(?:\s+si\s+ambalat)?\s+(?:in|en)\s+(?:ue|uniunea europeana|the eu|eu)\b/.test(t);
  const euWords = /\bdin ue\b|\beu\b/.test(t) && !/afara ue|non-eu/.test(t) ? 'eu' : /afara ue|non-eu/.test(t) ? (/\bdin ue\b|eu and/.test(t) ? 'both' : 'nonEu') : null;
  return { origin: [...new Set(origin)], processed: [...new Set(processed)], packed, fao, wild, farmed, thawed, ingredientOrigins, eu: euWords, processedEu };
}

/** Facts from an Open Food Facts product (origins, manufacturing places, labels, packer codes). Not countries_tags: those are where it is sold. */
export function originFromProduct(p = {}) {
  const origin = findCountries([p.origins, ...(p.originsTags || [])].join(', '));
  const processed = findCountries([p.manufacturingPlaces, ...(p.labels || []).filter((l) => /made-in|produit en|hergestellt/i.test(l)).map((l) => l.replace(/^[a-z]{2}:/, '').replace(/-/g, ' '))].join(', '));
  const marks = (p.embCodes || []).map(markCountry).filter(Boolean);
  const designations = [...new Set((p.labels || []).map((l) => LABEL_TAGS[l]).filter(Boolean))];
  return { origin, processed, marks: [...new Set(marks)], designations };
}

/** Great-circle distance in km between two countries' capitals. */
export function distanceKm(a, b) {
  const A = COUNTRY_BY_ISO[a];
  const B = COUNTRY_BY_ISO[b];
  if (!A || !B || a === b) return 0;
  const r = Math.PI / 180;
  const h = Math.sin(((B.lat - A.lat) * r) / 2) ** 2 + Math.cos(A.lat * r) * Math.cos(B.lat * r) * Math.sin(((B.lon - A.lon) * r) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
}

/**
 * The chain and the assessment.
 * @param {{text?: string, product?: object, saleCountry?: string}} args
 * @returns {{chain: {stage, iso?, fao?}[], countries: string[], km: number|null, points: {id, kind, source, params}[], known: boolean}}
 */
export function assessOrigin({ text = '', product = null, saleCountry = 'RO' } = {}) {
  const fromText = originFromText(text);
  const fromDb = originFromProduct(product || {});
  const origin = [...new Set([...fromText.origin, ...fromDb.origin])];
  const processed = [...new Set([...fromText.processed, ...fromDb.processed, ...fromText.packed])].filter((x) => !origin.includes(x) || origin.length > 1);
  const marks = fromDb.marks;
  const fish = fromText.fao || fromText.wild || fromText.farmed;

  const chain = [];
  if (fish && (fromText.fao || origin.length)) chain.push({ stage: fromText.farmed ? 'farmed' : 'caught', iso: origin[0] || null, fao: fromText.fao });
  else origin.forEach((iso) => chain.push({ stage: 'origin', iso }));
  const procIsos = processed.length ? processed : marks.filter((m) => !origin.includes(m));
  procIsos.forEach((iso) => chain.push({ stage: 'processed', iso }));
  chain.push({ stage: 'sold', iso: saleCountry });

  const isos = chain.map((s) => s.iso).filter(Boolean);
  const countries = [...new Set(isos)];
  const known = isos.length > 1;
  let km = null;
  if (known) { km = 0; for (let i = 1; i < isos.length; i++) km += distanceKm(isos[i - 1], isos[i]); }

  const points = [];
  const add = (id, params = {}) => points.push({ id, kind: RULES[id].kind, source: RULES[id].source, params });
  if (!known && !fromText.eu) add('unknown');
  if (known && countries.length === 1) add('local');
  else if (km != null && km <= NEAR_KM && countries.length > 1) add('near', { km });
  else if (km != null && km >= FAR_KM) add('far', { km });
  if (countries.length >= MANY_COUNTRIES + 1) add('manyCountries', { n: countries.length }); // origin + processing + sale, plus one more
  const nonEu = countries.filter((iso) => iso !== saleCountry && COUNTRY_BY_ISO[iso] && !COUNTRY_BY_ISO[iso].eu);
  const procEu = procIsos.length && procIsos.every((iso) => COUNTRY_BY_ISO[iso]?.eu);
  if (nonEu.length) add('outsideEu', { countries: nonEu });
  else if (procEu || fromText.processedEu) add('insideEu');
  if (fromText.ingredientOrigins.length) add('ingredientOrigin', { list: fromText.ingredientOrigins });
  if (fromText.wild || (fromText.fao && !fromText.farmed)) add('wild', { fao: fromText.fao });
  if (fromText.farmed) add('farmed', { fao: fromText.fao });
  if (fromText.thawed) add('thawed');
  for (const d of fromDb.designations) add(d);
  if (marks.length && !processed.length) add('mark', { countries: marks });
  return { chain, countries, km, points, known };
}

export { FAO_AREAS };
