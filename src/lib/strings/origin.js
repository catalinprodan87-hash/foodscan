/**
 * Texts for the origin card and the "Vândut în" setting (v3.7). Kept out of i18n.js so they load
 * with the screens that use them, not with the first screen; importing this
 * module adds them to the shared tables.
 */
import { STRINGS } from '../i18n.js';

const TABLE = {
  en: {
    originTitle: 'Where it comes from',
    originChain: 'From where it comes to where it is sold',
    originStage_origin: 'Origin',
    originStage_caught: 'Caught',
    originStage_farmed: 'Farmed',
    originStage_processed: 'Processed / packed',
    originStage_sold: 'Sold in',
    originUnknown: 'The origin is not on the label text read or in the database.',
    originSoldIn: 'Sold in: {country}.',
    originDistance: 'About {km} km between the countries in the chain (straight lines between capitals, a rough guide).',
    originGroup_plus: 'Why it is good',
    originGroup_minus: 'Why it is not so good',
    originGroup_info: 'Good to know',
    originArea: 'area',
    originNote: 'Only documented facts about the chain. No country is rated as safe or unsafe.',
    originSource: 'source',
    whereEu: 'EU', whereNonEu: 'outside the EU', whereBoth: 'EU and outside the EU',
    saleCountryTitle: 'Where you shop',
    saleCountryLabel: 'Sold in (for the origin of products)',
  },
  ro: {
    originTitle: 'De unde vine',
    originChain: 'De unde vine până unde se vinde',
    originStage_origin: 'Origine',
    originStage_caught: 'Pescuit',
    originStage_farmed: 'Crescut',
    originStage_processed: 'Procesat / ambalat',
    originStage_sold: 'Vândut în',
    originUnknown: 'Originea nu apare în textul citit de pe etichetă sau în baza de date.',
    originSoldIn: 'Vândut în: {country}.',
    originDistance: 'Aproximativ {km} km între țările din lanț (în linie dreaptă între capitale, orientativ).',
    originGroup_plus: 'De ce e bine',
    originGroup_minus: 'De ce nu e bine',
    originGroup_info: 'De știut',
    originArea: 'zona',
    originNote: 'Doar fapte documentate despre lanț. Nicio țară nu e evaluată ca sigură sau nesigură.',
    originSource: 'sursa',
    whereEu: 'UE', whereNonEu: 'din afara UE', whereBoth: 'UE și din afara UE',
    saleCountryTitle: 'Unde cumperi',
    saleCountryLabel: 'Vândut în (pentru originea produselor)',
  },
};

for (const lang of Object.keys(TABLE)) Object.assign(STRINGS[lang], TABLE[lang]);

export default TABLE;
