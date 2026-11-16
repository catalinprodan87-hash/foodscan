/**
 * The overall score 1–100 (v3.8), as described in docs/SCORING.md.
 * Pure: the same inputs always give the same score. Unit- and golden-tested.
 */
import {
  SCORE_VERSION, WEIGHTS, LEVEL_PENALTY, GRADE_POINTS, NOVA_POINTS, ORIGIN, COMPLETENESS,
  AVOID, CAP_HIGH, CAP_BANNED, LOW_OCR, BANDS, EU_BANNED,
} from '../data/scoring.js';
import './strings/score.js';

const clamp = (x) => Math.max(0, Math.min(100, x));
export const bandFor = (score) => (score == null ? null : BANDS.find((b) => score >= b.from).id);

/** Ingredients written on the label (rough count: commas and semicolons outside brackets). */
export function countIngredients(text) {
  let depth = 0;
  let n = 0;
  let current = '';
  for (const ch of String(text || '')) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) { if (current.trim()) n++; current = ''; } else current += ch;
  }
  return n + (current.trim() ? 1 : 0);
}

/**
 * @param {object} args
 * @param {object} args.result      analyze() result (with the active avoid list)
 * @param {string} [args.text]      the ingredients text shown
 * @param {string|null} [args.grade] Nutri-Score grade (database or computed by the app)
 * @param {{known: boolean, points: {kind}[]}|null} [args.origin] assessOrigin() result
 * @param {number|null} [args.ocrConfidence] when the text was read from a photo
 * @returns {{version, kind, insufficient, general, personal, band, personalBand, confidence, parts, caps, avoidHits}}
 */
export function computeScore({ result, text = '', grade = null, origin = null, ocrConfidence = null } = {}) {
  const food = result?.productType === 'food';
  const kind = food ? 'food' : 'ingredients';
  const hasText = !!String(text).trim();
  const tagged = food && (result?.items?.some((x) => x.matchedBy?.includes('tag')) ?? false);
  const avoidHits = result?.avoidHits?.length || 0;
  const base = { version: SCORE_VERSION, kind, avoidHits };
  if (!result || (!hasText && !tagged)) {
    return { ...base, insufficient: true, general: null, personal: null, band: null, personalBand: null, confidence: null, parts: [], caps: [] };
  }

  const counts = result.counts || {};
  const ingredientsPoints = clamp(100 - LEVEL_PENALTY.high * (counts.high || 0) - LEVEL_PENALTY.medium * (counts.medium || 0) - LEVEL_PENALTY.low * (counts.low || 0));
  const parts = [{ id: 'ingredients', points: ingredientsPoints, detail: { high: counts.high || 0, medium: counts.medium || 0, low: counts.low || 0 } }];
  const nova = result.processing?.nova ?? null;
  const g = typeof grade === 'string' ? grade.toLowerCase() : null;
  let confidence;

  if (food) {
    if (GRADE_POINTS[g] != null) parts.push({ id: 'nutrition', points: GRADE_POINTS[g], detail: { grade: g } });
    if (NOVA_POINTS[nova] != null) parts.push({ id: 'processing', points: NOVA_POINTS[nova], detail: { nova } });
    const plus = origin?.points?.filter((p) => p.kind === 'plus').length || 0;
    const minus = origin?.points?.filter((p) => p.kind === 'minus' && p.id !== 'unknown').length || 0;
    const known = !!origin?.known;
    parts.push({ id: 'origin', points: known ? clamp(ORIGIN.base + ORIGIN.plus * plus - ORIGIN.minus * minus) : ORIGIN.unknown, detail: { known, plus, minus } });
    const haveGrade = parts.some((p) => p.id === 'nutrition');
    const haveNova = parts.some((p) => p.id === 'processing');
    parts.push({
      id: 'completeness',
      points: COMPLETENESS.ingredients + (haveGrade ? COMPLETENESS.nutrition : 0) + (haveNova ? COMPLETENESS.processing : 0) + (known ? COMPLETENESS.origin : 0),
      detail: { nutrition: haveGrade, processing: haveNova, origin: known },
    });
    confidence = haveGrade && haveNova ? 'high' : haveGrade || haveNova ? 'medium' : 'low';
  } else {
    const n = countIngredients(text);
    parts.push({ id: 'avoid', points: 100, detail: { hits: avoidHits } });
    parts.push({ id: 'completeness', points: n >= 3 ? 100 : 50, detail: { count: n } });
    confidence = n >= 3 ? 'high' : 'low';
  }
  if (ocrConfidence != null && ocrConfidence < LOW_OCR) confidence = confidence === 'high' ? 'medium' : 'low';

  // Weighted sum; the weights of missing parts are shared out among the others.
  const weights = WEIGHTS[kind];
  const totalWeight = parts.reduce((s, p) => s + weights[p.id], 0);
  for (const p of parts) { p.weight = weights[p.id]; p.share = weights[p.id] / totalWeight; }
  const sum = (ps) => ps.reduce((s, p) => s + p.points * p.share, 0);

  const caps = [];
  const banned = (result.items || []).filter((x) => EU_BANNED[food ? 'food' : result.productType]?.[x.code]).map((x) => x.code);
  if (banned.length) caps.push({ id: 'banned', max: CAP_BANNED, codes: banned });
  if (counts.high) caps.push({ id: 'high', max: CAP_HIGH });
  const capped = (x) => Math.min(Math.round(x), ...caps.map((c) => c.max));

  const general = Math.max(1, capped(sum(parts)));
  let personal = general;
  if (avoidHits) {
    if (food) personal = Math.max(1, Math.min(general - AVOID.food * avoidHits, AVOID.cap));
    else {
      const withAvoid = parts.map((p) => (p.id === 'avoid' ? { ...p, points: clamp(100 - AVOID.ingredientsPart * avoidHits) } : p));
      personal = Math.max(1, Math.min(capped(sum(withAvoid)), AVOID.cap));
    }
  }
  return { ...base, insufficient: false, general, personal, band: bandFor(general), personalBand: bandFor(personal), confidence, parts, caps };
}
