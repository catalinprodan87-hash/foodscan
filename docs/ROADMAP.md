# IngrediScan roadmap: v2 and v3

Status: proposal, 14 Nov 2026, written against v1.4.0 (commit `99d62f8`).
No code was changed for this document.

**Decisions (15 Nov 2026).** The v2 prompts based on these decisions are in `docs/V2_PROMPTS.md`.
- **Audience:** you and your family. A public launch, usage statistics (T5) and store releases are not planned.
- **Real photos (Q1):** not now. The benchmark stays synthetic; the open question stays open.
- **Custom domain and Play Store (P5, P1):** skipped for now, kept open.
- **Allergens (F1):** **information only**. "Contains" and "may contain traces" are shown but never change the verdict.
- **Licence (O1):** undecided. Only a NOTICE file with third-party credits is added in v2.1.
- **Contributing to Open Facts (C1):** skipped for now, kept open.
- **Sync (C2):** explained again to you. Sharing a list by link (F10, v2.8) comes first.
- **"Report a problem" (C5):** reshaped for family use. It shares an editable report through WhatsApp or e-mail (Web Share API) instead of opening a GitHub issue.

Markers used below:
- **[code]** checked in this repository.
- **[measured]** measured in this session's container (desktop-class CPU, headless Chromium). Not measured on a phone.
- **[verify]** an external fact I believe is right but did not check against the primary source today. Check it before building on it.

---

## 1. Current state (v1.4)

**What it does**

1. **Scan a barcode**, then look it up on Open Food Facts, Open Beauty Facts and Open Products Facts (API v2). The databases are queried **one after another**: the chosen type first, then food → cosmetic → household, with an 8 s timeout each. [code: `src/lib/lookup.js` `lookupProduct`, `DEFAULT_TIMEOUT_MS`]
2. **Analyse ingredients** from the database, from pasted text, or from a photo. Supports food, cosmetics and household products, with automatic type detection from the text (INCI and detergent signals versus E-numbers). [code: `src/lib/analyze.js` `detectProductType`]
3. **Local rating databases**:
   - 167 food additives (15 high, 42 medium, 57 low, 53 none) with 673 aliases.
   - 115 non-food ingredients (22 high, 39 medium, 49 low, 5 none).
   - Restrictions outside the EU for 24 codes (US, California, Hawaii, Canada, Japan).
   - Every entry has a RO + EN reason. [code: `src/data/*.js`]
4. **Worst-risk rule**: an item's level is the worst of its EU rating and every other country's, and the source is shown ("De limitat · California"). [code: `restrictions.js` `worstLevel`]
5. **Food scores**:
   - NOVA comes from Open Food Facts, or from our own estimate with an explanation of which ingredients set it.
   - Nutri-Score shows fat, saturated fat, sugars and salt levels.
   - Nutri-Score D/E and NOVA 4 feed into the verdict. [code: `analyze.js` `estimateNova`, `Result.jsx` `ScoreTiles`]
6. **Personal avoid list**: 14 presets (palm oil, glucose-fructose syrup, parabens, isothiazolinones…) plus custom terms per product type, with negation handling ("fără zahăr" is not a hit) and JSON export/import. [code: `avoidPresets.js`, `analyze.js` `NEGATION_BEFORE`]
7. **Barcode reading**:
   - Native `BarcodeDetector` first, then ZXing-C++ (zxing-wasm 3.1.6, self-hosted).
   - Picks the main back camera, with continuous focus, zoom and torch.
   - Misread protection: 2 matching frames within 1.5 s, GTIN check digit, UPC-E expansion.
   - Photo decoding tries rotations and sharpening. [code: `scanner.js`, `camera.js`]
8. **On-device OCR**:
   - PaddleOCR PP-OCRv4 (Chinese detector + English recogniser, 95-character dictionary **without diacritics**) on onnxruntime-web 1.30, WebAssembly, **one thread**, in a Web Worker.
   - About 24 MB is downloaded on the first photo, then cached for 90 days.
   - Then section extraction (finds "Ingrediente:" and stops at nutrition, language blocks and hazard codes) and a lexicon of about 1,200 words that fixes one-edit slips and restores ă/â/î/ș/ț. [code: `ocrWorker.js`, `paddleCore.js`, `ocrText.js`, `lexicon.js`, `public/ocr/manifest.json`]
9. **Remembered ingredients**: a photographed or pasted list for a barcode is shown immediately on the next scan, even offline. [code: `savedIngredients.js`]
10. **History**: up to 200 items in IndexedDB (localStorage fallback), with search and filters, swipe to delete with undo, and re-analysis with the current avoid list. [code: `history.js`, `HistoryView.jsx`]
11. **PWA**:
    - vite-plugin-pwa in prompt mode with an update banner and install card.
    - The Open Facts API is cached NetworkFirst for 14 days, so earlier lookups work offline.
    - Hosted free on GitHub Pages; deployed by one workflow on push to `main` that runs the unit tests and then the build. [code: `vite.config.js`, `.github/workflows/deploy.yml`]
12. **RO/EN UI** with about 300 keys per language. Design "Clar": light and dark mode, contrast tests for every colour pair, a skip link, and focus moved to the new screen's heading. [code: `i18n.js`, `tests/phase4.test.js`]
13. **Stack and tests**:
    - React 18 + Vite 5, plain CSS, no backend.
    - 241 unit tests with the Node test runner, covering pure logic only.
    - Main JS chunk 370 KB (raw, before compression; about 116 KB gzip) [measured: `dist/assets/index-*.js`]. The OCR worker, scanner and secondary views load lazily.

**Weak spots (checked in the code)**

| # | Weak spot | Evidence |
|---|---|---|
| W1 | **Rotated photos fail.** Any text line steeper than 45° is discarded, so a photo turned 90°/270° gives almost no text. A 180° photo produces junk lines at low confidence. EXIF only fixes photos whose camera recorded the rotation. | `paddleCore.js` `linesFromProbMap`: `if (Math.abs(angle) > Math.PI / 4) continue;` |
| W2 | **No orientation classifier** is used, although PaddleOCR's 0°/180° classifier `ch_ppocr_mobile_v2.0_cls_infer.onnx` (585 KB) already ships in our npm dependency. | `node_modules/paddle-ocr-onnx-models/models/` |
| W3 | **OCR is slow on phones.** Whole photo about 4.7 s, cropped about 3.2 s per label on this container's CPU [measured, `ocrbench3`]. Phones are probably 2–4× slower (not measured). Single thread, because GitHub Pages cannot send the cross-origin-isolation headers that threads need. | `ocrWorker.js` `numThreads = 1` |
| W4 | **Diacritics depend on the lexicon.** The recogniser cannot output ă/î/ș/ț, so a word missing from the about 1,200-word lexicon keeps its wrong letters, and allergen words could be missed. | `public/ocr/paddle/dict.txt`, `lexicon.js` |
| W5 | **Slow "not found".** An unknown barcode costs 3 sequential requests, up to 24 s if a server hangs. Not-found answers are not cached, so the next scan repeats them. | `lookupProduct` loop; `vite.config.js` caches `statuses: [200]` only |
| W6 | **No allergen detection.** The EU 14 allergens and "poate conține urme de…" are not recognised. Open Food Facts `allergens_tags` / `traces_tags` are not requested. | `grep allergen src/` matches only descriptive text; `FOOD_FIELDS` in `lookup.js` |
| W7 | **Benchmarks and browser tests are not in the repository.** The 6 synthetic label renders, the 24 hard barcode images and the Playwright flows used for v1.1–v1.4 lived in the session scratchpad. There are no end-to-end or component tests in CI. | `tests/` holds Node unit tests only |
| W8 | **CI runs only on push to `main`**, and it deploys. There are no checks on other branches or pull requests, no lint and no bundle-size budget. | `.github/workflows/deploy.yml` |
| W9 | **Data can be silently evicted.** `navigator.storage.persist()` is never requested, so the browser may evict history and remembered ingredients when storage is low (especially Safari for non-installed sites [verify]). | no match for `storage.persist` |
| W10 | **Database freshness is manual.** Review dates exist per database, not per entry, and nothing checks whether EU or other rules changed. | `meta.js` `DATABASES_REVIEWED` |
| W11 | **Coverage gaps.** 167 additives versus roughly 330 E-numbers authorised in the EU [verify the count against the Union list]. Unknown E-codes appear with no information. | `additives.js` |
| W12 | **In-store barcodes** (prefixes 200–299, weighed products) are looked up and reported as "not found" with no explanation. | `lookup.js` has no prefix check; GS1 reserves 200–299 for restricted circulation [verify GS1 Romania usage] |
| W13 | **No licence file.** Third parties can't legally reuse or contribute, and the attribution duties for the ODbL Open Facts data aren't stated in the repo. | no `LICENSE` |
| W14 | **Accessibility is only partly verified.** Contrast is tested, but there is no automated audit (axe), no 200% text-zoom check and no screen-reader pass on the score tiles. | `tests/phase4.test.js` covers contrast only |

---

## 2. Master table

Columns:
- **Value** (to a shopper): 1–5.
- **Effort**:
  - S: up to 1 evening.
  - M: 2–4 evenings.
  - L: 1–2 weeks of evenings.
  - XL: more.
- **Risk**: what can go wrong.
- **Release**:
  - v2: target release, e.g. v2.0.
  - v3: connected features.
  - Later: maybe, not scheduled.
  - ✗: rejected.

### Accuracy

| ID | Idea | Value | Effort | Risk | Depends on | Release |
|---|---|---|---|---|---|---|
| A1 | **Automatic orientation (0/90/180/270°) before the crop step** (detail in §4) | 5 | M | wrong pick on mixed-orientation packs; extra time | A2, Q1 | v2.1 |
| A2 | Manual "Rotește ⟳" button in the crop step | 4 | S | none | – | v2.0 |
| A3 | Low-confidence retry: if confidence < 55 or few dictionary words, retry once at 180° and once with a higher-resolution detector before the review step | 4 | S | adds a few seconds on bad photos | A1 | v2.1 |
| A4 | Review step highlights low-confidence words (per-character probabilities are already computed in `ctcDecode`), so the user fixes only those | 4 | M | false alarms on correct words | – | v2.2 |
| A5 | Bigger lexicon (about 5,000 words) mined offline from Romanian Open Food Facts ingredient lists, including allergen words with diacritics | 4 | M | a wrong "correction" introduces a word that wasn't on the label | D6 | v2.2 |
| A6 | **Curved packs: 2–3 overlapping photos, merged as text.** Reshaped from image stitching: each photo is read separately, then the lines are merged with fuzzy overlap (Levenshtein on line ends) | 4 | M | duplicated or missing words at the seams | A4 | v2.2 |
| A7 | Auto-crop suggestion: preselect the crop box around the detected text block that starts with "Ingrediente" | 4 | M | proposes the wrong block on multilingual packs | A1 | v2.1 |
| A8 | Golden test corpus: about 500 real Romanian ingredient lists (from Open Food Facts) with snapshot outputs, to catch false positives and negatives and measure unknown E-codes | 5 | M | licence (ODbL attribution) | D6 | v2.3 |
| A9 | Parallel lookup across the 3 databases (keep priority, return the first hit). Not-found drops from up to 24 s to about 8 s. Cache "not found" for 24 h | 4 | S | 3× requests to Open Facts per scan (they ask apps to be gentle [verify rate limits]) | – | v2.0 |
| A10 | Explain in-store barcodes (200–299) instead of reporting "not found" | 3 | S | GS1 RO may use part of the range differently [verify] | – | v2.0 |
| A11 | Faster OCR experiment 1: multithreading via a service worker that adds the cross-origin-isolation headers (the `coi-serviceworker` approach [verify]) | 3 | M | breaks cross-origin images and fetches unless they send CORS/CORP headers; hard to debug on iOS | Q1 | v2 spike, later |
| A12 | Faster OCR experiment 2: onnxruntime-web WebGPU backend where available (Chrome Android 121+ [verify]) | 3 | M | driver bugs, different numeric results | Q1 | later |
| A13 | Alias-collision and false-positive audit (e.g. "lecitine" versus "E322", short CAPS aliases) as a schema test | 3 | S | none | – | v2.0 |

### New features

| ID | Idea | Value | Effort | Risk | Depends on | Release |
|---|---|---|---|---|---|---|
| F1 | **Allergens**: the EU 14 (Reg. (EU) 1169/2011 Annex II) detected in text and sub-ingredients, plus Open Food Facts `allergens_tags`/`traces_tags`. "Poate conține urme de…" is shown separately from "conține". The user picks which allergens to watch | 5 | M | **a false negative is dangerous**, so wording must never say "fără alergeni"; always "pe etichetă/în baza de date apare…" plus "verifică eticheta" | A5, A8 | v2.3 |
| F2 | **Profiles** (Eu / Copil / custom), each with its own avoid list and allergens. Reshaped: no "pregnancy-safe" rating. Only presets backed by **legal label statements** (e.g. the Southampton colours warning, Reg. 1333/2008 Annex V; the "high caffeine content" statement, Reg. 1169/2011 Annex III [verify wording]) | 4 | M | slides into medical advice if presets are invented | F1 | v2.4 (local only) |
| F3 | Compare two products side by side (from history or two scans) | 4 | M | none | – | v2.4 |
| F4 | Healthier alternatives from the same Open Food Facts category (search API, Nutri-Score/NOVA/additives) | 3 | L | needs network; Romanian coverage thin; search rate limits [verify] | F3 | v3 |
| F5 | Vegan/vegetarian and palm oil from Open Food Facts `ingredients_analysis_tags`, plus local text detection worded "possibly". Reject "palm oil source": labels rarely state it | 3 | S | an "maybe vegan" read as a guarantee | A8 | v2.3 |
| F6 | Green-Score (formerly Eco-Score) when Open Food Facts has it [verify the 2025 rename and the API field name] | 2 | S | weak Romanian coverage | – | v3 |
| F7 | **Shopping mode**: scan → compact verdict card → keep scanning; the session list stays on screen | 4 | M | camera power use | – | v2.4 |
| F8 | Product recall alerts (RASFF, ANSVSA). Reshaped: a "Rechemări recente" list matched by **brand + name**, with "posibil" wording. RASFF entries rarely carry barcodes [verify]; there is no documented public RASFF API and ANSVSA publishes HTML [verify] | 3 | L | false matches cause alarm; scraping breaks | backend/cron | v3 (reshaped) |
| F9 | History backup: export/import (JSON, CSV) | 3 | S | none | – | v2.0 |
| F10 | Share the avoid list or profile **by link** (data in the URL fragment, which never reaches a server) | 3 | S | long URLs | F2 | v2.4 |

### UI/UX

| ID | Idea | Value | Effort | Risk | Depends on | Release |
|---|---|---|---|---|---|---|
| U1 | Scan-first setting: open the scanner on launch; key controls in the bottom third for one-handed use | 4 | S | annoying for paste users, so it's a setting | – | v2.4 |
| U2 | One-line summary at the top of the result: "2 de evitat · 1 alergen: lapte · NOVA 4" | 4 | S | none | F1 | v2.3 |
| U3 | Accessibility pass: axe-core in Playwright, 200% zoom, a TalkBack walkthrough, score tiles read as sentences | 4 | M | none | Q3 | v2.4 |
| U4 | Onboarding "try a sample product" button | 2 | S | none | – | v2.4 |
| U5 | Plain-language glossary (NOVA, Nutri-Score, DZA/ADI, IARC groups, "not approved" vs "banned") linked from results | 3 | S | none | – | v2.4 |
| U6 | Settings screen: download OCR now on Wi-Fi, storage used, persistent storage status, delete all data | 3 | S | none | P3 | v2.0 |

### Data and databases

| ID | Idea | Value | Effort | Risk | Depends on | Release |
|---|---|---|---|---|---|---|
| D1 | Cover all EU-authorised E-numbers (missing ones mostly level `none`/`low`, each with a source) | 4 | M | review workload | D6 | v2.3 |
| D2 | Cosmetics: use CosIng / Reg. 1223/2009 Annex II (banned) and III (restricted) as the legal backbone for non-food entries [verify CosIng download format] | 3 | L | volume; INCI synonyms | D4 | v3 |
| D3 | Per-entry `reviewed` date and `sources` (URLs) shown in the expanded item | 4 | M | backfilling about 300 entries | – | v2.3 (schema), filled over time |
| D4 | **Automated freshness check** (weekly scheduled GitHub Action). Fetches the official sources, compares hashes or "last modified" with a stored snapshot, and **opens an issue with the diff for human review**; never edits ratings. Sources: EUR-Lex consolidated versions of 1333/2008, 1223/2009 and 1169/2011; the ECHA REACH Annex XVII list; EFSA OpenFoodTox; FDA colour-additive pages [verify URLs and formats] | 4 | M | noisy diffs (layout changes); sites blocking bots | Q4 | v3 |
| D5 | Data schema tests: every entry has ro/en name and reason, a valid level, unique aliases, no alias shadowing another code, and restriction regions exist | 4 | S | none | – | v2.0 |
| D6 | Offline script that builds the corpus and lexicon from Open Food Facts Romanian products (search API, `countries_tags=en:romania`, paged; or the data export [verify size and licence]) | 4 | M | ODbL attribution; the API is polite-use only | – | v2.2 |

### Connectors and integrations

| ID | Idea | Value | Effort | Risk | Depends on | Release |
|---|---|---|---|---|---|---|
| C1 | **Contribute back to Open Facts**: upload the ingredient photo, the user-checked text and basic fields for missing products, with the user's own Open Facts account. Explicit consent that **photos become public under CC BY-SA** [verify the licence and the v3 write API / `product_image_upload`] | 4 | L | bad OCR text pollutes the database, so send only text the user reviewed; credential storage on the device | A4 | v3 |
| C2 | Optional cloud sync and family avoid list (Supabase). Fully usable without an account. Allergies and profiles are **GDPR special-category data (Art. 9)**, so it needs explicit consent, the minimum data and an EU region [verify the Supabase free-tier pause and limits] | 3 | L | an ongoing service, security and GDPR duties for one developer | F2, F10 | v3, only if F10 proves too weak |
| C3 | Web Share Target: "Share → IngrediScan" from the gallery or camera opens the photo flow (installed PWA, Android Chrome [verify iOS: not supported]) | 3 | S | Android only | – | v2.2 |
| C4 | Push notifications, only for recalls of products in the history | 2 | L | needs a server plus VAPID; iOS only for home-screen apps since 16.4 [verify] | F8 | later |
| C5 | "Raportează o problemă" opens a pre-filled GitHub issue (OCR text, confidence, app version, device; **no photo**) that the user sends themselves | 4 | S | needs a GitHub account; a mailto fallback | – | v2.0 |

### Platform and distribution

| ID | Idea | Value | Effort | Risk | Depends on | Release |
|---|---|---|---|---|---|---|
| P1 | **Play Store as a Trusted Web Activity** (Bubblewrap CLI). Digital Asset Links must be served from the **origin root** (`/.well-known/assetlinks.json`), which a project site under `github.io/foodscan` can't do, so it needs a custom domain or a `catalinprodan87-hash.github.io` user-site repo. $25 one-time developer fee; new personal accounts must run a closed test (12 testers × 14 days) [verify the current Play policy] | 4 | M | Play policy changes; health-app declarations | P5 | v3 |
| P2 | iOS: stays a home-screen PWA. Camera works through ZXing because Safari has no `BarcodeDetector` [verify]. There's no install prompt (instructions already shown). An App Store wrapper (Capacitor, $99/yr) risks rejection under guideline 4.2 "minimum functionality" [verify] | 2 | XL | review rejection, cost | – | later |
| P3 | Request `navigator.storage.persist()` after the first saved item, and show the status | 4 | S | browsers may refuse silently | – | v2.0 |
| P4 | Lazy-load the non-food databases and the second language (main chunk 370 KB raw) | 2 | S | small gain | – | later |
| P5 | Custom domain (e.g. a `.ro` domain, about €10/yr [verify price]) | 3 | S | cost; HTTPS through Pages is free | – | v3 (before P1) |

### Privacy, trust and safety

| ID | Idea | Value | Effort | Risk | Depends on | Release |
|---|---|---|---|---|---|---|
| T1 | "Ce date pleacă de pe telefon" page: only the barcode goes to Open Facts; photos and lists stay local; nothing else is collected. Plus "Șterge toate datele" | 4 | S | none | U6 | v2.0 |
| T2 | Wording rules for allergens and profiles (never "sigur", "fără", "potrivit pentru sarcină"), enforced by a test over i18n strings | 4 | S | none | F1 | v2.3 |
| T3 | Source and date on every finding (D3), and "data în baza de date: Open Food Facts, actualizat la …" from `last_modified_t` [verify field] | 4 | S | none | D3 | v2.3 |
| T4 | **Optional AI-vision fallback** for unreadable labels: the user's own API key; consent on each photo ("fotografia pleacă de pe telefon către <furnizor>"); the result is marked "citit de AI" and must be reviewed. Not default, not bundled with a key | 3 | M | key stored on device; cost; the AI can invent text, so review is mandatory | A4 | v3 (opt-in) |
| T5 | Privacy-friendly usage counts (page views only, no cookies; e.g. GoatCounter [verify terms]) and opt-in OCR-failure reports (C5) | 2 | S | trust, if not opt-in | – | later (family audience: not needed) |

### Quality engineering

| ID | Idea | Value | Effort | Risk | Depends on | Release |
|---|---|---|---|---|---|---|
| Q1 | **Commit the OCR benchmark** (`bench/ocr/`): the 6 synthetic labels (flat + photo), real photos once available, ground-truth JSON, and a Playwright harness (`npm run bench:ocr`) reporting character error rate (CER), key-ingredient recall and time | 5 | M | repo size (keep images ≤ 300 KB each) | – | v2.0 |
| Q2 | Commit the barcode benchmark (24 hard synthetic images plus the camera clips) the same way | 3 | S | size | Q1 | v2.0 |
| Q3 | Playwright end-to-end tests in CI with the Open Facts API mocked: paste, barcode→no ingredients→photo→result, re-scan from saved, history, avoid list, offline | 5 | M | flaky timing; keep OCR out of the per-push tests | Q4 | v2.0 |
| Q4 | CI on every push and pull request (unit + e2e + build + bundle budget); deploy only from `main` | 4 | S | none | – | v2.0 |
| Q5 | Benchmark workflow (`workflow_dispatch` + weekly): runs Q1/Q2, uploads the results and fails if recall drops more than 2 points from the committed baseline | 4 | S | CI runner speed differs from phones | Q1 | v2.1 |
| Q6 | On-device timing log (local only): OCR phases, lookup time; included in C5 reports | 3 | S | none | C5 | v2.0 |

### Other

| ID | Idea | Value | Effort | Risk | Depends on | Release |
|---|---|---|---|---|---|---|
| O1 | Licence: code (e.g. MIT or AGPL-3.0) plus a NOTICE for Open Facts data (ODbL, attribution) and the PaddleOCR models (Apache-2.0 [verify]) | 3 | S | the choice is yours | – | v2.0 |
| O2 | Sustainability without ads: GitHub Sponsors or a donation link; apply for open-source grants (e.g. NLnet NGI calls [verify eligibility]); **no affiliate links or sponsored "alternatives"** | 2 | S | – | – | v3 |
| O3 | Shareable result image (PNG card with verdict and flagged items) for messaging apps | 2 | S | none | – | later |

### Rejected

| Idea | Reason |
|---|---|
| Image stitching of curved packs | Heavy (feature matching, warping) and fragile on glossy curved labels. Merging OCR text from 2–3 photos (A6) gets the same result at a fraction of the cost. |
| Palm-oil **source** (RSPO / sustainable) | Labels rarely state it and no open dataset maps products to certification. Showing it would be guesswork. |
| Pregnancy or medical "safe/unsafe" ratings | A medical claim; outside the no-medical-advice boundary. Only legal label statements and user-chosen lists (F2). |
| Silent automatic rating updates | Explicitly ruled out. D4 only opens issues for human review. |
| Ads, affiliate links, paid placement in alternatives | Destroys trust in the verdict. |
| Cloud OCR by default | Breaks "on-device by default". Kept only as opt-in T4. |
| Native rewrite (Kotlin/Swift) | One developer; the PWA plus TWA covers Android, and iOS gains little for the cost. |

---

## 3. Roadmap

### v2: "better and more accurate" (about 6–7 weeks of evenings, no backend)

The plan was split into smaller releases so each fits one session. The prompts are in `docs/V2_PROMPTS.md`.

| Release | Content |
|---|---|
| **v2.0 Safety net** | Q1, Q2, Q3, Q4, Q5, D5, A13 |
| **v2.1 Quick wins** | A2, A9, A10, P3, U6, T1, F9, C5 (family version), Q6, NOTICE |
| **v2.2 Automatic orientation** | A1, A3 |
| **v2.3 Smart crop and uncertain words** | A7, A4 |
| **v2.4 Romanian word list and curved packs** | D6, A5, A6 |
| **v2.5 Allergens (info only), vegan and palm oil** | F1, F5, A8, T2, U2 |
| **v2.6 Coverage, sources and dates** | D1, D3, T3 |
| **v2.7 Shopping mode and compare** | F7, F3 |
| **v2.8 Family profiles, sharing and accessibility** | F2, F10, U1, U3, U4, U5 |
| **v2.9 (optional) Share photos into the app** | C3 |

A11 (multithreading) remains an optional time-boxed spike (at most 2 evenings). It is adopted only if it gives at least 1.5× faster OCR with nothing broken.

### v3: "your data, read better, scored" (agreed 2026-11-15)

One release per session; each is tested, deployed on main and comes with a phone checklist.

| Release | Content | Items |
|---|---|---|
| **v3.0 Clean-up, update feedback, share fix** ✅ | Remove "Raportează o problemă" and posting to Open Facts (keep "Vezi pe Open … Facts"); disclaimer out of the footer (first run, About, one line on results, in full when something high-risk is flagged); "Actualizare reușită / nu a reușit" after "Reîncarcă" plus "Ce e nou" once; share target audit, several photos at once, reinstall hint (Android), not-supported note (iPhone) | 7, 10, 1, 2 |
| **v3.1 Measure text reading** ✅ (report: `docs/OCR_REAL.md`) | Corpus of real clear photos (RO, HU, BG, DE, IT, FR, PL): your photos in `tests/corpus/own/` plus Open Food Facts photos with CC BY-SA attribution; character and word error rate per language; time per photo (desktop and CPU-throttled as a mid-range proxy). No app change. Corpus never deployed. | 8 (part 1) |
| **v3.2 Better reading models** | Newer PaddleOCR Latin recogniser (diacritics ș ț ă î â), Cyrillic recogniser loaded only for Bulgarian, higher detection resolution on clear photos. Keep only what measurably helps; report before/after, download size, time. | 8 (part 2) |
| **v3.3 Your own ingredients text** | Per-barcode product record (text, source, original); automatic backup before migrating remembered ingredients and history; "Editează ingredientele" → "Re-analizează", "editat de tine", "Revino la textul original"; replace or complete database ingredients by photo or typing. An explicit edit wins; otherwise: Romanian from the database → your text → other languages. | 4, 6 (part 1) |
| **v3.4 Photo sets per product** | Front / ingredients / nutrition / origin / other, classified from the text, one-tap type change; ingredients photo read first; cancel; text merged per type; "Adaugă poze" on the result; thumbnails (~160 px) in IndexedDB with a cap, not in backups. | 3, 5 |
| **v3.5 Nutrition values** | Open Facts values and the nutrition-table photo; editable table with sanity checks; local Nutri-Score 2023 (general, drinks, fats/oils/nuts, cheese) marked "calculat de aplicație"; drinks inferred from ml + categories with a one-tap correction. | 12 |
| **v3.6 Language and translation** | Language detection; term-by-term on-device translation from the Open Food Facts ingredient and additive taxonomies (ODbL credit in NOTICE and About); E-numbers and INCI kept; unknown words highlighted; "tradus automat din {limba}" with the original a tap away; the browser translator only to display unknown words, never for analysis; dictionary-based word correction for OCR. | 6 (part 2), 8 (part 3) |
| **v3.7 Country of origin** | Origin data from Open Food Facts and photo text; supply chain ending in "Vândut în: {your country setting}" (default România); "De ce e bine / De ce nu e bine" from documented factors only; rules with sources in `src/data/origin.js`. No RASFF statistics, no ratings of countries. | 9 |
| **v3.8 Overall score 1–100** | `docs/SCORING.md` first; weights as agreed; caps 49 (high concern) and 25 (banned in the EU); calibrated on ~30 real products and locked in a golden test; "date insuficiente" without an ingredients list; "scor ingrediente" for cosmetics and household; personal score as the big number, the general score for sharing, compare and other profiles; versioned formula. | 11 |

Decisions (2026-11-15): measurement early; real photos from you and from Open Food Facts; thumbnails on the phone only; an explicit edit beats the Romanian database text; no RASFF statistics; personal score shown big; drinks inferred with a one-tap correction; the browser translator only for displaying unknown words.

Earlier v3 ideas ("connected": custom domain and Play Store, contributions to Open Facts, recalls, alternatives, cloud sync, donations) moved to "Later / maybe".

### Later / maybe

- Earlier v3 ideas: P5 custom domain and P1 Play Store; C1 contributions to Open Facts; D4/D2 data freshness and CosIng; F4 alternatives and F6 Green-Score; F8 recalls; T4 AI-vision fallback; C2 cloud sync; O2 donations.
- A12 WebGPU: wait until the benchmark harness can run on a real phone.
- C4 push notifications: needs F8 to be useful, plus a server.
- P2 App Store wrapper: cost and review risk.
- P4 lazy data: small gain.
- O3 share image.

### Rejected

See the rejected table in §2.

---

## 4. v2 item details

### A1. Automatic orientation (0/90/180/270°), before the crop step

**Problem.** Photos taken upside down or sideways where EXIF doesn't fix it: screenshots, gallery copies, some Android camera apps, or a phone held flat. Today:
- 90°/270°: almost all lines are dropped (`paddleCore.js`, the 45° check).
- 180°: the recogniser reads upside-down glyphs as junk with low confidence. Section extraction then finds no "Ingrediente" and the user sees "fotografia nu e destul de clară".

The crop step also shows the photo rotated, which is confusing.

**Proposed solution.** A new worker message `orient`, run on a downscaled copy right after the photo is decoded, before the crop screen.

1. **Downscale** the long side to 960 px.
2. **Run the detector once** (a quarter of the pixels of today's 1,920 px detection pass).
3. **Detect sideways text.** For each text component, compute the principal-axis (PCA) angle; the code already computes it and then throws the steep ones away. Weight each component by its area.
   - If more than 60% of the text area is steeper than 45°, the base orientation is 90°, so the candidates are {90°, 270°}.
   - Otherwise the candidates are {0°, 180°}.
4. **Decide the direction.** Take the ≤ 8 largest, most confident line boxes, cut them out for the first candidate angle, and run **PaddleOCR's direction classifier** (`ch_ppocr_mobile_v2.0_cls_infer.onnx`, 585 KB, 0° vs 180°, input 3×48×192 [verify the input shape and normalisation against PaddleOCR `cls_image_shape`]). Vote, weighted by classifier probability.
5. **Fallback when the classifier is unsure** (mean winning probability < 0.75, or a 50/50 vote) or failed to load: run the recogniser on the same ≤ 8 lines in both candidate orientations. Score = 0.5 × mean CTC confidence + 0.5 × share of tokens found in the lexicon (`lexicon.js`). Keep the higher score.
6. **Rotate** the full-resolution image (canvas, 90° steps, lossless) and show it in the crop step. A **"⟳ Rotește"** button (A2) always lets the user override. The choice is remembered for the "Fotografie nouă" retake.
7. **Guards:**
   - If the engine isn't downloaded yet (first photo), show the crop step at once and rotate when the engine is ready (with a small "se verifică orientarea…" note).
   - Time limit 3 s, then continue unrotated.
   - After OCR, A3 retries once at +180° when the result is weak (confidence < 55 and < 30% lexicon words).

**Cost on mid-range phones** (estimate, to be confirmed by Q6 timings):
- Detection at 960 px is about 25% of today's detection time.
- The classifier on 8 crops of 48×192 is tiny, probably < 100 ms [estimate].
- The recogniser fallback on 2 × 8 lines costs about 16 extra line reads, about 0.3–0.8 s.
- Expected total **0.5–1.5 s** before the crop screen, and only once the engine is cached.
- One-off download: +585 KB (the classifier).

**Files affected:**
- `src/lib/paddleCore.js`: export pure helpers `orientationFromComponents()`, `pickRotation()`, `lexiconScore()`, and keep the vertical components instead of discarding them.
- `src/workers/ocrWorker.js`: load the classifier lazily; add an `orient` message.
- `src/lib/ocr.js`: add `detectOrientation(bitmap)`.
- `src/lib/imagePrep.js`: add `rotateImage(img, deg)`.
- `src/components/PhotoFlow.jsx`: run orientation before the crop step; Rotate button; status line.
- `src/components/CropBox.jsx`: re-layout after rotation.
- `scripts/copy-ocr-assets.mjs` and `public/ocr/manifest.json`: add `paddle/cls.onnx`.
- `src/lib/i18n.js`: about 4 strings.
- `bench/ocr/*`: rotated variants.

**Acceptance criteria:**
- On the rotated benchmark (every label × 0/90/180/270°, flat and photo): orientation is correct in ≥ 95% of images (≥ 100% on flat renders).
- Key-ingredient recall on rotated images is within 3 points of the upright result.
- No regression on upright images: recall changes by less than 1 point and the median time increase is at most 25%.
- Orientation never blocks the UI for more than 3 s; the Rotate button works offline and before the engine has loaded.

**Tests and benchmark:**
- Unit tests (`tests/ocr.test.js`):
  - Synthetic probability maps with vertical lines give the 90° family.
  - `pickRotation` with tie, low-confidence and missing-classifier inputs.
  - `lexiconScore` on upright versus garbled text.
- Benchmark: `bench/ocr/make-rotations.mjs` generates rotated copies of the committed set, with EXIF stripped so the test is honest. Run via `npm run bench:ocr -- --rotations`; report orientation accuracy, recall and time.
- End-to-end: an upside-down photo goes through photo → crop (shown upright) → review containing "Ingrediente".

**Risks:**
- Packs whose text runs in two orientations (e.g. a vertical side strip): the area weighting and the user's crop handle it, and the button is the safety net.
- Wrong classifier preprocessing: guarded by the recogniser fallback and the benchmark.

### A2. Manual rotate button (crop step)

- **Problem:** there's no way out when a photo shows rotated (W1).
- **Solution:** "⟳ Rotește" rotates the preview and the source by 90° per tap (`rotateImage`) and resets the crop.
- **Files:** `PhotoFlow.jsx`, `CropBox.jsx`, `imagePrep.js`, `i18n.js`, `styles.css`.
- **Acceptance:**
  - Four taps return the original.
  - The OCR input matches the shown orientation.
  - Keyboard and screen-reader label work.
- **Tests:** pure `rotatedSize()` unit test; e2e on an upside-down image.
- **Risks:** memory on 12 MP photos, so rotate the downscaled 3000 px copy only.

### A3. Low-confidence retry

- **Problem:** weak reads go straight to the review step even when a cheap retry would fix them.
- **Solution:** in `PhotoFlow.read()`, if `needsBetterPhoto()` holds, retry once at +180°, then once with the detector at 2,560 px long side on the crop. Keep the best by lexicon score, and show "am încercat din nou" in the review.
- **Files:** `PhotoFlow.jsx`, `ocrText.js`, `paddleCore.js` (`detSize` parameter).
- **Acceptance:** no change for good reads; on the bench's blurred/small cases recall improves ≥ 5 points; worst-case added time ≤ 1.5× a single read.
- **Tests:** unit test for the retry decision; bench.
- **Risks:** slow phones, so the retry gets a visible progress label and a cancel button.

### A7. Auto-crop suggestion

- **Problem:** users skip cropping ("Sari peste"), which reads the whole pack: slower, and nutrition tables pollute the text. Crop: about 3.2 s versus about 4.7 s whole [measured].
- **Solution:** reuse the orientation detection pass. Cluster line boxes into blocks; recognise only the first line of each of the 6 largest blocks; preselect the block whose first line matches `findStart()` ("Ingrediente", "Ingredients", "Compoziție"…), expanded to the following lines until a gap greater than 2 line heights.
- **Files:** `paddleCore.js` (`clusterBlocks`), `ocrWorker.js`, `PhotoFlow.jsx`, `CropBox.jsx`.
- **Acceptance:** on the bench, the suggested box contains ≥ 95% of the ground-truth ingredient characters on ≥ 80% of images; the user can still move it or choose "whole photo".
- **Tests:** unit tests for `clusterBlocks` on synthetic boxes; bench metric "crop coverage".
- **Risks:** multilingual packs where the Romanian block comes later, so prefer the block that matches `ro` markers, then `en`.

### A9. Parallel lookup and caching "not found"

- **Problem:** W5.
- **Solution:**
  - Start all 3 requests together, keeping priority order: the chosen type's result wins if it arrives within its timeout. Return the first "found" in priority order and abort the rest.
  - Keep a not-found cache in localStorage for 24 h.
  - Keep the "error versus not found" rule.
- **Files:** `lookup.js`, `App.jsx` (nothing else), `tests/lookup.test.js`.
- **Acceptance:** with mocked delays, not-found ≤ max(single timeouts) instead of the sum; a priority hit is chosen even if a lower-priority answer arrives first; a second scan of an unknown code within 24 h answers instantly while online. The user can force a refresh with "Încearcă din nou".
- **Tests:** unit tests with a fake `fetchImpl` and controllable timers.
- **Risks:** 3× load on Open Facts. Mitigation: only the first request runs immediately, and the other two start after 1.5 s unless the first answers.

### A10. In-store barcodes

- **Problem:** W12.
- **Solution:** `isRestrictedCirculation(code)` for EAN-13 starting with 20–29. Show a "Cod intern al magazinului (produs cântărit)" card with a photo or paste prompt, and skip the Open Facts lookup.
- **Files:** `lookup.js`, `App.jsx`, `LookupViews.jsx`, `i18n.js`.
- **Acceptance:** no network request for those codes; the remembered-ingredients path still works for them.
- **Tests:** unit test; e2e.
- **Risks:** the GS1 Romania range use [verify]; worded as "probabil".

### A13 and D5. Data schema and alias-collision tests

- **Problem:** silent data mistakes (a duplicate alias, a missing translation, a region not in `REGIONS`).
- **Solution:** `tests/data.test.js` runs over all databases.
- **Acceptance:** fails on any alias mapped to two codes (unless whitelisted), an empty `why.ro`, an unknown level or region, or a malformed E-code.
- **Risks:** none.

### Q1/Q2. Benchmarks in the repository

- **Problem:** W7. The numbers quoted in v1.1–v1.4 can't be reproduced.
- **Solution:**
  - `bench/ocr/` holds images, `truth.json` (ingredient text and key words), `run.mjs` (starts `vite preview`, Playwright, runs the real worker) and `baseline.json`.
  - `bench/barcode/` has the same layout.
  - Images are compressed (≤ 300 KB each; the whole set ≤ 15 MB).
  - Real photos are added only with your permission (Open question 1).
- **Files:** `bench/**`, `package.json` scripts, `.gitattributes`.
- **Acceptance:** `npm run bench:ocr` prints CER, recall, orientation accuracy and median time per image and in total, and writes `bench/results/*.json`.
- **Risks:** repo size; desktop timings ≠ phone timings, so they're labelled.

### Q3/Q4. End-to-end tests and CI on every push

- **Problem:** W7, W8.
- **Solution:**
  - Playwright (Chromium is preinstalled in CI images via `npx playwright install --with-deps chromium` [verify the runner time]). Specs live in `e2e/`, with the Open Facts API mocked through `page.route`. OCR is covered by one smoke test using a tiny image.
  - `ci.yml` runs on push and pull_request: unit, e2e, build, bundle budget (main chunk ≤ 420 KB raw).
  - `deploy.yml` also runs the same tests before deploying.
- **Acceptance:** the CI run takes ≤ 6 min; a broken flow blocks the deploy.
- **Risks:** flakiness, so use no sleeps, only `waitFor` on stable selectors.

### Q6 and C5. Timing log and "report a problem"

- **Problem:** no way to learn about real-world failures without a backend.
- **Solution:**
  - Keep a ring buffer (last 20) of `{phase, ms, ok}` in localStorage.
  - "Raportează o problemă" on the review and result screens opens `github.com/<repo>/issues/new?title=…&body=…` with the app version, user agent, timings, OCR confidence and OCR text (the user can edit it). Never a photo.
  - A mailto fallback.
- **Acceptance:** the body stays under about 6 KB (URL length); nothing is sent automatically.
- **Risks:** personal text in the OCR, so the user sees the text and can edit it before sending.

### P3, U6, T1 and F9. Storage, settings, privacy, backup

- **Problem:** W9; no data overview; no backup of history and remembered ingredients.
- **Solution:**
  - Request `navigator.storage.persist()` after the first saved analysis.
  - Settings card in About:
    - Persistent storage status.
    - Storage used (`navigator.storage.estimate()`).
    - "Descarcă motorul OCR acum".
    - Export/import of everything as one JSON file (history, remembered ingredients, avoid list).
    - "Șterge toate datele" with confirmation.
  - A privacy section listing exactly what leaves the device.
- **Files:** `AboutView.jsx`, `history.js`, `savedIngredients.js`, new `backup.js`, `i18n.js`.
- **Acceptance:** round-trip export → clear → import restores everything; delete-all leaves no keys or stores behind.
- **Tests:** unit test for backup round-trip; e2e for delete-all.
- **Risks:** an import from an older version, so the file carries a version and is migrated.

### O1. Licence

- **Solution:** a `LICENSE` file (your choice), plus `NOTICE.md` listing Open Facts (ODbL, attribution), PaddleOCR models (Apache-2.0 [verify]), onnxruntime (MIT), zxing-cpp (Apache-2.0) and Space Grotesk (OFL).
- **Acceptance:** About links to NOTICE.

### A4. Highlight uncertain words in the review step

- **Problem:** users must proofread the whole text; most of it is right.
- **Solution:** return per-character probabilities from `ctcDecode` and per-word minimums from the worker. The review shows the text in an editable field with words below 0.75 underlined; tapping one selects it.
- **Files:** `paddleCore.js`, `ocrWorker.js`, `ocr.js`, `PhotoFlow.jsx`, `styles.css`.
- **Acceptance:** on the bench, ≥ 70% of wrong words are highlighted and ≤ 15% of correct words are.
- **Risks:** the editable highlighted field is fiddly on mobile. A simpler start: a list of uncertain words with "corectează" buttons.

### A5 and D6. Lexicon and corpus from Romanian Open Food Facts data

- **Problem:** W4.
- **Solution:**
  - `scripts/build-corpus.mjs` (run by hand, not in CI) pages through Romanian products and stores `bench/corpus/ro-ingredients.jsonl` (about 500–2,000 lists, with code and licence note).
  - `scripts/build-lexicon.mjs` counts words with diacritics (frequency ≥ 3) and writes `src/data/lexicon-ro.js` (about 5k words, roughly 40 KB [estimate]), lazily loaded with the OCR code only.
- **Acceptance:** diacritics restored correctly for ≥ 98% of corpus words with the diacritics stripped; no correction creates an additive or allergen word that wasn't in the OCR text (property test).
- **Risks:** Open Facts' polite-use limits, so throttle to 1 request/s and identify the app in the query [verify their guidance].

### A6. Two or three photos for curved packs

- **Problem:** text wraps around jars and bottles; one photo misses one side.
- **Solution:**
  - The review step gets an "Adaugă o fotografie (continuarea textului)" button. Each photo is OCR'd separately.
  - The merge finds the longest overlap between the last 3 lines of the previous text and the first 3 lines of the new one (normalised Levenshtein ≤ 0.25) and joins them without the duplicate. Without an overlap, it appends with " … ".
  - At most 3 photos.
- **Files:** `ocrText.js` (`mergeOcrTexts`), `PhotoFlow.jsx`, `i18n.js`.
- **Acceptance:** unit cases (exact overlap, fuzzy overlap, no overlap, reversed order not merged); a bench pair made from a cylinder render.
- **Risks:** wrong order, so the user sees thumbnails in order and can remove one.

### C3. Web Share Target

- **Problem:** photos already in the gallery need several taps.
- **Solution:** a manifest `share_target` (POST, multipart, `image/*`). The service worker catches the POST, stores the file in Cache Storage, and redirects to `./?share=1`; App opens PhotoFlow with it. Android and installed PWA only [verify Chrome support details].
- **Files:** `vite.config.js` (manifest; switch to `injectManifest` for a custom service-worker handler [verify vite-plugin-pwa requirements]), `src/sw.js`, `App.jsx`.
- **Acceptance:** sharing a photo from Google Photos opens the crop step.
- **Risks:** the service-worker switch is the risky part, so it goes in its own release with the update flow re-tested.

### F1. Allergens (EU 14 + traces)

- **Problem:** W6. This is the most-requested safety use for families.
- **Solution:**
  - `src/data/allergens.js`: 14 groups with RO/EN terms. Examples:
    - Cereals containing gluten: grâu, secară, orz, ovăz, spelt, kamut…
    - The other groups: crustacee, ouă, pește, arahide, soia, lapte (lactoză, cazeină, zer), fructe cu coajă, țelină, muștar, susan, dioxid de sulf/sulfiți > 10 mg/kg, lupin, moluște.
  - Matching reuses `matchTerms` with negation handling.
  - "Poate conține / urme de / may contain" sentences go into a separate `traces` list.
  - Lookup requests `allergens_tags,traces_tags`; the union is shown with a source tag ("etichetă" / "Open Food Facts").
  - The user picks the allergens to watch (a new avoid-list section). Hits go to the verdict as `avoid`, and "traces" is configurable (Open question 4).
  - Wording: "Eticheta menționează: lapte, soia. Urme posibile: alune." **Never "nu conține alergeni".** When nothing is found: "Nu am găsit alergenii urmăriți în textul citit. Verifică eticheta – alergenii sunt scriși îngroșat."
- **Files:** `allergens.js`, `analyze.js`, `lookup.js` (`FOOD_FIELDS`), `avoidPresets.js` / `AvoidListView.jsx`, `Result.jsx`, `share.js`, `i18n.js`, `history.js` (store tags).
- **Acceptance:**
  - On the golden corpus (A8): recall ≥ 98% of allergens that Open Food Facts tags on the same products.
  - No allergen hit inside "fără lactoză" (negation).
  - Traces are never merged with "conține".
- **Tests:** unit tests per group with diacritic and OCR variants; a corpus snapshot; the T2 wording test.
- **Risks:** false negatives on OCR errors ("lapte" read as "lapfe"), reduced by A5 and by the persistent "verifică eticheta" note.

### F5. Vegan/vegetarian and palm oil

- **Solution:** prefer Open Food Facts `ingredients_analysis_tags` (`en:vegan`, `en:non-vegan`, `en:maybe-vegan`, `en:palm-oil`, `en:palm-oil-free`… [verify the tag list]); otherwise a local animal-ingredient list giving "probabil nevegan" or "nu am găsit ingrediente de origine animală". Shown as chips; not in the verdict unless the user adds them to the avoid list.
- **Acceptance:** agrees with Open Food Facts tags on ≥ 95% of corpus products that have them.
- **Risks:** "maybe" being read as a guarantee, so the chips say "după ingrediente".

### A8. Golden corpus tests

- **Solution:** `tests/corpus.test.js` runs `analyze()` on `bench/corpus/ro-ingredients.jsonl` and compares a compact snapshot (codes, levels, allergens, type, NOVA estimate) with `tests/__snapshots__/corpus.json`. Updating it is deliberate: `UPDATE_SNAPSHOTS=1 npm test`. It also reports unknown E-codes (which feed D1).
- **Acceptance:** runs in < 5 s; a diff shows per-product changes.
- **Risks:** large snapshot diffs, so keep the snapshot compact (one line per product).

### D1. Missing E-numbers

- **Solution:** add every E-number from the EU Union list (Reg. 1333/2008 Annex II [verify the current consolidated version]) that isn't in `additives.js`, with level `none`/`low`, a one-line function and the source. Higher levels only with a cited EFSA opinion.
- **Acceptance:** zero unknown E-codes on the corpus, except ones not authorised in the EU (shown as such).
- **Risks:** time, so batch by category.

### D3, T2, T3 and U2. Sources, dates and wording

- **Solution:**
  - Optional per-entry `reviewed` and `sources: [{title, url}]`, shown in the expanded item ("Surse · verificat 14 nov. 2026").
  - Product data shows Open Food Facts `last_modified_t` [verify the field].
  - A wording test scans RO/EN strings for banned words in allergen and profile contexts ("sigur", "fără risc", "safe", "potrivit pentru sarcină").
  - A one-line summary sits at the top of the result.
- **Acceptance:** the schema test allows sources; strings pass the wording test.

### F7. Shopping mode

- **Problem:** in the shop, every product means scan → result → back → scan.
- **Solution:** in the scanner overlay, "Mod cumpărături" keeps the camera open. Each confirmed code (deduplicated for 10 s) adds a compact card (name, verdict colour, top reason, remembered/needs-photo badge) to a bottom sheet. Tapping a card opens the full result; the session list stays until closed. Lookups run in the background with A9.
- **Files:** `ScannerOverlay.jsx`, new `ShoppingSheet.jsx`, `App.jsx`, `scanner.js` (continuous mode), `i18n.js`, `styles.css`.
- **Acceptance:** 5 products scanned in a row without leaving the camera; each card appears ≤ 1 s after a cached lookup; one-handed reach (controls in the bottom 40%).
- **Risks:** battery and heat, so it stops after 5 minutes idle.

### F3. Compare two products

- **Solution:** in history, long-press or a "Compară" checkbox on two items opens a two-column view: verdict, NOVA, Nutri-Score, nutrient levels, flagged items (shared ones highlighted), allergens.
- **Files:** `HistoryView.jsx`, new `CompareView.jsx`, `App.jsx`, `i18n.js`.
- **Acceptance:** works offline from history; readable at 320 px (stacked rows, not two narrow columns).
- **Risks:** none significant.

### F2 and F10. Profiles and sharing by link

- **Solution:** `avoid` state becomes `{profiles: [{id, name, avoid, allergens}], active}`, migrated from the current single state. A profile switcher sits on the result ("pentru: Copil"). Presets only cite legal label statements. "Trimite lista" builds `…/#import=<base64url JSON>`, and opening it shows a preview before importing.
- **Acceptance:** migration keeps current lists; no data in the query string (fragment only); the import preview requires confirmation.
- **Risks:** URL length for big lists (compress with `CompressionStream` [verify support] or cap the size).

### U1, U3, U4 and U5. In-shop UX and accessibility

- **Solution:**
  - U1: a setting "Pornește direct scanerul" plus thumb-zone layout checks.
  - U3: axe-core runs in e2e on every screen (no serious or critical violations); 200% zoom without horizontal scroll; score tiles get an `aria-label` sentence.
  - U4: "Încearcă cu un exemplu" in onboarding.
  - U5: a glossary page linked from the "?" next to NOVA, Nutri-Score, DZA and status pills.
- **Acceptance:** axe clean; the manual TalkBack checklist is in `docs/a11y.md`.

---

## 5. Top 5 quick wins this week

1. **A9 + A10, faster "not found" and in-store codes.** About 2 evenings; removes the most noticeable wait in the shop.
2. **A2, a Rotate button in the crop step.** 1 evening; unblocks upside-down or sideways photos today, before A1.
3. **P3 + T1 + F9, persistent storage, privacy page and backup.** 1–2 evenings; protects history and remembered ingredients from eviction.
4. **D5/A13, data schema tests, plus Q4, CI on every push.** 1 evening; cheap insurance for every later data change.
5. **C5, "Raportează o problemă" pre-filled issue.** 1 evening; real-world failure reports with no backend and no hidden data flow.

---

## 6. Open questions

1. **Real photos:** can you take 20–30 ingredient photos of Romanian products (some curved, some upside down or sideways, some blurry), and may they be committed to the public repo? Without them the benchmark stays synthetic.
2. **Domain:** are you willing to buy a custom domain (about €10/yr)? It's the simplest path to the Play Store (TWA needs `/.well-known/assetlinks.json` at the domain root) and it looks more trustworthy. The alternative is moving the app to a `catalinprodan87-hash.github.io` user-site repo.
3. **Stores:** for v3, is the Play Store worth the $25 fee plus a 12-tester × 14-day closed test? Do you use or need iOS at all?
4. **Allergen traces:** should "poate conține urme de…" for a watched allergen raise the verdict (to "warn"), or only be shown as information?
5. **Audience:** is this mainly for you and your family, or a public launch in Romania? That decides how far to go on support, legal pages, usage stats and outreach to the Open Food Facts Romania community.
6. **Licence:** MIT (anyone may reuse, including closed apps) or AGPL-3.0 (improvements must stay open)? Any preference about others forking the app?
7. **Contributing to Open Facts (v3):** should users log in with their **own** Open Facts account (cleaner, their name on the edit), or would you rather run one app account? I recommend their own account; Open Facts' policy on app accounts needs checking.
8. **Sync:** do you actually need a family list synced between phones, or is "share the list by link" (no server, no account) enough? If it's enough, Supabase and the GDPR work drop out of v3.
