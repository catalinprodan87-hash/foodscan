/**
 * Allergens (EU 14, Reg. 1169/2011 Annex II) in an ingredients text, kept
 * apart from "may contain" traces, merged with Open Food Facts' own tags.
 * INFORMATION ONLY: never part of the verdict, never "allergen-free".
 * Pure, unit-tested.
 */
import { ALLERGENS } from '../data/allergens.js';
import { normalize, compileTerm } from './analyze.js';

/*
 * Where precautionary labelling starts ("Poate conține urme de lapte."):
 * from the marker to the end of its sentence the text is "traces".
 */
const TRACE_MARKER = /(?:poate|pot|poate sa)\s+contine(?:\s+urme)?|urme\s+de|(?:may|can)\s+contain|traces?\s+of|produs\s+(?:intr-o|in|intr-un)\s+(?:fabrica|unitate|spatiu|mediu)[^.;]*?(?:care|unde)\s+(?:se\s+)?(?:proceseaza|prelucreaza|foloseste|utilizeaza|manipuleaza)/g;

/** Splits normalised text into what the product contains and its "may contain" parts. */
export function splitTraces(text) {
  const norm = normalize(String(text || ''));
  const parts = [];
  let last = 0;
  const traces = [];
  for (const m of norm.matchAll(TRACE_MARKER)) {
    if (m.index < last) continue;
    const end = (() => {
      const rest = norm.slice(m.index + m[0].length);
      const stop = rest.search(/[.;]\s|[.;]$|\n/);
      return stop < 0 ? norm.length : m.index + m[0].length + stop;
    })();
    parts.push(norm.slice(last, m.index));
    traces.push(norm.slice(m.index + m[0].length, end));
    last = end;
  }
  parts.push(norm.slice(last));
  return { contains: parts.join(' '), traces: traces.join(' ; ') };
}

const NEGATED_BEFORE = /(?:^|[^a-z0-9])(?:fara|without|no|free\s+from|free\s+of)\s*$/;
const NEGATED_AFTER = /^[\s-]*(?:free|liber)(?![a-z0-9])/;

const compiled = new Map();
const re = (term) => {
  if (!compiled.has(term)) compiled.set(term, compileTerm(term).re);
  return compiled.get(term);
};

/** The terms of one allergen group found in normalised text: matched snippets. */
function matchGroup(group, norm) {
  const out = new Set();
  for (const term of group.terms) {
    const r = re(term);
    r.lastIndex = 0;
    let m;
    while ((m = r.exec(norm))) {
      const start = m.index;
      const end = start + m[0].length;
      const before = norm.slice(Math.max(0, start - 30), start);
      const after = norm.slice(end, end + 16);
      if (NEGATED_BEFORE.test(before) || NEGATED_AFTER.test(after)) continue;
      if ((group.notAfter || []).some((x) => new RegExp(`^[\\s(]*${x}(?![a-z])`).test(after))) continue;
      if ((group.notBefore || []).some((x) => new RegExp(`${x.replace(/-/g, '[\\s-]*')}[\\s(]*(?:din\\s+|de\\s+|from\\s+)?$`).test(before))) continue;
      out.add(m[0].trim());
    }
  }
  return [...out];
}

/**
 * @param {string} text ingredients text
 * @param {{codes?: (string|{code, matches})[], offAllergens?: string[], offTraces?: string[]}} extra
 *   codes: additives found (sulphites E220–E228), with their matched words when known;
 *   off*: Open Food Facts tags
 * @returns {{contains: Entry[], traces: Entry[]}} Entry: {id, matches: string[], sources: ('label'|'database')[]}
 *   An allergen listed as contained is not repeated under traces.
 */
export function findAllergens(text, { codes = [], offAllergens = [], offTraces = [] } = {}) {
  const { contains, traces } = splitTraces(text);
  const result = { contains: new Map(), traces: new Map() };
  const put = (kind, id, source, matches = []) => {
    const e = result[kind].get(id) || { id, matches: [], sources: [] };
    for (const m of matches) if (!e.matches.includes(m)) e.matches.push(m);
    if (!e.sources.includes(source)) e.sources.push(source);
    result[kind].set(id, e);
  };
  for (const g of ALLERGENS) {
    const inText = matchGroup(g, contains);
    // An additive counts only when its words are in the "contains" part (not in "may contain").
    const fromCodes = (g.codes || []).filter((c) => codes.some((x) => (typeof x === 'string' ? x === c
      : x.code === c && (!x.matches?.length || x.matches.some((m) => contains.includes(normalize(m)))))));
    if (inText.length || fromCodes.length) put('contains', g.id, 'label', [...inText, ...fromCodes]);
    if (g.off.some((t) => offAllergens.includes(t))) put('contains', g.id, 'database');
    const inTraces = matchGroup(g, traces);
    if (inTraces.length) put('traces', g.id, 'label', inTraces);
    if (g.off.some((t) => offTraces.includes(t))) put('traces', g.id, 'database');
  }
  for (const id of result.contains.keys()) result.traces.delete(id);
  const order = (m) => ALLERGENS.map((g) => g.id).filter((id) => m.has(id)).map((id) => m.get(id));
  return { contains: order(result.contains), traces: order(result.traces) };
}
