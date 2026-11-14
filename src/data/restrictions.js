/**
 * Restrictions outside the EU for ingredients that are allowed in the EU
 * (food additives by E-number, cosmetic / household ingredients by their code
 * in nonFoodIngredients.js). Shown as a "restricted in other countries" flag
 * with the reason; any entry raises the verdict to at least "warn".
 *
 *   region  – US | US-CA (California) | US-HI (Hawaii) | CA (Canada) | JP (Japan)
 *   status  – banned        prohibited by law or authorisation withdrawn
 *             not_approved  never authorised for this use (not always a safety
 *                           finding: sometimes nobody applied)
 *             restricted    partial ban (e.g. school food, one product type)
 *             warning       official carcinogen listing / mandatory warning
 *             phase_out     official plan to remove it
 *   en / ro – one factual sentence with the rule or body behind it
 *
 * Kept deliberately conservative: only restrictions I could state with a
 * specific rule or list. Laws change – review together with the databases
 * (see DATABASES_REVIEWED in meta.js).
 */

export const REGIONS = {
  US: { en: 'United States', ro: 'SUA' },
  'US-CA': { en: 'California (US)', ro: 'California (SUA)' },
  'US-HI': { en: 'Hawaii (US)', ro: 'Hawaii (SUA)' },
  CA: { en: 'Canada', ro: 'Canada' },
  JP: { en: 'Japan', ro: 'Japonia' },
};

const r = (region, status, en, ro) => ({ region, status, en, ro });

// ───────────────────────────── shared entries ─────────────────────────────

const CA_SCHOOLS = r('US-CA', 'restricted',
  'Banned from food sold in California public schools from 31 December 2027 (California School Food Safety Act, AB 2316, 2024), over concerns about children’s behaviour.',
  'Interzis în alimentele vândute în școlile publice din California de la 31 decembrie 2027 (California School Food Safety Act, AB 2316, 2024), din cauza îngrijorărilor privind comportamentul copiilor.');
const FDA_PHASE_OUT = r('US', 'phase_out',
  'In April 2025 the US FDA announced a plan to phase petroleum-based synthetic dyes, including this one, out of the US food supply.',
  'În aprilie 2025, FDA (SUA) a anunțat un plan de eliminare treptată a coloranților sintetici derivați din petrol, inclusiv acesta, din alimentele vândute în SUA.');
const US_DYE_NOT_LISTED = r('US', 'not_approved',
  'Not on the FDA list of colour additives permitted in food, so foods containing it cannot be sold in the US.',
  'Nu se află pe lista FDA a coloranților permiși în alimente, deci alimentele care îl conțin nu pot fi vândute în SUA.');
const JP_NOT_DESIGNATED = r('JP', 'not_approved',
  'Not a designated food additive in Japan; imported foods containing it are rejected.',
  'Nu este aditiv alimentar desemnat în Japonia; alimentele importate care îl conțin sunt respinse.');
const CA_DYE_NOT_LISTED = r('CA', 'not_approved',
  'Not on Health Canada’s list of permitted food colours.',
  'Nu se află pe lista coloranților alimentari permiși de Health Canada.');
const PROP65_4MEI = r('US-CA', 'warning',
  'Its by-product 4-methylimidazole (4-MEI) has been on California’s Proposition 65 list of carcinogens since 2011; products giving more than 29 micrograms a day need a warning label.',
  'Subprodusul său, 4-metilimidazolul (4-MEI), se află din 2011 pe lista substanțelor cancerigene din Propunerea 65 a Californiei; produsele care aduc peste 29 micrograme pe zi necesită etichetă de avertizare.');
const FDA_ANTISEPTIC = r('US', 'banned',
  'Since 2017 the FDA no longer allows it in consumer antiseptic hand and body washes (final rule of 2016): manufacturers did not show it is safe for daily use or more effective than plain soap.',
  'Din 2017, FDA nu îl mai permite în săpunurile și gelurile antiseptice pentru consumatori (regula finală din 2016): producătorii nu au demonstrat că este sigur la utilizare zilnică sau mai eficient decât săpunul obișnuit.');
const HAWAII_REEF = r('US-HI', 'banned',
  'Hawaii has banned the sale of sunscreens containing it since 1 January 2021 (Act 104), to protect coral reefs.',
  'Hawaii interzice din 1 ianuarie 2021 vânzarea produselor de protecție solară care îl conțin (Act 104), pentru protejarea recifelor de corali.');

// ─────────────────────────────── by code ──────────────────────────────────

export const RESTRICTIONS = {
  // Food colours
  E102: [CA_SCHOOLS, FDA_PHASE_OUT],
  E104: [
    r('US', 'not_approved',
      'Not approved for food in the US: it is listed only for medicines and cosmetics (as D&C Yellow No. 10).',
      'Neautorizat în alimente în SUA: este listat doar pentru medicamente și cosmetice (ca D&C Yellow No. 10).'),
    JP_NOT_DESIGNATED,
  ],
  E110: [CA_SCHOOLS, FDA_PHASE_OUT],
  E122: [US_DYE_NOT_LISTED, CA_DYE_NOT_LISTED, JP_NOT_DESIGNATED],
  E123: [
    r('US', 'banned',
      'Banned in US food since 1976 (formerly FD&C Red No. 2), after animal studies raised a suspicion of cancer that the FDA could not rule out.',
      'Interzis în alimente în SUA din 1976 (fostul FD&C Red No. 2), după ce studii pe animale au ridicat o suspiciune de cancer pe care FDA nu a putut-o exclude.'),
  ],
  E124: [US_DYE_NOT_LISTED, CA_DYE_NOT_LISTED],
  E127: [
    r('US', 'banned',
      'In January 2025 the FDA revoked its authorisation in food (FD&C Red No. 3), with effect from 15 January 2027, because high doses caused thyroid tumours in male rats.',
      'În ianuarie 2025, FDA i-a retras autorizarea în alimente (FD&C Red No. 3), cu efect de la 15 ianuarie 2027, deoarece dozele mari au provocat tumori tiroidiene la șobolanii masculi.'),
    r('US-CA', 'banned',
      'Banned in food in California from 1 January 2027 (California Food Safety Act, AB 418, 2023).',
      'Interzis în alimente în California de la 1 ianuarie 2027 (California Food Safety Act, AB 418, 2023).'),
  ],
  E129: [CA_SCHOOLS, FDA_PHASE_OUT],
  E131: [US_DYE_NOT_LISTED, JP_NOT_DESIGNATED],
  E132: [CA_SCHOOLS, FDA_PHASE_OUT],
  E133: [CA_SCHOOLS, FDA_PHASE_OUT],
  E142: [US_DYE_NOT_LISTED, JP_NOT_DESIGNATED],
  E150c: [PROP65_4MEI],
  E150d: [PROP65_4MEI],
  E151: [US_DYE_NOT_LISTED, JP_NOT_DESIGNATED],
  E153: [US_DYE_NOT_LISTED],
  E155: [US_DYE_NOT_LISTED, JP_NOT_DESIGNATED],

  // Antioxidants, sweeteners
  E319: [JP_NOT_DESIGNATED],
  E320: [
    r('US', 'warning',
      'The US National Toxicology Program lists it as "reasonably anticipated to be a human carcinogen".',
      'Programul Național de Toxicologie al SUA îl listează drept „anticipat în mod rezonabil ca fiind cancerigen pentru om”.'),
    r('US-CA', 'warning',
      'On California’s Proposition 65 list of chemicals known to cause cancer since 1990.',
      'Pe lista Propunerii 65 din California a substanțelor cunoscute ca fiind cancerigene, din 1990.'),
  ],
  E952: [
    r('US', 'banned',
      'Banned in US food since 1970, after a study linked a cyclamate-saccharin mixture to bladder tumours in rats; the FDA has not re-approved it.',
      'Interzis în alimente în SUA din 1970, după ce un studiu a asociat un amestec de ciclamat și zaharină cu tumori ale vezicii la șobolani; FDA nu l-a reautorizat.'),
    JP_NOT_DESIGNATED,
  ],

  // Cosmetics / household (codes from nonFoodIngredients.js)
  TRICLOSAN: [FDA_ANTISEPTIC],
  TRICLOCARBAN: [FDA_ANTISEPTIC],
  'BP-3': [HAWAII_REEF],
  OMC: [HAWAII_REEF],
};

/** Restrictions outside the EU for a code (empty array if none). */
export function restrictionsFor(code) {
  return RESTRICTIONS[code] || [];
}
