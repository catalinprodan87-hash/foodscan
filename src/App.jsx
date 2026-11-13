import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header.jsx';
import IngredientInput from './components/IngredientInput.jsx';
import AvoidSettings from './components/AvoidSettings.jsx';
import Result from './components/Result.jsx';
import Disclaimer from './components/Disclaimer.jsx';
import { analyze } from './lib/analyze.js';
import { detectLang } from './lib/i18n.js';
import { getLang, setLang as saveLang, getAvoidState, setAvoidState } from './lib/storage.js';

export default function App() {
  const [lang, setLang] = useState(() => getLang() || detectLang());
  const [avoid, setAvoid] = useState(() => getAvoidState());
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const result = useMemo(
    () => (submitted == null ? null : analyze({ text: submitted }, avoid)),
    [submitted, avoid],
  );

  const changeLang = (l) => {
    setLang(l);
    saveLang(l);
  };
  const changeAvoid = (s) => {
    setAvoid(s);
    setAvoidState(s);
  };
  const runAnalysis = (value) => {
    setSubmitted(value);
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app">
      <Header lang={lang} onLang={changeLang} />
      <main>
        {result ? (
          <Result lang={lang} result={result} onBack={() => setSubmitted(null)} />
        ) : (
          <>
            <IngredientInput lang={lang} value={text} onChange={setText} onAnalyze={runAnalysis} />
            <AvoidSettings lang={lang} state={avoid} onChange={changeAvoid} />
          </>
        )}
      </main>
      <Disclaimer lang={lang} />
    </div>
  );
}
