/**
 * Country of origin (v3.7): the rules behind "De ce e bine / De ce nu e
 * bine / De știut", each with its source. Only objective, documented
 * factors: distance and number of countries in the chain, processing inside
 * or outside the EU, wild-caught or farmed fish and the FAO area, thawed
 * food, protected designations and EU organic.
 *
 * Never a rating of a country or of its people, and no statements about
 * safety problems (no RASFF statistics – decided 2026-11-15).
 */

export const SOURCES = {
  fic: { id: 'fic', ro: 'Regulamentul (UE) nr. 1169/2011 privind informarea consumatorilor', en: 'Regulation (EU) No 1169/2011 on food information to consumers', url: 'https://eur-lex.europa.eu/eli/reg/2011/1169/oj' },
  primary: { id: 'primary', ro: 'Regulamentul (UE) 2018/775 – originea ingredientului primar', en: 'Regulation (EU) 2018/775 – origin of the primary ingredient', url: 'https://eur-lex.europa.eu/eli/reg_impl/2018/775/oj' },
  controls: { id: 'controls', ro: 'Regulamentul (UE) 2017/625 privind controalele oficiale (inclusiv la frontieră)', en: 'Regulation (EU) 2017/625 on official controls (incl. at the border)', url: 'https://eur-lex.europa.eu/eli/reg/2017/625/oj' },
  fish: { id: 'fish', ro: 'Regulamentul (UE) nr. 1379/2013, art. 35 – informații despre produsele pescărești', en: 'Regulation (EU) No 1379/2013, Art. 35 – information on fishery products', url: 'https://eur-lex.europa.eu/eli/reg/2013/1379/oj' },
  quality: { id: 'quality', ro: 'Regulamentul (UE) 2024/1143 – indicații geografice (DOP, IGP) și STG', en: 'Regulation (EU) 2024/1143 – geographical indications (PDO, PGI) and TSG', url: 'https://eur-lex.europa.eu/eli/reg/2024/1143/oj' },
  organic: { id: 'organic', ro: 'Regulamentul (UE) 2018/848 privind producția ecologică', en: 'Regulation (EU) 2018/848 on organic production', url: 'https://eur-lex.europa.eu/eli/reg/2018/848/oj' },
  mark: { id: 'mark', ro: 'Regulamentul (CE) nr. 853/2004 – marca de identificare (ex. „RO 1234 CE”)', en: 'Regulation (EC) No 853/2004 – identification mark (e.g. "RO 1234 CE")', url: 'https://eur-lex.europa.eu/eli/reg/2004/853/oj' },
  footprint: { id: 'footprint', ro: 'Our World in Data – transportul e de obicei o parte mică din amprenta de carbon a alimentelor (Ritchie, 2020)', en: 'Our World in Data – transport is usually a small part of food’s carbon footprint (Ritchie, 2020)', url: 'https://ourworldindata.org/food-choice-vs-eating-local' },
};

/** Distance bands (km, sum of the legs between the countries in the chain). */
export const NEAR_KM = 600;
export const FAR_KM = 3000;
export const MANY_COUNTRIES = 3;

/**
 * Statements. kind: plus (De ce e bine) | minus (De ce nu e bine) | info (De știut).
 * {km}, {n}, {country}, {area} are filled in.
 */
export const RULES = {
  local: { kind: 'plus', source: 'footprint', ro: 'Produs în țara în care se vinde: drum scurt până la raft (mai puțin transport, mai proaspăt). Transportul e totuși o parte mică din amprenta unui aliment.', en: 'Made in the country where it is sold: a short way to the shelf (less transport, fresher). Transport is still a small part of a food’s footprint.' },
  near: { kind: 'plus', source: 'footprint', ro: 'Drum scurt: aproximativ {km} km între țările din lanț.', en: 'A short way: about {km} km between the countries in the chain.' },
  far: { kind: 'minus', source: 'footprint', ro: 'Drum lung: aproximativ {km} km între țările din lanț (mai mult transport și timp). Transportul e de obicei o parte mică din amprenta unui aliment.', en: 'A long way: about {km} km between the countries in the chain (more transport and time). Transport is usually a small part of a food’s footprint.' },
  manyCountries: { kind: 'minus', source: 'fic', ro: 'Lanț cu {n} țări: e mai greu de urmărit de unde vine fiecare parte.', en: 'A chain of {n} countries: harder to trace where each part comes from.' },
  unknown: { kind: 'minus', source: 'fic', ro: 'Originea nu e precizată. În UE e obligatorie doar pentru unele alimente (carne proaspătă, fructe și legume, pește, miere, ulei de măsline…) sau când lipsa ei ar induce în eroare.', en: 'The origin is not stated. In the EU it is mandatory only for some foods (fresh meat, fruit and vegetables, fish, honey, olive oil…) or when leaving it out would mislead.' },
  outsideEu: { kind: 'info', source: 'controls', ro: 'Procesat sau provenit din afara UE ({country}). Importurile trebuie să respecte aceleași reguli de siguranță alimentară ale UE și trec prin controale oficiale la frontieră.', en: 'Processed in or coming from outside the EU ({country}). Imports must meet the same EU food safety rules and pass official border checks.' },
  insideEu: { kind: 'info', source: 'controls', ro: 'Procesat în UE, după regulile de igienă și controalele oficiale ale UE.', en: 'Processed in the EU, under EU hygiene rules and official controls.' },
  ingredientOrigin: { kind: 'info', source: 'primary', ro: 'Originea unor ingrediente e precizată separat: {list}.', en: 'The origin of some ingredients is stated separately: {list}.' },
  wild: { kind: 'info', source: 'fish', ro: 'Pescuit în sălbăticie{area}.', en: 'Wild-caught{area}.' },
  farmed: { kind: 'info', source: 'fish', ro: 'Din acvacultură (crescut în fermă){area}.', en: 'Farmed (aquaculture){area}.' },
  thawed: { kind: 'info', source: 'fic', ro: 'Decongelat: a fost congelat înainte de vânzare. Nu se recongelează.', en: 'Defrosted: it was frozen before sale. Do not refreeze.' },
  pdo: { kind: 'plus', source: 'quality', ro: 'Denumire de origine protejată (DOP): produs, prelucrat și preparat într-o zonă definită, după o metodă înregistrată.', en: 'Protected designation of origin (PDO): produced, processed and prepared in a defined area, by a registered method.' },
  pgi: { kind: 'plus', source: 'quality', ro: 'Indicație geografică protejată (IGP): legat de o zonă definită, unde are loc cel puțin o etapă a producției.', en: 'Protected geographical indication (PGI): linked to a defined area where at least one production step takes place.' },
  tsg: { kind: 'plus', source: 'quality', ro: 'Specialitate tradițională garantată (STG): rețetă sau metodă tradițională înregistrată.', en: 'Traditional speciality guaranteed (TSG): a registered traditional recipe or method.' },
  organic: { kind: 'plus', source: 'organic', ro: 'Ecologic (bio) certificat UE: producție controlată după regulile UE pentru agricultura ecologică.', en: 'EU-certified organic: production checked under the EU organic farming rules.' },
  mark: { kind: 'info', source: 'mark', ro: 'Marca de identificare arată unitatea care l-a ambalat sau prelucrat: {country}.', en: 'The identification mark shows the establishment that packed or processed it: {country}.' },
};

/** FAO major fishing areas (Reg. 1379/2013 Annex III), names RO / EN. */
export const FAO_AREAS = {
  18: { ro: 'Oceanul Arctic', en: 'Arctic Sea' },
  21: { ro: 'Atlanticul de Nord-Vest', en: 'Atlantic, Northwest' },
  27: { ro: 'Atlanticul de Nord-Est', en: 'Atlantic, Northeast' },
  31: { ro: 'Atlanticul Central-Vestic', en: 'Atlantic, Western Central' },
  34: { ro: 'Atlanticul Central-Estic', en: 'Atlantic, Eastern Central' },
  37: { ro: 'Marea Mediterană și Marea Neagră', en: 'Mediterranean and Black Sea' },
  41: { ro: 'Atlanticul de Sud-Vest', en: 'Atlantic, Southwest' },
  47: { ro: 'Atlanticul de Sud-Est', en: 'Atlantic, Southeast' },
  48: { ro: 'Atlanticul, Antarctic', en: 'Atlantic, Antarctic' },
  51: { ro: 'Oceanul Indian de Vest', en: 'Indian Ocean, Western' },
  57: { ro: 'Oceanul Indian de Est', en: 'Indian Ocean, Eastern' },
  58: { ro: 'Oceanul Indian, Antarctic', en: 'Indian Ocean, Antarctic' },
  61: { ro: 'Pacificul de Nord-Vest', en: 'Pacific, Northwest' },
  67: { ro: 'Pacificul de Nord-Est', en: 'Pacific, Northeast' },
  71: { ro: 'Pacificul Central-Vestic', en: 'Pacific, Western Central' },
  77: { ro: 'Pacificul Central-Estic', en: 'Pacific, Eastern Central' },
  81: { ro: 'Pacificul de Sud-Vest', en: 'Pacific, Southwest' },
  87: { ro: 'Pacificul de Sud-Est', en: 'Pacific, Southeast' },
  88: { ro: 'Pacificul, Antarctic', en: 'Pacific, Antarctic' },
};

/** Open Food Facts label tags → designations. */
export const LABEL_TAGS = {
  'en:pdo': 'pdo', 'en:protected-designation-of-origin': 'pdo', 'fr:aop': 'pdo', 'en:dop': 'pdo',
  'en:pgi': 'pgi', 'en:protected-geographical-indication': 'pgi', 'fr:igp': 'pgi',
  'en:tsg': 'tsg', 'en:traditional-speciality-guaranteed': 'tsg',
  'en:organic': 'organic', 'en:eu-organic': 'organic', 'en:ab-agriculture-biologique': 'organic',
};
