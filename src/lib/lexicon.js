/**
 * Ingredient word list for OCR clean-up: fixes words that are one unambiguous
 * edit away from a known ingredient word ("sore" → "sare", "posteurizat" →
 * "pasteurizat") and restores Romanian diacritics ("zahar" → "zahăr").
 * Real words are never changed, so a correction cannot invent an additive.
 */
import { ADDITIVES } from '../data/additives.js';
import { NONFOOD_INGREDIENTS } from '../data/nonFoodIngredients.js';
import { AVOID_PRESETS } from '../data/avoidPresets.js';
import { normalize } from './analyze.js';
import { levenshtein } from './ocrText.js';

/* Common words on Romanian ingredient lists (with diacritics). */
const COMMON = `
apă sare zahăr făină grâu secară ovăz orz porumb orez cartofi amidon ulei uleiuri grăsime grăsimi vegetală vegetale
palmier floarea-soarelui rapiță măsline soia lapte praf smântână unt brânză iaurt zer cazeină ouă ou albuș gălbenuș
carne porc pui vită curcan pește ton somon ficat slănină șorici sânge mușchi piept pulpă
concentrat tomate roșii ardei ceapă usturoi morcov țelină pătrunjel mărar cimbru piper boia paprika chimen coriandru
oregano busuioc dafin muștar oțet vin lămâie portocale mere pere căpșuni zmeură vișine cireșe caise prune struguri
banane ananas nucă nuci alune arahide migdale fistic cocos susan semințe in mac cacao ciocolată vanilie vanilină scorțișoară
miere sirop glucoză fructoză dextroză lactoză maltodextrină zaharoză caramel melasă drojdie maia gluten tărâțe fibre
proteine hidrolizate izolat concentrat extract suc pulpă piure pastă bucăți fulgi granule pudră pulbere
emulgator emulgatori stabilizator stabilizatori conservant conservanți antioxidant antioxidanți colorant coloranți
acidifiant corector aciditate agent agenți afânare îngroșare gelifiant îndulcitor îndulcitori aromă arome naturală naturale
potențiator potențiatori sare iodată condimente legume fructe verdețuri ciuperci mazăre fasole linte năut
pasteurizat pasteurizată sterilizat uscat uscată uscate solubilă substanță conține poate urme minimum maxim adaos
integral integrală degresat degresată semidegresat hidrogenat hidrogenată parțial modificat modificată rafinat rafinată
`;

let lexicon = null;

/** normalised word → preferred spelling (with diacritics where known). */
export function getLexicon() {
  if (lexicon) return lexicon;
  lexicon = new Map();
  const add = (phrase) => {
    for (const w of String(phrase).split(/[^\p{L}\p{N}-]+/u)) {
      if (w.length < 3 || /\d/.test(w)) continue;
      for (const part of w.split('-')) {
        if (part.length < 3) continue;
        const key = normalize(part);
        const prev = lexicon.get(key);
        // Prefer the spelling with diacritics, in lower case.
        if (!prev || (prev === key && part.toLowerCase() !== key)) lexicon.set(key, part === part.toUpperCase() && part.length > 3 ? key : part.toLowerCase());
      }
    }
  };
  COMMON.split(/\s+/).forEach(add);
  for (const a of ADDITIVES) { a.aliases.forEach(add); add(a.name.ro); add(a.name.en); }
  for (const n of NONFOOD_INGREDIENTS) { n.aliases.forEach(add); add(n.name.ro); add(n.name.en); }
  for (const p of AVOID_PRESETS) { p.terms.forEach(add); add(p.label.ro); }
  return lexicon;
}

/** "maltodextrinapotentiatori" → ['maltodextrina', 'potentiatori'] (both parts known, ≥ 3 letters). */
function splitGlued(key, lex) {
  if (key.length < 7) return null;
  let best = null;
  for (let i = 3; i <= key.length - 3; i++) {
    const a = key.slice(0, i);
    const b = key.slice(i);
    if (lex.has(a) && lex.has(b) && (!best || Math.min(a.length, b.length) > Math.min(best[0].length, best[1].length))) best = [a, b];
  }
  return best;
}

function matchCase(word, replacement) {
  const letters = word.replace(/[^\p{L}]/gu, '');
  const upper = letters.replace(/[^\p{Lu}]/gu, '').length;
  if (letters.length > 1 && upper / letters.length >= 0.7) return replacement.toUpperCase();
  if (word[0] === word[0].toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

/**
 * @returns {{text: string, changes: {from: string, to: string}[]}}
 */
export function correctWords(text, lex = getLexicon()) {
  const changes = [];
  const keys = [...lex.keys()];
  const out = String(text || '').replace(/\p{L}[\p{L}\p{M}]*/gu, (word) => {
    const key = normalize(word);
    if (key.length < 3) return word;
    const known = lex.get(key);
    if (known) {
      // Known word without diacritics → add them ("zahar" → "zahăr").
      if (normalize(word) === word.toLowerCase() && known !== key && word.toLowerCase() === key) {
        const fixed = matchCase(word, known);
        changes.push({ from: word, to: fixed });
        return fixed;
      }
      return word;
    }
    if (key.length < 4) return word; // too short to correct safely
    if (word === word.toUpperCase() && key.length <= 5) return word; // short codes, abbreviations
    // Two known words glued together where ", " was lost ("cacaolapte").
    const split = splitGlued(key, lex);
    if (split) {
      const fixed = matchCase(word, `${lex.get(split[0])} ${lex.get(split[1])}`);
      changes.push({ from: word, to: fixed });
      return fixed;
    }
    const maxD = key.length >= 8 ? 2 : 1;
    let best = null;
    let bestD = maxD + 1;
    let tie = false;
    for (const k of keys) {
      if (Math.abs(k.length - key.length) > maxD) continue;
      const d = levenshtein(key, k);
      if (d < bestD) { best = k; bestD = d; tie = false; } else if (d === bestD) tie = true;
    }
    if (!best || tie || bestD > maxD) return word;
    const fixed = matchCase(word, lex.get(best));
    changes.push({ from: word, to: fixed });
    return fixed;
  });
  return { text: out, changes };
}
