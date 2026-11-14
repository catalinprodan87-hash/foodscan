# IngrediScan v2: one prompt per release

Paste one prompt per session, in order. Each prompt is meant to be built, tested and deployed in one session, and each assumes the previous ones are on `main`.

Decisions behind this plan (15 Nov 2026):
- **Audience:** you and your family.
- **Real photos:** not now; benchmarks stay synthetic for the moment.
- **Allergens:** shown as information only; they never change the verdict.
- **Kept open, not scheduled:** custom domain, Play Store, Open Facts contributions, cloud sync, licence.

Details for every item are in `docs/ROADMAP.md` §4 (IDs in brackets).

The same closing paragraph ends every prompt; it is written out in full in each one, so each block can be pasted alone.

---

## v2.0: safety net (benchmarks, browser tests, CI)

```
You are working on IngrediScan (this repo, v1.4). Read README.md and docs/ROADMAP.md
first, especially W7, W8 and items Q1–Q5, D5 and A13. This release adds no user-facing
features. It builds the safety net that later releases depend on.

1. OCR benchmark in bench/ocr/:
   - make-labels.mjs uses Playwright to render 6 synthetic ingredient labels as HTML:
     tomato paste, biscuits, chocolate, a multilingual soup (RO + HU + BG), shampoo
     (INCI) and a detergent (Reg. 648/2004 % bands).
   - Each label is saved as a flat PNG and as a "photo" JPEG with perspective, slight
     curve, blur, noise and glare.
   - truth.json holds the exact ingredient text and the key words per label.
   - Every image is ≤ 300 KB.
   - run.mjs runs `vite preview`, then the real OCR worker in Chromium (whole photo and
     ingredient crop). It reports CER, key-word recall and time per image, writes
     bench/results/<date>.json and compares against a committed bench/ocr/baseline.json.
   - Scripts: npm run bench:ocr, npm run bench:labels.
2. Barcode benchmark in bench/barcode/:
   - A generator creates 24 hard EAN-13 images: rotated 15/40/90/180°, blur, glare,
     perspective, curved, small in frame, low JPEG quality, combinations.
   - A harness uses decodeImageFile and reports reads, misreads and time against a
     baseline.
3. Browser tests: Playwright tests in e2e/, with the Open *Facts API mocked through
   page.route. Cover:
   - Paste → result.
   - Barcode found with ingredients.
   - Barcode found without ingredients → paste → "Salvat" → re-scan shows the result at
     once and also offline.
   - Barcode not found.
   - History: open, delete, undo.
   - Avoid list: add a custom term and see the hit.
   - RO/EN switch.
   - One OCR smoke test on a small image.
   - No fixed sleeps; wait on selectors.
4. tests/data.test.js: every database entry has ro/en name and reason, a valid level,
   valid E-code syntax, and restriction regions that exist. No alias may point to two
   codes (allow an explicit whitelist).
5. CI:
   - .github/workflows/ci.yml on every push and pull request: npm ci, unit tests,
     Playwright install (chromium only), browser tests, build, then
     scripts/check-bundle.mjs (fails if the main JS chunk is > 420 KB raw).
   - deploy.yml runs the same checks before deploying.
   - bench.yml runs on workflow_dispatch and weekly: both benchmarks, results uploaded
     as an artifact, failing if OCR recall drops > 2 points versus the baseline.
6. README: a "Testing and benchmarks" section. Version 2.0.0.

Rules: no medical claims; RO + EN strings; everything stays on the device. Run unit tests,
browser tests and the build, and check the app in a browser at 390 px and 320 px, light
and dark. Bump the version, update the README, commit, push to main only (not the session
branch), confirm that the "Deploy to GitHub Pages" run on main succeeds, then give me a
short summary I can test on my phone.
```

---

## v2.1: quick wins

```
IngrediScan, after v2.0. Read docs/ROADMAP.md items A2, A9, A10, P3, U6, T1, F9, C5
and Q6. Ship these quick wins:

1. Crop step: a "⟳ Rotește" button turns the photo 90° per tap. Rotate the
   ≤ 3000 px working copy, not the original. Four taps give the original back, and
   OCR reads what is shown.
2. Faster lookup:
   - The first Open *Facts database is queried at once; the other two start after
     1.5 s unless the first has already answered. Priority order is kept.
   - "Not found" is cached for 24 h in localStorage; "Încearcă din nou" bypasses the
     cache.
   - Unit tests use a fake fetch and fake timers.
3. EAN-13 codes starting with 20–29 (in-store, weighed products): no lookup. Show
   "Cod intern al magazinului (probabil produs cântărit)" with photo and paste options.
   Remembered ingredients must still work for these codes.
4. Request navigator.storage.persist() after the first saved analysis.
5. Settings card in About:
   - Persistent storage status and storage used (navigator.storage.estimate).
   - "Descarcă motorul OCR acum".
   - Export and import of ALL data in one JSON file (history, remembered ingredients,
     avoid list), with a version field and a migration path.
   - "Șterge toate datele" with confirmation.
6. Privacy section: exactly what leaves the phone (only the barcode, to Open *Facts)
   and what stays on it.
7. "Raportează o problemă" on the photo review and result screens (family version, no
   GitHub account needed):
   - Builds an editable report: app version, device/browser, the last 20 timings from a
     local ring buffer (lookup, OCR phases), OCR confidence and text.
   - Sends it with the Web Share API (WhatsApp, e-mail), falling back to copying it to
     the clipboard.
   - Never a photo, never sent automatically.
8. NOTICE.md crediting Open Food/Beauty/Products Facts (ODbL), PaddleOCR models,
   onnxruntime-web, zxing-cpp/zxing-wasm and Space Grotesk, linked from About. No
   LICENSE file yet; that decision is still open.
9. Unit and browser tests for all of the above. Version 2.1.0.

Rules: no medical claims; RO + EN strings; everything stays on the device. Run unit tests,
browser tests and the build, and check the app in a browser at 390 px and 320 px, light
and dark. Bump the version, update the README, commit, push to main only (not the session
branch), confirm that the "Deploy to GitHub Pages" run on main succeeds, then give me a
short summary I can test on my phone.
```

---

## v2.2: automatic photo orientation

```
IngrediScan, after v2.1. Implement docs/ROADMAP.md §4 A1 and A3 (and Q5 if it is not
done yet): ingredient photos taken upside down or sideways (90/180/270°) that EXIF
does not fix.

Approach:
- Right after the photo is decoded and BEFORE the crop step, a new worker message
  "orient" runs on a 960 px copy:
  1. Run the detector once. Keep the steep text components; today linesFromProbMap
     drops them.
  2. If > 60% of the text area is vertical, the candidates are 90°/270°; otherwise
     0°/180°.
  3. Run PaddleOCR's direction classifier ch_ppocr_mobile_v2.0_cls_infer.onnx, which
     is already in node_modules/paddle-ocr-onnx-models. Copy it to public/ocr/paddle/
     and add it to manifest.json. Check its input shape and normalisation against
     PaddleOCR before use. Run it on ≤ 8 large line crops and take a weighted vote.
  4. If the classifier is unsure (< 0.75, or a split vote) or fails, read the same
     lines in both orientations with the recogniser and keep the better score:
     0.5 × CTC confidence + 0.5 × share of words found in the lexicon.
- Rotate the full image and show the crop step upright. Keep the "⟳ Rotește" button
  as an override.
- Time limit 3 s, then continue unrotated. On the first photo (engine not downloaded
  yet) show the crop step at once and rotate when the engine is ready.
- A3: if the OCR result is weak (needsBetterPhoto), retry once at +180°, then once
  with a 2560 px detector on the crop. Keep the best by lexicon score, with a visible
  "Încerc din nou…" step and a cancel button.

Pure helpers go in paddleCore.js with unit tests: orientationFromComponents,
pickRotation, lexiconScore.

Benchmark: bench/ocr/make-rotations.mjs makes 0/90/180/270° copies of every label
with EXIF stripped. Report orientation accuracy, recall and time.

Acceptance:
- Orientation correct on ≥ 95% of the rotated photo images and on 100% of flat ones.
- Rotated recall within 3 points of upright.
- Upright recall changes by < 1 point, and the median time goes up by ≤ 25%.
- Record the timings in the README.

Version 2.2.0.

Rules: no medical claims; RO + EN strings; everything stays on the device. Run unit tests,
browser tests and the build, and check the app in a browser at 390 px and 320 px, light
and dark. Bump the version, update the README, commit, push to main only (not the session
branch), confirm that the "Deploy to GitHub Pages" run on main succeeds, then give me a
short summary I can test on my phone.
```

---

## v2.3: smart crop and uncertain words

```
IngrediScan, after v2.2. Implement docs/ROADMAP.md §4 A7 and A4.

1. Auto-crop:
   - Reuse the orientation detection pass. Group line boxes into text blocks
     (clusterBlocks in paddleCore.js).
   - Read only the first line of the 6 largest blocks. Preselect the block that starts
     with an ingredients marker (findStart: "Ingrediente", "Ingredients",
     "Compoziție"…), preferring Romanian, extended over the following lines until a
     gap > 2 line heights.
   - The user can still move the box or pick "toată fotografia".
2. Uncertain words:
   - ctcDecode returns per-character probabilities; the worker returns per-word
     minimums.
   - The review step lists words below 0.75 as tappable chips ("verifică: lapfe,
     zahar…"). Tapping a chip selects that word in the text field.
   - Keep the text field simple and editable.

Benchmark metrics:
- Crop coverage: ≥ 95% of the ingredient characters inside the suggested box on
  ≥ 80% of images.
- Wrong words flagged: ≥ 70% of wrong words flagged, ≤ 15% of correct words flagged.

Unit tests for clusterBlocks and the per-word confidence; a browser test for the
review chips. Version 2.3.0.

Rules: no medical claims; RO + EN strings; everything stays on the device. Run unit tests,
browser tests and the build, and check the app in a browser at 390 px and 320 px, light
and dark. Bump the version, update the README, commit, push to main only (not the session
branch), confirm that the "Deploy to GitHub Pages" run on main succeeds, then give me a
short summary I can test on my phone.
```

---

## v2.4: Romanian word list and curved packs

```
IngrediScan, after v2.3. Implement docs/ROADMAP.md §4 D6, A5 and A6.

1. scripts/build-corpus.mjs (run by hand, not in CI):
   - Fetch Romanian products with ingredient lists from Open Food Facts
     (countries_tags=en:romania; check the current search API and its polite-use
     limits; at most 1 request per second).
   - Save 500–2000 lists to bench/corpus/ro-ingredients.jsonl with barcode and an ODbL
     attribution header.
2. scripts/build-lexicon.mjs:
   - Count words with diacritics (frequency ≥ 3) and write src/data/lexicon-ro.js
     (about 5k words), loaded lazily together with the OCR code.
   - lexicon.js uses it.
   - Property test: a correction never creates an additive or allergen word that wasn't
     in the OCR text.
   - Diacritics test: stripped corpus words are restored correctly ≥ 98% of the time.
3. Curved packs:
   - The review step gets "Adaugă o fotografie (continuarea textului)", up to 3 photos,
     each read separately.
   - mergeOcrTexts in ocrText.js joins on the longest fuzzy overlap between the end of
     one text and the start of the next (normalised Levenshtein ≤ 0.25). Without an
     overlap it appends with " … ".
   - Thumbnails in order, each removable.
   - Unit tests: exact overlap, fuzzy overlap, no overlap.
   - Benchmark pair: render a label around a cylinder, photographed from two angles.

Version 2.4.0.

Rules: no medical claims; RO + EN strings; everything stays on the device. Run unit tests,
browser tests and the build, and check the app in a browser at 390 px and 320 px, light
and dark. Bump the version, update the README, commit, push to main only (not the session
branch), confirm that the "Deploy to GitHub Pages" run on main succeeds, then give me a
short summary I can test on my phone.
```

---

## v2.5: allergens (information only), vegan and palm oil

```
IngrediScan, after v2.4. Implement docs/ROADMAP.md §4 F1, F5, A8, T2 and U2.
Decision: allergens are INFORMATION ONLY. They never change the verdict.

1. src/data/allergens.js: the 14 EU allergen groups (Reg. (EU) 1169/2011 Annex II)
   with RO/EN terms. Examples:
   - Gluten cereals: grâu, secară, orz, ovăz, spelt.
   - The other groups: ouă, pește, crustacee, moluște, arahide, soia, lapte (lactoză,
     cazeină, zer), fructe cu coajă, țelină, muștar, susan, sulfiți > 10 mg/kg, lupin.
   Matching reuses matchTerms with negation ("fără lactoză" is not a hit).
2. Text after "poate conține / urme de / may contain" goes into a separate traces list.
3. Lookup also requests allergens_tags and traces_tags; merge them and show the source
   ("etichetă" / "Open Food Facts").
4. Result: an "Alergeni" info card near the top.
   - Wording: "Eticheta menționează: lapte, soia. Urme posibile: alune."
   - With none found: "Nu am găsit alergeni în textul citit. Verifică eticheta – alergenii
     sunt scriși îngroșat."
   - NEVER "fără alergeni" or "sigur".
   - The user can mark allergens to watch (avoid-list screen); watched ones are
     highlighted, still with no effect on the verdict.
5. Vegan and palm oil:
   - Chips from Open Food Facts ingredients_analysis_tags (check the tag names); when
     those are missing, local detection worded "după ingrediente: probabil…".
   - Not in the verdict.
6. Golden corpus: tests/corpus.test.js runs analyze() over bench/corpus and compares a
   compact snapshot (codes, levels, allergens, type, NOVA). Update the snapshot with
   UPDATE_SNAPSHOTS=1. Report unknown E-codes.
7. Wording test: scan the i18n strings for banned words in allergen contexts (sigur,
   fără risc, safe, free of allergens).
8. A one-line summary at the top of the result: "2 de evitat · alergeni: lapte · NOVA 4".

Acceptance: allergen recall ≥ 98% versus Open Food Facts tags on the corpus products that
have them; traces never merged into "contains".

Version 2.5.0.

Rules: no medical claims; RO + EN strings; everything stays on the device. Run unit tests,
browser tests and the build, and check the app in a browser at 390 px and 320 px, light
and dark. Bump the version, update the README, commit, push to main only (not the session
branch), confirm that the "Deploy to GitHub Pages" run on main succeeds, then give me a
short summary I can test on my phone.
```

---

## v2.6: database coverage, sources and dates

```
IngrediScan, after v2.5. Implement docs/ROADMAP.md §4 D1, D3 and T3.

1. Add every E-number on the EU Union list (Reg. (EC) 1333/2008 Annex II, current
   consolidated version on EUR-Lex; cite which one) that is missing from additives.js.
   - Default level none/low, with a one-line function and the source.
   - A higher level only with a cited EFSA opinion.
   - Goal: zero unknown E-codes on the bench corpus, except codes not authorised in the
     EU, which are labelled as such.
2. Optional per-entry fields: reviewed (date) and sources [{title, url}].
   - Show them in the expanded item: "Surse · verificat <dată>".
   - Backfill sources for every high and medium entry and all restrictions.
   - The schema test enforces the format.
3. Product data shows "Open Food Facts, actualizat la <dată>" from the product's last
   modified time (check the field name).
4. About shows per-database review dates and counts.

Version 2.6.0.

Rules: no medical claims; RO + EN strings; everything stays on the device. Run unit tests,
browser tests and the build, and check the app in a browser at 390 px and 320 px, light
and dark. Bump the version, update the README, commit, push to main only (not the session
branch), confirm that the "Deploy to GitHub Pages" run on main succeeds, then give me a
short summary I can test on my phone.
```

---

## v2.7: shopping mode and comparing products

```
IngrediScan, after v2.6. Implement docs/ROADMAP.md §4 F7 and F3.

1. Shopping mode:
   - A toggle in the scanner ("Mod cumpărături") keeps the camera open.
   - Each confirmed code (the same code ignored for 10 s) adds a compact card to a
     bottom sheet: name, verdict colour, top reason, a badge "salvat" or "lipsesc
     ingredientele".
   - Lookups run in the background.
   - Tapping a card opens the full result; going back returns to the camera with the
     list intact.
   - Controls sit in the bottom 40% of the screen (one hand).
   - Stops after 5 min idle.
   - Browser test: 5 mocked products scanned in a row.
2. Compare:
   - In History, select two items ("Compară").
   - The view shows verdict, NOVA, Nutri-Score, nutrient levels, flagged items (shared
     ones highlighted) and allergens.
   - Works offline; stacked rows at 320 px.

Version 2.7.0.

Rules: no medical claims; RO + EN strings; everything stays on the device. Run unit tests,
browser tests and the build, and check the app in a browser at 390 px and 320 px, light
and dark. Bump the version, update the README, commit, push to main only (not the session
branch), confirm that the "Deploy to GitHub Pages" run on main succeeds, then give me a
short summary I can test on my phone.
```

---

## v2.8: family profiles, sharing the list, accessibility

```
IngrediScan, after v2.7. Implement docs/ROADMAP.md §4 F2, F10, U1, U3, U4 and U5.

1. Profiles:
   - The avoid state becomes {profiles: [{id, name, avoid, allergens}], active}.
   - Migrate the current list into a profile named "Eu".
   - Add, rename and delete profiles; a switcher on the result ("pentru: Copil").
   - Presets may only cite legal label statements (e.g. the Southampton colours warning,
     Reg. 1333/2008 Annex V). No pregnancy or medical ratings.
2. "Trimite lista":
   - Builds a link with the profile in the URL FRAGMENT (#import=…), compressed, so it
     never reaches a server.
   - Opening it shows a preview and imports only after confirmation.
   - Share through the Web Share API (WhatsApp).
3. Setting "Pornește direct scanerul" when the app opens.
4. Accessibility:
   - axe-core in the browser tests on every screen (no serious or critical issues).
   - 200% zoom without horizontal scroll.
   - Score tiles get a spoken sentence.
   - docs/a11y.md with a manual TalkBack checklist.
5. Onboarding gets "Încearcă cu un exemplu" (a sample product).
6. A short glossary (NOVA, Nutri-Score, DZA, IARC groups, "neautorizat" vs "interzis"),
   linked from "?" icons.

Version 2.8.0.

Rules: no medical claims; RO + EN strings; everything stays on the device. Run unit tests,
browser tests and the build, and check the app in a browser at 390 px and 320 px, light
and dark. Bump the version, update the README, commit, push to main only (not the session
branch), confirm that the "Deploy to GitHub Pages" run on main succeeds, then give me a
short summary I can test on my phone.
```

---

## v2.9 (optional): share photos into the app

```
IngrediScan, after v2.8. Implement docs/ROADMAP.md §4 C3 (Web Share Target).

- Add a manifest share_target (POST, multipart, image/*).
- This needs a custom service worker: switch vite-plugin-pwa to injectManifest (check its
  current docs), keeping precaching, the runtime caching rules and the update prompt
  exactly as they are.
- The service worker stores the shared file in Cache Storage and redirects to ./?share=1;
  the app opens the photo flow with it.
- Re-test the update banner, offline start and OCR caching (browser tests).
- Android with the installed PWA only; tell me how to test it on my phone.

Version 2.9.0.

Rules: no medical claims; RO + EN strings; everything stays on the device. Run unit tests,
browser tests and the build, and check the app in a browser at 390 px and 320 px, light
and dark. Bump the version, update the README, commit, push to main only (not the session
branch), confirm that the "Deploy to GitHub Pages" run on main succeeds, then give me a
short summary I can test on my phone.
```
