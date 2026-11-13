/** Minimal i18n for IngrediScan (Romanian + English). */

export const LANGS = ['ro', 'en'];

const STRINGS = {
  en: {
    appName: 'IngrediScan',
    tagline: 'Check supermarket ingredients for risky additives',
    langLabel: 'Language',
    inputTitle: 'Paste the ingredients',
    inputHint: 'Copy the ingredients list from the label or an online shop and paste it here.',
    inputPlaceholder: 'e.g. Sugar, palm oil, wheat flour, emulsifier: soy lecithin (E322), colour: E150d, preservative: sodium benzoate…',
    analyze: 'Analyse',
    example: 'Try an example',
    clear: 'Clear',
    back: 'New check',
    avoidSettings: 'My avoid list',
    avoidSettingsHint: 'Ingredients you want to be warned about.',

    verdict_bad: 'Not recommended',
    verdict_warn: 'Consume with care',
    verdict_ok: 'Looks fine',
    verdict_unknown: 'Not enough information',
    verdictSub_bad: 'Contains ingredients that deserve attention.',
    verdictSub_warn: 'Some ingredients deserve a closer look.',
    verdictSub_ok: 'No risky additives or ingredients from your avoid list were found.',
    verdictSub_unknown: 'Paste an ingredients list to get a result.',

    reason_high: '{count} high-risk additive(s)',
    reason_avoid: '{count} ingredient(s) from your avoid list',
    reason_medium: '{count} additive(s) worth limiting',
    reason_nova4: 'Ultra-processed food (NOVA 4)',
    reason_nutriscore: 'Nutri-Score {grade}',

    processing: 'Processing level',
    novaEstimated: 'estimated from ingredients',
    novaDatabase: 'from database',
    nova_1: 'Unprocessed or minimally processed',
    nova_2: 'Processed culinary ingredient',
    nova_3: 'Processed food',
    nova_4: 'Ultra-processed food',
    nova_null: 'Unknown',
    novaMarkers: 'Signs of ultra-processing:',

    avoidTitle: 'From your avoid list',
    avoidNone: 'Nothing from your avoid list.',
    additivesTitle: 'Additives',
    additivesNone: 'No additives found.',
    foundAs: 'Found as',
    unknownAdditive: 'Not in our database yet',

    level_high: 'High risk',
    level_medium: 'Limit',
    level_low: 'Low risk',
    level_none: 'Harmless',
    level_unknown: 'Unknown',

    cat_colour: 'Colour',
    cat_preservative: 'Preservative',
    cat_antioxidant: 'Antioxidant',
    cat_sweetener: 'Sweetener',
    cat_emulsifier: 'Emulsifier',
    cat_thickener: 'Thickener',
    cat_enhancer: 'Flavour enhancer',
    cat_acid: 'Acid / regulator',
    cat_other: 'Other',

    disclaimer: 'For information only, not medical advice. All additives sold in the EU are approved and considered safe at permitted levels; ratings here show which ones deserve extra attention.',
    footerSources: 'Sources: EFSA, EU Regulation 1333/2008, IARC, US FDA.',
  },
  ro: {
    appName: 'IngrediScan',
    tagline: 'Verifică ingredientele produselor din supermarket',
    langLabel: 'Limba',
    inputTitle: 'Lipește lista de ingrediente',
    inputHint: 'Copiază lista de ingrediente de pe etichetă sau dintr-un magazin online și lipește-o aici.',
    inputPlaceholder: 'ex. Zahăr, ulei de palmier, făină de grâu, emulgator: lecitină din soia (E322), colorant: E150d, conservant: benzoat de sodiu…',
    analyze: 'Analizează',
    example: 'Încearcă un exemplu',
    clear: 'Șterge',
    back: 'Verificare nouă',
    avoidSettings: 'Lista mea de evitat',
    avoidSettingsHint: 'Ingrediente despre care vrei să fii avertizat.',

    verdict_bad: 'Nerecomandat',
    verdict_warn: 'Consumă cu moderație',
    verdict_ok: 'Pare în regulă',
    verdict_unknown: 'Informații insuficiente',
    verdictSub_bad: 'Conține ingrediente care merită atenție.',
    verdictSub_warn: 'Unele ingrediente merită o privire mai atentă.',
    verdictSub_ok: 'Nu am găsit aditivi riscanți sau ingrediente din lista ta de evitat.',
    verdictSub_unknown: 'Lipește o listă de ingrediente pentru a vedea rezultatul.',

    reason_high: '{count} aditiv(i) cu risc ridicat',
    reason_avoid: '{count} ingredient(e) din lista ta de evitat',
    reason_medium: '{count} aditiv(i) de limitat',
    reason_nova4: 'Aliment ultraprocesat (NOVA 4)',
    reason_nutriscore: 'Nutri-Score {grade}',

    processing: 'Nivel de procesare',
    novaEstimated: 'estimat din ingrediente',
    novaDatabase: 'din baza de date',
    nova_1: 'Neprocesat sau minim procesat',
    nova_2: 'Ingredient culinar procesat',
    nova_3: 'Aliment procesat',
    nova_4: 'Aliment ultraprocesat',
    nova_null: 'Necunoscut',
    novaMarkers: 'Semne de ultraprocesare:',

    avoidTitle: 'Din lista ta de evitat',
    avoidNone: 'Nimic din lista ta de evitat.',
    additivesTitle: 'Aditivi',
    additivesNone: 'Nu am găsit aditivi.',
    foundAs: 'Găsit ca',
    unknownAdditive: 'Nu este încă în baza noastră de date',

    level_high: 'Risc ridicat',
    level_medium: 'De limitat',
    level_low: 'Risc scăzut',
    level_none: 'Inofensiv',
    level_unknown: 'Necunoscut',

    cat_colour: 'Colorant',
    cat_preservative: 'Conservant',
    cat_antioxidant: 'Antioxidant',
    cat_sweetener: 'Îndulcitor',
    cat_emulsifier: 'Emulgator',
    cat_thickener: 'Agent de îngroșare',
    cat_enhancer: 'Potențiator de aromă',
    cat_acid: 'Acid / corector de aciditate',
    cat_other: 'Altele',

    disclaimer: 'Doar în scop informativ, nu reprezintă sfat medical. Toți aditivii comercializați în UE sunt aprobați și considerați siguri la nivelurile permise; evaluările de aici arată care merită o atenție sporită.',
    footerSources: 'Surse: EFSA, Regulamentul UE 1333/2008, IARC, FDA (SUA).',
  },
};

/** Translate `key` into `lang`, replacing {placeholders} from `params`. */
export function t(lang, key, params) {
  const dict = STRINGS[lang] || STRINGS.en;
  let s = dict[key] ?? STRINGS.en[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
  return s;
}

/** Pick the right language from a {en, ro} object. */
export function pick(obj, lang) {
  if (!obj) return '';
  return obj[lang] ?? obj.en ?? '';
}

/**
 * Default language from the browser: Romanian if the user's preferred
 * languages put Romanian before English, otherwise English.
 */
export function detectLang(nav = typeof navigator !== 'undefined' ? navigator : undefined) {
  const list = [...(nav?.languages || []), nav?.language].filter(Boolean);
  for (const l of list) {
    const code = String(l).toLowerCase().slice(0, 2);
    if (code === 'ro' || code === 'mo') return 'ro';
    if (code === 'en') return 'en';
  }
  return 'en';
}

export { STRINGS };
