/** Short explanations of the terms used in results (RO / EN). Opened from the "?" buttons. */
export const GLOSSARY = [
  {
    id: 'nova',
    term: { ro: 'NOVA (1–4)', en: 'NOVA (1–4)' },
    text: {
      ro: 'Arată cât de prelucrat este un aliment, nu cât de sănătos: 1 – neprocesat sau minim procesat; 2 – ingrediente culinare (ulei, zahăr, sare); 3 – alimente procesate (conserve, brânzeturi, pâine simplă); 4 – ultraprocesat (ingrediente de fabrică: arome, emulgatori, îndulcitori, amidonuri modificate). Clasificare a Universității din São Paulo.',
      en: 'How processed a food is, not how healthy: 1 – unprocessed or minimally processed; 2 – culinary ingredients (oil, sugar, salt); 3 – processed foods (canned food, cheese, simple bread); 4 – ultra-processed (factory ingredients: flavourings, emulsifiers, sweeteners, modified starches). Classification from the University of São Paulo.',
    },
  },
  {
    id: 'nutriscore',
    term: { ro: 'Nutri-Score (A–E)', en: 'Nutri-Score (A–E)' },
    text: {
      ro: 'Notă pentru calitatea nutrițională la 100 g, calculată din energie, zaharuri, grăsimi saturate și sare (în minus) și fibre, proteine, fructe și legume (în plus). A este cea mai bună. Nu ține cont de aditivi sau de procesare.',
      en: 'A grade for nutritional quality per 100 g, from energy, sugars, saturated fat and salt (minus) and fibre, protein, fruit and vegetables (plus). A is best. It does not take additives or processing into account.',
    },
  },
  {
    id: 'adi',
    term: { ro: 'DZA (doza zilnică admisă)', en: 'ADI (acceptable daily intake)' },
    text: {
      ro: 'Cantitatea dintr-un aditiv care poate fi consumată zilnic toată viața fără risc apreciabil, în mg pe kg de greutate corporală. O stabilește EFSA în UE. Depășirea ocazională nu înseamnă că apare un efect.',
      en: 'The amount of an additive that can be eaten every day for a lifetime without appreciable risk, in mg per kg of body weight. Set by EFSA in the EU. Going over it now and then does not mean an effect will occur.',
    },
  },
  {
    id: 'iarc',
    term: { ro: 'Grupele IARC', en: 'IARC groups' },
    text: {
      ro: 'Agenția Internațională pentru Cercetarea Cancerului clasifică cât de sigure sunt dovezile că ceva POATE provoca cancer – nu cât de mare e riscul: Grupa 1 – sigur cancerigen; 2A – probabil; 2B – posibil; 3 – neclasificabil. Doza și expunerea contează.',
      en: 'The International Agency for Research on Cancer rates how strong the evidence is that something CAN cause cancer – not how big the risk is: Group 1 – carcinogenic; 2A – probably; 2B – possibly; 3 – not classifiable. Dose and exposure matter.',
    },
  },
  {
    id: 'status',
    term: { ro: '„Neautorizat” sau „interzis”', en: '"Not approved" or "banned"' },
    text: {
      ro: 'Interzis: o autoritate a scos ingredientul din uz, de regulă pentru siguranță. Neautorizat: nu e pe lista permisă – uneori pentru că nimeni nu a cerut aprobarea, nu neapărat pentru că ar fi periculos. Restricționat: permis doar în anumite produse sau cantități. Avertizare oficială: de ex. lista Propunerii 65 din California.',
      en: 'Banned: an authority took the ingredient off the market, usually for safety. Not approved: not on the permitted list – sometimes because nobody applied, not necessarily because it is unsafe. Restricted: allowed only in some products or amounts. Official warning: e.g. California’s Proposition 65 list.',
    },
  },
  {
    id: 'enumber',
    term: { ro: 'Codurile E', en: 'E-numbers' },
    text: {
      ro: 'Codul unui aditiv aprobat în UE (Regulamentul 1333/2008): 100–199 coloranți, 200–299 conservanți, 300–399 antioxidanți și acidifianți, 400–499 agenți de îngroșare și emulgatori, 600–699 potențiatori de aromă, 900+ alți aditivi și îndulcitori. Un cod E nu înseamnă automat ceva rău – și vitamina C are unul (E300).',
      en: 'The code of an additive approved in the EU (Regulation 1333/2008): 100–199 colours, 200–299 preservatives, 300–399 antioxidants and acids, 400–499 thickeners and emulsifiers, 600–699 flavour enhancers, 900+ other additives and sweeteners. An E-number is not bad in itself – vitamin C has one (E300).',
    },
  },
  {
    id: 'traces',
    term: { ro: 'Alergeni și „poate conține urme”', en: 'Allergens and "may contain traces"' },
    text: {
      ro: 'Cei 14 alergeni din legislația UE trebuie scriși îngroșat în lista de ingrediente. „Poate conține urme de…” este o avertizare voluntară: produsul nu îi conține ca ingredient, dar poate veni în contact cu ei în fabrică. Aplicația doar îi semnalează – eticheta rămâne referința.',
      en: 'The 14 allergens in EU law must be printed in bold in the ingredient list. "May contain traces of…" is a voluntary warning: the product does not contain them as an ingredient, but may come into contact with them in the factory. The app only points them out – the label remains the reference.',
    },
  },
];

export const GLOSSARY_BY_ID = Object.fromEntries(GLOSSARY.map((g) => [g.id, g]));

/** Opens the glossary at a term (listened to by the app). */
export function openGlossary(id) {
  window.dispatchEvent(new CustomEvent('ingrediscan:glossary', { detail: id }));
}
