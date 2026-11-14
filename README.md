# IngrediScan

Installable web app (PWA) that checks supermarket product ingredients and flags risky additives and ingredients you want to avoid, for **food**, **cosmetics** and **household cleaning products**. Interface in **Romanian** and **English**.

> **v1.0 (phase 4 of 4).** Scan or type a barcode, photograph the ingredients list (on-device OCR), or paste it — for food, cosmetics and household cleaners. Scan history, an editable avoid list, install & update prompts.

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

- **Scanner** (`src/lib/scanner.js`, lazy-loaded): the browser's own `BarcodeDetector` where it exists (Chrome on Android – Google's detector), otherwise **ZXing-C++ compiled to WebAssembly** (`zxing-wasm`, self-hosted at `scan/zxing_reader.wasm`, 0.9 MB, precached). EAN-13 / EAN-8 / UPC-A / UPC-E. The main back lens is chosen on phones with several (ultra-wide lenses cannot focus close), with continuous autofocus, 1080p, slight zoom and a torch button. Without a native detector, frames cycle through fast / full-resolution / ±30° tilted decoding. The camera stops as soon as a code is accepted, when the overlay closes and when the page is hidden.
- **No misreads:** every code must pass its check digit; the camera needs the same code in two frames, photos need two agreeing decoding passes (`camera.js`). UPC-E is expanded to UPC-A.
- **Photos of barcodes:** native detector, then ZXing-C++ on several scales, crops, sharpened and rotated versions. Benchmark on 24 deliberately bad photos (small, tilted 40°, curved jar, blur, glare, noise, JPEG q 0.3, clutter): **23/24 read, 0 wrong** (the old zxing-js reader: 14/24). Live camera (fake-camera test, no native detector): 4/5 hard frames in 1–2 s.
- **Lookup** (`src/lib/lookup.js`): the chosen product type's database is queried first; with auto or no match, the others follow in the order OFF → OBF → OPF. The database that finds the product (or the product's own `product_type`) sets the product type. Each request has an 8 s `AbortController` timeout; nothing found + any failed request → "error" with a retry button, otherwise "not found".
- **Results:** product name, brand, quantity, image and barcode, a "View on Open … Facts" link, and the analysis (food also uses `additives_tags`, `nova_group`, `nutriscore_grade`). Not found or no ingredients → prompt to paste the ingredients; the barcode is kept with the analysis.
- **Offline:** Open \*Facts API responses are cached by the service worker (NetworkFirst, 14 days, 300 entries).

### Photo of the ingredients – on-device OCR

- **Engine:** PaddleOCR PP-OCRv4 (text detector + English/Latin recogniser, `paddle-ocr-onnx-models`) on ONNX Runtime Web (WebAssembly) in a Web Worker (`src/workers/ocrWorker.js`, maths in `src/lib/paddleCore.js`). Text lines are cut along their own angle, so tilted and curved labels read line by line. **The photo never leaves the phone.**
- **Why PaddleOCR:** benchmark on six realistic hard label photos (curved red jar with glare, small print, glossy, white-on-blue, multilingual RO/HU/BG, dim and noisy), share of key ingredients read correctly:

  | | Uncropped photo | Cropped to the label |
  |---|---|---|
  | Tesseract 5 (v1.0) | 40 % | 91 % |
  | **PaddleOCR (now)** | **94–97 %** | **98 %** |

- **Self-hosted engine** (`scripts/copy-ocr-assets.mjs`, runs before `dev` / `build`): ONNX Runtime wasm (14 MB) + detector (4.7 MB) + recogniser (7.7 MB) + character list in `public/ocr/` (git-ignored). About 25 MB once, with a real progress bar; then kept by the service worker (CacheFirst, 90 days) for offline use. Not precached.
- **Text clean-up** (`src/lib/ocrText.js`, `src/lib/lexicon.js`): section extraction from `Ingrediente:` / `Compoziție:` / `Ingredients:` / `INCI:` / `Conține:` – also badly read headings ("ngrec lente:", "…nte:", "Ingredientezahăr") – to before "Poate conține", "A se păstra" (also "ASE păstra"), nutrition tables, hazard codes or another language. A word list of ~1,200 ingredient words then fixes one-edit slips ("sore" → "sare", "posteurizat" → "pasteurizat"), splits glued words ("cacaolapte" → "cacao lapte") and restores diacritics; real words are never changed, so no additive can be invented.
- **Entry points, review and labels** as before: home button, the barcode "not found" / "no ingredients" / error screens (text attached to the barcode), crop step, editable review, "citit din fotografie" label.

### Scores explained, restrictions outside the EU (v1.2–1.3)

- **NOVA and Nutri-Score are separate cards.** They are unrelated scores (processing level vs nutritional quality); showing the Nutri-Score strip inside the NOVA card read as "NOVA 3 = E".
- **NOVA card:** "NOVA 3 of 4", a 1–4 scale, and *why* this product got its group, naming the ingredients behind it (`result.novaWhy = { rule, triggers, higherEstimate }`; rules: `plain`, `culinary_single`, `culinary_mixed`, `additives`, `markers`, `database`). If the database says a lower group than the ingredients read suggest (e.g. NOVA 1 with E224 listed), a note says so. NOVA 2 and 3 use neutral colours: they describe processing, not risk; only NOVA 4 affects the verdict.
- **Nutri-Score card:** the grade plus the facts behind it from Open Food Facts (`nutrient_levels`, `nutriments`): fat, saturated fat, sugars, salt per 100 g with low / moderate / high, and energy. When a caution comes only from Nutri-Score D/E or NOVA 4, the banner says the ingredients themselves are fine.
- **Restrictions outside the EU** (`src/data/restrictions.js`): for ingredients allowed in the EU but banned, not approved, partly banned, under an official warning or being phased out elsewhere (US federal, California, Hawaii, Canada, Japan), with the rule behind each. Examples: cyclamate E952 (US ban 1970), amaranth E123 (US ban 1976), erythrosine E127 (FDA 2025), BHA E320 and 4-MEI caramels (California Prop 65), six dyes in California school food, triclosan (FDA 2016), oxybenzone (Hawaii). Items carry `restrictions` and show a 🌍 flag with the reasons.
- **Worst risk wins (v1.3)**: each rule has a level on the app's scale (default by status: banned → high; restricted, phase-out, official warning → medium; not approved → low, since often nobody applied). An item's `level` is the worst of its EU level and every country's, with `levelSource` (`'EU'` or the region) and `euLevel` kept. Harmless in the EU but medium in Japan → "Medium · Japan"; medium in the EU but high in the US → "High · US"; medium in the EU and low elsewhere → "Medium" (EU). On a tie the EU rating is shown. The worst levels drive the counts and the verdict. Exceptions: the Hawaii sunscreen ban is set to medium (environmental reason, not a health finding); the US NTP carcinogen listing of BHA is set to high.
- **Design (v1.3)**: light, calm layout: white cards, a tinted verdict box, NOVA and Nutri-Score as two tiles side by side with a short "why", and full explanations folded below. Headings use Space Grotesk, self-hosted via `@fontsource/space-grotesk`.
- **Not authorised in the EU but used elsewhere** (may appear on imports), rated high: potassium bromate E924, brominated vegetable oil E443, azodicarbonamide E927a, propylparaben E216.

### Products without ingredients in Open Food Facts

Checked on real data: the Kaufland tomato paste 5949069402286 is in Open Food Facts with name, brand and photo, but no ingredients in any language and no photo of the ingredients panel. Of 100 recently updated Romanian products, 40 had ingredients and 60 had neither text nor an ingredients photo; none had the list only in another language. So the app makes the photo the main action on that screen, keeps the product's name, image and scores in the result, and offers "Copy the ingredients" + "Complete it on Open Food Facts" (the product's edit page) so the next person gets a result straight from the barcode.

### History, avoid list, install & polish (phase 4)

- **Istoric** (`src/lib/history.js`): every analysis is saved on the phone (IndexedDB, localStorage fallback): barcode, name, brand, image URL, product type, source (barcode / photo / paste), ingredients text, database fields (NOVA, Nutri-Score, additive tags, link), verdict, date. Last 200 kept; the same barcode (or the same text and type) replaces the older entry. Search by name / brand / barcode, filter by type and verdict. Opening an entry re-runs `analyze()` with the **current** avoid list, and the list's verdict icons follow it too. Swipe left or long-press to delete (with undo); "Șterge tot" asks first.
- **Lista mea** (`src/lib/avoidList.js`): presets grouped by product type with the types each applies to; custom entries with alternative spellings ("soia / soy") limited to chosen product types; edit / delete; "would flag N from your history" previews; export / import as JSON (`ingrediscan-avoid-list`, version 1). Older saved lists (plain strings) are upgraded automatically.
- **Install & updates:** "Instalează aplicația" button from `beforeinstallprompt` (hidden once installed); a one-time Share → Add to Home Screen hint on iPhone; service worker in **prompt** mode – a new deploy shows "Versiune nouă disponibilă — Reîncarcă" instead of reloading mid-scan (checked hourly while open).
- **Result:** ingredients text with flagged words highlighted by level (tap → jumps to and opens the explanation); "Distribuie" via the Web Share API, falling back to copying a text summary; "Adaugă produsul în Open … Facts" for barcodes the databases don't know.
- **Polish:** first-run slides (what it does, disclaimer, camera note), "Despre" page (sources, regulations cited, database review dates in `src/data/meta.js`, version), dark mode following the system with WCAG AA contrast checked by a test, offline banner, error boundary with "Reîncarcă", skip link, focus moved to each new screen's heading, labelled controls.
- **First load:** about 114 KB gzipped (HTML 0.5 + CSS 5.7 + JS 107: React ≈ 45, ingredient databases ≈ 33, translations ≈ 10, engine ≈ 9). Scanner (118 KB), OCR (≈ 8 MB, first photo only), History / List / About / first-run screens (≈ 2 KB each) load on demand.

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
├── public/ocr/, public/scan/  # Generated: self-hosted OCR and barcode engines (git-ignored)
├── src/workers/ocrWorker.js   # PaddleOCR in a Web Worker
├── scripts/copy-ocr-assets.mjs
├── src/
│   ├── main.jsx               # React entry
│   ├── App.jsx                # Screens: input ↔ result
│   ├── styles.css             # Plain CSS, teal theme, light/dark
│   ├── components/
│   │   ├── Header.jsx         # Logo + RO/EN switch
│   │   ├── TabBar.jsx         # Scanează / Istoric / Lista mea / Despre
│   │   ├── HistoryView.jsx    # History list, search, filters, swipe / long-press delete
│   │   ├── AvoidListView.jsx  # Presets per type, custom entries, export / import
│   │   ├── AboutView.jsx      # Sources, regulations, review dates, disclaimer
│   │   ├── Onboarding.jsx     # First-run slides
│   │   ├── Banners.jsx        # Update, offline, install (Android / iPhone), toast
│   │   ├── ResultExtras.jsx   # Highlighted ingredients, share, add-product links
│   │   ├── ErrorBoundary.jsx
│   │   ├── Home.jsx           # Scan button (main action), manual barcode, photo, paste
│   │   ├── TypeSelector.jsx   # Alimente / Cosmetice / Curățenie selector (+ back to auto)
│   │   ├── BarcodeEntry.jsx   # Manual barcode + read from a photo
│   │   ├── ScannerOverlay.jsx # Full-screen camera scanner (lazy-loaded)
│   │   ├── ProductHeader.jsx  # Image, name, brand, barcode, Open … Facts link
│   │   ├── LookupViews.jsx    # Loading, not found, no ingredients, network error
│   │   ├── PhotoButton.jsx    # "Fotografiază ingredientele" (camera file input)
│   │   ├── PhotoFlow.jsx      # Crop → OCR progress → review (lazy-loaded)
│   │   ├── CropBox.jsx        # Draggable / resizable crop rectangle
│   │   ├── IngredientInput.jsx
│   │   ├── AvoidSettings.jsx  # Toggle avoid-list presets (per product type)
│   │   ├── Result.jsx         # Type badge, verdict, safety tip, NOVA card, avoid hits
│   │   ├── AdditiveList.jsx   # Expandable items with risk pills (grouped for non-food)
│   │   └── Disclaimer.jsx
│   ├── data/
│   │   ├── additives.js       # E-number database (food)
│   │   ├── nonFoodIngredients.js # Cosmetic + household ingredient database
│   │   ├── meta.js            # Data sources, regulations, database review dates
│   │   ├── restrictions.js    # Restrictions outside the EU (US, California, Hawaii, Canada, Japan)
│   │   ├── productCategories.js  # Product types, categories, Open *Facts sources
│   │   └── avoidPresets.js    # Avoid-list presets (RO + EN terms, codes, types)
│   └── lib/
│       ├── analyze.js         # Analysis engine (pure, runs in Node too)
│       ├── lookup.js          # Open *Facts lookup, field mapping, barcode helpers
│       ├── camera.js          # Camera choice, misread protection, formats, camera errors
│       ├── scanner.js         # Barcode camera + photo decoding (native / ZXing-C++, lazy-loaded)
│       ├── ocr.js             # OCR engine download (progress) + Web Worker client
│       ├── paddleCore.js      # PaddleOCR maths: line boxes, CTC decoding, reading order
│       ├── lexicon.js         # Ingredient word list: OCR slip correction, diacritics
│       ├── ocrText.js         # Ingredients section extraction + OCR text cleaning
│       ├── imagePrep.js       # EXIF, crop, downscale, grayscale, contrast
│       ├── request.js         # What to analyse (paste / photo / barcode), product type
│       ├── history.js         # Scan history (IndexedDB / localStorage)
│       ├── avoidList.js       # Custom entries, export / import, previews
│       ├── share.js           # Share summary, add-product links, highlighting
│       ├── install.js, installPrompt.js, pwa.js, hooks.js  # install / update / online
│       ├── i18n.js            # Strings, t(), detectLang()
│       └── storage.js         # localStorage helpers (language, avoid list)
├── tests/
│   ├── analyze.test.js        # food engine, i18n, database checks
│   ├── nonfood.test.js        # non-food database checks
│   ├── producttype.test.js    # productType routing, auto-detection, non-food presets
│   ├── lookup.test.js         # lookup routing (mocked fetch), field mapping, barcodes, camera errors
│   ├── ocr.test.js            # label text extraction, merge into barcode results, mocked OCR worker, PaddleOCR maths, word correction
│   ├── phase4.test.js         # history, avoid list import/export & per-type entries, highlighting, share, install, contrast
│   ├── scan.test.js           # camera choice, misread protection, barcode format names
│   └── scores.test.js         # NOVA explanations, Nutri-Score facts, restrictions outside the EU
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
