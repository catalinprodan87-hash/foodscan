# IngrediScan

Installable web app (PWA) that checks supermarket product ingredients and flags risky additives and ingredients you want to avoid, for **food**, **cosmetics** and **household cleaning products**. Interface in **Romanian** and **English**.

> **Phase 2 of 4 – barcode scanning and product lookup.** Scan or type a barcode, or paste an ingredients list, for food, cosmetics and household cleaners. Reading ingredients from a photo (OCR) comes in phase 3.

**Live:** https://catalinprodan87-hash.github.io/foodscan/

## Features (phase 1)

- Paste ingredients text → verdict banner (not recommended / consume with care / looks fine), NOVA processing level, avoid-list hits and an expandable additive list with risk pills and reasons.
- Food additive database with 160+ E-numbers (RO + EN names, label aliases, short reasons citing EFSA, EU Regulation 1333/2008, IARC or the US FDA).
- Detects E-numbers in many written forms (`E 250`, `E-211`, `e330`, `E150d`, `E407a`, `E322(i)`), fixes common OCR errors (`E33O` → `E330`, `El50d` → `E150d`) and ignores Romanian "e 100%".
- Matches additive names (longest alias wins; `BHA`/`MSG` only as standalone capitals).
- Avoid list with presets: palm oil, glucose-fructose syrup, hydrogenated fats (on by default), added sugars, flavourings, maltodextrin, modified starch.
- NOVA estimate when no database value is available.
- RO/EN switch (default from the browser language), mobile-first, works offline once installed.

### Product types

| Type | UI label (RO / EN) | Database | What the analysis does |
|---|---|---|---|
| `food` (default) | Alimente / Food | `additives.js` | E-numbers, additive names, OFF tags, NOVA, Nutri-Score |
| `cosmetic` | Cosmetice / Cosmetics | `nonFoodIngredients.js`, domain `cosmetic` + `both` | INCI-name matching only |
| `household` | Curățenie / Cleaning | `nonFoodIngredients.js`, domain `household` + `both` | Label-name matching + "never mix" tip |

- **Auto-detection** (`detectProductType()`): INCI signals (`Aqua`, `Parfum`, `Glycerin`, `CI 7xxxx`…) → cosmetic; detergent signals (`agenți de suprafață`, `fosfonați`, `înălbitori`, `hipoclorit`, Reg. 648/2004 % bands) → household; otherwise food. E-numbers count as a food signal. The user can always override with the 3-way selector on the input screen.
- **Non-food verdict:** any high-concern ingredient → bad; any medium-concern ingredient or avoid-list hit → warn; otherwise ok. Non-food results hide the NOVA card and group ingredients by category (preservatives, fragrance allergens, UV filters…).
- **Never-mix tips:** any household product with chlorine bleach (hypochlorite, dichloroisocyanurate) or ammonia shows "never mix with other cleaners" (for chlorine: especially acids such as descalers, toilet cleaners, vinegar, or ammonia; for ammonia: especially chlorine bleach). If chlorine and an acid or ammonia are in the same product, a stronger red warning is shown instead.
- **Non-food avoid presets** (all off by default, matched by ingredient code): Fragrance / Parfum, Sulfates (SLS, SLES, ALS), Parabens, Silicones (D4, D5, D6, dimethicone), Formaldehyde releasers, Isothiazolinones (MIT, MCI/MI, BIT, OIT), Microplastics & PFAS. Only presets for the current product type are shown and checked.

### Barcode scanning and lookup (phase 2)

- **Scanner** (`src/lib/scanner.js`, lazy-loaded with the overlay): `@zxing/browser` + `@zxing/library`, EAN-13 / EAN-8 / UPC-A / UPC-E only, back camera (`facingMode: environment`), full-screen overlay with a scan frame, vibration on detection. The camera stops as soon as a code is read, when the overlay closes (✕, Escape) and when the page goes to the background. UPC-E is expanded to UPC-A before lookup.
- **Fallbacks:** camera denied / missing / busy / insecure page → RO/EN message with manual entry and "read from a photo" (`decodeImageFile`: tries the photo as-is and rotated 90°, downscaled to 1600 px). Typed codes are checked (8/12/13/14 digits + check digit).
- **Lookup** (`src/lib/lookup.js`): the chosen product type's database is queried first; with auto or no match, the others follow in the order OFF → OBF → OPF. The database that finds the product (or the product's own `product_type`) sets the product type. Each request has an 8 s `AbortController` timeout; nothing found + any failed request → "error" with a retry button, otherwise "not found".
- **Results:** product name, brand, quantity, image and barcode, a "View on Open … Facts" link, and the analysis (food also uses `additives_tags`, `nova_group`, `nutriscore_grade`). Not found or no ingredients → prompt to paste the ingredients; the barcode is kept with the analysis.
- **Offline:** Open \*Facts API responses are cached by the service worker (NetworkFirst, 14 days, 300 entries).
- **Known library issue:** `@zxing/browser` 0.2.1's `TRY_HARDER` rotation pass is broken (`HTMLCanvasElementLuminanceSource.rotate` keeps the old width/height), so it is not used; photos are rotated by the app instead.

### Barcode lookup sources

`src/data/productCategories.js` keeps one Open \*Facts source per product type. All three use the same API format, `GET {source}/api/v2/product/{barcode}.json?fields=…`:

| Type | Source |
|---|---|
| food | Open Food Facts – `https://world.openfoodfacts.org` |
| cosmetic | Open Beauty Facts – `https://world.openbeautyfacts.org` |
| household | Open Products Facts – `https://world.openproductsfacts.org` |

## Project layout

```
.
├── index.html                 # HTML entry
├── vite.config.js             # Vite + React + vite-plugin-pwa (base: './')
├── public/icons/              # App icons (SVG + PNG for the manifest)
├── src/
│   ├── main.jsx               # React entry
│   ├── App.jsx                # Screens: input ↔ result
│   ├── styles.css             # Plain CSS, teal theme, light/dark
│   ├── components/
│   │   ├── Header.jsx         # Logo + RO/EN switch
│   │   ├── Home.jsx           # Scan button (main action), manual barcode, photo, paste
│   │   ├── TypeSelector.jsx   # Alimente / Cosmetice / Curățenie selector (+ back to auto)
│   │   ├── BarcodeEntry.jsx   # Manual barcode + read from a photo
│   │   ├── ScannerOverlay.jsx # Full-screen camera scanner (lazy-loaded)
│   │   ├── ProductHeader.jsx  # Image, name, brand, barcode, Open … Facts link
│   │   ├── LookupViews.jsx    # Loading, not found, no ingredients, network error
│   │   ├── IngredientInput.jsx
│   │   ├── AvoidSettings.jsx  # Toggle avoid-list presets (per product type)
│   │   ├── Result.jsx         # Type badge, verdict, safety tip, NOVA card, avoid hits
│   │   ├── AdditiveList.jsx   # Expandable items with risk pills (grouped for non-food)
│   │   └── Disclaimer.jsx
│   ├── data/
│   │   ├── additives.js       # E-number database (food)
│   │   ├── nonFoodIngredients.js # Cosmetic + household ingredient database
│   │   ├── productCategories.js  # Product types, categories, Open *Facts sources
│   │   └── avoidPresets.js    # Avoid-list presets (RO + EN terms, codes, types)
│   └── lib/
│       ├── analyze.js         # Analysis engine (pure, runs in Node too)
│       ├── lookup.js          # Open *Facts lookup, field mapping, barcode helpers
│       ├── camera.js          # Scan formats, camera constraints, error classification
│       ├── scanner.js         # zxing camera + photo decoding (lazy-loaded)
│       ├── i18n.js            # Strings, t(), detectLang()
│       └── storage.js         # localStorage helpers (language, avoid list)
├── tests/
│   ├── analyze.test.js        # food engine, i18n, database checks
│   ├── nonfood.test.js        # non-food database checks
│   ├── producttype.test.js    # productType routing, auto-detection, non-food presets
│   └── lookup.test.js         # lookup routing (mocked fetch), field mapping, barcodes, camera errors
└── .github/workflows/deploy.yml  # Build + deploy to GitHub Pages on push to main
```

## Commands

Requires Node.js 20.19+ (CI uses Node 22).

```bash
npm install        # install dependencies
npm run dev        # dev server at http://localhost:5173
npm test           # run the tests (Node's built-in test runner)
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

## Analysis engine API

```js
import { analyze } from './src/lib/analyze.js';

const result = analyze(
  { text: 'zahăr, ulei de palmier, E150d', productType: 'food', additiveTags: ['en:e322i'], nova: null, nutriscore: null },
  { presets: { palm: true, sugar: false }, custom: [] }, // optional; defaults to preset defaults
);
// result.productType  'food' | 'cosmetic' | 'household'
// result.verdict      'bad' | 'warn' | 'ok' | 'unknown'
// result.items        matched entries (food: same array as result.additives)
// result.reasons      [{ type: 'high' | 'avoid' | 'medium' | 'nova4' | 'nutriscore', count?, grade? }]
// result.additives    food only, sorted high → medium → low → unknown → none ([] for non-food)
// result.avoidHits    [{ id, label: {en, ro}, matches: [...] }]
// result.processing   food: { nova: 1-4 | null, source: 'database' | 'estimate' | null, markers: [...] }; non-food: null
// result.counts       { high, medium, low, none, unknown, total }
// result.safetyTips   household: [{ type: 'neverMix', chlorine, partners }] or [{ type: 'mixCaution', kind: 'chlorine'|'ammonia', substances }]; otherwise []
```

Food verdict rules: any high-risk additive or avoid-list hit → **bad**; otherwise any medium additive, NOVA 4 or Nutri-Score D/E → **warn**; otherwise **ok**; no input → **unknown**. Non-food rules are under [Product types](#product-types).

## Deployment (GitHub Pages)

The workflow in `.github/workflows/deploy.yml` runs the tests, builds and deploys on every push to `main` (and can be started manually from the Actions tab).

One-time setup: in the repository go to **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.

## Disclaimer

For information only, not medical advice. All additives sold in the EU are approved and considered safe at permitted levels; cosmetics must comply with Regulation (EC) 1223/2009 and detergents with Regulation (EC) 648/2004. The ratings show which ingredients deserve extra attention.
