/**
 * Avoid-list presets. Each preset is matched against the normalised
 * ingredients text (lowercase, no diacritics) with whole-word boundaries.
 *
 *   terms  – RO + EN phrases. Whitespace matches any whitespace, a hyphen
 *            matches an optional hyphen/space. The token "~" stands for
 *            "up to three words in between" (e.g. "amidon ~ modificat"
 *            also matches "amidon de porumb modificat").
 *   codes  – optional E-numbers that also count as a hit (e.g. modified
 *            starches E14xx for the "modified starch" preset).
 *   defaultOn – whether the preset is enabled for new users.
 */
export const AVOID_PRESETS = [
  {
    id: 'palm',
    defaultOn: true,
    label: { en: 'Palm oil', ro: 'Ulei de palmier' },
    terms: [
      'ulei de palmier', 'grasime de palmier', 'grasimi de palmier', 'ulei de palmist', 'grasime vegetala de palmier',
      'grasimi vegetale de palmier', 'ulei vegetal de palmier', 'stearina de palmier', 'oleina de palmier',
      'palmier', 'palmist', 'palmieri',
      'palm', 'palm oil', 'palm fat', 'palm kernel', 'palm olein', 'palm stearin', 'palmolein',
      'elaeis guineensis',
    ],
  },
  {
    id: 'gfs',
    defaultOn: true,
    label: { en: 'Glucose-fructose syrup', ro: 'Sirop de glucoză-fructoză' },
    terms: [
      'sirop de glucoza-fructoza', 'sirop de fructoza-glucoza', 'sirop de glucoza si fructoza',
      'sirop de porumb bogat in fructoza', 'izoglucoza',
      'glucose-fructose syrup', 'fructose-glucose syrup', 'high fructose corn syrup',
      'high-fructose corn syrup', 'isoglucose', 'HFCS',
    ],
  },
  {
    id: 'hydrogenated',
    defaultOn: true,
    label: { en: 'Hydrogenated fats', ro: 'Grăsimi hidrogenate' },
    terms: [
      'hidrogenat', 'hidrogenata', 'hidrogenate', 'hidrogenati', 'hidrogenizat', 'hidrogenizata', 'hidrogenizate',
      'hydrogenated', 'hydrogenised', 'hydrogenized',
    ],
  },
  {
    id: 'sugar',
    defaultOn: false,
    label: { en: 'Added sugars', ro: 'Zaharuri adăugate' },
    terms: [
      'zahar', 'zaharuri', 'zahar brun', 'zahar din trestie', 'zahar invertit', 'zaharoza',
      'sirop de glucoza', 'sirop de zahar', 'sirop de fructoza', 'sirop de porumb', 'sirop de agave',
      'glucoza', 'fructoza', 'dextroza', 'melasa',
      'sugar', 'sugars', 'cane sugar', 'brown sugar', 'invert sugar', 'sucrose',
      'glucose syrup', 'glucose', 'fructose', 'dextrose', 'corn syrup', 'molasses', 'agave syrup',
    ],
  },
  {
    id: 'flavourings',
    defaultOn: false,
    label: { en: 'Flavourings', ro: 'Arome' },
    terms: [
      'aroma', 'arome', 'aromatizant', 'aromatizanti', 'aromatizanta', 'aroma naturala', 'arome naturale',
      'flavouring', 'flavourings', 'flavoring', 'flavorings', 'flavour', 'flavours', 'flavor', 'flavors',
    ],
  },
  {
    id: 'maltodextrin',
    defaultOn: false,
    label: { en: 'Maltodextrin', ro: 'Maltodextrină' },
    terms: ['maltodextrina', 'maltodextrine', 'maltodextrin', 'maltodextrins'],
  },
  {
    id: 'modstarch',
    defaultOn: false,
    label: { en: 'Modified starch', ro: 'Amidon modificat' },
    terms: [
      'amidon ~ modificat', 'amidon modificat', 'amidonuri modificate',
      'modified ~ starch', 'modified starch', 'modified starches',
    ],
    codes: ['E1404', 'E1410', 'E1412', 'E1413', 'E1414', 'E1420', 'E1422', 'E1440', 'E1442', 'E1450', 'E1451', 'E1452'],
  },
];

export const AVOID_PRESETS_BY_ID = Object.fromEntries(AVOID_PRESETS.map((p) => [p.id, p]));

/** Default avoid state: { presets: { [id]: boolean }, custom: string[] } */
export function defaultAvoidState() {
  return {
    presets: Object.fromEntries(AVOID_PRESETS.map((p) => [p.id, p.defaultOn])),
    custom: [],
  };
}
