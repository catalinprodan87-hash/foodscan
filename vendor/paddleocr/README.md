# PaddleOCR PP-OCRv5 recognisers (ONNX)

Copied into `public/ocr/paddle/` by `scripts/copy-ocr-assets.mjs`. Kept in the repository because the model hosts (Hugging Face, Git LFS) are rate-limited or unreachable from the build.

| File | Use | SHA-256 |
|---|---|---|
| `latin_PP-OCRv5_mobile_rec_infer.onnx` | Latin script, ~45 languages incl. Romanian (ă â î ș ț), Hungarian, Polish, Czech, Croatian, German, French, Italian | `497dbed20b7fd86334c9deb5082c2958982a316bb16e3589ebc6502cd85cae79` |
| `ppocrv5_latin_dict.txt` | its characters | `7274e68c7675355e45dd75c360c83faa0d0624de33a704c799a7da8897662201` |
| `cyrillic_PP-OCRv5_mobile_rec_infer.onnx` | Cyrillic (Bulgarian, Serbian, Russian, Ukrainian, Macedonian…) and English | `0d91040605ef7bdca6868fad6cad1664840d031e9f6d40d54607df5b50fa280a` |
| `ppocrv5_cyrillic_dict.txt` | its characters | `90822a96058eb83f8e637ace75f90cbd36c41253f9dbdfb88fcf5a2bdd50d669` |

- **Models:** PP-OCRv5 mobile recognition models by [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR), Apache-2.0.
- **ONNX exports and dictionaries:** [PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models](https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models) (`recognition/multi/{latin,cyrillic}/v5/`), Apache-2.0, unchanged.
- **Dictionary format:** the first line is empty and is not a model class. `copy-ocr-assets.mjs` drops it, and the worker appends the space class.

Measured with `npm run bench:real`: see `docs/OCR_REAL.md`.
