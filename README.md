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
- **Lookup** (`src/lib/lookup.js`): the chosen product type's database is queried first; with auto or no match, the others follow in the order OFF → OBF → OPF. The database that finds the product (or the product's own `product_type`) sets the product type. Each request has an 8 s `AbortController` timeout; nothing found + any failed request → "error" with a retry button, otherwise "not found". Quick answers keep the one-by-one order; if a database has not answered within 1.5 s, the remaining ones are asked in parallel (a hanging server costs about one timeout instead of three), and a match in a higher-priority database still wins. "Not found" is remembered for 24 h (`createNotFoundCache`); **Caută din nou** asks again. EAN-13 codes 20–29 (printed by the shop for weighed / packed products) are not looked up: the app explains and offers photo / paste, remembered for the code.
- **Results:** product name, brand, quantity, image and barcode, a "View on Open … Facts" link, and the analysis (food also uses `additives_tags`, `nova_group`, `nutriscore_grade`). Not found or no ingredients → prompt to paste the ingredients; the barcode is kept with the analysis.
- **Offline:** Open \*Facts API responses are cached by the service worker (NetworkFirst, 14 days, 300 entries).

### Photo of the ingredients – on-device OCR

- **Engine:** PaddleOCR PP-OCRv4 (text detector + English/Latin recogniser, `paddle-ocr-onnx-models`) on ONNX Runtime Web (WebAssembly) in a Web Worker (`src/workers/ocrWorker.js`, maths in `src/lib/paddleCore.js`). Text lines are cut along their own angle, so tilted and curved labels read line by line. **The photo never leaves the phone.**
- **Automatic orientation (v2.2):** photos saved sideways or upside down without an EXIF tag are turned upright before the crop step. On a 960 px copy the detector finds the text; if most line-shaped text is steep, the photo is sideways (turn 90°). PaddleOCR's direction classifier (`cls.onnx`, 0.6 MB) then votes 0° / 180° on short pieces of the main lines (`lineSegments`: whole long lines squeezed into its 192 × 48 input are unreadable). When it is unsure (< 0.75), the same pieces are read both ways and the reading with known words wins (`src/lib/orientation.js`). Runs while the crop step is shown; ignored after 3 s, or once you rotate or start reading; **⟳ Rotește** always overrides. Benchmark: 48/48 rotated images turned correctly, 0.2–1.0 s on a desktop CPU.
- **Crop suggestion (v2.3):** after the orientation check, the crop box is placed on the ingredients list. Lines are detected on a 1280 px scale and grouped into paragraphs (`clusterBlocks`); the start of each line is read (≤ 30 short reads) to find a heading – Romanian first, then English, INCI, "Conține:" – and the box frames that paragraph from the heading down (`src/lib/cropSuggest.js`). Applied whenever it arrives, unless you already moved the box or started reading. Benchmark: ≥ 95% of the ingredients inside the box on 10/12 images (the misses are the curved jar and bottle), median 1.5 s on a desktop CPU.
- **Several photos of one label (v2.4):** for jars and bottles, the review step offers **Adaugă o fotografie (continuarea textului)** – up to 3 photos. Each extra photo is turned upright, cropped when a heading is found, and read; the texts are merged (`mergeOcrTexts` in `src/lib/ocrText.js`) on letters and digits only (OCR glues words differently in each photo): as a continuation (the second text starts where the first ends) or side by side (text running round a jar: each photo holds part of every line, joined line by line); with nothing in common the text is appended after "…". Benchmark pair (a jar label from two sides): 55% / 45% of the key words alone, 100% merged.
- **Romanian word list from real labels (v2.4):** `scripts/build-corpus.mjs` collects Romanian ingredient lists from Open Food Facts (ODbL, polite rate) into `bench/corpus/ro-ingredients.jsonl`; `scripts/build-lexicon.mjs` turns the words seen ≥ 3 times into `src/data/lexicon-ro.js` (spelling with diacritics preferred), added to the clean-up word list. 474 lists, 615 words (220 with diacritics) in this release. Ties between equally near words go to the hand-made list, then to the more frequent word ("sore" → "sare", not "soare"); inflected forms are never cut back to the base word ("copți" stays, never "copt"). Tested on the corpus: diacritics restored on ≥ 98% of words; real words are never turned into additive names (only typos are fixed, e.g. "tecoferol" → "tocoferol").
- **Words to check (v2.3):** the recogniser's per-letter confidence marks words it was unsure about (weakest letter < 0.75); the review step lists the ones still in the text as chips – tap one to select it. Benchmark: 74% of misread words flagged, 7% of correct words.
- **Second chance for weak reads (v2.2):** a read with low confidence, almost no text, or no ingredients heading and few known words is read again: upside down (only if the orientation could not be checked), then with the text detector enlarged up to 2× (only crops and photos ≤ 1600 px – on whole photos it tripled the time for nothing). The better reading wins (`src/lib/readPhoto.js`). Benchmark: cropped phone photos 85.4% → 93.1% key words.
- **Why PaddleOCR:** benchmark on six realistic hard label photos (curved red jar with glare, small print, glossy, white-on-blue, multilingual RO/HU/BG, dim and noisy), share of key ingredients read correctly:

  | | Uncropped photo | Cropped to the label |
  |---|---|---|
  | Tesseract 5 (v1.0) | 40 % | 91 % |
  | **PaddleOCR (now)** | **94–97 %** | **98 %** |

- **Self-hosted engine** (`scripts/copy-ocr-assets.mjs`, runs before `dev` / `build`): ONNX Runtime wasm (14 MB) + detector (4.7 MB) + recogniser (7.7 MB) + character list in `public/ocr/` (git-ignored). About 25 MB once, with a real progress bar; then kept by the service worker (CacheFirst, 90 days) for offline use. Not precached.
- **Text clean-up** (`src/lib/ocrText.js`, `src/lib/lexicon.js`): section extraction from `Ingrediente:` / `Compoziție:` / `Ingredients:` / `INCI:` / `Conține:` – also badly read headings ("ngrec lente:", "…nte:", "Ingredientezahăr") – to before "Poate conține", "A se păstra" (also "ASE păstra"), nutrition tables, hazard codes or another language. A word list of ~1,200 ingredient words then fixes one-edit slips ("sore" → "sare", "posteurizat" → "pasteurizat"), splits glued words ("cacaolapte" → "cacao lapte") and restores diacritics; real words are never changed, so no additive can be invented.
- **Entry points, review and labels** as before: home button, the barcode "not found" / "no ingredients" / error screens (text attached to the barcode), crop step, editable review, "citit din fotografie" label.

### Update feedback, sharing, a quieter disclaimer (v3.0)

- After "Reîncarcă" the app says **"Actualizare reușită – v…"** once the new version runs, or **"Actualizarea nu a reușit – încearcă din nou"** if no new version took over within 15 s. Builds are compared by version + build time, so a redeploy of the same version counts too. "Ce e nou în v3.x" appears once after each update.
- **Share → IngrediScan** accepts several photos at once (they are read and merged, up to 3). About explains how it works on Android (and that a reinstall refreshes the share list), and that iPhone does not support it.
- The disclaimer is no longer a footer on every page: it is on the first-run slides and About, and one short line under each result (in full when something high-risk is flagged).
- Removed: "Raportează o problemă" and the cards that sent products to Open Food Facts. The "Vezi pe Open … Facts" link stays.

### Share a photo into the app (v2.9)

- On Android, with IngrediScan installed: in Gallery / Photos / Camera, **Share → IngrediScan** opens the photo straight in the crop-and-read step. Shared text (e.g. an ingredient list copied from a website) goes into the ingredients box.
- How it works: the manifest declares a `share_target`; the service worker (`src/sw.js`, vite-plugin-pwa `injectManifest`) receives the photo, keeps it in Cache Storage on the phone and opens the app at `./?share=1`, which reads it once and removes it. Nothing is uploaded.
- The service worker keeps the earlier behaviour: the app is precached, the OCR engine is cached on first use, product lookups are network-first, and a new version waits for "Reîncarcă" (which now also reloads when the update was found by the hourly check). Browser tests cover sharing, offline start, OCR caching and both update paths.
- Not on iPhone (Safari has no Web Share Target) and not in a browser tab – only in the installed app.

### Family lists, sending a list, glossary, accessibility (v2.8)

- **One avoid list per person** (Lista mea → "Lista cui"): "Eu", "Copil", … up to 8. The list saved before v2.8 becomes "Eu". A result can be re-checked for another person with the "Verificat pentru" selector.
- **Send a list by link**: "Trimite lista" shares a link (`#import=…`, the list compressed into the link – nothing goes to a server). Opening it shows what it contains and asks before adding it as a new person; a damaged link says so and changes nothing.
- **New groups** (off by default): the six colours that must carry the EU warning for children (E102, E104, E110, E122, E124, E129) and caffeine / guarana.
- **Glossary**: "?" next to NOVA, Nutri-Score, allergens and restrictions, and in About – NOVA, Nutri-Score, DZA/ADI, IARC groups, banned vs not approved, E-numbers, "may contain traces".
- **Start with the camera** (About → Datele tale), and "Încearcă cu un exemplu" at the end of the first-run slides.
- **Accessibility**: every screen is checked with axe (light and dark, no serious or critical issue), text at 200 % never makes a screen scroll sideways, score tiles read as one sentence. Manual TalkBack checklist: [docs/a11y.md](docs/a11y.md).
- Backups are now version 2 (all profiles); version 1 files still restore.

### Shopping mode and comparing products (v2.7)

- **Mod cumpărături** in the scanner: the camera stays on and each new barcode becomes a card in a sheet at the bottom (name, verdict colour, the main reason; badges *salvat*, *lipsesc ingredientele*, *cod magazin*, *negăsit*), looked up in the background. The same code within 10 s is ignored (the box is still in front of the camera); a code already in the list moves to the top. Tapping a card opens the full result; **Înapoi la cumpărături** returns to the camera with the list intact. Shopping scans go to the history. The camera stops after 5 minutes without a new product (battery, heat). `src/lib/shopping.js`.
- **Compare two** in the history: pick two products for a side-by-side view (verdict, NOVA, Nutri-Score, nutrient levels, additives to avoid / limit, your list, allergens), worked out again with the current list and offline; items found in both are marked. Stacked rows, readable at 320 px. `src/lib/compare.js`, `CompareView.jsx`.
- Browser tests drive shopping mode with Chromium's fake camera and a stand-in `BarcodeDetector`.

### Full EU additive list, sources and dates (v2.6)

- **All additives authorised in the EU** (Regulation (EC) 1333/2008, Annex II): 162 entries added in `src/data/additivesExtra.js` (RO/EN name, label words, one-line function; level `none` or that of their family, higher only with a stated reason – aluminium compounds, boric acid only in caviar, konjac not in jelly mini-cups). E203 is not included (authorisation withdrawn in 2018); "E960a" resolves to E960. Codes with letters up to h (E161g) are now read.
- **Romanian plurals** of one-word additive names are recognised ("ciclamați" → E952 cyclamate on 8 real products, "zaharine" → E954, "sorbitoli" → E420), unless the plural is another additive's name.
- **Sources and review date** on every expanded item ("Surse: EFSA ↗ · Regulamentul (CE) 1333/2008 ↗ · verificat 15 nov. 2026"). Sources are derived from what the explanation cites (`src/data/sources.js`), so they cannot drift from the text; restrictions outside the EU add their authority (FDA, Health Canada…). A test requires a source for every high / medium entry and every restriction.
- The product header shows when the Open Food Facts page was last updated; About lists each database with its size and review date.
- The first-screen JavaScript budget was raised from 420 to 470 KB on purpose (the full additive list is core data).

### Allergens, vegan, palm oil (v2.5) – information only

- **Allergens** (`src/data/allergens.js`, `src/lib/allergens.js`): the 14 groups of EU Regulation 1169/2011 Annex II, with Romanian and English label words. Text after "Poate conține (urme de)…" / "May contain…" / "Produs într-o fabrică care procesează…" counts as **possible traces**, kept apart from what the product contains. Not counted: cocoa butter, coconut, plant drinks as milk; wheat glucose syrup, dextrose and maltodextrin, and refined soybean oil (Annex II exemptions); "fără …" mentions; "peste" (= over) and "cod" (= code). Sulphites also from E220–E228. Open Food Facts' `allergens_tags` / `traces_tags` are merged, with the source shown.
- Shown in a card under the verdict: "Eticheta menționează: …", "Urme posibile: …"; with nothing found: "Nu am găsit alergeni în textul citit. Verifică eticheta – alergenii sunt scriși îngroșat." **Never** "fără alergeni", and allergens **never change the verdict**. Lista mea → *Alergeni de evidențiat* marks the ones to highlight with ⚠. A test checks the RO/EN texts for promises of safety.
- **Vegan / vegetarian / palm oil** chips (`src/lib/diet.js`): Open Food Facts' ingredient analysis when it has one, otherwise a cautious reading of the ingredients ("după ingrediente"; no animal ingredient seen is "nu am găsit ingrediente de origine animală", not "vegan").
- A one-line summary at the top of the result: "2 din lista ta · alergeni: lapte, soia · NOVA 4".
- **Golden corpus test** (`tests/corpus.test.js`): the analysis of all 474 corpus lists against a snapshot (`UPDATE_SNAPSHOTS=1 npm test` to accept changes), unknown E-codes listed, allergen recall against Open Food Facts' own tags (267/267 on the 275 lists tagged so far; tags the ingredient text does not support are reviewed by hand in `bench/corpus/tag-review.json`).

### Your data and backup (v2.1)

- **Despre → Datele tale**: whether the browser keeps the app's data under storage pressure (the app asks with `navigator.storage.persist()` after the first saved analysis), space used, **download the text reading engine now** (on Wi-Fi), **backup** of history + remembered ingredients + avoid list in one JSON file (`src/lib/backup.js`; restoring adds new / newer items and replaces the avoid list after a preview), and **delete all data** (history, remembered ingredients, settings, cached lookups; the OCR engine is kept).
- **Privacy** section listing exactly what leaves the phone (only the barcode, to Open *Facts) and what stays.
- **⟳ Rotește** in the crop step turns the photo 90° per tap (for photos the camera saved sideways or upside down). The crop frame now always has the photo's exact shape (tall photos were letterboxed, so the crop could miss the chosen area).
- Credits and licences: [`NOTICE.md`](NOTICE.md).

### Remembered ingredients (v1.4)

When a scanned barcode has no ingredients in the databases (or is not found, or the lookup fails) and you photograph or paste them, they are remembered for that barcode (`src/lib/savedIngredients.js`, localStorage, up to 1,000 products). The next scan of the same barcode shows the result straight away, even offline; the product details (name, NOVA, Nutri-Score) are refreshed in the background when online. The result says where the ingredients came from and offers **New photo** (replaces them) and **Forget these ingredients**. Kept apart from the history, so deleting or clearing the history does not lose them; photos and pasted lists already in the history are picked up once on first start of v1.4.

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
- **Result:** ingredients text with flagged words highlighted by level (tap → jumps to and opens the explanation); "Distribuie" via the Web Share API, falling back to copying a text summary.
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
│   │   ├── AboutView.jsx      # Privacy, your data, sources, regulations, review dates, disclaimer
│   │   ├── SettingsCard.jsx   # Storage status, OCR download, backup / restore, delete all
│   │   ├── Onboarding.jsx     # First-run slides
│   │   ├── Banners.jsx        # Update, offline, install (Android / iPhone), toast
│   │   ├── ResultExtras.jsx   # Highlighted ingredients, share, add-product links
│   │   ├── ErrorBoundary.jsx
│   │   ├── Home.jsx           # Scan button (main action), manual barcode, photo, paste
│   │   ├── TypeSelector.jsx   # Alimente / Cosmetice / Curățenie selector (+ back to auto)
│   │   ├── BarcodeEntry.jsx   # Manual barcode + read from a photo
│   │   ├── ScannerOverlay.jsx # Full-screen camera scanner (lazy-loaded)
│   │   ├── ProductHeader.jsx  # Image, name, brand, barcode, Open … Facts link
│   │   ├── LookupViews.jsx    # Loading, not found (+ search again), in-store code, no ingredients, network error
│   │   ├── PhotoButton.jsx    # "Fotografiază ingredientele" (camera file input)
│   │   ├── PhotoFlow.jsx      # Crop → OCR progress → review (lazy-loaded)
│   │   ├── CropBox.jsx        # Draggable / resizable crop rectangle
│   │   ├── IngredientInput.jsx
│   │   ├── AvoidSettings.jsx  # Toggle avoid-list presets (per product type)
│   │   ├── Result.jsx         # Type badge, verdict, safety tip, NOVA card, avoid hits
│   │   └── AdditiveList.jsx   # Expandable items with risk pills (grouped for non-food)
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
│   ├── saved.test.js          # Remembered ingredients by barcode
│   ├── data.test.js           # Database schema: both languages, levels, codes, regions, alias clashes
│   ├── v21.test.js            # Backup / restore / delete, diagnostics report, rotation sizes
│   ├── orientation.test.js    # Sideways / upside-down detection, classifier vote, retries for weak reads
│   ├── crop.test.js           # Text blocks, crop suggestion, uncertain words
│   ├── merge.test.js          # Merging photos of one label
│   ├── corpus-words.test.js   # Word clean-up on real Romanian ingredient lists
│   ├── allergens.test.js      # EU 14 allergens, traces, exemptions, diet, wording
│   ├── corpus.test.js         # Golden corpus snapshot, allergen recall vs Open Food Facts
│   └── scores.test.js         # NOVA explanations, Nutri-Score facts, restrictions outside the EU
├── e2e/                       # Browser tests (Playwright, API mocked): paste, barcode flows, remembered
│                              # ingredients offline, history, avoid list, RO/EN, one real OCR smoke test
├── bench/
│   ├── ocr/                   # OCR benchmark: labels.json → images/ (synthetic labels + phone photos),
│   │                          # truth.json, harness, run.mjs, baseline.json
│   ├── barcode/               # Barcode benchmark: 24 hard EAN-13 photos, truth.json, harness, baseline
│   └── lib/                   # photoize.js (synthetic photo effects), dev server helper
├── scripts/check-bundle.mjs   # First-load JS budget (420 KB raw)
└── .github/workflows/
    ├── ci.yml                 # Every branch / pull request: unit + build + budget + browser tests
    ├── deploy.yml             # main: the same checks, then deploy to GitHub Pages
    └── bench.yml              # Benchmarks: by hand and weekly
```

## Commands

Requires Node.js 20.19+ (CI uses Node 22).

```bash
npm install        # install dependencies
npm run dev        # dev server at http://localhost:5173
npm test           # unit tests (Node's built-in test runner)
npm run test:e2e   # build, then browser tests (Playwright, Chromium)
npm run build      # production build into dist/
npm run check:bundle  # first-load JS budget (after a build)
npm run preview    # serve the production build locally
```

## Testing and benchmarks

**Real-photo benchmark** (`bench/real`, `npm run bench:real`). 20 real label photos (12 taken in Romanian shops in `tests/corpus/own/`, 8 from Open Food Facts under CC BY-SA in `tests/corpus/off/`), each text block transcribed by hand. It reports the character and word error rate per language, strict (diacritics count) and folded (as the analysis sees it), the nutrition table rows and values found, what the app picks by itself, and the time per photo. Results and findings: [docs/OCR_REAL.md](docs/OCR_REAL.md). The corpus is never deployed.

| What | Command | Where it runs |
|---|---|---|
| Unit tests (logic, data schema) | `npm test` | every push |
| Browser tests (main flows, API mocked) | `npm run test:e2e` | every push (CI and before each deploy) |
| First-load JS budget | `npm run check:bundle` | every push |
| Barcode benchmark | `npm run bench:barcodes` | by hand / weekly (`bench.yml`) |
| OCR benchmark | `npm run bench:ocr` | by hand / weekly (`bench.yml`) |

Browser tests never reach the real Open *Facts servers: every request is answered by a mock (`e2e/fixtures.js`). The first run needs Chromium: `npx playwright install chromium`.

**OCR benchmark** (`bench/ocr`). Six synthetic labels (tomato paste, biscuits, chocolate, multilingual soup RO/HU/BG, shampoo INCI, detergent with Reg. 648/2004 bands), each as a flat image and as a synthetic phone photo (curve, perspective, tilt, blur, glare, noise, dim light). Each is read whole and cropped to the ingredients paragraph through the app's real OCR path in Chromium. Reported per image: key-word recall, CER (character error rate of the extracted ingredients text after normalisation) and time. The run fails if the average recall of any group drops more than 2 points below `baseline.json`. Change the labels in `labels.json`, then `npm run bench:labels`; accept new numbers with `npm run bench:ocr -- --update-baseline`.

Baseline (15 Nov 2026, v2.2, desktop CPU, one thread – a phone is slower). Reading includes the app's word clean-up and the second chance for weak reads:

| Group | Recall | CER | Median time |
|---|---|---|---|
| flat / whole | 100% | 0.001 | 2.8 s |
| flat / crop | 100% | 0.001 | 1.2 s |
| photo / whole | 77.8% | 0.336 | 3.4 s |
| photo / crop | 93.1% | 0.131 | 1.6 s |

`--merge` reads label pairs (two sides of a jar) alone and merged. `--suggest` checks the crop suggestion (share of the true ingredients paragraph inside the suggested box; fails if fewer images reach 95% than in the baseline) and reports how many misread words were flagged as uncertain. `--rotations` (which includes `--suggest` and `--merge`) also turns every image 90/180/270° (re-encoded as JPEG without EXIF, like a phone that did not record the rotation) and runs the app's automatic orientation first. Orientation was correct on 48/48 images; recall after turning matches the same path at 0° (photo / crop: 83.3% at 0°, 88.9–90.3% at 90/180/270°; re-encoding is why 0° is below the table above). Median orientation time 0.2–0.4 s for flat labels, 0.5–1.0 s for photos (sideways photos need a second detection pass). The baseline fails a run if any image's orientation goes wrong that was right before.

The weak cases are small, curved text: the tomato jar (whole photo) and the shampoo bottle (word spaces and letters lost). Targets of v2.3–v2.4.

The benchmark found one clean-up bug, fixed in v2.2: "masa de cacao" was "corrected" to "maia de cacao" because "masă" was missing from the word list.

**Barcode benchmark** (`bench/barcode`). 24 synthetic hard photos (small, tiny, rotated 15/40/90/180°, perspective, blur, curve, glare, low contrast, noise, low JPEG quality, combinations) decoded by the app's photo path. Baseline: 22/24 read, 0 misreads (the misses are 3.5 px blur and curve + blur). Headless Chromium on Linux has no native `BarcodeDetector`, so this measures the ZXing fallback. Regenerate images with `npm run bench:barcodes:make`.

Real photos are not in the benchmark yet (synthetic only).

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

The workflow in `.github/workflows/deploy.yml` runs the unit tests, builds, checks the bundle budget, runs the browser tests and only then deploys, on every push to `main` (and can be started manually from the Actions tab).

One-time setup: in the repository go to **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.

## Disclaimer

For information only, not medical advice. All additives sold in the EU are approved and considered safe at permitted levels; cosmetics must comply with Regulation (EC) 1223/2009 and detergents with Regulation (EC) 648/2004. The ratings show which ingredients deserve extra attention.
