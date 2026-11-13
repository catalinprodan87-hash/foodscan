import { NONFOOD_INGREDIENTS } from './nonFoodIngredients.js';

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
 *   types  – product types the preset applies to (food | cosmetic | household).
 *            The UI only shows, and analyze() only checks, presets for the
 *            current product type.
 *   defaultOn – whether the preset is enabled for new users.
 */
export const AVOID_PRESETS = [
  {
    id: 'palm',
    types: ['food'],
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
    types: ['food'],
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
    types: ['food'],
    defaultOn: true,
    label: { en: 'Hydrogenated fats', ro: 'Grăsimi hidrogenate' },
    terms: [
      'hidrogenat', 'hidrogenata', 'hidrogenate', 'hidrogenati', 'hidrogenizat', 'hidrogenizata', 'hidrogenizate',
      'hydrogenated', 'hydrogenised', 'hydrogenized',
    ],
  },
  {
    id: 'sugar',
    types: ['food'],
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
    types: ['food'],
    defaultOn: false,
    label: { en: 'Flavourings', ro: 'Arome' },
    terms: [
      'aroma', 'arome', 'aromatizant', 'aromatizanti', 'aromatizanta', 'aroma naturala', 'arome naturale',
      'flavouring', 'flavourings', 'flavoring', 'flavorings', 'flavour', 'flavours', 'flavor', 'flavors',
    ],
  },
  {
    id: 'maltodextrin',
    types: ['food'],
    defaultOn: false,
    label: { en: 'Maltodextrin', ro: 'Maltodextrină' },
    terms: ['maltodextrina', 'maltodextrine', 'maltodextrin', 'maltodextrins'],
  },
  {
    id: 'modstarch',
    types: ['food'],
    defaultOn: false,
    label: { en: 'Modified starch', ro: 'Amidon modificat' },
    terms: [
      'amidon ~ modificat', 'amidon modificat', 'amidonuri modificate',
      'modified ~ starch', 'modified starch', 'modified starches',
    ],
    codes: ['E1404', 'E1410', 'E1412', 'E1413', 'E1414', 'E1420', 'E1422', 'E1440', 'E1442', 'E1450', 'E1451', 'E1452'],
  },

  // ───────────────── Non-food presets (cosmetics & household) ─────────────────
  // Matched by item code from nonFoodIngredients.js, all off by default.
  {
    id: 'fragrance',
    types: ['cosmetic', 'household'],
    defaultOn: false,
    label: { en: 'Fragrance / Parfum', ro: 'Parfum / arome parfumate' },
    terms: [],
    codes: nonFoodCodes((x) => x.code === 'PARFUM' || x.category === 'fragrance'),
  },
  {
    id: 'sulfates',
    types: ['cosmetic', 'household'],
    defaultOn: false,
    label: { en: 'Sulfates (SLS, SLES, ALS)', ro: 'Sulfați (SLS, SLES, ALS)' },
    terms: [],
    codes: ['SLS', 'SLES', 'ALS'],
  },
  {
    id: 'parabens',
    types: ['cosmetic'],
    defaultOn: false,
    label: { en: 'Parabens', ro: 'Parabeni' },
    terms: [],
    codes: nonFoodCodes((x) => x.code.endsWith('PARABEN')),
  },
  {
    id: 'silicones',
    types: ['cosmetic', 'household'],
    defaultOn: false,
    label: { en: 'Silicones (D4, D5, D6, dimethicone)', ro: 'Siliconi (D4, D5, D6, dimeticonă)' },
    terms: [],
    codes: ['D4', 'D5', 'D6', 'DIMETHICONE'],
  },
  {
    id: 'formaldehyde',
    types: ['cosmetic', 'household'],
    defaultOn: false,
    label: { en: 'Formaldehyde releasers', ro: 'Eliberatori de formaldehidă' },
    terms: [],
    codes: ['FORMALDEHYDE', 'DMDM-H', 'IMID-U', 'DIAZ-U', 'SHMG', 'BRONOPOL', 'QUAT-15'],
  },
  {
    id: 'isothiazolinones',
    types: ['cosmetic', 'household'],
    defaultOn: false,
    label: { en: 'Isothiazolinones (MIT, MCI/MI, BIT, OIT)', ro: 'Izotiazolinone (MIT, MCI/MI, BIT, OIT)' },
    terms: [],
    codes: ['MIT', 'MCI/MI', 'BIT', 'OIT'],
  },
  {
    id: 'microplastics',
    types: ['cosmetic', 'household'],
    defaultOn: false,
    label: { en: 'Microplastics & PFAS', ro: 'Microplastice și PFAS' },
    terms: [],
    codes: ['PE', 'PFAS'],
  },
];

function nonFoodCodes(filter) {
  return NONFOOD_INGREDIENTS.filter(filter).map((x) => x.code);
}

/** Presets that apply to a product type ('food' | 'cosmetic' | 'household'). */
export function presetsForType(type = 'food') {
  return AVOID_PRESETS.filter((p) => p.types.includes(type));
}

export const AVOID_PRESETS_BY_ID = Object.fromEntries(AVOID_PRESETS.map((p) => [p.id, p]));

const ALL_TYPES = ['food', 'cosmetic', 'household'];

/**
 * Custom avoid entry: { id, terms: string[], types: string[] }.
 * "soia / soy" → terms ['soia', 'soy']. Plain strings (older format) are
 * accepted and apply to every product type. Returns null if nothing usable.
 */
export function normalizeCustomEntry(entry) {
  const raw = typeof entry === 'string' ? { terms: entry } : entry;
  if (!raw || typeof raw !== 'object') return null;
  const list = Array.isArray(raw.terms) ? raw.terms : String(raw.terms ?? raw.label ?? '').split('/');
  const terms = [...new Set(list.map((t) => String(t).replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, 12);
  if (!terms.length) return null;
  const types = Array.isArray(raw.types) ? ALL_TYPES.filter((t) => raw.types.includes(t)) : [...ALL_TYPES];
  const id = typeof raw.id === 'string' && raw.id ? raw.id : `c-${terms[0].toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`;
  return { id, terms, types: types.length ? types : [...ALL_TYPES] };
}

/** Default avoid state: { presets: { [id]: boolean }, custom: CustomEntry[] } */
export function defaultAvoidState() {
  return {
    presets: Object.fromEntries(AVOID_PRESETS.map((p) => [p.id, p.defaultOn])),
    custom: [],
  };
}
