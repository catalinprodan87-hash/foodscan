import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header.jsx';
import IngredientInput from './components/IngredientInput.jsx';
import AvoidSettings from './components/AvoidSettings.jsx';
import Result from './components/Result.jsx';
import Disclaimer from './components/Disclaimer.jsx';
import { analyze, detectProductType } from './lib/analyze.js';
import { detectLang } from './lib/i18n.js';
import { getLang, setLang as saveLang, getAvoidState, setAvoidState } from './lib/storage.js';

export default function App() {
  const [lang, setLang] = useState(() => getLang() || detectLang());
  const [avoid, setAvoid] = useState(() => getAvoidState());
  const [text, setText] = useState('');
  // null = auto-detect from the text; otherwise the type the user picked.
  const [chosenType, setChosenType] = useState(null);
  const [submitted, setSubmitted] = useState(null); // { text, type, auto }

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const detectedType = useMemo(() => detectProductType(text), [text]);
  const type = chosenType ?? detectedType;

  const result = useMemo(
    () => (submitted == null ? null : analyze({ text: submitted.text, productType: submitted.type }, avoid)),
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
  const changeText = (value) => {
    setText(value);
    if (!value.trim()) setChosenType(null); // clearing the box goes back to auto-detect
  };
  const runAnalysis = (value) => {
    setSubmitted({ text: value, type, auto: chosenType == null });
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app">
      <Header lang={lang} onLang={changeLang} />
      <main>
        {result ? (
          <Result lang={lang} result={result} typeAuto={submitted.auto} onBack={() => setSubmitted(null)} />
        ) : (
          <>
            <IngredientInput
              lang={lang}
              value={text}
              onChange={changeText}
              onAnalyze={runAnalysis}
              type={type}
              typeAuto={chosenType == null}
              onType={setChosenType}
            />
            <AvoidSettings lang={lang} state={avoid} onChange={changeAvoid} type={type} />
          </>
        )}
      </main>
      <Disclaimer lang={lang} type={result ? result.productType : type} />
    </div>
  );
}
