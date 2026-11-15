/**
 * Local diagnostics for "Raportează o problemă": the last 20 timings
 * (lookups, OCR phases) in localStorage, and the report text built from them.
 * Nothing is ever sent automatically – the user shares the report themselves.
 */
const KEY = 'ingrediscan:timings';
export const TIMINGS_MAX = 20;

function storage(ls) {
  if (ls !== undefined) return ls;
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Adds one timing: phase ('lookup', 'ocr'…), duration, success, short detail. */
export function recordTiming(phase, ms, ok = true, detail = '', { ls, now = new Date() } = {}) {
  const s = storage(ls);
  try {
    const list = JSON.parse(s?.getItem(KEY) || '[]');
    list.push({ phase, ms: Math.round(ms), ok: !!ok, detail: String(detail).slice(0, 60), at: now.toISOString() });
    s?.setItem(KEY, JSON.stringify(list.slice(-TIMINGS_MAX)));
  } catch { /* private mode / quota */ }
}

export function getTimings({ ls } = {}) {
  try { return JSON.parse(storage(ls)?.getItem(KEY) || '[]'); } catch { return []; }
}

/**
 * Plain-text report the user can read and edit before sharing.
 * @param {{version, userAgent, lang, screen, timings, ocr?: {confidence, text}, note?}} info
 */
export function buildReport({ version, userAgent, lang, screen, timings = [], ocr = null, product = null }) {
  const lines = [
    'IngrediScan – raport problemă / problem report',
    '',
    'Ce s-a întâmplat / What happened:',
    '',
    '',
    '— Detalii tehnice / Technical details —',
    `Versiune / Version: ${version}`,
    `Ecran / Screen: ${screen || '–'}`,
    `Limbă / Language: ${lang}`,
    `Browser: ${userAgent}`,
  ];
  if (product) lines.push(`Produs / Product: ${[product.name, product.code].filter(Boolean).join(' · ')}`);
  if (ocr) {
    lines.push(`OCR încredere / confidence: ${ocr.confidence}%`);
    lines.push('Text citit / OCR text:');
    lines.push(String(ocr.text || '').slice(0, 1500));
  }
  if (timings.length) {
    lines.push('Ultimele timpi / Last timings:');
    for (const x of timings.slice(-TIMINGS_MAX)) {
      lines.push(`  ${x.at.slice(5, 16).replace('T', ' ')} ${x.phase} ${x.ms} ms ${x.ok ? 'ok' : 'FAIL'}${x.detail ? ` (${x.detail})` : ''}`);
    }
  }
  return lines.join('\n');
}
