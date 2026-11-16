/**
 * The general score of a history entry (v3.8), computed again from its saved
 * data with the current formula – so the history, compare and old entries
 * always use the same scoreVersion. General score: no avoid list.
 */
import { analyze } from './analyze.js';
import { entryAnalyzeInput } from './history.js';
import { assessOrigin } from './origin.js';
import { computeScore } from './score.js';

export function scoreForEntry(entry, saleCountry = 'RO') {
  if (!entry) return null;
  const result = analyze(entryAnalyzeInput(entry));
  const food = entry.productType === 'food';
  return computeScore({
    result,
    text: entry.text || '',
    grade: entry.grade || entry.db?.nutriscore || null,
    origin: food ? assessOrigin({ text: `${entry.originText || ''}\n${entry.text || ''}`, product: entry.db?.origin || null, saleCountry }) : null,
    ocrConfidence: entry.source === 'photo' ? entry.confidence ?? null : null,
  });
}
