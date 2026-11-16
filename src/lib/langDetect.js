/**
 * Language of an ingredients text (v3.6): common label words and letters
 * that only some languages use. Pure, unit-tested.
 */

const WORDS = {
  ro: 'ingrediente si de din cu zahar zahăr faina făină ulei sare apa apă lapte poate contine conține urme emulsifiant emulgator arome aroma praf grasime grăsime amidon acid',
  en: 'ingredients and of with sugar flour oil salt water milk may contain traces emulsifier flavouring flavourings powder starch acid vegetable wheat',
  fr: 'ingrédients ingredients et de du des avec sucre farine huile sel eau lait peut contenir traces émulsifiant arôme arômes poudre amidon acide blé',
  de: 'zutaten und mit zucker weizenmehl mehl öl salz wasser milch kann spuren enthalten emulgator aroma aromen pulver stärke säure',
  it: 'ingredienti e di con zucchero farina olio sale acqua latte può contenere tracce emulsionante aroma aromi polvere amido acido grano',
  es: 'ingredientes y de con azúcar harina aceite sal agua leche puede contener trazas emulgente aroma aromas polvo almidón ácido trigo',
  pt: 'ingredientes e de com açúcar farinha óleo sal água leite pode conter emulsionante aroma amido ácido trigo',
  nl: 'ingrediënten en van met suiker bloem olie zout water melk kan sporen bevatten emulgator aroma zetmeel zuur tarwe',
  pl: 'składniki i z cukier mąka olej sól woda mleko może zawierać emulgator aromat aromaty proszku skrobia kwas pszenna',
  hu: 'összetevők és cukor liszt olaj só víz tej tartalmazhat emulgeálószer aroma por keményítő sav búza',
  cs: 'složení cukr mouka olej sůl voda mléko může obsahovat emulgátor aroma prášek škrob kyselina pšeničná',
  sk: 'zloženie cukor múka olej soľ voda mlieko môže obsahovať emulgátor aróma prášok škrob kyselina pšeničná',
  hr: 'sastojci i šećer brašno ulje sol voda mlijeko može sadržavati emulgator aroma prah škrob kiselina pšenično',
  sl: 'sestavine in sladkor moka olje sol voda mleko lahko vsebuje emulgator aroma škrob kislina',
  bg: 'съставки и захар брашно олио сол вода мляко може да съдържа емулгатор аромат прах нишесте киселина',
  ru: 'состав и сахар мука масло соль вода молоко может содержать эмульгатор ароматизатор крахмал кислота',
  uk: 'склад і цукор борошно олія сіль вода молоко може містити емульгатор ароматизатор крохмаль кислота',
  el: 'συστατικά και ζάχαρη αλεύρι λάδι αλάτι νερό γάλα μπορεί να περιέχει γαλακτωματοποιητής άρωμα άμυλο οξύ',
};
const LEX = Object.fromEntries(Object.entries(WORDS).map(([l, w]) => [l, new Set(w.split(' '))]));

// Letters that point to a language (lower case).
const LETTERS = { ro: /[ășțşţ]/g, hu: /[őű]/g, pl: /[łąęńśźż]/g, cs: /[řůě]/g, sk: /[ľĺŕô]/g, de: /ß/g, hr: /[đ]/g, uk: /[іїєґ]/g, bg: /[ъщ]/g };

/**
 * @returns {{lang: string|null, confidence: number, scores: Record<string, number>}}
 *   lang null when the text is too short or no language stands out
 */
export function detectLanguage(text) {
  const t = String(text || '').toLowerCase();
  const words = t.match(/[\p{L}]+/gu) || [];
  if (words.length < 3) return { lang: null, confidence: 0, scores: {} };
  const scores = {};
  for (const [l, set] of Object.entries(LEX)) scores[l] = words.filter((w) => set.has(w)).length;
  for (const [l, re] of Object.entries(LETTERS)) scores[l] = (scores[l] || 0) + Math.min(5, (t.match(re) || []).length * 0.5);
  // Script: Cyrillic / Greek letters rule out the Latin-script languages.
  const cyr = (t.match(/[Ѐ-ӿ]/g) || []).length;
  const grk = (t.match(/[Ͱ-Ͽ]/g) || []).length;
  const latin = (t.match(/[a-z]/g) || []).length;
  if (cyr > latin) for (const l of Object.keys(scores)) if (!['bg', 'ru', 'uk'].includes(l)) scores[l] = 0;
  if (grk > latin) for (const l of Object.keys(scores)) if (l !== 'el') scores[l] = 0;
  if (cyr > latin && !scores.bg && !scores.ru && !scores.uk) scores.bg = 0.5; // Cyrillic on a Romanian-market label: usually Bulgarian
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  if (!best || best[1] < 1.5 || best[1] - (second?.[1] || 0) < 0.5) return { lang: null, confidence: 0, scores };
  return { lang: best[0], confidence: Math.min(1, (best[1] - (second?.[1] || 0)) / 4), scores };
}

export const LANGUAGE_NAMES = {
  ro: { ro: 'română', en: 'Romanian' }, en: { ro: 'engleză', en: 'English' }, fr: { ro: 'franceză', en: 'French' },
  de: { ro: 'germană', en: 'German' }, it: { ro: 'italiană', en: 'Italian' }, es: { ro: 'spaniolă', en: 'Spanish' },
  pt: { ro: 'portugheză', en: 'Portuguese' }, nl: { ro: 'neerlandeză', en: 'Dutch' }, pl: { ro: 'poloneză', en: 'Polish' },
  hu: { ro: 'maghiară', en: 'Hungarian' }, cs: { ro: 'cehă', en: 'Czech' }, sk: { ro: 'slovacă', en: 'Slovak' },
  hr: { ro: 'croată', en: 'Croatian' }, sl: { ro: 'slovenă', en: 'Slovenian' }, bg: { ro: 'bulgară', en: 'Bulgarian' },
  ru: { ro: 'rusă', en: 'Russian' }, uk: { ro: 'ucraineană', en: 'Ukrainian' }, el: { ro: 'greacă', en: 'Greek' },
};
