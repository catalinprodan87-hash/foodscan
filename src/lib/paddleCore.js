/**
 * PaddleOCR (PP-OCRv4) pipeline maths, without ONNX Runtime or canvas:
 * text-line boxes from the detector's probability map, CTC decoding of the
 * recogniser output, and reading order. Unit-tested in tests/ocr.test.js.
 */

export const DET_MAX_SIDE = 1920; // small print needs a large detection input
export const DET_THRESH = 0.3; // probability threshold for text pixels
export const BOX_THRESH = 0.5; // minimum mean probability of a line
export const UNCLIP = 1.6; // DB "unclip" ratio
export const REC_HEIGHT = 48;
export const MIN_LINE_CONF = 0.5;

/**
 * Detector input size: long side ≤ maxSide, both sides multiples of 32.
 * With `upscale` a small photo is enlarged towards maxSide (at most 2×), so
 * small print gets more pixels per letter.
 */
export function detSize(width, height, maxSide = DET_MAX_SIDE, upscale = false) {
  const k = Math.min(upscale ? 2 : 1, maxSide / Math.max(width, height));
  return {
    w: Math.max(32, Math.ceil((width * k) / 32) * 32),
    h: Math.max(32, Math.ceil((height * k) / 32) * 32),
  };
}

/**
 * Text lines from a DB probability map (connected components), each as an
 * oriented rectangle in source-image coordinates: {cx, cy, angle, len, thick}.
 * Lines on tilted labels are long and slanted, so an upright box would
 * swallow the neighbouring lines; the rectangle follows each line's angle.
 * @param {Float32Array} prob w×h probabilities
 * @param {number} sx, sy  scale from map pixels to source pixels
 */
export function linesFromProbMap(prob, w, h, sx = 1, sy = 1, opts = {}) {
  return componentsFromProbMap(prob, w, h, sx, sy, opts).filter((b) => !b.vertical);
}

/**
 * All text components of a DB probability map as oriented rectangles, also
 * the steep ones (`vertical: true`, |angle| > 45°): on a photo taken sideways
 * every line is steep. linesFromProbMap() keeps only the readable ones.
 * Each: {cx, cy, angle, len, thick, score, area, vertical}.
 */
export function componentsFromProbMap(prob, w, h, sx = 1, sy = 1, { thresh = DET_THRESH, boxThresh = BOX_THRESH, unclip = UNCLIP } = {}) {
  const N = w * h;
  const seen = new Uint8Array(N);
  const boxes = [];
  const stack = [];
  const xs = [];
  const ys = [];
  for (let s0 = 0; s0 < N; s0++) {
    if (seen[s0] || prob[s0] <= thresh) continue;
    xs.length = 0;
    ys.length = 0;
    let sum = 0;
    stack.push(s0);
    seen[s0] = 1;
    while (stack.length) {
      const p = stack.pop();
      const px = p % w;
      const py = (p - px) / w;
      xs.push(px);
      ys.push(py);
      sum += prob[p];
      if (px > 0 && !seen[p - 1] && prob[p - 1] > thresh) { seen[p - 1] = 1; stack.push(p - 1); }
      if (px < w - 1 && !seen[p + 1] && prob[p + 1] > thresh) { seen[p + 1] = 1; stack.push(p + 1); }
      if (py > 0 && !seen[p - w] && prob[p - w] > thresh) { seen[p - w] = 1; stack.push(p - w); }
      if (py < h - 1 && !seen[p + w] && prob[p + w] > thresh) { seen[p + w] = 1; stack.push(p + w); }
    }
    const n = xs.length;
    if (n < 12 || sum / n < boxThresh) continue;
    let mx = 0;
    let my = 0;
    for (let i = 0; i < n; i++) { mx += xs[i] * sx; my += ys[i] * sy; }
    mx /= n;
    my /= n;
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] * sx - mx;
      const dy = ys[i] * sy - my;
      sxx += dx * dx;
      syy += dy * dy;
      sxy += dx * dy;
    }
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const vertical = Math.abs(angle) > Math.PI / 4; // steep: sideways text (read after rotating the photo)
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    let u0 = Infinity;
    let u1 = -Infinity;
    let v0 = Infinity;
    let v1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] * sx - mx;
      const dy = ys[i] * sy - my;
      const u = dx * ux + dy * uy;
      const v = -dx * uy + dy * ux;
      if (u < u0) u0 = u;
      if (u > u1) u1 = u;
      if (v < v0) v0 = v;
      if (v > v1) v1 = v;
    }
    const len0 = u1 - u0 + sx;
    const thick0 = v1 - v0 + sy;
    if (thick0 < 3) continue;
    const dist = (len0 * thick0 * unclip) / (2 * (len0 + thick0));
    const thick = thick0 + 2 * dist;
    const uc = (u0 + u1) / 2;
    const vc = (v0 + v1) / 2;
    boxes.push({
      cx: mx + uc * ux - vc * uy,
      cy: my + uc * uy + vc * ux,
      angle,
      len: len0 + 2 * dist + thick * 0.8, // room for first / last letters
      thick,
      score: sum / n,
      area: n * sx * sy,
      vertical,
    });
  }
  return boxes;
}

/** Recogniser input width for a line box (height 48). */
export function recWidth(box, height = REC_HEIGHT) {
  return Math.max(16, Math.min(2000, Math.ceil((box.len / box.thick) * height)));
}

/**
 * Greedy CTC decoding. probs: T×C (class 0 = blank, class i = dict[i-1]).
 * @returns {{text: string, conf: number}}
 */
export function ctcDecode(probs, T, C, dict) {
  let text = '';
  let last = 0;
  let confSum = 0;
  let confN = 0;
  for (let t = 0; t < T; t++) {
    let best = 0;
    let bv = -Infinity;
    const off = t * C;
    for (let c = 0; c < C; c++) {
      const v = probs[off + c];
      if (v > bv) { bv = v; best = c; }
    }
    if (best !== 0 && best !== last) {
      text += dict[best - 1] ?? '';
      confSum += bv;
      confN++;
    }
    last = best;
  }
  return { text, conf: confN ? confSum / confN : 0 };
}

/**
 * Recognised lines → text in reading order: lines top to bottom, pieces on
 * the same line left to right, lines separated by newlines.
 * @param {{cx, cy, angle, len, thick, text, conf}[]} items
 * @returns {{text: string, confidence: number}}
 */
export function joinLines(items, minConf = MIN_LINE_CONF) {
  const kept = items.filter((it) => it.text.trim() && it.conf >= minConf).map((it) => ({
    ...it,
    left: it.cx - (it.len / 2) * Math.cos(it.angle),
    top: it.cy - (it.len / 2) * Math.sin(it.angle),
  }));
  kept.sort((a, b) => a.top - b.top);
  const lines = [];
  for (const it of kept) {
    const line = lines.find((l) => Math.abs(l.top - it.top) < Math.min(l.thick, it.thick) * 0.45);
    if (line) line.items.push(it);
    else lines.push({ top: it.top, thick: it.thick, items: [it] });
  }
  const text = lines.map((l) => l.items.sort((a, b) => a.left - b.left).map((i) => i.text.trim()).join(' ')).join('\n');
  const confidence = kept.length ? Math.round((kept.reduce((s, i) => s + i.conf, 0) / kept.length) * 100) : 0;
  return { text, confidence };
}

// ───────────────────────────── orientation ───────────────────────────────

/** Share of elongated (line-like) text area that is steep. 0…1, or null if no text. */
export function verticalShare(components, minElongation = 2.5) {
  let vertical = 0;
  let total = 0;
  for (const c of components) {
    if (c.len / c.thick < minElongation) continue; // single letters: angle meaningless
    total += c.area;
    if (c.vertical) vertical += c.area;
  }
  return total ? vertical / total : null;
}

/**
 * First guess of the photo's orientation from the detector alone:
 * 0 = lines horizontal (upright or upside down), 1 = lines steep (sideways:
 * turn 90° to make them horizontal, then decide up or down).
 */
export function orientationBase(components, threshold = 0.6) {
  const share = verticalShare(components);
  return share != null && share > threshold ? 1 : 0;
}

/** The `n` most useful lines for deciding the direction: long, confident, line-shaped. */
export function topLines(boxes, n = 8) {
  return boxes
    .filter((b) => b.len / b.thick >= 2.5 && b.score >= BOX_THRESH)
    .sort((a, b) => b.len * b.thick * b.score - a.len * a.thick * a.score)
    .slice(0, n);
}

/** The same line box in the image turned 180° (width W, height H). */
export function rotateBox180(box, W, H) {
  return { ...box, cx: W - box.cx, cy: H - box.cy };
}

/** Classifier confidence needed to trust its vote without reading the text. */
export const CLS_SURE = 0.75;
/** Long side of the small copy used to find the orientation. */
export const ORIENT_MAX_SIDE = 960;

/** Direction classifier input: height 48, width up to 192 (keeps the line's shape). */
export const CLS_HEIGHT = 48;
export const CLS_WIDTH = 192;
export function clsWidth(box) {
  return Math.max(8, Math.min(CLS_WIDTH, Math.ceil((box.len / box.thick) * CLS_HEIGHT)));
}

/**
 * Short pieces of a line, each at most `maxRatio` × its height long, spread
 * along it (start, middle, end). The classifier's input is 192 × 48: a whole
 * long line squeezed into it becomes unreadable, a piece of it does not.
 */
export function lineSegments(box, { maxRatio = 4, maxSegments = 3 } = {}) {
  const segLen = Math.min(box.len, box.thick * maxRatio);
  if (segLen >= box.len) return [box];
  const count = Math.min(maxSegments, Math.max(1, Math.floor(box.len / segLen)));
  const ux = Math.cos(box.angle);
  const uy = Math.sin(box.angle);
  const span = box.len - segLen; // distance between the first and last centre
  const out = [];
  for (let i = 0; i < count; i++) {
    const offset = count === 1 ? 0 : -span / 2 + (span * i) / (count - 1);
    out.push({ ...box, cx: box.cx + ux * offset, cy: box.cy + uy * offset, len: segLen });
  }
  return out;
}

/**
 * Weighted vote of the direction classifier over several lines.
 * @param {{p180: number, weight: number}[]} votes
 * @returns {{flip: boolean, confidence: number}|null} confidence: weighted mean probability of the winner (0.5–1)
 */
export function clsVote(votes) {
  const total = votes.reduce((n, v) => n + v.weight, 0);
  if (!total) return null;
  const p180 = votes.reduce((n, v) => n + v.p180 * v.weight, 0) / total;
  return { flip: p180 > 0.5, confidence: Math.max(p180, 1 - p180) };
}
