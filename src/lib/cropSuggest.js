/**
 * Suggested crop: the text block that starts with an ingredients heading.
 * The OCR worker groups the detected lines into blocks and reads the first
 * lines of the largest ones ('suggest' message); this picks the block whose
 * line holds the heading – Romanian first, then English, INCI, "Conține:" –
 * and frames it from that line down. Pure (unit-tested).
 */
import { findStart } from './ocrText.js';

const KIND_RANK = { ro: 0, en: 1, inci: 2, contains: 3, fuzzy: 4 };
export const CROP_PAD = 0.02; // margin around the block, share of the photo

/**
 * @param {{width: number, height: number, blocks: {left, top, right, bottom,
 *          lines: {bounds: {left, top, right, bottom}, text?: string}[]}[]}} m
 * @returns {{rect: {x, y, w, h}, kind: string, marker: string}|null} rect normalised 0–1
 */
export function pickIngredientBlock(m) {
  if (!m?.blocks?.length || !m.width || !m.height) return null;
  let best = null;
  m.blocks.forEach((block, order) => {
    block.lines.forEach((line, index) => {
      if (!line.text) return;
      const start = findStart(line.text);
      if (!start) return;
      const rank = KIND_RANK[start.kind] ?? 5;
      if (!best || rank < best.rank || (rank === best.rank && order < best.order)) {
        best = { block, index, rank, order, kind: start.kind, marker: start.marker };
      }
    });
  });
  if (!best) return null;
  const lines = best.block.lines.slice(best.index);
  const left = Math.min(...lines.map((l) => l.bounds.left));
  const right = Math.max(...lines.map((l) => l.bounds.right));
  const top = Math.min(...lines.map((l) => l.bounds.top));
  const bottom = Math.max(...lines.map((l) => l.bounds.bottom));
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const x = clamp(left / m.width - CROP_PAD);
  const y = clamp(top / m.height - CROP_PAD);
  const x2 = clamp(right / m.width + CROP_PAD);
  const y2 = clamp(bottom / m.height + CROP_PAD);
  if (x2 - x < 0.05 || y2 - y < 0.02) return null;
  return { rect: { x, y, w: x2 - x, h: y2 - y }, kind: best.kind, marker: best.marker };
}

/** Share of rect `truth` covered by rect `guess` (both normalised [x, y, w, h] or {x, y, w, h}). */
export function coverage(guess, truth) {
  const g = Array.isArray(guess) ? { x: guess[0], y: guess[1], w: guess[2], h: guess[3] } : guess;
  const t = Array.isArray(truth) ? { x: truth[0], y: truth[1], w: truth[2], h: truth[3] } : truth;
  const iw = Math.max(0, Math.min(g.x + g.w, t.x + t.w) - Math.max(g.x, t.x));
  const ih = Math.max(0, Math.min(g.y + g.h, t.y + t.h) - Math.max(g.y, t.y));
  return (iw * ih) / (t.w * t.h || 1);
}
