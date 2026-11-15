/**
 * The rest of the EU Union list of food additives (Regulation (EC) 1333/2008,
 * Annex II): additives authorised in the EU that were not yet in additives.js.
 * Mostly level `none` (a technical function, no specific concern) or the level
 * of their family; a higher level only with a stated reason. Added
 * 15 Nov 2026 (v2.6); same entry shape as additives.js.
 *
 * Not included: E203 (calcium sorbate – authorisation withdrawn in 2018);
 * E960a (steviol glycosides: "E960a" on a label resolves to the E960 entry).
 */
const EU = 'Authorised in the EU (Regulation (EC) 1333/2008, Annex II).';
const EU_RO = 'Autorizat în UE (Regulamentul (CE) 1333/2008, Anexa II).';

/** code, category, level, en, ro, aliases, function (en), function (ro) */
const x = (code, category, level, en, ro, aliases, fnEn, fnRo) => ({
  code, category, level, name: { en, ro }, aliases,
  why: { en: `${fnEn} ${EU}`, ro: `${fnRo} ${EU_RO}` },
  reviewed: '2026-11-15',
});

const PHOSPHATE_EN = 'Phosphate (EFSA 2019 group ADI 40 mg phosphorus/kg body weight/day; high consumers, especially children, may exceed it).';
const PHOSPHATE_RO = 'Fosfat (DZA de grup EFSA 2019: 40 mg fosfor/kg corp/zi; marii consumatori, mai ales copiii, o pot depăși).';
const ALU_EN = 'Contains aluminium: EFSA (2008) set a tolerable weekly intake of 1 mg/kg body weight, which some people may exceed from all sources.';
const ALU_RO = 'Conține aluminiu: EFSA (2008) a stabilit un aport săptămânal tolerabil de 1 mg/kg corp, pe care unele persoane îl pot depăși din toate sursele.';
const POLYSORBATE_EN = 'Polysorbate emulsifier, same family as E433 (some animal studies link emulsifiers of this type to changes in gut bacteria).';
const POLYSORBATE_RO = 'Emulgator polisorbat, aceeași familie cu E433 (unele studii pe animale asociază emulgatorii de acest tip cu modificări ale florei intestinale).';
const CMC_EN = 'Modified carboxymethyl cellulose, same family as E466 (CMC; animal studies link it to changes in gut bacteria).';
const CMC_RO = 'Carboximetilceluloză modificată, aceeași familie cu E466 (CMC; studii pe animale o asociază cu modificări ale florei intestinale).';
const GAS_EN = 'Packaging or propellant gas.';
const GAS_RO = 'Gaz de ambalare sau propulsor.';
const RIBO_EN = 'Flavour enhancer (ribonucleotide), usually with glutamate (E621); people with gout are sometimes advised to limit purines.';
const RIBO_RO = 'Potențiator de aromă (ribonucleotidă), de obicei împreună cu glutamatul (E621); persoanelor cu gută li se recomandă uneori limitarea purinelor.';

export const ADDITIVES_EXTRA = [
  // Colours
  x('E160e', 'colour', 'none', "Beta-apo-8'-carotenal", "Beta-apo-8'-carotenal", ['beta-apo-8-carotenal', 'apocarotenal'], 'Orange colour related to beta-carotene.', 'Colorant portocaliu înrudit cu beta-carotenul.'),
  x('E161b', 'colour', 'none', 'Lutein', 'Luteină', ['luteina', 'lutein'], 'Yellow colour from marigold flowers.', 'Colorant galben din flori de crăițe.'),
  x('E161g', 'colour', 'low', 'Canthaxanthin', 'Cantaxantină', ['cantaxantina', 'canthaxanthin'], 'Orange-red colour; in the EU only for Strasbourg sausages. EFSA (2010) set an ADI of 0.03 mg/kg body weight.', 'Colorant roșu-portocaliu; în UE doar pentru cârnații de Strasbourg. EFSA (2010) a stabilit o DZA de 0,03 mg/kg corp.'),
  x('E170', 'colour', 'none', 'Calcium carbonate', 'Carbonat de calciu', ['carbonat de calciu', 'carbonati de calciu', 'calcium carbonate'], 'White colour, acidity regulator and calcium source (chalk).', 'Colorant alb, corector de aciditate și sursă de calciu (cretă).'),
  x('E174', 'colour', 'low', 'Silver', 'Argint', ['argint alimentar', 'foita de argint', 'silver leaf'], 'Metallic decoration of sweets. EFSA (2016) could not confirm its safety for lack of data.', 'Decor metalic pentru dulciuri. EFSA (2016) nu i-a putut confirma siguranța din lipsă de date.'),
  x('E175', 'colour', 'low', 'Gold', 'Aur', ['aur alimentar', 'foita de aur', 'gold leaf'], 'Metallic decoration of sweets and drinks. EFSA (2016) could not confirm its safety for lack of data.', 'Decor metalic pentru dulciuri și băuturi. EFSA (2016) nu i-a putut confirma siguranța din lipsă de date.'),
  x('E180', 'colour', 'low', 'Litholrubine BK', 'Litolrubină BK', ['litolrubina', 'litholrubine'], 'Red colour allowed in the EU only on edible cheese rinds.', 'Colorant roșu permis în UE doar pe coaja comestibilă a brânzeturilor.'),

  // Preservatives
  x('E215', 'preservative', 'low', 'Sodium ethyl p-hydroxybenzoate (paraben)', 'p-Hidroxibenzoat de etil sodic (paraben)', ['p-hidroxibenzoat de etil sodic', 'sodium ethylparaben'], 'Paraben preservative, same group as E214.', 'Conservant paraben, același grup cu E214.'),
  x('E219', 'preservative', 'low', 'Sodium methyl p-hydroxybenzoate (paraben)', 'p-Hidroxibenzoat de metil sodic (paraben)', ['p-hidroxibenzoat de metil sodic', 'sodium methylparaben'], 'Paraben preservative, same group as E218.', 'Conservant paraben, același grup cu E218.'),
  x('E242', 'preservative', 'none', 'Dimethyl dicarbonate', 'Dicarbonat de dimetil', ['dicarbonat de dimetil', 'dimethyl dicarbonate', 'velcorin'], 'Cold sterilant for drinks; breaks down to methanol and CO2 in tiny amounts.', 'Agent de sterilizare la rece pentru băuturi; se descompune în cantități foarte mici de metanol și CO2.'),
  x('E243', 'preservative', 'none', 'Ethyl lauroyl arginate', 'Etil lauroil arginat', ['etil lauroil arginat', 'lauric arginate', 'ethyl lauroyl arginate'], 'Preservative for cooked meats (EFSA ADI 0.5 mg/kg body weight).', 'Conservant pentru preparate din carne gătită (DZA EFSA 0,5 mg/kg corp).'),
  x('E281', 'preservative', 'low', 'Sodium propionate', 'Propionat de sodiu', ['propionat de sodiu', 'sodium propionate'], 'Mould inhibitor in bread, same group as E280.', 'Inhibitor de mucegai în pâine, același grup cu E280.'),
  x('E283', 'preservative', 'low', 'Potassium propionate', 'Propionat de potasiu', ['propionat de potasiu', 'potassium propionate'], 'Mould inhibitor in bread, same group as E280.', 'Inhibitor de mucegai în pâine, același grup cu E280.'),
  x('E284', 'preservative', 'low', 'Boric acid', 'Acid boric', ['acid boric', 'boric acid'], 'Preservative allowed in the EU only in sturgeon caviar; boron intake is limited by EFSA.', 'Conservant permis în UE doar în icrele de sturion; aportul de bor este limitat de EFSA.'),
  x('E285', 'preservative', 'low', 'Sodium tetraborate (borax)', 'Tetraborat de sodiu (borax)', ['tetraborat de sodiu', 'borax'], 'Preservative allowed in the EU only in sturgeon caviar; boron intake is limited by EFSA.', 'Conservant permis în UE doar în icrele de sturion; aportul de bor este limitat de EFSA.'),

  // Acids, acidity regulators, salts
  x('E261', 'acid', 'none', 'Potassium acetate', 'Acetat de potasiu', ['acetat de potasiu', 'acetati de potasiu', 'potassium acetate'], 'Acidity regulator (salt of vinegar acid).', 'Corector de aciditate (sare a acidului acetic).'),
  x('E262', 'acid', 'none', 'Sodium acetates', 'Acetați de sodiu', ['acetat de sodiu', 'acetati de sodiu', 'diacetat de sodiu', 'sodium acetate', 'sodium diacetate'], 'Acidity regulator and preservative (salt of vinegar acid).', 'Corector de aciditate și conservant (sare a acidului acetic).'),
  x('E263', 'acid', 'none', 'Calcium acetate', 'Acetat de calciu', ['acetat de calciu', 'calcium acetate'], 'Acidity regulator (salt of vinegar acid).', 'Corector de aciditate (sare a acidului acetic).'),
  x('E297', 'acid', 'none', 'Fumaric acid', 'Acid fumaric', ['acid fumaric', 'fumaric acid'], 'Acidifier, naturally present in the body.', 'Acidifiant, prezent în mod natural în organism.'),
  x('E326', 'acid', 'none', 'Potassium lactate', 'Lactat de potasiu', ['lactat de potasiu', 'potassium lactate'], 'Acidity regulator (salt of lactic acid).', 'Corector de aciditate (sare a acidului lactic).'),
  x('E327', 'acid', 'none', 'Calcium lactate', 'Lactat de calciu', ['lactat de calciu', 'calcium lactate'], 'Acidity regulator and calcium source (not milk, despite the name).', 'Corector de aciditate și sursă de calciu (nu e lapte, în ciuda numelui).'),
  x('E335', 'acid', 'none', 'Sodium tartrates', 'Tartrați de sodiu', ['tartrat de sodiu', 'tartrati de sodiu', 'sodium tartrate'], 'Acidity regulator (salt of tartaric acid).', 'Corector de aciditate (sare a acidului tartric).'),
  x('E336', 'acid', 'none', 'Potassium tartrates (cream of tartar)', 'Tartrați de potasiu (cremor tartru)', ['tartrat de potasiu', 'tartrati de potasiu', 'cremor tartru', 'cream of tartar'], 'Raising agent and acidity regulator.', 'Agent de afânare și corector de aciditate.'),
  x('E337', 'acid', 'none', 'Sodium potassium tartrate', 'Tartrat de sodiu și potasiu', ['tartrat de sodiu si potasiu', 'sodium potassium tartrate'], 'Acidity regulator.', 'Corector de aciditate.'),
  x('E343', 'acid', 'low', 'Magnesium phosphates', 'Fosfați de magneziu', ['fosfat de magneziu', 'fosfati de magneziu', 'magnesium phosphate'], PHOSPHATE_EN, PHOSPHATE_RO),
  x('E350', 'acid', 'none', 'Sodium malates', 'Malați de sodiu', ['malat de sodiu', 'malati de sodiu', 'sodium malate'], 'Acidity regulator (salt of malic acid).', 'Corector de aciditate (sare a acidului malic).'),
  x('E351', 'acid', 'none', 'Potassium malate', 'Malat de potasiu', ['malat de potasiu', 'potassium malate'], 'Acidity regulator (salt of malic acid).', 'Corector de aciditate (sare a acidului malic).'),
  x('E352', 'acid', 'none', 'Calcium malates', 'Malați de calciu', ['malat de calciu', 'malati de calciu', 'calcium malate'], 'Acidity regulator (salt of malic acid).', 'Corector de aciditate (sare a acidului malic).'),
  x('E353', 'acid', 'none', 'Metatartaric acid', 'Acid metatartric', ['acid metatartric', 'metatartaric acid'], 'Stabiliser that stops tartrate crystals in wine.', 'Stabilizator care previne cristalele de tartru în vin.'),
  x('E354', 'acid', 'none', 'Calcium tartrate', 'Tartrat de calciu', ['tartrat de calciu', 'calcium tartrate'], 'Acidity regulator.', 'Corector de aciditate.'),
  x('E355', 'acid', 'none', 'Adipic acid', 'Acid adipic', ['acid adipic', 'adipic acid'], 'Acidifier in desserts and powders.', 'Acidifiant în deserturi și pudre.'),
  x('E356', 'acid', 'none', 'Sodium adipate', 'Adipat de sodiu', ['adipat de sodiu', 'sodium adipate'], 'Acidity regulator (salt of adipic acid).', 'Corector de aciditate (sare a acidului adipic).'),
  x('E357', 'acid', 'none', 'Potassium adipate', 'Adipat de potasiu', ['adipat de potasiu', 'potassium adipate'], 'Acidity regulator (salt of adipic acid).', 'Corector de aciditate (sare a acidului adipic).'),
  x('E363', 'acid', 'none', 'Succinic acid', 'Acid succinic', ['acid succinic', 'succinic acid'], 'Acidifier, naturally present in the body.', 'Acidifiant, prezent în mod natural în organism.'),
  x('E380', 'acid', 'none', 'Triammonium citrate', 'Citrat triamoniacal', ['citrat triamoniacal', 'citrat de amoniu', 'triammonium citrate'], 'Acidity regulator (salt of citric acid).', 'Corector de aciditate (sare a acidului citric).'),
  x('E385', 'antioxidant', 'low', 'Calcium disodium EDTA', 'EDTA calcic disodic', ['edta calcic disodic', 'etilendiamintetraacetat de calciu disodic', 'calcium disodium edta', 'calciu disodic edta'], 'Binds metals to keep colour and flavour (e.g. in canned pulses, mayonnaise). EFSA ADI 1.9 mg/kg body weight.', 'Leagă metalele ca să păstreze culoarea și gustul (de ex. în conserve de leguminoase, maioneză). DZA EFSA 1,9 mg/kg corp.'),
  x('E501', 'acid', 'none', 'Potassium carbonates', 'Carbonați de potasiu', ['carbonat de potasiu', 'carbonati de potasiu', 'potassium carbonate'], 'Raising agent and acidity regulator (potash).', 'Agent de afânare și corector de aciditate (potasă).'),
  x('E504', 'acid', 'none', 'Magnesium carbonates', 'Carbonați de magneziu', ['carbonat de magneziu', 'carbonati de magneziu', 'magnesium carbonate'], 'Acidity regulator and anti-caking agent.', 'Corector de aciditate și antiaglomerant.'),
  x('E507', 'acid', 'none', 'Hydrochloric acid', 'Acid clorhidric', ['acid clorhidric', 'hydrochloric acid'], 'Acid used in processing (e.g. starch, protein hydrolysis); neutralised in the food.', 'Acid folosit la prelucrare (de ex. amidon, hidroliza proteinelor); neutralizat în aliment.'),
  x('E508', 'other', 'none', 'Potassium chloride', 'Clorură de potasiu', ['clorura de potasiu', 'potassium chloride'], 'Salt substitute and gelling aid.', 'Înlocuitor de sare și ajutor la gelificare.'),
  x('E511', 'other', 'none', 'Magnesium chloride', 'Clorură de magneziu', ['clorura de magneziu', 'magnesium chloride', 'nigari'], 'Firming agent (tofu coagulant).', 'Agent de întărire (coagulant pentru tofu).'),
  x('E512', 'other', 'low', 'Stannous chloride', 'Clorură stanoasă', ['clorura stanoasa', 'clorura de staniu', 'stannous chloride'], 'Keeps the colour of canned white asparagus (tin compound; only there).', 'Păstrează culoarea sparanghelului alb la conservă (compus de staniu; doar acolo).'),
  x('E513', 'acid', 'none', 'Sulphuric acid', 'Acid sulfuric', ['acid sulfuric', 'sulphuric acid', 'sulfuric acid'], 'Acid used in processing; neutralised in the food.', 'Acid folosit la prelucrare; neutralizat în aliment.'),
  x('E514', 'acid', 'none', 'Sodium sulphates', 'Sulfați de sodiu', ['sulfat de sodiu', 'sulfati de sodiu', 'sodium sulphate'], 'Acidity regulator.', 'Corector de aciditate.'),
  x('E515', 'acid', 'none', 'Potassium sulphates', 'Sulfați de potasiu', ['sulfat de potasiu', 'sulfati de potasiu', 'potassium sulphate'], 'Salt substitute and acidity regulator.', 'Înlocuitor de sare și corector de aciditate.'),
  x('E516', 'other', 'none', 'Calcium sulphate', 'Sulfat de calciu', ['sulfat de calciu', 'calcium sulphate', 'calcium sulfate'], 'Firming agent (tofu coagulant), calcium source.', 'Agent de întărire (coagulant pentru tofu), sursă de calciu.'),
  x('E517', 'other', 'none', 'Ammonium sulphate', 'Sulfat de amoniu', ['sulfat de amoniu', 'ammonium sulphate'], 'Flour treatment and yeast nutrient.', 'Agent de tratare a făinii și nutrient pentru drojdie.'),
  x('E524', 'acid', 'none', 'Sodium hydroxide', 'Hidroxid de sodiu', ['hidroxid de sodiu', 'sodium hydroxide'], 'Strong base used in processing (pretzels, cocoa, olives); neutralised in the food.', 'Bază puternică folosită la prelucrare (covrigi, cacao, măsline); neutralizată în aliment.'),
  x('E525', 'acid', 'none', 'Potassium hydroxide', 'Hidroxid de potasiu', ['hidroxid de potasiu', 'potassium hydroxide'], 'Base used in processing (e.g. cocoa); neutralised in the food.', 'Bază folosită la prelucrare (de ex. cacao); neutralizată în aliment.'),
  x('E526', 'acid', 'none', 'Calcium hydroxide', 'Hidroxid de calciu', ['hidroxid de calciu', 'calcium hydroxide'], 'Base and firming agent (lime water).', 'Bază și agent de întărire (apă de var).'),
  x('E527', 'acid', 'none', 'Ammonium hydroxide', 'Hidroxid de amoniu', ['hidroxid de amoniu', 'ammonium hydroxide'], 'Acidity regulator (e.g. in cocoa).', 'Corector de aciditate (de ex. în cacao).'),
  x('E528', 'acid', 'none', 'Magnesium hydroxide', 'Hidroxid de magneziu', ['hidroxid de magneziu', 'magnesium hydroxide'], 'Acidity regulator.', 'Corector de aciditate.'),
  x('E529', 'acid', 'none', 'Calcium oxide', 'Oxid de calciu', ['oxid de calciu', 'calcium oxide'], 'Acidity regulator (quicklime).', 'Corector de aciditate (var nestins).'),
  x('E530', 'other', 'none', 'Magnesium oxide', 'Oxid de magneziu', ['oxid de magneziu', 'magnesium oxide'], 'Anti-caking agent, magnesium source.', 'Antiaglomerant, sursă de magneziu.'),
  x('E535', 'other', 'low', 'Sodium ferrocyanide', 'Ferocianură de sodiu', ['ferocianura de sodiu', 'sodium ferrocyanide'], 'Anti-caking agent for salt only, in very small amounts (stable; the cyanide is bound).', 'Antiaglomerant doar pentru sare, în cantități foarte mici (stabil; cianura este legată).'),
  x('E536', 'other', 'low', 'Potassium ferrocyanide', 'Ferocianură de potasiu', ['ferocianura de potasiu', 'potassium ferrocyanide'], 'Anti-caking agent for salt only, in very small amounts (stable; the cyanide is bound).', 'Antiaglomerant doar pentru sare, în cantități foarte mici (stabil; cianura este legată).'),
  x('E538', 'other', 'low', 'Calcium ferrocyanide', 'Ferocianură de calciu', ['ferocianura de calciu', 'calcium ferrocyanide'], 'Anti-caking agent for salt only, in very small amounts (stable; the cyanide is bound).', 'Antiaglomerant doar pentru sare, în cantități foarte mici (stabil; cianura este legată).'),
  x('E552', 'other', 'low', 'Calcium silicate', 'Silicat de calciu', ['silicat de calciu', 'calcium silicate'], 'Anti-caking agent, same group as silicon dioxide (E551).', 'Antiaglomerant, același grup cu dioxidul de siliciu (E551).'),
  x('E553a', 'other', 'low', 'Magnesium silicate', 'Silicat de magneziu', ['silicat de magneziu', 'trisilicat de magneziu', 'magnesium silicate'], 'Anti-caking agent, same group as silicon dioxide (E551).', 'Antiaglomerant, același grup cu dioxidul de siliciu (E551).'),
  x('E553b', 'other', 'low', 'Talc', 'Talc', ['talc'], 'Anti-caking and dusting agent (e.g. on chewing gum, rice).', 'Antiaglomerant și pudrare (de ex. pe gumă de mestecat, orez).'),
  x('E555', 'other', 'medium', 'Potassium aluminium silicate', 'Silicat de aluminiu și potasiu', ['silicat de aluminiu si potasiu', 'potassium aluminium silicate'], `Carrier for pearlescent colours. ${ALU_EN}`, `Suport pentru coloranți perlați. ${ALU_RO}`),
  x('E570', 'other', 'none', 'Fatty acids', 'Acizi grași', ['acid stearic', 'stearic acid'], 'Glazing and anti-caking agent (e.g. stearic acid).', 'Agent de glazurare și antiaglomerant (de ex. acid stearic).'),
  x('E574', 'acid', 'none', 'Gluconic acid', 'Acid gluconic', ['acid gluconic', 'gluconic acid'], 'Acidity regulator.', 'Corector de aciditate.'),
  x('E575', 'acid', 'none', 'Glucono-delta-lactone', 'Glucono-delta-lactonă', ['glucono-delta-lactona', 'glucono delta lactona', 'glucono-delta-lactone', 'gdl'], 'Slow acidifier (cured meats, tofu, baking).', 'Acidifiant lent (mezeluri, tofu, panificație).'),
  x('E576', 'acid', 'none', 'Sodium gluconate', 'Gluconat de sodiu', ['gluconat de sodiu', 'sodium gluconate'], 'Sequestrant and acidity regulator.', 'Sechestrant și corector de aciditate.'),
  x('E577', 'acid', 'none', 'Potassium gluconate', 'Gluconat de potasiu', ['gluconat de potasiu', 'potassium gluconate'], 'Sequestrant and acidity regulator.', 'Sechestrant și corector de aciditate.'),
  x('E578', 'acid', 'none', 'Calcium gluconate', 'Gluconat de calciu', ['gluconat de calciu', 'calcium gluconate'], 'Firming agent, calcium source.', 'Agent de întărire, sursă de calciu.'),
  x('E579', 'colour', 'low', 'Ferrous gluconate', 'Gluconat feros', ['gluconat feros', 'ferrous gluconate'], 'Iron salt that keeps black olives black (only there).', 'Sare de fier care păstrează măslinele negre (doar acolo).'),
  x('E585', 'colour', 'low', 'Ferrous lactate', 'Lactat feros', ['lactat feros', 'ferrous lactate'], 'Iron salt that keeps black olives black (only there).', 'Sare de fier care păstrează măslinele negre (doar acolo).'),
  x('E586', 'antioxidant', 'low', '4-Hexylresorcinol', '4-Hexilrezorcinol', ['4-hexilrezorcinol', '4-hexylresorcinol', 'hexilrezorcinol'], 'Stops black spots on shrimps and other crustaceans (only there).', 'Previne petele negre pe creveți și alte crustacee (doar acolo).'),

  // Thickeners, gums, starches, celluloses
  x('E400', 'thickener', 'none', 'Alginic acid', 'Acid alginic', ['acid alginic', 'alginic acid'], 'Thickener from brown seaweed.', 'Agent de îngroșare din alge brune.'),
  x('E401', 'thickener', 'none', 'Sodium alginate', 'Alginat de sodiu', ['alginat de sodiu', 'sodium alginate'], 'Thickener and gelling agent from seaweed.', 'Agent de îngroșare și gelifiant din alge.'),
  x('E402', 'thickener', 'none', 'Potassium alginate', 'Alginat de potasiu', ['alginat de potasiu', 'potassium alginate'], 'Thickener from seaweed.', 'Agent de îngroșare din alge.'),
  x('E403', 'thickener', 'none', 'Ammonium alginate', 'Alginat de amoniu', ['alginat de amoniu', 'ammonium alginate'], 'Thickener from seaweed.', 'Agent de îngroșare din alge.'),
  x('E404', 'thickener', 'none', 'Calcium alginate', 'Alginat de calciu', ['alginat de calciu', 'calcium alginate'], 'Gelling agent from seaweed.', 'Gelifiant din alge.'),
  x('E405', 'thickener', 'none', 'Propane-1,2-diol alginate', 'Alginat de propan-1,2-diol', ['alginat de propan-1,2-diol', 'alginat de propilenglicol', 'propylene glycol alginate'], 'Foam stabiliser (beer) and thickener.', 'Stabilizator de spumă (bere) și agent de îngroșare.'),
  x('E413', 'thickener', 'none', 'Tragacanth', 'Tragacant', ['tragacant', 'guma tragacant', 'tragacanth'], 'Natural plant gum thickener.', 'Agent de îngroșare natural din gumă vegetală.'),
  x('E416', 'thickener', 'none', 'Karaya gum', 'Gumă karaya', ['guma karaya', 'karaya gum'], 'Natural plant gum thickener.', 'Agent de îngroșare natural din gumă vegetală.'),
  x('E417', 'thickener', 'none', 'Tara gum', 'Gumă tara', ['guma tara', 'tara gum'], 'Natural thickener from tara seeds.', 'Agent de îngroșare natural din semințe de tara.'),
  x('E425', 'thickener', 'low', 'Konjac', 'Konjac', ['konjac', 'glucomanan konjac', 'guma konjac', 'konjac gum', 'konjac glucomannan'], 'Thickener from konjac tubers; not allowed in jelly mini-cups (choking risk, EU since 2004).', 'Agent de îngroșare din tuberculi de konjac; interzis în paharele mici cu jeleu (risc de sufocare, UE din 2004).'),
  x('E426', 'thickener', 'none', 'Soybean hemicellulose', 'Hemiceluloză de soia', ['hemiceluloza de soia', 'soybean hemicellulose'], 'Stabiliser from soybean fibre.', 'Stabilizator din fibre de soia.'),
  x('E427', 'thickener', 'none', 'Cassia gum', 'Gumă cassia', ['guma cassia', 'cassia gum'], 'Thickener from cassia seeds.', 'Agent de îngroșare din semințe de cassia.'),
  x('E459', 'thickener', 'none', 'Beta-cyclodextrin', 'Beta-ciclodextrină', ['beta-ciclodextrina', 'beta-cyclodextrin'], 'Carrier for flavours and vitamins (made from starch).', 'Suport pentru arome și vitamine (obținut din amidon).'),
  x('E462', 'thickener', 'low', 'Ethyl cellulose', 'Etilceluloză', ['etilceluloza', 'ethyl cellulose'], 'Cellulose-based binder and coating, same group as E461.', 'Liant și înveliș pe bază de celuloză, același grup cu E461.'),
  x('E463', 'thickener', 'low', 'Hydroxypropyl cellulose', 'Hidroxipropilceluloză', ['hidroxipropilceluloza', 'hydroxypropyl cellulose'], 'Cellulose-based thickener, same group as E461.', 'Agent de îngroșare pe bază de celuloză, același grup cu E461.'),
  x('E465', 'thickener', 'low', 'Ethyl methyl cellulose', 'Etilmetilceluloză', ['etilmetilceluloza', 'ethyl methyl cellulose'], 'Cellulose-based thickener, same group as E461.', 'Agent de îngroșare pe bază de celuloză, același grup cu E461.'),
  x('E468', 'thickener', 'medium', 'Cross-linked sodium carboxymethyl cellulose', 'Carboximetilceluloză sodică reticulată', ['carboximetilceluloza sodica reticulata', 'croscarmeloza', 'croscarmellose'], CMC_EN, CMC_RO),
  x('E469', 'thickener', 'medium', 'Enzymatically hydrolysed carboxymethyl cellulose', 'Carboximetilceluloză hidrolizată enzimatic', ['carboximetilceluloza hidrolizata enzimatic', 'enzymatically hydrolysed carboxymethyl cellulose'], CMC_EN, CMC_RO),
  x('E1410', 'thickener', 'none', 'Monostarch phosphate', 'Fosfat de monoamidon', ['fosfat de monoamidon', 'monostarch phosphate'], 'Modified starch (thickener).', 'Amidon modificat (agent de îngroșare).'),
  x('E1413', 'thickener', 'none', 'Phosphated distarch phosphate', 'Fosfat de diamidon fosfatat', ['fosfat de diamidon fosfatat', 'phosphated distarch phosphate'], 'Modified starch (thickener).', 'Amidon modificat (agent de îngroșare).'),
  x('E1440', 'thickener', 'none', 'Hydroxypropyl starch', 'Amidon hidroxipropilat', ['amidon hidroxipropilat', 'hydroxypropyl starch'], 'Modified starch (thickener).', 'Amidon modificat (agent de îngroșare).'),
  x('E1451', 'thickener', 'none', 'Acetylated oxidised starch', 'Amidon oxidat acetilat', ['amidon oxidat acetilat', 'acetylated oxidised starch'], 'Modified starch (thickener).', 'Amidon modificat (agent de îngroșare).'),
  x('E1452', 'thickener', 'medium', 'Starch aluminium octenyl succinate', 'Octenil succinat de amidon și aluminiu', ['octenil succinat de amidon si aluminiu', 'starch aluminium octenyl succinate'], `Modified starch used in encapsulated vitamin supplements. ${ALU_EN}`, `Amidon modificat folosit în suplimente cu vitamine încapsulate. ${ALU_RO}`),

  // Emulsifiers
  x('E431', 'emulsifier', 'low', 'Polyoxyethylene (40) stearate', 'Stearat de polioxietilenă (40)', ['stearat de polioxietilena', 'polyoxyethylene stearate'], 'Synthetic emulsifier.', 'Emulgator sintetic.'),
  x('E432', 'emulsifier', 'medium', 'Polysorbate 20', 'Polisorbat 20', ['polisorbat 20', 'polysorbate 20'], POLYSORBATE_EN, POLYSORBATE_RO),
  x('E434', 'emulsifier', 'medium', 'Polysorbate 40', 'Polisorbat 40', ['polisorbat 40', 'polysorbate 40'], POLYSORBATE_EN, POLYSORBATE_RO),
  x('E435', 'emulsifier', 'medium', 'Polysorbate 60', 'Polisorbat 60', ['polisorbat 60', 'polysorbate 60'], POLYSORBATE_EN, POLYSORBATE_RO),
  x('E436', 'emulsifier', 'medium', 'Polysorbate 65', 'Polisorbat 65', ['polisorbat 65', 'polysorbate 65'], POLYSORBATE_EN, POLYSORBATE_RO),
  x('E444', 'emulsifier', 'low', 'Sucrose acetate isobutyrate (SAIB)', 'Acetat izobutirat de zaharoză (SAIB)', ['acetat izobutirat de zaharoza', 'sucrose acetate isobutyrate', 'SAIB'], 'Weighting agent that keeps flavour oils evenly spread in cloudy soft drinks.', 'Agent de încărcare care ține uleiurile aromatice dispersate în băuturile răcoritoare tulburi.'),
  x('E445', 'emulsifier', 'low', 'Glycerol esters of wood rosins', 'Esteri ai glicerolului cu colofoniu', ['esteri ai glicerolului cu colofoniu', 'esteri ai glicerolului din rasini de lemn', 'esteri glicerici ai colofoniului', 'glycerol esters of wood rosins'], 'Weighting agent that keeps flavour oils evenly spread in cloudy soft drinks.', 'Agent de încărcare care ține uleiurile aromatice dispersate în băuturile răcoritoare tulburi.'),
  x('E470a', 'emulsifier', 'none', 'Sodium, potassium and calcium salts of fatty acids', 'Săruri de sodiu, potasiu și calciu ale acizilor grași', ['saruri de sodiu, potasiu si calciu ale acizilor grasi', 'saruri ale acizilor grasi'], 'Emulsifier and anti-caking agent.', 'Emulgator și antiaglomerant.'),
  x('E470b', 'emulsifier', 'none', 'Magnesium salts of fatty acids', 'Săruri de magneziu ale acizilor grași', ['saruri de magneziu ale acizilor grasi', 'stearat de magneziu', 'magnesium stearate'], 'Emulsifier and anti-caking agent (e.g. magnesium stearate in tablets).', 'Emulgator și antiaglomerant (de ex. stearat de magneziu în tablete).'),
  x('E472a', 'emulsifier', 'low', 'Acetic acid esters of mono- and diglycerides', 'Esteri ai acidului acetic cu mono- și digliceride', ['esteri ai acidului acetic cu mono- si digliceride', 'esteri acetici ai mono- si digliceridelor'], 'Emulsifier from the E471 family.', 'Emulgator din familia E471.'),
  x('E472b', 'emulsifier', 'low', 'Lactic acid esters of mono- and diglycerides', 'Esteri ai acidului lactic cu mono- și digliceride', ['esteri ai acidului lactic cu mono- si digliceride', 'esteri lactici ai mono- si digliceridelor'], 'Emulsifier from the E471 family.', 'Emulgator din familia E471.'),
  x('E472c', 'emulsifier', 'low', 'Citric acid esters of mono- and diglycerides', 'Esteri ai acidului citric cu mono- și digliceride', ['esteri ai acidului citric cu mono- si digliceride', 'esteri citrici ai mono- si digliceridelor'], 'Emulsifier from the E471 family.', 'Emulgator din familia E471.'),
  x('E472d', 'emulsifier', 'low', 'Tartaric acid esters of mono- and diglycerides', 'Esteri ai acidului tartric cu mono- și digliceride', ['esteri ai acidului tartric cu mono- si digliceride'], 'Emulsifier from the E471 family.', 'Emulgator din familia E471.'),
  x('E472f', 'emulsifier', 'low', 'Mixed acetic and tartaric acid esters of mono- and diglycerides', 'Esteri micști ai acizilor acetic și tartric cu mono- și digliceride', ['esteri micsti ai acizilor acetic si tartric cu mono- si digliceride'], 'Emulsifier from the E471 family.', 'Emulgator din familia E471.'),
  x('E473', 'emulsifier', 'low', 'Sucrose esters of fatty acids', 'Esteri ai zaharozei cu acizi grași', ['esteri ai zaharozei cu acizii grasi', 'esteri ai zaharozei cu acizi grasi', 'sucrose esters of fatty acids'], 'Emulsifier made from sugar and fatty acids.', 'Emulgator obținut din zahăr și acizi grași.'),
  x('E474', 'emulsifier', 'low', 'Sucroglycerides', 'Zaharogliceride', ['zaharogliceride', 'sucroglycerides'], 'Emulsifier made from sugar and fats.', 'Emulgator obținut din zahăr și grăsimi.'),
  x('E477', 'emulsifier', 'low', 'Propane-1,2-diol esters of fatty acids', 'Esteri ai propan-1,2-diolului cu acizi grași', ['esteri ai propan-1,2-diolului cu acizii grasi', 'esteri ai propilenglicolului cu acizi grasi', 'propylene glycol esters of fatty acids'], 'Emulsifier (whipped toppings, cake mixes).', 'Emulgator (spume de frișcă, amestecuri pentru prăjituri).'),
  x('E479b', 'emulsifier', 'low', 'Thermally oxidised soya bean oil with mono- and diglycerides', 'Ulei de soia oxidat termic cu mono- și digliceride', ['ulei de soia oxidat termic', 'thermally oxidised soya bean oil'], 'Emulsifier for frying fats.', 'Emulgator pentru grăsimi de prăjit.'),
  x('E482', 'emulsifier', 'low', 'Calcium stearoyl-2-lactylate', 'Stearoil-2-lactilat de calciu', ['stearoil-2-lactilat de calciu', 'stearoil lactilat de calciu', 'calcium stearoyl lactylate'], 'Dough conditioner, same group as E481.', 'Ameliorator de aluat, același grup cu E481.'),
  x('E483', 'emulsifier', 'low', 'Stearyl tartrate', 'Tartrat de stearil', ['tartrat de stearil', 'stearyl tartrate'], 'Dough conditioner.', 'Ameliorator de aluat.'),
  x('E492', 'emulsifier', 'low', 'Sorbitan tristearate', 'Tristearat de sorbitan', ['tristearat de sorbitan', 'sorbitan tristearate'], 'Emulsifier, same group as E491 (e.g. in chocolate, against bloom).', 'Emulgator, același grup cu E491 (de ex. în ciocolată, împotriva albirii).'),
  x('E493', 'emulsifier', 'low', 'Sorbitan monolaurate', 'Monolaurat de sorbitan', ['monolaurat de sorbitan', 'sorbitan monolaurate'], 'Emulsifier, same group as E491.', 'Emulgator, același grup cu E491.'),
  x('E494', 'emulsifier', 'low', 'Sorbitan monooleate', 'Monooleat de sorbitan', ['monooleat de sorbitan', 'sorbitan monooleate'], 'Emulsifier, same group as E491.', 'Emulgator, același grup cu E491.'),
  x('E495', 'emulsifier', 'low', 'Sorbitan monopalmitate', 'Monopalmitat de sorbitan', ['monopalmitat de sorbitan', 'sorbitan monopalmitate'], 'Emulsifier, same group as E491.', 'Emulgator, același grup cu E491.'),
  x('E499', 'other', 'none', 'Stigmasterol-rich plant sterols', 'Steroli vegetali bogați în stigmasterol', ['steroli vegetali bogati in stigmasterol', 'stigmasterol-rich plant sterols'], 'Stabiliser for frozen cocktail mixes.', 'Stabilizator pentru amestecuri congelate de cocktail.'),

  // Flavour enhancers
  x('E626', 'enhancer', 'low', 'Guanylic acid', 'Acid guanilic', ['acid guanilic', 'guanylic acid'], RIBO_EN, RIBO_RO),
  x('E628', 'enhancer', 'low', 'Dipotassium guanylate', 'Guanilat dipotasic', ['guanilat dipotasic', 'dipotassium guanylate'], RIBO_EN, RIBO_RO),
  x('E629', 'enhancer', 'low', 'Calcium guanylate', 'Guanilat de calciu', ['guanilat de calciu', 'calcium guanylate'], RIBO_EN, RIBO_RO),
  x('E630', 'enhancer', 'low', 'Inosinic acid', 'Acid inozinic', ['acid inozinic', 'inosinic acid'], RIBO_EN, RIBO_RO),
  x('E632', 'enhancer', 'low', 'Dipotassium inosinate', 'Inozinat dipotasic', ['inozinat dipotasic', 'dipotassium inosinate'], RIBO_EN, RIBO_RO),
  x('E633', 'enhancer', 'low', 'Calcium inosinate', 'Inozinat de calciu', ['inozinat de calciu', 'calcium inosinate'], RIBO_EN, RIBO_RO),
  x('E634', 'enhancer', 'low', "Calcium 5'-ribonucleotides", "5'-ribonucleotide de calciu", ["5'-ribonucleotide de calciu", 'ribonucleotide de calciu', 'calcium ribonucleotides'], RIBO_EN, RIBO_RO),
  x('E640', 'enhancer', 'none', 'Glycine and its sodium salt', 'Glicină și sarea ei de sodiu', ['glicina', 'glycine'], 'Amino acid used as flavour enhancer.', 'Aminoacid folosit ca potențiator de aromă.'),
  x('E650', 'enhancer', 'none', 'Zinc acetate', 'Acetat de zinc', ['acetat de zinc', 'zinc acetate'], 'Flavour enhancer in chewing gum (only there).', 'Potențiator de aromă în guma de mestecat (doar acolo).'),

  // Glazing agents, waxes, gases, flour treatment, others
  x('E902', 'other', 'none', 'Candelilla wax', 'Ceară candelilla', ['ceara candelilla', 'candelilla wax'], 'Plant wax for glazing sweets.', 'Ceară vegetală pentru glazurarea dulciurilor.'),
  x('E905', 'other', 'low', 'Microcrystalline wax', 'Ceară microcristalină', ['ceara microcristalina', 'microcrystalline wax'], 'Petroleum-based wax for coating cheese rinds and some sweets.', 'Ceară derivată din petrol pentru acoperirea cojii brânzeturilor și a unor dulciuri.'),
  x('E907', 'other', 'low', 'Hydrogenated poly-1-decene', 'Poli-1-decenă hidrogenată', ['poli-1-decena hidrogenata', 'hydrogenated poly-1-decene'], 'Synthetic glazing agent for dried fruit and sweets.', 'Agent sintetic de glazurare pentru fructe uscate și dulciuri.'),
  x('E914', 'other', 'low', 'Oxidised polyethylene wax', 'Ceară de polietilenă oxidată', ['ceara de polietilena oxidata', 'oxidised polyethylene wax'], 'Synthetic wax on the peel of citrus and other fruit (not eaten).', 'Ceară sintetică pe coaja citricelor și a altor fructe (nu se consumă).'),
  x('E920', 'other', 'none', 'L-cysteine', 'L-cisteină', ['l-cisteina', 'l-cysteine'], 'Flour treatment agent (an amino acid); may come from feathers or hair, or be made by fermentation.', 'Agent de tratare a făinii (aminoacid); poate proveni din pene sau păr, ori din fermentație.'),
  x('E927b', 'other', 'none', 'Carbamide (urea)', 'Carbamidă (uree)', ['carbamida', 'carbamide'], 'Used only in sugar-free chewing gum.', 'Folosit doar în guma de mestecat fără zahăr.'),
  x('E938', 'other', 'none', 'Argon', 'Argon', ['argon'], GAS_EN, GAS_RO),
  x('E939', 'other', 'none', 'Helium', 'Heliu', ['heliu', 'helium'], GAS_EN, GAS_RO),
  x('E941', 'other', 'none', 'Nitrogen', 'Azot', ['azot', 'nitrogen'], GAS_EN, GAS_RO),
  x('E942', 'other', 'none', 'Nitrous oxide', 'Protoxid de azot', ['protoxid de azot', 'oxid de diazot', 'nitrous oxide'], 'Propellant gas (whipped cream sprays).', 'Gaz propulsor (spray de frișcă).'),
  x('E943a', 'other', 'none', 'Butane', 'Butan', ['butan', 'butane'], 'Propellant for cooking-oil sprays.', 'Propulsor pentru spray-urile de ulei de gătit.'),
  x('E943b', 'other', 'none', 'Isobutane', 'Izobutan', ['izobutan', 'isobutane'], 'Propellant for cooking-oil sprays.', 'Propulsor pentru spray-urile de ulei de gătit.'),
  x('E944', 'other', 'none', 'Propane', 'Propan', ['propan', 'propane'], 'Propellant for cooking-oil sprays.', 'Propulsor pentru spray-urile de ulei de gătit.'),
  x('E948', 'other', 'none', 'Oxygen', 'Oxigen', ['oxigen', 'oxygen'], GAS_EN, GAS_RO),
  x('E949', 'other', 'none', 'Hydrogen', 'Hidrogen', ['hidrogen', 'hydrogen'], GAS_EN, GAS_RO),
  x('E999', 'other', 'none', 'Quillaia extract', 'Extract de quillaia', ['extract de quillaia', 'quillaia extract', 'quillaja'], 'Foaming agent in soft drinks (from the soap-bark tree).', 'Agent de spumare în băuturi răcoritoare (din arborele de săpun).'),
  x('E1103', 'other', 'none', 'Invertase', 'Invertază', ['invertaza', 'invertase'], 'Enzyme that keeps soft-centred sweets soft.', 'Enzimă care menține moale umplutura bomboanelor.'),
  x('E1200', 'thickener', 'low', 'Polydextrose', 'Polidextroză', ['polidextroza', 'polydextrose'], 'Bulking agent (a fibre); large amounts can have a laxative effect.', 'Agent de încărcare (fibră); în cantități mari poate avea efect laxativ.'),
  x('E1201', 'thickener', 'low', 'Polyvinylpyrrolidone', 'Polivinilpirolidonă', ['polivinilpirolidona', 'polyvinylpyrrolidone', 'povidona', 'povidone'], 'Synthetic binder for tablets and supplements.', 'Liant sintetic pentru tablete și suplimente.'),
  x('E1202', 'thickener', 'low', 'Polyvinylpolypyrrolidone', 'Polivinilpolipirolidonă', ['polivinilpolipirolidona', 'polyvinylpolypyrrolidone', 'crospovidona', 'crospovidone'], 'Synthetic aid for tablets and for clarifying drinks.', 'Ajutor sintetic pentru tablete și limpezirea băuturilor.'),
  x('E1203', 'thickener', 'low', 'Polyvinyl alcohol', 'Alcool polivinilic', ['alcool polivinilic', 'polyvinyl alcohol'], 'Synthetic coating for supplements.', 'Înveliș sintetic pentru suplimente.'),
  x('E1204', 'thickener', 'none', 'Pullulan', 'Pululan', ['pululan', 'pullulan'], 'Film for capsules (made by fermentation).', 'Peliculă pentru capsule (obținută prin fermentație).'),
  x('E1205', 'thickener', 'low', 'Basic methacrylate copolymer', 'Copolimer bazic de metacrilat', ['copolimer bazic de metacrilat', 'basic methacrylate copolymer'], 'Synthetic coating for supplements.', 'Înveliș sintetic pentru suplimente.'),
  x('E1206', 'thickener', 'low', 'Neutral methacrylate copolymer', 'Copolimer neutru de metacrilat', ['copolimer neutru de metacrilat', 'neutral methacrylate copolymer'], 'Synthetic coating for supplements.', 'Înveliș sintetic pentru suplimente.'),
  x('E1208', 'thickener', 'low', 'Anionic methacrylate copolymer', 'Copolimer anionic de metacrilat', ['copolimer anionic de metacrilat', 'anionic methacrylate copolymer'], 'Synthetic coating for supplements.', 'Înveliș sintetic pentru suplimente.'),
  x('E1209', 'thickener', 'low', 'Polyvinyl alcohol–polyethylene glycol graft copolymer', 'Copolimer grefat alcool polivinilic–polietilenglicol', ['copolimer grefat alcool polivinilic-polietilenglicol', 'pva-peg graft copolymer'], 'Synthetic coating for supplements.', 'Înveliș sintetic pentru suplimente.'),
  x('E1505', 'other', 'none', 'Triethyl citrate', 'Citrat de trietil', ['citrat de trietil', 'triethyl citrate'], 'Foam stabiliser for egg white and flavour carrier.', 'Stabilizator de spumă pentru albuș și suport de arome.'),
  x('E1517', 'other', 'none', 'Glyceryl diacetate (diacetin)', 'Diacetat de gliceril (diacetină)', ['diacetat de gliceril', 'diacetina', 'diacetin'], 'Carrier for flavours.', 'Suport pentru arome.'),
  x('E1518', 'other', 'none', 'Glyceryl triacetate (triacetin)', 'Triacetat de gliceril (triacetină)', ['triacetat de gliceril', 'triacetina', 'triacetin'], 'Carrier for flavours and humectant in chewing gum.', 'Suport pentru arome și umectant în guma de mestecat.'),
  x('E1519', 'other', 'low', 'Benzyl alcohol', 'Alcool benzilic', ['alcool benzilic', 'benzyl alcohol'], 'Carrier for flavours in drinks and sweets (also a fragrance allergen in cosmetics).', 'Suport pentru arome în băuturi și dulciuri (și alergen de parfum în cosmetice).'),
  x('E1521', 'other', 'low', 'Polyethylene glycol', 'Polietilenglicol', ['polietilenglicol', 'polyethylene glycol'], 'Synthetic coating and antifoam for supplements.', 'Înveliș sintetic și antispumant pentru suplimente.'),
];
