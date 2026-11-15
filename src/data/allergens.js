/**
 * The 14 allergens that EU law requires food labels to emphasise
 * (Regulation (EU) No 1169/2011, Annex II), with the words used for them on
 * Romanian and English labels – plus the commonest French and German ones
 * (imported products, or a foreign text in the Romanian field). Shown as INFORMATION only – the app never says
 * a product is free of an allergen: OCR can miss a word, and the label (where
 * allergens are printed in bold) is the reference.
 *
 *   terms       matched as whole words on normalised text (lowercase, no diacritics)
 *   notAfter    the term does not count when followed by these words
 *               ("unt de cacao" is not dairy butter)
 *   notBefore   …or preceded by these (Annex II exemptions, e.g. glucose syrup
 *               made from wheat does not have to be declared as gluten)
 *   codes       additives that are this allergen (sulphites E220–E228)
 *   off         Open Food Facts allergen / traces tags for the group
 */
const NOT_DAIRY_AFTER = ['de cacao', 'de shea', 'de karite', 'de arahide', 'de cocos', 'de migdale', 'de soia', 'de ovaz', 'de orez', 'vegetal', 'vegetala', 'vegetale'];

export const ALLERGENS = [
  {
    id: 'gluten',
    name: { ro: 'cereale cu gluten', en: 'cereals containing gluten' },
    short: { ro: 'gluten', en: 'gluten' },
    terms: ['gluten', 'grau', 'graului', 'grau dur', 'secara', 'secarei', 'orz', 'orzului', 'ovaz', 'ovazului', 'spelt', 'alac', 'kamut', 'triticale', 'gris', 'malt de orz', 'tarate de grau', 'wheat', 'rye', 'barley', 'oats', 'oat', 'ble', 'froment', 'seigle', 'orge', 'avoine', 'epeautre', 'weizen', 'roggen', 'gerste', 'hafer', 'dinkel'],
    notBefore: ['sirop de glucoza', 'sirop de glucoza-fructoza', 'glucoza', 'dextroza', 'maltodextrina', 'glucose syrup', 'dextrose', 'maltodextrin'],
    notAfter: [],
    off: ['en:gluten'],
  },
  {
    id: 'crustaceans',
    name: { ro: 'crustacee', en: 'crustaceans' },
    short: { ro: 'crustacee', en: 'crustaceans' },
    terms: ['crustacee', 'creveti', 'crevete', 'crab', 'crabi', 'homar', 'langustine', 'raci', 'shrimp', 'shrimps', 'prawn', 'prawns', 'lobster', 'crustaceans'],
    off: ['en:crustaceans'],
  },
  {
    id: 'eggs',
    name: { ro: 'ouă', en: 'eggs' },
    short: { ro: 'ouă', en: 'eggs' },
    terms: ['ou', 'oua', 'ouale', 'albus', 'albus de ou', 'galbenus', 'galbenus de ou', 'praf de ou', 'ou praf', 'oua praf', 'albumina de ou', 'egg', 'eggs', 'egg white', 'egg yolk', 'oeuf', 'oeufs', 'jaune d oeuf', 'ei', 'eier', 'eigelb'],
    off: ['en:eggs'],
  },
  {
    id: 'fish',
    name: { ro: 'pește', en: 'fish' },
    short: { ro: 'pește', en: 'fish' },
    // "peste" alone also means "over" in Romanian ("peste 18 luni"), so only clear forms.
    terms: ['de peste', 'peste oceanic', 'fileu de peste', 'file de peste', 'pestelui', 'ton', 'somon', 'file de cod', 'cod de atlantic', 'cod atlantic', 'hering', 'macrou', 'sardine', 'sardina', 'hamsii', 'ansoa', 'anchois', 'pastrav', 'merluciu', 'fish', 'tuna', 'salmon', 'anchovies', 'mackerel', 'poisson', 'thon', 'saumon', 'fisch'],
    off: ['en:fish'],
  },
  {
    id: 'peanuts',
    name: { ro: 'arahide', en: 'peanuts' },
    short: { ro: 'arahide', en: 'peanuts' },
    terms: ['arahide', 'arahida', 'alune de pamant', 'unt de arahide', 'peanut', 'peanuts', 'groundnut', 'groundnuts', 'arachide', 'arachides', 'erdnuss', 'erdnusse'],
    off: ['en:peanuts'],
  },
  {
    id: 'soy',
    name: { ro: 'soia', en: 'soybeans' },
    short: { ro: 'soia', en: 'soy' },
    terms: ['soia', 'soy', 'soya', 'soja', 'soybean', 'soybeans', 'boabe de soia', 'lecitina de soia', 'lecitine de soia'],
    // Annex II exempts fully refined soybean oil and fat.
    notAfter: [],
    notBefore: ['ulei de', 'ulei rafinat de', 'grasime de', 'oil'],
    off: ['en:soybeans'],
  },
  {
    id: 'milk',
    name: { ro: 'lapte (inclusiv lactoză)', en: 'milk (including lactose)' },
    short: { ro: 'lapte', en: 'milk' },
    terms: ['lapte', 'laptelui', 'lapte praf', 'lactoza', 'lactoză', 'cazeina', 'cazeinat', 'cazeinat de sodiu', 'zer', 'zer praf', 'proteine din lapte', 'smantana', 'frisca', 'unt', 'branza', 'branzeturi', 'cascaval', 'iaurt', 'chefir', 'mascarpone', 'ricotta', 'mozzarella', 'parmezan', 'milk', 'lactose', 'whey', 'casein', 'caseinate', 'butter', 'cream', 'cheese', 'yoghurt', 'yogurt', 'lait', 'lactoserum', 'beurre', 'creme', 'fromage', 'milch', 'milchpulver', 'molke', 'sahne', 'kase'],
    notAfter: NOT_DAIRY_AFTER,
    off: ['en:milk'],
  },
  {
    id: 'nuts',
    name: { ro: 'fructe cu coajă lemnoasă', en: 'tree nuts' },
    short: { ro: 'fructe cu coajă', en: 'tree nuts' },
    terms: ['migdale', 'migdala', 'alune', 'alune de padure', 'nuci', 'nuca', 'caju', 'fistic', 'nuci pecan', 'pecan', 'nuci braziliene', 'macadamia', 'almond', 'almonds', 'hazelnut', 'hazelnuts', 'walnut', 'walnuts', 'cashew', 'cashews', 'pistachio', 'pistachios', 'nuts', 'noisette', 'noisettes', 'amande', 'amandes', 'noix', 'haselnuss', 'haselnusse', 'mandeln', 'walnusse'],
    // Peanuts are their own group; coconut is not on the Annex II list.
    notAfter: ['de pamant', 'de cocos', 'cocos'],
    off: ['en:nuts'],
  },
  {
    id: 'celery',
    name: { ro: 'țelină', en: 'celery' },
    short: { ro: 'țelină', en: 'celery' },
    terms: ['telina', 'telinei', 'celery', 'celeriac', 'celeri', 'sellerie'],
    off: ['en:celery'],
  },
  {
    id: 'mustard',
    name: { ro: 'muștar', en: 'mustard' },
    short: { ro: 'muștar', en: 'mustard' },
    terms: ['mustar', 'mustarului', 'seminte de mustar', 'mustard', 'moutarde', 'senf'],
    off: ['en:mustard'],
  },
  {
    id: 'sesame',
    name: { ro: 'semințe de susan', en: 'sesame seeds' },
    short: { ro: 'susan', en: 'sesame' },
    terms: ['susan', 'seminte de susan', 'tahini', 'sesame', 'sesam'],
    off: ['en:sesame-seeds'],
  },
  {
    id: 'sulphites',
    name: { ro: 'dioxid de sulf și sulfiți (peste 10 mg/kg)', en: 'sulphur dioxide and sulphites (over 10 mg/kg)' },
    short: { ro: 'sulfiți', en: 'sulphites' },
    terms: ['sulfiti', 'sulfit', 'dioxid de sulf', 'metabisulfit', 'bisulfit', 'sulphites', 'sulfites', 'sulphite', 'sulphur dioxide'],
    codes: ['E220', 'E221', 'E222', 'E223', 'E224', 'E225', 'E226', 'E227', 'E228'],
    // Caramel colours made with sulphites (E150b, E150d) do not have to be declared as sulphites.
    notBefore: ['caramel', 'caramel cu', 'caramel amoniacal', 'caramel caustic'],
    off: ['en:sulphur-dioxide-and-sulphites'],
  },
  {
    id: 'lupin',
    name: { ro: 'lupin', en: 'lupin' },
    short: { ro: 'lupin', en: 'lupin' },
    terms: ['lupin', 'lupine', 'faina de lupin'],
    off: ['en:lupin'],
  },
  {
    id: 'molluscs',
    name: { ro: 'moluște', en: 'molluscs' },
    short: { ro: 'moluște', en: 'molluscs' },
    terms: ['moluste', 'molusce', 'midii', 'scoici', 'stridii', 'calamar', 'calamari', 'sepie', 'caracatita', 'melci', 'mussels', 'squid', 'octopus', 'oysters', 'clams', 'molluscs'],
    off: ['en:molluscs'],
  },
];

export const ALLERGENS_BY_ID = Object.fromEntries(ALLERGENS.map((a) => [a.id, a]));
