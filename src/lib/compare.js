/**
 * Two history entries side by side: what each analysis finds, re-run with the
 * current avoid list (works offline, from the history). Pure, unit-tested.
 */
import { analyze } from './analyze.js';
import { entryAnalyzeInput } from './history.js';
import { scoreForEntry } from './scoreEntry.js';

const FLAGGED = ['high', 'medium'];
const NUTRIENTS = ['fat', 'saturatedFat', 'sugars', 'salt'];

/** @returns {{a: object, b: object, shared: {flagged: string[], allergens: string[], avoid: string[]}}} */
export function compareEntries(entryA, entryB, avoid, saleCountry = 'RO') {
  const side = (e) => {
    const r = analyze(entryAnalyzeInput(e), avoid);
    const levels = Object.fromEntries((e.db?.nutrition?.items || []).map((n) => [n.key, n.level]));
    return {
      entry: e,
      productType: r.productType,
      verdict: r.verdict,
      score: scoreForEntry(e, saleCountry), // general score (v3.8)
      nova: r.processing?.nova ?? null,
      nutriscore: r.nutriscore ?? e.grade ?? null,
      nutrients: Object.fromEntries(NUTRIENTS.map((k) => [k, levels[k] || null])),
      flagged: r.items.filter((x) => FLAGGED.includes(x.level)).map((x) => ({ code: x.code, name: x.name, level: x.level })),
      avoid: r.avoidHits.map((h) => ({ id: h.id, label: h.label })),
      allergens: (r.allergens?.contains || []).map((x) => x.id),
      counts: r.counts,
    };
  };
  const a = side(entryA);
  const b = side(entryB);
  const both = (x, y) => x.filter((v) => y.includes(v));
  return {
    a,
    b,
    shared: {
      flagged: both(a.flagged.map((x) => x.code), b.flagged.map((x) => x.code)),
      allergens: both(a.allergens, b.allergens),
      avoid: both(a.avoid.map((x) => x.id), b.avoid.map((x) => x.id)),
    },
  };
}

export { NUTRIENTS };
