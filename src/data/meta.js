/** Data sources and review dates shown on the "Despre" page. */

/** When the ingredient databases were last reviewed against the cited sources. */
export const DATABASES_REVIEWED = {
  additives: '2026-11-13',
  nonFood: '2026-11-13',
};

export const PRODUCT_SOURCES = [
  { name: 'Open Food Facts', url: 'https://world.openfoodfacts.org', licence: 'ODbL' },
  { name: 'Open Beauty Facts', url: 'https://world.openbeautyfacts.org', licence: 'ODbL' },
  { name: 'Open Products Facts', url: 'https://world.openproductsfacts.org', licence: 'ODbL' },
];

/** EU rules and scientific bodies cited in the ingredient databases. */
export const REFERENCES = [
  { id: 'reg-1333', en: 'Regulation (EC) 1333/2008 – food additives', ro: 'Regulamentul (CE) 1333/2008 – aditivi alimentari', url: 'https://eur-lex.europa.eu/eli/reg/2008/1333/oj' },
  { id: 'reg-1169', en: 'Regulation (EU) 1169/2011 – food information to consumers', ro: 'Regulamentul (UE) 1169/2011 – informarea consumatorilor', url: 'https://eur-lex.europa.eu/eli/reg/2011/1169/oj' },
  { id: 'reg-2022-63', en: 'Regulation (EU) 2022/63 – ban on titanium dioxide (E171)', ro: 'Regulamentul (UE) 2022/63 – interzicerea dioxidului de titan (E171)', url: 'https://eur-lex.europa.eu/eli/reg/2022/63/oj' },
  { id: 'reg-1223', en: 'Regulation (EC) 1223/2009 – cosmetic products', ro: 'Regulamentul (CE) 1223/2009 – produse cosmetice', url: 'https://eur-lex.europa.eu/eli/reg/2009/1223/oj' },
  { id: 'reg-648', en: 'Regulation (EC) 648/2004 – detergents', ro: 'Regulamentul (CE) 648/2004 – detergenți', url: 'https://eur-lex.europa.eu/eli/reg/2004/648/oj' },
  { id: 'reg-1272', en: 'Regulation (EC) 1272/2008 – CLP (classification and labelling)', ro: 'Regulamentul (CE) 1272/2008 – CLP (clasificare și etichetare)', url: 'https://eur-lex.europa.eu/eli/reg/2008/1272/oj' },
  { id: 'reg-1907', en: 'Regulation (EC) 1907/2006 – REACH', ro: 'Regulamentul (CE) 1907/2006 – REACH', url: 'https://eur-lex.europa.eu/eli/reg/2006/1907/oj' },
  { id: 'reg-2023-2055', en: 'Regulation (EU) 2023/2055 – intentionally added microplastics', ro: 'Regulamentul (UE) 2023/2055 – microplastice adăugate intenționat', url: 'https://eur-lex.europa.eu/eli/reg/2023/2055/oj' },
  { id: 'efsa', en: 'EFSA – European Food Safety Authority opinions', ro: 'EFSA – avizele Autorității Europene pentru Siguranța Alimentară', url: 'https://www.efsa.europa.eu' },
  { id: 'sccs', en: 'SCCS – Scientific Committee on Consumer Safety', ro: 'SCCS – Comitetul științific pentru siguranța consumatorilor', url: 'https://health.ec.europa.eu/scientific-committees/scientific-committee-consumer-safety-sccs_en' },
  { id: 'iarc', en: 'IARC – International Agency for Research on Cancer', ro: 'IARC – Agenția Internațională pentru Cercetarea Cancerului', url: 'https://monographs.iarc.who.int' },
  { id: 'fda', en: 'US FDA – Food and Drug Administration', ro: 'FDA (SUA) – Administrația pentru Alimente și Medicamente', url: 'https://www.fda.gov/food' },
];
