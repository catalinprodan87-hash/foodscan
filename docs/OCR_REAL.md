# Text reading on real photos – measurement (v3.1)

Measured 2026-11-15 with `npm run bench:real` (`bench/real/`), on 20 photos:

- **12 photos taken in Romanian shops** (`tests/corpus/own/`), as they are usually taken: hand-held, whole back of the pack, some sideways, one with strong glare. Languages on them: RO, BG, HR, HU, CS, SK, SR, EL, EN.
- **8 ingredient photos from Open Food Facts** (`tests/corpus/off/`, CC BY-SA 3.0, sources in `truth.json`), mostly already cropped to the ingredients by their contributors. Languages: DE, FR, IT, PL.

Every text block (ingredients per language, origin, storage, preparation) was transcribed by hand. Nutrition tables are scored by the share of row names and values found. Each photo is read the way the app does it: EXIF applied, automatic orientation, then the reading engine (PaddleOCR PP-OCRv4 English recogniser in a Web Worker, ONNX Runtime WebAssembly).

**CER / WER**: character / word error rate of a block, found anywhere in the text the reader returned. **Strict**: ă â î ș ț and other accents must be right. **Folded**: accents removed, which is how the analysis matches ingredients.

## Baseline (the app as it is in v3.0)

### All the text of a photo, per language

| Language | Blocks | Characters | CER strict | CER folded | WER folded |
|---|---:|---:|---:|---:|---:|
| ro – Romanian | 20 | 5021 | 47.7% | 45.2% | 74.6% |
| de – German | 4 | 865 | 6.1% | 4.6% | 35.9% |
| fr – French | 2 | 1017 | 45.5% | 43.9% | 72.7% |
| it – Italian | 2 | 630 | 37.8% | 37.6% | 64.9% |
| pl – Polish | 1 | 303 | 16.2% | 14.9% | 79.5% |
| hu – Hungarian | 3 | 1300 | 26.6% | 18.5% | 63.9% |
| en – English | 1 | 267 | 48.3% | 48.3% | 71.1% |
| cs – Czech | 1 | 393 | 60.3% | 55.7% | 94.0% |
| sk – Slovak | 1 | 157 | 28.7% | 21.7% | 75.0% |
| hr – Croatian | 3 | 1014 | 74.7% | 74.4% | 97.2% |
| sr – Serbian (Latin) | 3 | 508 | 12.0% | 10.0% | 47.9% |
| bg – Bulgarian (Cyrillic) | 6 | 1838 | 88.7% | 88.7% | 98.5% |
| el – Greek | 1 | 179 | 87.2% | 87.2% | 100% |

- **Nutrition tables:** 43% of row names and 66% of values found.
- **What the app does by itself** (crop suggestion, then the reading step) on each photo's ingredients, Romanian first:
  - 49.3% CER folded.
  - The "Ingrediente:" heading was found on 5 of 18 photos.
- **Two photos of one label merged** (instant noodles, ro-03 + ro-04): 55% CER folded. Alone: 57% and 63%.

### Per photo

| Photo | Turned | CER folded, all blocks | App: ingredients CER folded |
|---|---:|---:|---:|
| ro-01 sunflower oil | 0° | 3.0% | 0% |
| ro-02 instant noodles (preparation, table) | 0° | 77.0% | – |
| ro-03 instant noodles (right half) | 0° | 70.2% | 44.4% |
| ro-04 instant noodles (left half) | 0° | 72.2% | 48.1% |
| ro-05 cream for cakes | **180° – wrong** | 89.4% | 90.6% |
| ro-06 ketchup | 0° | 45.8% | 27.3% |
| ro-07 rice-chocolate dragées (table, sideways) | 90° | (table only) | – |
| ro-08 rice-chocolate dragées (ingredients, sideways, glare) | 270° | 30.1% | 57.2% |
| ro-09 fruit-yoghurt sweets | 0° | 53.3% | 57.5% |
| ro-10 milk chocolate bars | 0° | 49.5% | 78.3% |
| ro-11 dark chocolate with hazelnuts | 0° | 41.0% | 35.6% |
| sr-01 white chocolate (SR / EL) | 0° | 30.1% | 92.2% |
| off-de ×3, off-fr ×2, off-it ×2, off-pl ×1 | 0° (fr pesto: **180° – wrong**) | 0.4–85% | 0–83% |

## What goes wrong

1. **Narrow letters are squeezed out.** Food labels use condensed fonts. The recogniser gives each 8 pixels of a line one "slot", and a narrow letter gets fewer than two. Thin characters (i, l, r, commas, spaces) vanish: "21,2%" becomes "212%", "din alcool" becomes "dinalcool", "rafinat" becomes "rfinat". This explains most errors on Latin text and the high word error rates (words glued together). The line pictures sent to the recogniser are sharp, so this is not a photo-quality problem.
2. **Wrong orientation on 2 of 20 photos.** ro-05 (upright cream sachet) and the French pesto label (white text on dark blue) were turned 180° before reading. The orientation check reads short pieces both ways, and those pieces suffer from problem 1.
3. **No letters for most languages.** The recogniser knows 95 ASCII characters:
   - no ă â î ș ț (strict vs folded CER);
   - no Cyrillic (Bulgarian: 89% CER);
   - no Greek;
   - no Czech, Croatian or Hungarian accents.
4. **Close lines merge.** On dense labels (ketchup storage text, nutrition tables), two neighbouring lines sometimes come out as one box, which then reads as nothing.
5. **The app picks the wrong part of the photo.** On multi-language packs the automatic crop often frames another language or the nutrition table. The heading was found on only 5 of 18 photos. On the Italian pasta the whole text reads at 2.9% CER, but the app's extracted ingredients come out at 83%.

## Preview for v3.2: stretching each line 2× before recognition

The same 20 photos with one change: each line is stretched to twice its width before recognition (`recWidth` × 2, max 4000 px). The app was not changed in v3.1. This is only what v3.2 starts from.

| | Baseline | Stretched 2× |
|---|---:|---:|
| ro – CER folded | 45.2% | **24.7%** |
| fr | 43.9% | **8.3%** |
| it | 37.6% | **15.1%** |
| en | 48.3% | **4.1%** |
| pl | 14.9% | 9.6% |
| de | 4.6% | 3.2% |
| hu | 18.5% | 16.8% |
| bg (Cyrillic, no model) | 88.7% | 86.4% |
| Wrong orientation | 2 of 20 | **0 of 20** |
| Nutrition: row names / values found | 43% / 66% | 69% / 58% |
| App by itself: ingredients CER folded, heading found | 49.3%, 5/18 | 44.5%, 11/18 |
| Time per photo (median, desktop) | 9.3 s all text / 15.3 s app | 15.6 s / 25.2 s |

Plan for v3.2:
- Tune the stretch (1.5× vs 2×) against time and nutrition values.
- Then try:
  - a newer Latin recogniser with diacritics;
  - the Cyrillic recogniser, loaded only for Bulgarian;
  - keeping close lines apart;
  - better choice of the ingredients block on multi-language packs.

## Time per photo

Measured in headless Chromium on the build container (desktop-class CPU, one WebAssembly thread):
- whole-photo read: median 9.3 s, up to 22 s on the densest packs;
- the app's full path (orientation, crop suggestion, reading with retries): median 15 s, up to 28 s.

CPU throttling in Chrome DevTools slows only the page, not the reading worker (4× throttling: 10.8 s became 12.7 s). So it can't stand in for a mid-range phone. Phone times need to be taken on the phone. As a rough guide, a mid-range Android phone runs WebAssembly 2–4× slower than this machine.

## How to run

```
npm run bench:real                      # all photos (about 10 minutes)
npm run bench:real -- --only=ro-06      # one photo
npm run bench:real -- --det=2560        # detector input size
node bench/real/debug.mjs ro-06-ketchup.jpg 2 3   # line boxes and what the recogniser sees
```

Results go to `bench/results/real.{json,md}` (not committed). `bench/real/baseline.json` holds the baseline summary above.

To add your own photos, put them in `tests/corpus/own/` as `{language}-{number}-{product}.jpg` and add their text to `tests/corpus/own/truth.json`.
