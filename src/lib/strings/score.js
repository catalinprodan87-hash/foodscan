/**
 * Texts for the overall score (v3.8). Kept out of i18n.js so they load
 * with the screens that use them, not with the first screen; importing this
 * module adds them to the shared tables.
 */
import { STRINGS } from '../i18n.js';

const TABLE = {
  en: {
    scoreTitle: 'Overall score',
    scoreIngredientsTitle: 'Ingredient score',
    scoreOutOf: 'out of 100',
    scoreInsufficient: 'Not enough data: there is no ingredients list, so there is no score.',
    scoreEstimated: 'estimated score – incomplete data',
    scoreConfidence: 'Confidence: {level}',
    scoreConf_high: 'high', scoreConf_medium: 'medium', scoreConf_low: 'low',
    scoreBand_good: 'Good', scoreBand_fair: 'Fair', scoreBand_below: 'Below average', scoreBand_low: 'Poor',
    scorePersonal: 'Your score: {personal} (general {general}) – it contains {n} ingredient(s) from your list.',
    scoreOtherProfile: 'General score. With the list of {name}: {personal} ({n} ingredient(s) from the list).',
    scoreHow: 'How it was calculated',
    scorePart_ingredients: 'Ingredients and additives', scorePart_nutrition: 'Nutrition (Nutri-Score)', scorePart_processing: 'Processing (NOVA)',
    scorePart_origin: 'Origin', scorePart_completeness: 'Completeness of data', scorePart_avoid: 'Your avoid list',
    scoreWhy_ingredients: '{high} high, {medium} medium, {low} low', scoreWhy_grade: 'Nutri-Score {grade}', scoreWhy_nova: 'NOVA {nova}',
    scoreWhy_originKnown: '{plus} plus, {minus} minus', scoreWhy_originUnknown: 'origin unknown',
    scoreWhy_missing: 'missing: {list}', scoreWhy_complete: 'all known', scoreWhy_count: '{n} ingredients', scoreWhy_general: 'not used in the general score',
    scorePoints: '{points}/100 · weight {weight}%',
    scoreCap_high: 'Capped at 49: an ingredient with the high level.',
    scoreCap_banned: 'Capped at 25: banned or not allowed in the EU ({codes}).',
    scoreMissingShare: 'Parts that are not known are left out and their weight is shared out among the others.',
    scoreNote: 'A summary of what the app shows, not medical advice. Formula version {v}.',
    scoreShare: 'General score: {score}/100 ({band})',
    scoreCmp: 'Score',
  },
  ro: {
    scoreTitle: 'Scor general',
    scoreIngredientsTitle: 'Scor ingrediente',
    scoreOutOf: 'din 100',
    scoreInsufficient: 'Date insuficiente: lipsește lista de ingrediente, deci nu există scor.',
    scoreEstimated: 'scor estimat – date incomplete',
    scoreConfidence: 'Încredere: {level}',
    scoreConf_high: 'ridicată', scoreConf_medium: 'medie', scoreConf_low: 'scăzută',
    scoreBand_good: 'Bun', scoreBand_fair: 'Acceptabil', scoreBand_below: 'Sub medie', scoreBand_low: 'Slab',
    scorePersonal: 'Scorul tău: {personal} (general {general}) – conține {n} ingredient(e) din lista ta.',
    scoreOtherProfile: 'Scor general. Cu lista profilului {name}: {personal} ({n} ingredient(e) din listă).',
    scoreHow: 'Cum s-a calculat',
    scorePart_ingredients: 'Ingrediente și aditivi', scorePart_nutrition: 'Nutriție (Nutri-Score)', scorePart_processing: 'Procesare (NOVA)',
    scorePart_origin: 'Origine', scorePart_completeness: 'Date complete', scorePart_avoid: 'Lista ta de evitat',
    scoreWhy_ingredients: '{high} ridicat, {medium} mediu, {low} scăzut', scoreWhy_grade: 'Nutri-Score {grade}', scoreWhy_nova: 'NOVA {nova}',
    scoreWhy_originKnown: '{plus} plusuri, {minus} minusuri', scoreWhy_originUnknown: 'origine necunoscută',
    scoreWhy_missing: 'lipsesc: {list}', scoreWhy_complete: 'toate cunoscute', scoreWhy_count: '{n} ingrediente', scoreWhy_general: 'nu contează în scorul general',
    scorePoints: '{points}/100 · pondere {weight}%',
    scoreCap_high: 'Plafonat la 49: un ingredient cu nivel ridicat.',
    scoreCap_banned: 'Plafonat la 25: interzis sau nepermis în UE ({codes}).',
    scoreMissingShare: 'Părțile necunoscute sunt lăsate deoparte, iar ponderea lor e împărțită între celelalte.',
    scoreNote: 'Un rezumat a ce arată aplicația, nu un sfat medical. Versiunea formulei: {v}.',
    scoreShare: 'Scor general: {score}/100 ({band})',
    scoreCmp: 'Scor',
  },
};

for (const lang of Object.keys(TABLE)) Object.assign(STRINGS[lang], TABLE[lang]);

export default TABLE;
