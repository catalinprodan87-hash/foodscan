# The overall score (1–100), v3.8

**Formula version: `scoreVersion = 1`.** Every saved score carries the version it was computed with. If the formula changes, the version goes up, old history entries are recomputed from their saved data, and a golden test (`tests/fixtures/score-golden.json`) shows every product whose score moved.

The score sums up what the app already shows. It adds no new judgement. It is information, not medical advice. A low score does not mean a product is unsafe: everything sold legally in the EU meets EU food or cosmetics law.

## When there is no score

- **"Date insuficiente" / "Not enough data"**: there is no ingredients list (no text and no additive tags from the database). No number is shown, because a number would look more certain than it is.
- The other cards (nutrition, origin) still show what is known.

## Food

| Part | Weight | 100 means | How it is computed |
|---|---:|---|---|
| Ingredients and additives | 40% | no additive that deserves attention | `100 − 35 × high − 15 × medium − 5 × low`, minimum 0. Levels are the app's existing ones (`src/data/additives.js`, `src/data/restrictions.js`: the worst of the EU level and restrictions in other countries, each with its source). |
| Nutrition | 35% | Nutri-Score A | A = 100, B = 75, C = 50, D = 25, E = 0. Uses the database grade, or the grade computed by the app from consistent values (v3.5). |
| Processing (NOVA) | 15% | NOVA 1 | NOVA 1 = 100, 2 = 80, 3 = 50, 4 = 0. Database value, or the app's estimate. |
| Origin | 5% | documented pluses only | Unknown = 50. Known: `70 + 15 × plus − 20 × minus`, between 0 and 100. Pluses and minuses are the ones on the origin card (v3.7, `src/data/origin.js`). "Good to know" points do not count. |
| Completeness | 5% | everything is known | Ingredients list 40 + nutrition grade 30 + NOVA 15 + known origin 15. |

**Missing parts:** if the nutrition grade or NOVA is not known, its weight is shared out among the parts that are known, in proportion to their weights. Completeness shows that something was missing.

## Cosmetics and household products: "scor ingrediente"

Labelled **"Scor ingrediente" / "Ingredient score"**, because it only looks at the ingredient list. There is no nutrition, processing or origin.

| Part | Weight | How it is computed |
|---|---:|---|
| Ingredient risk | 80% | Same as food: `100 − 35 × high − 15 × medium − 5 × low` (levels from `src/data/nonFoodIngredients.js`). |
| Your avoid list | 10% | General score: 100. Personal score: `100 − 50 × hits`, minimum 0. |
| Completeness | 10% | 100 for a list of at least 3 ingredients, 50 for a shorter one (probably not read in full). |

## Caps

They are applied after the weighted sum.

- **At most 49** when any ingredient has the "high" level.
- **At most 25** when an ingredient is banned or not allowed in the EU for this kind of product. The list is in `src/data/scoring.js`, each entry with its regulation:
  - **Food:** E171 (Reg. 2022/63); E443, E924 and E927a (not authorised, Reg. 1333/2008 Annex II).
  - **Cosmetics only:** the ingredients banned by Reg. 1223/2009 Annex II and its amendments (e.g. isopropyl- and isobutylparaben, Lilial, HICC, zinc pyrithione, MDBGN, hydroquinone, mercury, TPO, DMTA, DBP, D4, coal tar).

## General and personal score

- **General score:** the formula above, the same for everyone.
- **Personal score:** the general score, then for each hit on the active profile's avoid list `−15` (food) and a cap of at most 49. The result says so: "Scorul tău: 34 (general 64) – conține ingrediente din lista ta".
- **Which one is shown where:**
  - The personal score is the big number on the result.
  - **Sharing, compare and other family profiles** use the general score, because someone else's avoid list says nothing about your choice.

## Bands and colours

| Score | Band (RO / EN) | Colour |
|---|---|---|
| 0–24 | Slab / Poor | red |
| 25–49 | Sub medie / Below average | orange |
| 50–74 | Acceptabil / Fair | yellow-green |
| 75–100 | Bun / Good | green |

The number is always shown with its band word, so colour is never the only signal.

## Confidence

- **Ridicată / High:** ingredients, nutrition grade and NOVA are all known.
- **Medie / Medium:** ingredients and one of the other two are known.
- **Scăzută / Low:** only the ingredients are known.
- Medium and low show **"scor estimat – date incomplete"** under the number.
- For cosmetics and household products: high with a list of at least 3 ingredients, otherwise low.
- Text read from a photo with OCR confidence below 70% lowers the confidence by one step.

## Breakdown

Under the number, each part is listed with its points out of 100, its weight and a short reason ("2 aditivi de evitat", "Nutri-Score D", "NOVA 4", "origine necunoscută"). Any cap is named ("plafonat la 49: un ingredient cu nivel ridicat").

## Calibration

Checked on 32 products from Open Food Facts, Open Beauty Facts and Open Products Facts (`scripts/build-score-golden.mjs`, data under ODbL, no photos), across categories. The first try mapped Nutri-Score A–E to 100/80/55/30/10 and NOVA 1–4 to 100/85/60/20. With that, sweets and spreads graded E and NOVA 4 without flagged additives (Nutella, Kinder Bueno, Toffifee) came out at 53–55. Since then both tables are linear (A–E = 100/75/50/25/0, NOVA 1–4 = 100/80/50/0), and they land at 47–49.

| Product | Group | Nutri-Score | NOVA | Score |
|---|---|:-:|:-:|--:|
| Apă minerală naturală, natural carbogazoasă | water | A | 1 | **97** |
| PERRIER eau minérale naturelle gazeuse 1L | water | A | – | **99** |
| Huile d'olive vierge extra | oil | B | 2 | **88** |
| EXTRA VIRGIN OLIVE OIL | oil | B | 2 | **85** |
| Spaghetti Nº5 | pasta | A | 1 | **99** |
| Copos de Avena Integral | oats | A | 1 | **99** |
| Jemné ovesné vločky | oats | A | – | **99** |
| Wasa integrale | crispbread | A | 3 | **89** |
| SKYR ICELANDIC STYLE NATURAL | dairy | A | 1 | **99** |
| Philadelphia 300g | dairy | D | 3 | **65** |
| Irische Butter | butter | E | – | **56** |
| Grana Padano DOP rallado/ralado | cheese-pdo | D | 3 | **64** |
| Kalifornische Pistazien geröstet | nuts | A | – | **98** |
| Tofu natural | tofu | A | 3 | **92** |
| Thunfisch Filets in Sonnenblumenöl | fish | A | 3 | **90** |
| Tomatensoße Napoletana | sauce | A | 4 | **84** |
| Tomato Ketchup | ketchup | D | 3 | **63** |
| Pesto alla Genovese | pesto | E | 4 | **49** |
| Nutella | spread | E | 4 | **49** |
| Kinder bueno | sweets | E | 4 | **49** |
| Biscoff | biscuits | E | 4 | **48** |
| Toffifee 15er | sweets | E | 4 | **47** |
| gullon zero wafer vanilla | biscuits | D | – | **71** |
| Pringles originale | crisps | D | 4 | **53** |
| 098230 TUC Original | crackers | E | 4 | **41** |
| Coca-Cola Original | soft-drink | E | 4 | **39** |
| Coca-Cola Zero Sugar | soft-drink | C | 4 | **50** |
| Fanta Naranja | soft-drink | E | 4 | **33** |
| HELL | energy-drink | E | 4 | **47** |
| moisturising cream | cosmetic | – | – | **92** |
| Pampers fresh clean | cosmetic | – | – | **88** |
| linguettes HUGGIES pure | cosmetic | – | – | **96** |

- These scores are locked in `tests/fixtures/score-golden.json`.
- `tests/v38.test.js` fails if one changes while `SCORE_VERSION` stays the same.
- Checks in the same test:
  - plain foods (water, oats, pasta, olive oil, plain skyr, nuts) score at least 80;
  - sweets and spreads graded E and NOVA 4 score below 50;
  - the order follows Nutri-Score when ingredients and NOVA are equal.
- **Known limit:** the Gullón wafer's database ingredients are text misread from the pack, so its processing estimate (NOVA 1) is wrong and its score too high. Wrong data gives a wrong score; the confidence level cannot catch that.
