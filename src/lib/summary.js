/** One line at the top of a result: "2 de evitat · alergeni: lapte · NOVA 4" (also the shopping cards). */
import { t, pick } from './i18n.js';
import { ALLERGENS_BY_ID } from '../data/allergens.js';

const allergenName = (id, lang) => pick(ALLERGENS_BY_ID[id].short, lang);

export function summaryParts(result, lang) {
  const parts = [];
  if (result.avoidHits?.length) parts.push(t(lang, 'sumAvoid', { n: result.avoidHits.length }));
  if (result.counts?.high) parts.push(t(lang, 'sumHigh', { n: result.counts.high }));
  if (result.allergens?.contains?.length) {
    const ids = result.allergens.contains.map((a) => a.id);
    parts.push(t(lang, 'sumAllergens', { list: ids.slice(0, 3).map((id) => allergenName(id, lang)).join(', ') + (ids.length > 3 ? '…' : '') }));
  }
  if (result.processing?.nova) parts.push(`NOVA ${result.processing.nova}`);
  return parts;
}
