import { t } from '../lib/i18n.js';

const EXAMPLES = {
  food: {
    ro: 'Ingrediente: zahăr, făină de grâu, ulei de palmier, sirop de glucoză-fructoză, cacao degresată 4%, emulgatori: lecitină din soia, E471; agent de afânare: bicarbonat de sodiu; colorant: caramel amoniacal-sulfitic (E150d), E129; conservant: sorbat de potasiu; acidifiant: acid citric; arome. Poate conține urme de lapte.',
    en: 'Ingredients: sugar, wheat flour, palm oil, glucose-fructose syrup, fat-reduced cocoa 4%, emulsifiers: soy lecithin, E471; raising agent: sodium bicarbonate; colours: sulphite ammonia caramel (E150d), E129; preservative: potassium sorbate; acid: citric acid; flavourings. May contain traces of milk.',
  },
  // INCI names are the same on Romanian and English labels.
  cosmetic: {
    ro: 'Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Glycerin, Sodium Chloride, Parfum, Dimethicone, Citric Acid, Sodium Benzoate, Methylchloroisothiazolinone, Methylisothiazolinone, Limonene, Linalool, Hexyl Cinnamal, CI 19140, CI 42090',
  },
  household: {
    ro: 'Conține: 5-15% agenți de suprafață anionici, <5% agenți de suprafață neionici, fosfonați, săpun, enzime, agenți de albire optică, policarboxilați, parfumuri, Benzisothiazolinone, Methylisothiazolinone, Limonene, Hexyl Cinnamal.',
    en: 'Contains: 5-15% anionic surfactants, <5% non-ionic surfactants, phosphonates, soap, enzymes, optical brighteners, polycarboxylates, perfumes, Benzisothiazolinone, Methylisothiazolinone, Limonene, Hexyl Cinnamal.',
  },
};

export default function IngredientInput({ lang, value, onChange, onAnalyze, type }) {
  const submit = (e) => {
    e.preventDefault();
    if (value.trim()) onAnalyze(value);
  };
  const example = EXAMPLES[type][lang] || EXAMPLES[type].ro;
  const placeholder = type === 'food' ? t(lang, 'inputPlaceholder') : t(lang, 'inputPlaceholder_' + type);

  return (
    <form className="card input-card" onSubmit={submit}>
      <label htmlFor="ingredients" className="card-title">{t(lang, 'inputTitle')}</label>
      <p className="muted">{t(lang, 'inputHint')}</p>
      <textarea
        id="ingredients"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={7}
        spellCheck={false}
        autoCapitalize="off"
      />
      <div className="actions">
        <button type="submit" className="btn primary" disabled={!value.trim()}>
          {t(lang, 'analyze')}
        </button>
        {value ? (
          <button type="button" className="btn ghost" onClick={() => onChange('')}>
            {t(lang, 'clear')}
          </button>
        ) : (
          <button type="button" className="btn ghost" onClick={() => onChange(example)}>
            {t(lang, 'example')}
          </button>
        )}
      </div>
    </form>
  );
}
