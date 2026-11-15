/**
 * Sources for each database entry, derived from what its explanation cites
 * ("EFSA (2019)…", "Regulation (EC) 1333/2008…", "California Proposition 65…")
 * so the links can never drift from the text. Each source points to the
 * body's entry page (EUR-Lex act, EFSA, IARC, FDA…); the explanation names the
 * specific opinion or rule. Unit-tested: every high / medium entry and every
 * restriction outside the EU has at least one source.
 */
import { REFERENCES, DATABASES_REVIEWED } from './meta.js';

const REF = Object.fromEntries(REFERENCES.map((r) => [r.id, r]));

const EXTRA = {
  hawaii: { id: 'hawaii', en: 'Hawaii State Legislature – Act 104 (2018), sunscreen ban', ro: 'Legislativul statului Hawaii – Actul 104 (2018), interzicerea unor creme de protecție solară', url: 'https://www.capitol.hawaii.gov/' },
  canada: { id: 'canada', en: 'Health Canada – lists of permitted food additives', ro: 'Health Canada – listele aditivilor alimentari permiși', url: 'https://www.canada.ca/en/health-canada/services/food-nutrition/food-safety/food-additives/lists-permitted.html' },
  japan: { id: 'japan', en: 'Japan Ministry of Health – food additives', ro: 'Ministerul Sănătății din Japonia – aditivi alimentari', url: 'https://www.mhlw.go.jp/english/topics/foodsafety/foodadditives/' },
  'reg-259': { id: 'reg-259', en: 'Regulation (EU) 259/2012 – phosphates in consumer detergents', ro: 'Regulamentul (UE) 259/2012 – fosfații din detergenții de uz casnic', url: 'https://eur-lex.europa.eu/eli/reg/2012/259/oj' },
  echa: { id: 'echa', en: 'ECHA – European Chemicals Agency', ro: 'ECHA – Agenția Europeană pentru Produse Chimice', url: 'https://echa.europa.eu' },
};

/** Text patterns → reference ids. */
const CITES = [
  [/EFSA/, 'efsa'],
  [/IARC/, 'iarc'],
  [/SCCS/, 'sccs'],
  [/ECHA/, 'echa'],
  [/1333\/2008|Southampton|phenylalanine|not authorised in (?:the )?EU/i, 'reg-1333'],
  [/1169\/2011/, 'reg-1169'],
  [/2022\/63/, 'reg-2022-63'],
  // the Cosmetics Regulation and its amending acts
  [/1223\/2009|EU cosmetics|Cosmetics Regulation|cosmetic preservatives|permitted in cosmetics|Restricted preservative|Regulation (?:1003|1004|358)\/2014|2021\/1902|2022\/1176|2022\/2195|2025\/877/, 'reg-1223'],
  [/648\/2004/, 'reg-648'],
  // hazard classes come from the CLP classification
  [/1272\/2008|\bCLP\b|CMR|[Cc]orrosive|sensitiser|[Ii]rritat|aspiration hazard|harmful if swallowed/, 'reg-1272'],
  [/259\/2012/, 'reg-259'],
  [/PFAS/, 'echa'],
  [/REACH|1907\/2006/, 'reg-1907'],
  [/2023\/2055|microplastic/i, 'reg-2023-2055'],
  [/Proposition 65|Propunerii 65/, 'prop65'],
  [/AB 418|AB 2316/, 'ca-ab418'],
  [/National Toxicology Program/, 'ntp'],
  [/\bFDA\b|permitted in the US/, 'fda'],
  [/Hawaii/, 'hawaii'],
  [/Health Canada|\bCanada\b/, 'canada'],
  [/Japan/, 'japan'],
];

const lookup = (id) => REF[id] || EXTRA[id];

/** Sources cited in a text (English explanation), in a stable order, no duplicates. */
export function sourcesInText(text) {
  const ids = [];
  for (const [re, id] of CITES) if (re.test(text) && !ids.includes(id) && lookup(id)) ids.push(id);
  return ids.map(lookup);
}

/** The authority behind a restriction outside the EU, when its text names none. */
const REGION_SOURCE = { US: 'fda', 'US-HI': 'hawaii', CA: 'canada', JP: 'japan' };

/** Sources of a database entry: its explanation and the restrictions outside the EU. */
export function sourcesFor(entry, restrictions = []) {
  const texts = [entry?.why?.en || '', ...restrictions.map((r) => r.en || '')].join(' ');
  const found = sourcesInText(texts);
  for (const r of restrictions) {
    const id = REGION_SOURCE[r.region];
    if (id && !found.some((x) => x.id === id)) found.push(lookup(id));
  }
  return found;
}

/** When the entry was last reviewed (per database; entries may override). */
export function reviewedFor(entry, kind = 'additives') {
  return entry?.reviewed || DATABASES_REVIEWED[kind];
}
