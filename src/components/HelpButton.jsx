import { t, pick } from '../lib/i18n.js';
import { openGlossary, GLOSSARY_BY_ID } from '../data/glossary.js';

/** Small "?" that opens the glossary at a term. */
export default function HelpButton({ lang, term }) {
  return (
    <button type="button" className="help-btn" onClick={() => openGlossary(term)} aria-label={t(lang, 'whatIs', { term: pick(GLOSSARY_BY_ID[term].term, lang) })}>
      ?
    </button>
  );
}
