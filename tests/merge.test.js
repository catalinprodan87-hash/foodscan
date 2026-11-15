import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mergeOcrTexts, mergeAll, textOverlap } from '../src/lib/ocrText.js';

describe('several photos of one label', () => {
  test('continuation: the overlap is kept once', () => {
    const a = 'Ingrediente: zahăr, făină de grâu, ulei de palmier,\nsirop de glucoză, cacao degresată';
    const b = 'sirop de glucoza, cacao degresată 4%, sare, arome.';
    const r = mergeOcrTexts(a, b);
    assert.equal(r.how, 'continued');
    assert.equal(r.text, 'Ingrediente: zahăr, făină de grâu, ulei de palmier,\nsirop de glucoză, cacao degresată 4%, sare, arome.');
  });

  test('fuzzy overlap (OCR slips) still joins', () => {
    const r = mergeOcrTexts('lapte praf integral, masă de cacao, zer praf', 'masa de cacao, zer prat, grăsime din lapte');
    assert.equal(r.how, 'continued');
    assert.match(r.text, /zer praf, grăsime din lapte$/);
    assert.equal((r.text.match(/masă de cacao/g) || []).length, 1);
  });

  test('side by side: each photo has part of every line (text round a jar)', () => {
    const a = 'Ingrediente: concentrat de\nsare. Substanță uscată\nProdus pasteurizat. A se păstra';
    const b = 'concentrat de tomate, apă,\nuscată solubilă min. 28%\nse păstra la rece.';
    const r = mergeOcrTexts(a, b);
    assert.equal(r.how, 'lines');
    assert.equal(r.text, 'Ingrediente: concentrat de tomate, apă,\nsare. Substanță uscată solubilă min. 28%\nProdus pasteurizat. A se păstra la rece.');
  });

  test('nothing in common: appended after "…"; empty parts ignored', () => {
    const r = mergeOcrTexts('zahăr, făină', 'Valori nutriționale 100 g');
    assert.equal(r.how, 'appended');
    assert.equal(r.text, 'zahăr, făină\n… Valori nutriționale 100 g');
    assert.equal(mergeOcrTexts('', 'x y z').text, 'x y z');
    assert.equal(mergeOcrTexts('x y z', '  ').text, 'x y z');
  });

  test('reversed order is not merged as a continuation', () => {
    const a = 'sare, arome, colorant caramel.';
    const b = 'Ingrediente: făină de grâu, zahăr, ulei';
    assert.notEqual(mergeOcrTexts(a, b).how, 'continued');
  });

  test('mergeAll joins three photos in order; a tiny overlap is not enough', () => {
    assert.equal(
      mergeAll(['zahăr, făină de grâu, ulei de palmier', 'făină de grâu, ulei de palmier, sare, arome', 'ulei de palmier, sare, arome, colorant caramel']),
      'zahăr, făină de grâu, ulei de palmier, sare, arome, colorant caramel',
    );
    assert.equal(mergeAll(['zahăr, făină de grâu', 'de grâu, sare']), 'zahăr, făină de grâu, sare', '"de grâu" (6 letters) is enough within a line');
    assert.equal(mergeAll(['zahăr, făină de', 'de, sare']), 'zahăr, făină de\n… de, sare', '"de" is not');
  });

  test('glued words in one photo still overlap (letters, not words)', () => {
    const a = 'Ingrediente ardei copti 40%vinete coapte 25%ceapapasta de tomate, ulei de';
    const b = 'ceapa pastade tomate ulei de floarea-soarelui, zahar, sare';
    assert.notEqual(textOverlap(a, b, { minLen: 6 }), null);
    assert.match(mergeOcrTexts(a, b).text, /ulei de floarea-soarelui, zahar, sare$/);
  });

  test('the real jar benchmark pair is joined line by line', () => {
    const a = 'ZACUSCA DE LEGUME 300 g\nIngrediente ardei copti 40%vinete coapte 25%ceapapasta de tomate, ulei de\ndafin piper negru, acidifiant acid citric.Poate contine urme de telina.\nAse pastra la loc uscat si racoros.Dupa deschidere a se pastra la frigider.';
    const b = 'ceapa pastade tomate ulei de floarea-soarelui, zahar, sareotet de vin foi de\nntine urme de telina.\nastra la frigider.';
    const r = mergeOcrTexts(a, b);
    assert.equal(r.how, 'lines');
    assert.match(r.text, /ulei de floarea-soarelui, zahar, sareotet de vin foi de\ndafin piper negru/);
  });
});
