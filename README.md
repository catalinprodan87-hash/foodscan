# IngrediScan

Installable web app (PWA) that checks supermarket product ingredients and flags risky additives and ingredients you want to avoid. Interface in **Romanian** and **English**.

> **Phase 1 of 4 – foundation.** Paste an ingredients list and get a verdict. Camera, barcode scanning and OCR come in later phases.

**Live:** https://catalinprodan87-hash.github.io/foodscan/

## Features (phase 1)

- Paste ingredients text → verdict banner (not recommended / consume with care / looks fine), NOVA processing level, avoid-list hits and an expandable additive list with risk pills and reasons.
- Additive database with 160+ E-numbers (RO + EN names, label aliases, short reasons citing EFSA, EU Regulation 1333/2008, IARC or the US FDA).
- Detects E-numbers in many written forms (`E 250`, `E-211`, `e330`, `E150d`, `E407a`, `E322(i)`), fixes common OCR errors (`E33O` → `E330`, `El50d` → `E150d`) and ignores Romanian "e 100%".
- Matches additive names (longest alias wins; `BHA`/`MSG` only as standalone capitals).
- Avoid list with presets: palm oil, glucose-fructose syrup, hydrogenated fats (on by default), added sugars, flavourings, maltodextrin, modified starch.
- NOVA estimate when no database value is available.
- RO/EN switch (default from the browser language), mobile-first, works offline once installed.

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
│   │   ├── IngredientInput.jsx
│   │   ├── AvoidSettings.jsx  # Toggle avoid-list presets
│   │   ├── Result.jsx         # Verdict banner, NOVA card, avoid hits
│   │   ├── AdditiveList.jsx   # Expandable additives with risk pills
│   │   └── Disclaimer.jsx
│   ├── data/
│   │   ├── additives.js       # E-number database
│   │   └── avoidPresets.js    # Avoid-list presets (RO + EN terms)
│   └── lib/
│       ├── analyze.js         # Analysis engine (pure, runs in Node too)
│       ├── i18n.js            # Strings, t(), detectLang()
│       └── storage.js         # localStorage helpers (language, avoid list)
├── tests/
│   └── analyze.test.js        # node:test suite
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
  { text: 'zahăr, ulei de palmier, E150d', additiveTags: ['en:e322i'], nova: null, nutriscore: null },
  { presets: { palm: true, sugar: false }, custom: [] }, // optional; defaults to preset defaults
);
// result.verdict      'bad' | 'warn' | 'ok' | 'unknown'
// result.reasons      [{ type: 'high' | 'avoid' | 'medium' | 'nova4' | 'nutriscore', count?, grade? }]
// result.additives    sorted high → medium → low → unknown → none
// result.avoidHits    [{ id, label: {en, ro}, matches: [...] }]
// result.processing   { nova: 1-4 | null, source: 'database' | 'estimate' | null, markers: [...] }
// result.counts       { high, medium, low, none, unknown, total }
```

Verdict rules: any high-risk additive or avoid-list hit → **bad**; otherwise any medium additive, NOVA 4 or Nutri-Score D/E → **warn**; otherwise **ok**; no input → **unknown**.

## Deployment (GitHub Pages)

The workflow in `.github/workflows/deploy.yml` runs the tests, builds and deploys on every push to `main` (and can be started manually from the Actions tab).

One-time setup: in the repository go to **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.

## Disclaimer

For information only, not medical advice. All additives sold in the EU are approved and considered safe at permitted levels; the ratings show which ones deserve extra attention.
