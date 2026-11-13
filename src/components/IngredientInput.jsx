import { t } from '../lib/i18n.js';

const EXAMPLES = {
  ro: 'Ingrediente: zahăr, făină de grâu, ulei de palmier, sirop de glucoză-fructoză, cacao degresată 4%, emulgatori: lecitină din soia, E471; agent de afânare: bicarbonat de sodiu; colorant: caramel amoniacal-sulfitic (E150d), E129; conservant: sorbat de potasiu; acidifiant: acid citric; arome. Poate conține urme de lapte.',
  en: 'Ingredients: sugar, wheat flour, palm oil, glucose-fructose syrup, fat-reduced cocoa 4%, emulsifiers: soy lecithin, E471; raising agent: sodium bicarbonate; colours: sulphite ammonia caramel (E150d), E129; preservative: potassium sorbate; acid: citric acid; flavourings. May contain traces of milk.',
};

export default function IngredientInput({ lang, value, onChange, onAnalyze }) {
  const submit = (e) => {
    e.preventDefault();
    if (value.trim()) onAnalyze(value);
  };

  return (
    <form className="card input-card" onSubmit={submit}>
      <label htmlFor="ingredients" className="card-title">{t(lang, 'inputTitle')}</label>
      <p className="muted">{t(lang, 'inputHint')}</p>
      <textarea
        id="ingredients"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t(lang, 'inputPlaceholder')}
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
          <button type="button" className="btn ghost" onClick={() => onChange(EXAMPLES[lang] || EXAMPLES.en)}>
            {t(lang, 'example')}
          </button>
        )}
      </div>
    </form>
  );
}
