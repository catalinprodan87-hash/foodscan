/**
 * Nutri-Score, 2023 algorithm (Santé publique France, update of the
 * Nutri-Score algorithm for foods 2022 and beverages 2023), computed on the
 * phone when the database has no grade (v3.5). Checked against the grades
 * Open Food Facts computes for 175 products sold in Romania
 * (tests/fixtures/nutriscore-off.json). Pure, unit-tested.
 *
 * Inputs per 100 g (or 100 ml for drinks): energyKj, sugars, saturatedFat,
 * fat, salt, protein, fibre, fvl (% fruits, vegetables, legumes),
 * sweeteners (non-nutritive sweeteners present, drinks only).
 * Category: 'general' | 'drink' | 'water' | 'fats' (fats, oils, nuts, seeds) | 'cheese' | 'redMeat'.
 */

// Points: the number of thresholds the value is above (strictly).
const points = (value, thresholds) => {
  if (value == null || !Number.isFinite(value)) return 0;
  let p = 0;
  for (const t of thresholds) if (value > t) p++;
  return p;
};

const T = {
  energy: [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350],
  energyFromSat: [120, 240, 360, 480, 600, 720, 840, 960, 1080, 1200],
  sugars: [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51],
  saturatedFat: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  satRatio: [10, 16, 22, 28, 34, 40, 46, 52, 58, 64],
  salt: [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4],
  protein: [2.4, 4.8, 7.2, 9.6, 12, 14, 17],
  fibre: [3, 4.1, 5.2, 6.3, 7.4],
  // drinks
  drinkEnergy: [30, 90, 150, 210, 240, 270, 300, 330, 360, 390],
  drinkSugars: [0.5, 2, 3.5, 5, 6, 7, 8, 9, 10, 11],
  drinkProtein: [1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3],
};

/** Fruit, vegetable and legume points (foods / drinks). */
function fvlPoints(fvl, drink) {
  if (fvl == null) return 0;
  if (drink) return fvl > 80 ? 6 : fvl > 60 ? 4 : fvl > 40 ? 2 : 0;
  return fvl > 80 ? 5 : fvl > 60 ? 2 : fvl > 40 ? 1 : 0;
}

/**
 * @param {object} n nutrients per 100 g / 100 ml (see above)
 * @param {string} category
 * @returns {{grade: 'a'|'b'|'c'|'d'|'e', score: number, negative: object, positive: object, proteinCounted: boolean}|null}
 *   null when energy, sugars, saturated fat or salt are missing
 */
export function nutriScore(n, category = 'general') {
  if (category === 'water') return { grade: 'a', score: 0, negative: {}, positive: {}, proteinCounted: false };
  const drink = category === 'drink';
  const fats = category === 'fats';
  const energyKj = n.energyKj ?? (n.energyKcal != null ? n.energyKcal * 4.184 : null);
  if (energyKj == null || n.sugars == null || n.saturatedFat == null || n.salt == null) return null;

  const negative = {};
  if (drink) {
    negative.energy = points(energyKj, T.drinkEnergy);
    negative.sugars = points(n.sugars, T.drinkSugars);
    negative.saturatedFat = points(n.saturatedFat, T.saturatedFat);
    negative.salt = points(n.salt, T.salt);
    negative.sweeteners = n.sweeteners ? 4 : 0;
  } else if (fats) {
    negative.energyFromSat = points(n.saturatedFat * 37, T.energyFromSat);
    negative.sugars = points(n.sugars, T.sugars);
    const ratio = n.fat > 0 ? (n.saturatedFat / n.fat) * 100 : 0;
    negative.satRatio = ratio >= 64 ? 10 : T.satRatio.filter((t) => ratio >= t).length;
    negative.salt = points(n.salt, T.salt);
  } else {
    negative.energy = points(energyKj, T.energy);
    negative.sugars = points(n.sugars, T.sugars);
    negative.saturatedFat = points(n.saturatedFat, T.saturatedFat);
    negative.salt = points(n.salt, T.salt);
  }
  const N = Object.values(negative).reduce((a, b) => a + b, 0);

  const positive = {
    protein: points(n.protein, drink ? T.drinkProtein : T.protein),
    fibre: points(n.fibre, T.fibre),
    fvl: fvlPoints(n.fvl, drink),
  };
  if (category === 'redMeat') positive.protein = Math.min(positive.protein, 2);
  // Protein counts unless the food is "bad enough" (cheese and drinks: always).
  const proteinCounted = drink || category === 'cheese' || N < (fats ? 7 : 11);
  const P = positive.fibre + positive.fvl + (proteinCounted ? positive.protein : 0);
  const score = N - P;
  return { grade: gradeFor(score, category), score, negative, positive, proteinCounted };
}

/** Score → letter, per category (2023 thresholds). */
export function gradeFor(score, category = 'general') {
  if (category === 'water') return 'a';
  if (category === 'drink') return score <= 2 ? 'b' : score <= 6 ? 'c' : score <= 9 ? 'd' : 'e';
  if (category === 'fats') return score <= -6 ? 'a' : score <= 2 ? 'b' : score <= 10 ? 'c' : score <= 18 ? 'd' : 'e';
  return score <= 0 ? 'a' : score <= 2 ? 'b' : score <= 10 ? 'c' : score <= 18 ? 'd' : 'e';
}
