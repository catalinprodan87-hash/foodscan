# IngrediScan

Installable web app (PWA) that checks supermarket product ingredients and flags risky additives and ingredients you want to avoid, for **food**, **cosmetics** and **household cleaning products**. Interface in **Romanian** and **English**.

> **Phase 1 of 4 – foundation.** Paste an ingredients list and get a verdict. Camera, barcode scanning and OCR come in later phases.
> Phase 1 has been extended from food-only to three product types: food, cosmetics and household cleaners.

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
- **Never-mix tip:** a household product containing chlorine bleach (hypochlorite, dichloroisocyanurate) together with an acid (incl. citric acid, vinegar) or ammonia shows a fixed safety warning.
- **Non-food avoid presets** (all off by default, matched by ingredient code): Fragrance / Parfum, Sulfates (SLS, SLES, ALS), Parabens, Silicones (D4, D5, D6, dimethicone), Formaldehyde releasers, Isothiazolinones (MIT, MCI/MI, BIT, OIT), Microplastics & PFAS. Only presets for the current product type are shown and checked.

### Barcode lookup sources (planned)

`src/data/productCategories.js` keeps one Open \*Facts source per product type for the barcode-lookup phase. All three use the same API format, `GET {source}/api/v2/product/{barcode}.json`:

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
│   │   ├── TypeSelector.jsx   # Alimente / Cosmetice / Curățenie selector
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
│       ├── i18n.js            # Strings, t(), detectLang()
│       └── storage.js         # localStorage helpers (language, avoid list)
├── tests/
│   ├── analyze.test.js        # food engine, i18n, database checks
│   ├── nonfood.test.js        # non-food database checks
│   └── producttype.test.js    # productType routing, auto-detection, non-food presets
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
// result.safetyTips   household: [{ type: 'neverMix', chlorine: [...], partners: [...] }]; otherwise []
```

Food verdict rules: any high-risk additive or avoid-list hit → **bad**; otherwise any medium additive, NOVA 4 or Nutri-Score D/E → **warn**; otherwise **ok**; no input → **unknown**. Non-food rules are under [Product types](#product-types).

## Deployment (GitHub Pages)

The workflow in `.github/workflows/deploy.yml` runs the tests, builds and deploys on every push to `main` (and can be started manually from the Actions tab).

One-time setup: in the repository go to **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.

## Disclaimer

For information only, not medical advice. All additives sold in the EU are approved and considered safe at permitted levels; cosmetics must comply with Regulation (EC) 1223/2009 and detergents with Regulation (EC) 648/2004. The ratings show which ingredients deserve extra attention.
