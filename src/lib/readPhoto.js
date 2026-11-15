/**
 * Reads the ingredients from a prepared photo (crop + downscale done) with
 * the on-device OCR, and gives a weak read up to two more chances:
 *   1. the photo turned 180° – only when the orientation was not checked
 *      (the automatic check timed out or did not run),
 *   2. the text detector at a larger scale (small print), up to 2× – only
 *      for crops and small photos (≤ 1600 px): on a whole large photo it costs
 *      three times a normal read and found nothing more in the benchmark.
 * The best result by known words + recogniser confidence wins.
 *
 * Shared by the photo flow and the OCR benchmark. `recognize` and `rotate`
 * are injected (browser-only), so the decision logic is unit-tested.
 */
import { extractIngredients, needsBetterPhoto } from './ocrText.js';
import { correctWords } from './lexicon.js';
import { lexiconScore } from './orientation.js';

export const DET_RETRY_SIDE = 2560;
export const UPSCALE_MAX_SIDE = 1600;

/** The retries worth trying for this photo. */
export function retryPlan({ width, height }, { orientationChecked = false } = {}) {
  const plan = [];
  if (!orientationChecked) plan.push({ turns: 2 });
  if (Math.max(width, height) <= UPSCALE_MAX_SIDE) plan.push({ detMaxSide: DET_RETRY_SIDE });
  return plan;
}

/** How convincing a read is (0–1): known words and recogniser confidence. */
export const readScore = (r) => 0.5 * lexiconScore(r.text) + 0.5 * ((r.confidence || 0) / 100);

/**
 * Worth another try: low confidence, almost no text, or no ingredients
 * heading found and few words the app knows.
 */
export function isWeakRead(r) {
  return needsBetterPhoto(r) || (!r.foundStart && lexiconScore(r.text) < 0.35);
}

/**
 * @param canvas the prepared photo
 * @param {{recognize: Function, rotate: (canvas, quarterTurns) => canvas, onProgress?: Function,
 *          onRetry?: Function, shouldStop?: () => boolean, orientationChecked?: boolean}} deps
 * @returns {Promise<{text, rawText, confidence, lines, foundStart, tries, retried}>}
 */
export async function readIngredients(canvas, { recognize, rotate, onProgress, onRetry, shouldStop = () => false, orientationChecked = false }) {
  const once = async (image, options = {}) => {
    const ocr = await recognize(image, { onProgress, ...options });
    const extracted = extractIngredients(ocr.text);
    extracted.text = correctWords(extracted.text).text; // "sore" → "sare", restores diacritics
    return { ...extracted, rawText: ocr.text, confidence: ocr.confidence, lines: ocr.lines };
  };
  let best = await once(canvas);
  let tries = 1;
  for (const retry of retryPlan(canvas, { orientationChecked })) {
    if (!isWeakRead(best) || shouldStop()) break;
    onRetry?.(retry);
    tries++;
    const r = retry.turns ? await once(rotate(canvas, retry.turns)) : await once(canvas, { detMaxSide: retry.detMaxSide, upscale: true });
    if (readScore(r) > readScore(best)) best = { ...r, retried: true };
  }
  return { ...best, tries, retried: !!best.retried };
}
