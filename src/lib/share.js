/**
 * Sharing a result, "add this product" links, and highlighting flagged words
 * in the ingredients text. Pure, unit-tested.
 */
import { t, pick } from './i18n.js';
import { sourceFor, SOURCE_NAMES } from './lookup.js';

/**
 * Open *Facts "add a product" page for a barcode (the site's search-or-add
 * form: it opens the add page when the barcode is unknown).
 */
export function addProductUrl(type, code) {
  const base = sourceFor(type) || sourceFor('food');
  return `${base}/cgi/product.pl?type=search_or_add&action=process&code=${encodeURIComponent(code)}`;
}

export function addProductLinks(code, firstType = 'food') {
  const order = ['food', 'cosmetic', 'household'];
  const types = [firstType, ...order.filter((x) => x !== firstType)].filter((x) => order.includes(x));
  return types.map((type) => ({ type, name: SOURCE_NAMES[type], url: addProductUrl(type, code) }));
}

const FLAGGED = ['high', 'medium'];

/**
 * Text summary for the Web Share API / clipboard.
 * @returns {{title: string, text: string, url: string}}
 */
export function shareSummary(result, { lang = 'ro', product = null, barcode = null, appUrl = '', text = '' } = {}) {
  const food = result.productType === 'food';
  const snippet = text.replace(/\s+/g, ' ').trim();
  const fromText = snippet ? `„${snippet.length > 40 ? `${snippet.slice(0, 38)}…` : snippet}”` : '';
  const name = product?.name || (barcode ? `${t(lang, 'barcode')} ${barcode}` : fromText || t(lang, 'type_' + result.productType));
  const verdictKey = !food && result.verdict === 'warn' ? 'verdict_warn_nonfood' : 'verdict_' + result.verdict;
  const lines = [`${name}: ${t(lang, verdictKey)}`];
  const flagged = result.items.filter((x) => FLAGGED.includes(x.level));
  if (flagged.length) {
    const list = flagged.map((x) => `${food ? x.code + ' ' : ''}${pick(x.name, lang)} (${t(lang, 'level_' + x.level)})`);
    lines.push(`${t(lang, food ? 'additivesTitle' : 'itemsTitle')}: ${list.join(', ')}`);
  }
  if (result.avoidHits.length) {
    lines.push(`${t(lang, 'avoidTitle')}: ${result.avoidHits.map((h) => pick(h.label, lang)).join(', ')}`);
  }
  if (food && result.processing?.nova) lines.push(`NOVA ${result.processing.nova}`);
  if (result.nutriscore) lines.push(`Nutri-Score ${result.nutriscore.toUpperCase()}`);
  if (product?.url) lines.push(product.url);
  lines.push(`— IngrediScan ${appUrl}`.trim());
  return { title: `IngrediScan: ${name}`, text: lines.join('\n'), url: appUrl };
}

// ─────────────────────────────── highlighting ─────────────────────────────

const RANK = { high: 0, medium: 1, avoid: 2, low: 3 };

/** Safe DOM id for an item code ("MCI/MI" → "item-MCI-MI"). */
export function itemDomId(code) {
  return 'item-' + String(code).replace(/[^A-Za-z0-9_-]/g, '-');
}

function occurrences(text, snippet) {
  const out = [];
  if (!snippet) return out;
  for (let i = text.indexOf(snippet); i !== -1; i = text.indexOf(snippet, i + snippet.length)) {
    out.push([i, i + snippet.length]);
  }
  return out;
}

/**
 * Flagged spans in the analysed text: items rated high / medium / low and
 * avoid-list hits. Overlaps are resolved by severity (high wins).
 * @returns {{start, end, level, target}[]} sorted by start
 */
export function collectSpans(text, result) {
  const cands = [];
  for (const item of result.items) {
    if (!(item.level in RANK)) continue;
    for (const m of item.matches) {
      for (const [start, end] of occurrences(text, m)) cands.push({ start, end, level: item.level, target: itemDomId(item.code) });
    }
  }
  for (const hit of result.avoidHits) {
    for (const m of hit.matches) {
      for (const [start, end] of occurrences(text, m)) cands.push({ start, end, level: 'avoid', target: 'avoid-hits' });
    }
  }
  cands.sort((a, b) => RANK[a.level] - RANK[b.level] || (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  const taken = [];
  for (const c of cands) {
    if (!taken.some((x) => c.start < x.end && x.start < c.end)) taken.push(c);
  }
  return taken.sort((a, b) => a.start - b.start);
}

/** Splits text into plain and highlighted segments. */
export function highlightSegments(text, spans) {
  const out = [];
  let pos = 0;
  for (const s of spans) {
    if (s.start > pos) out.push({ text: text.slice(pos, s.start) });
    out.push({ text: text.slice(s.start, s.end), level: s.level, target: s.target });
    pos = s.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}
