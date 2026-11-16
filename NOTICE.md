# Third-party credits and licences

IngrediScan uses the following data and software. Thank you to everyone who builds and maintains them.

## Product data

| Source | Licence | Notes |
|---|---|---|
| [Open Food Facts](https://world.openfoodfacts.org) | Database: [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/); contents: [DbCL 1.0](https://opendatacommons.org/licenses/dbcl/1-0/); product photos: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Barcode lookups for food. Each result links to the product page. |
| [Open Beauty Facts](https://world.openbeautyfacts.org) | Same as above | Cosmetics. |
| [Open Products Facts](https://world.openproductsfacts.org) | Same as above | Household and other products. |

The benchmark corpus that later releases build from Open Food Facts data stays under the ODbL, with attribution in its file header.

**Translation dictionaries** (`public/dict/{lang}.json`, built by `scripts/build-dictionary.mjs`): derived from the Open Food Facts ingredient and additive taxonomies, © Open Food Facts contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). They are downloaded on the phone only for the languages actually read. The credit also appears in the app (About).

The real-photo benchmark (`tests/corpus/off/`, never deployed) includes ingredient photos from Open Food Facts by Open Food Facts contributors, under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/); `tests/corpus/off/truth.json` links each photo to its source. The photos in `tests/corpus/own/` were taken by the app's owner. `tests/fixtures/nutriscore-off.json` holds Nutri-Score inputs and results computed by Open Food Facts for 175 products (ODbL), used only to check the app's Nutri-Score. `tests/fixtures/score-golden.json` holds product data (no photos) from Open Food Facts, Open Beauty Facts and Open Products Facts (ODbL), used only to calibrate and test the overall score.

## Software bundled with or downloaded by the app

| Component | Licence | Used for |
|---|---|---|
| [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) PP-OCRv4 detector and direction classifier (via the npm package [paddle-ocr-onnx-models](https://www.npmjs.com/package/paddle-ocr-onnx-models)) | Apache-2.0 | Finding text lines in photos, on the phone |
| [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) PP-OCRv5 Latin and Cyrillic recognisers, ONNX exports from [ppu-paddle-ocr-models](https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models) (in `vendor/paddleocr/`) | Apache-2.0 | Reading the text, with diacritics and Cyrillic |
| [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) | MIT | Running the OCR models in the browser |
| [ZXing-C++](https://github.com/zxing-cpp/zxing-cpp) via [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) | Apache-2.0 / MIT | Reading barcodes |
| [React](https://react.dev) | MIT | User interface |
| [Workbox](https://github.com/GoogleChrome/workbox) (via vite-plugin-pwa) | MIT | Offline support and updates |
| [Space Grotesk](https://github.com/floriankarsten/space-grotesk) (via [@fontsource](https://fontsource.org)) | SIL Open Font License 1.1 | Heading font |

## Development tools (not shipped)

Vite, vite-plugin-pwa, @vitejs/plugin-react (MIT) and Playwright (Apache-2.0) are used to build and test the app.

## Ingredient information

The explanations in `src/data/` are written for this app and cite their sources: EU regulations (EUR-Lex), EFSA, SCCS, ECHA, IARC, the US FDA, California OEHHA, Health Canada and others. They are listed in the app under **Despre → Surse**.

## This app

The IngrediScan code has no licence file yet, so all rights are reserved by its author. See `docs/ROADMAP.md` (O1) for the open decision.
