/**
 * Product categories, used to pick which database and product source apply.
 * The structure of the food and cosmetics groups follows the categories on
 * alegesanatos.ro (a Romanian healthy-living site); household cleaning is added.
 *
 *   type     – food | cosmetic | household
 *   db       – which ingredient database(s) to analyse with
 *   source   – Open *Facts database for barcode lookups:
 *              food      → https://world.openfoodfacts.org/api/v2/product/{code}.json
 *              cosmetic  → https://world.openbeautyfacts.org/api/v2/product/{code}.json
 *              household → https://world.openproductsfacts.org/api/v2/product/{code}.json
 */
export const PRODUCT_TYPES = [
  {
    type: 'food',
    label: { en: 'Food & drinks', ro: 'Alimente și băuturi' },
    db: ['additives'],
    source: 'https://world.openfoodfacts.org',
    groups: [
      { id: 'drinks', en: 'Drinks', ro: 'Băuturi', items: ['carbonated & still drinks / băuturi carbogazoase și necarbogazoase', 'beer & cider / bere și cidru', 'coffee / cafea', 'tea / ceai', 'hot chocolate / ciocolată caldă'] },
      { id: 'pantry', en: 'Pantry', ro: 'Băcănie', items: ['canned fish / conserve de pește', 'jam / gem', 'muesli & cereals / musli și cereale', 'pâtés / pateuri', 'pasta / paste', 'instant food / mâncare instant', 'sauces / sosuri', 'oils / uleiuri', 'condiments / condimente'] },
      { id: 'baby-food', en: 'Baby food', ro: 'Bebe', items: [] },
      { id: 'cold-cuts', en: 'Cold cuts', ro: 'Mezeluri', items: ['turkey / curcan', 'pork / porc', 'chicken / pui', 'beef / vită'] },
      { id: 'sweets', en: 'Sweets', ro: 'Dulciuri', items: ['biscuits & wafers / biscuiți și napolitane', 'candy & chocolate / bomboane și ciocolată', 'pastries / produse de patiserie', 'chewing gum / gumă de mestecat', 'ice cream / înghețată', 'jelly / jeleuri'] },
      { id: 'diet', en: 'Diet', ro: 'Dietă', items: ['protein bars / batoane proteice', 'sweeteners / îndulcitori', 'sugar-free / fără zahăr', 'supplements / suplimente'] },
      { id: 'dairy', en: 'Dairy', ro: 'Lactate', items: ['cheese / brânză', 'kefir / chefir', 'yogurt / iaurt', 'milk / lapte', 'cream / smântână', 'butter & margarine / unt și margarină'] },
      { id: 'bakery', en: 'Bakery', ro: 'Brutărie', items: ['puff pastry / foietaj', 'packaged bread / pâine ambalată', 'crispbread / pâine crocantă', 'flatbreads / lipii'] },
      { id: 'ready-meals', en: 'Ready-to-cook', ro: 'Semipreparate', items: [] },
      { id: 'snacks', en: 'Snacks', ro: 'Snacks', items: ['chips', 'pretzels / covrigei', 'popcorn', 'nuts & seeds / nuci și semințe'] },
      { id: 'vegetarian', en: 'Vegetarian / Lenten', ro: 'Vegetariene / de post', items: [] },
    ],
  },
  {
    type: 'cosmetic',
    label: { en: 'Cosmetics & personal care', ro: 'Cosmetice și îngrijire personală' },
    db: ['nonfood:cosmetic', 'nonfood:both'],
    source: 'https://world.openbeautyfacts.org',
    groups: [
      { id: 'baby-care', en: 'Baby care', ro: 'Bebe', items: [] },
      { id: 'body-care', en: 'Body care', ro: 'Îngrijire corp', items: ['deodorants & antiperspirants / deodorante și antiperspirante', 'shaving / ras', 'hand & nail care / îngrijirea mâinilor și unghiilor', 'lotions / loțiuni', 'soap & shower gel / săpun și gel de duș', 'special care / îngrijire specială', 'intimate hygiene / igienă intimă'] },
      { id: 'face-care', en: 'Face care', ro: 'Îngrijire față', items: ['cleansing / curățare', 'face creams & serums / creme și seruri', 'eye creams / creme pentru ochi', 'shaving foam & aftershave / spumă de ras și aftershave'] },
      { id: 'oral-care', en: 'Oral care', ro: 'Igienă orală', items: ['toothpaste / pastă de dinți', "children's toothpaste / pastă de dinți pentru copii", 'mouthwash / apă de gură'] },
      { id: 'make-up', en: 'Make-up', ro: 'Make-up', items: ['lips / buze', 'mascara & brows / mascara și sprâncene', 'complexion / ten'] },
      { id: 'nails', en: 'Manicure', ro: 'Manichiură', items: ['nail polish / ojă', 'gel polish / ojă semipermanentă', 'nail polish remover / dizolvant'] },
      { id: 'hair-care', en: 'Hair care', ro: 'Îngrijire păr', items: ['shampoo / șampon', 'conditioner & masks / balsam și măști', 'styling', 'hair dye / vopsea de păr'] },
      { id: 'fragrance', en: 'Perfumes', ro: 'Parfumuri', items: ['women / femei', 'men / bărbați'] },
      { id: 'sun', en: 'Sun protection', ro: 'Protecție solară', items: ['body SPF / SPF corp', 'face SPF / SPF față', "children's SPF / SPF copii", 'after-sun', 'self-tanners / autobronzante'] },
    ],
  },
  {
    type: 'household',
    label: { en: 'Detergents & cleaners', ro: 'Detergenți și produse de curățenie' },
    db: ['nonfood:household', 'nonfood:both'],
    source: 'https://world.openproductsfacts.org',
    groups: [
      { id: 'laundry', en: 'Laundry', ro: 'Rufe', items: ['laundry detergent / detergent de rufe', 'capsules / capsule', 'fabric softener / balsam de rufe', 'stain remover / soluție pentru pete', 'bleach / înălbitor'] },
      { id: 'dishes', en: 'Dishes', ro: 'Vase', items: ['dish soap / detergent de vase', 'dishwasher tablets / tablete pentru mașina de spălat vase', 'rinse aid / agent de clătire', 'dishwasher salt / sare regenerantă'] },
      { id: 'kitchen', en: 'Kitchen', ro: 'Bucătărie', items: ['degreaser / degresant', 'oven cleaner / soluție pentru cuptor', 'descaler / anticalcar'] },
      { id: 'bathroom', en: 'Bathroom & toilet', ro: 'Baie și WC', items: ['toilet cleaner / soluție WC', 'limescale remover / anticalcar', 'mould remover / soluție anti-mucegai', 'toilet blocks / odorizante WC'] },
      { id: 'surfaces', en: 'Surfaces & floors', ro: 'Suprafețe și pardoseli', items: ['multi-surface / universal', 'glass cleaner / soluție pentru geamuri', 'floor cleaner / soluție pentru pardoseli', 'furniture polish / soluție pentru mobilă', 'disinfectant / dezinfectant'] },
      { id: 'drains', en: 'Drains', ro: 'Desfundat țevi', items: [] },
      { id: 'air', en: 'Air fresheners', ro: 'Odorizante de cameră', items: [] },
    ],
  },
];

export const PRODUCT_TYPE_BY_ID = Object.fromEntries(PRODUCT_TYPES.map((t) => [t.type, t]));
