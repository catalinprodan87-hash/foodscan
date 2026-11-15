import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ctcDecode, uncertainWords, lineBounds, clusterBlocks, lineStart } from '../src/lib/paddleCore.js';
import { pickIngredientBlock, coverage } from '../src/lib/cropSuggest.js';
import { wordsToCheck } from '../src/lib/readPhoto.js';

const line = (cx, cy, len, thick = 20, angle = 0) => ({ cx, cy, len, thick, angle, score: 0.9 });

describe('uncertain words', () => {
  test('CTC decoding keeps one probability per output character', () => {
    const dict = ['a', 'b', ' '];
    const C = 4;
    const seq = [[1, 0.9], [0, 0.9], [2, 0.4], [3, 0.95], [1, 0.8]];
    const probs = new Float32Array(seq.length * C);
    seq.forEach(([c, p], t) => { probs[t * C + c] = p; });
    const r = ctcDecode(probs, seq.length, C, dict);
    assert.equal(r.text, 'ab a');
    assert.deepEqual(r.probs.map((p) => Math.round(p * 100) / 100), [0.9, 0.4, 0.95, 0.8]);
  });

  test('a word is uncertain when its weakest letter is below 0.75; short words ignored', () => {
    const text = 'lapfe praf, de zahar';
    const probs = [...text].map((ch, i) => (i === 3 ? 0.4 : i === 16 ? 0.7 : 0.95));
    assert.deepEqual(uncertainWords(text, probs).map((w) => w.word), ['lapfe', 'zahar']);
    assert.deepEqual(uncertainWords('de', [0.1, 0.1]), []);
  });

  test('chips: only words still in the edited text, once each', () => {
    assert.deepEqual(wordsToCheck(['lapfe', 'zahar', 'Lapfe', 'sore'], 'lapfe praf, zahăr, sare'), ['lapfe']);
    assert.deepEqual(wordsToCheck(undefined, 'x'), []);
  });
});

describe('text blocks', () => {
  test('lines close together form a block; a far one starts another; largest first', () => {
    const blocks = clusterBlocks([line(200, 100, 300), line(200, 125, 300), line(200, 150, 280), line(200, 400, 120)]);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].lines.length, 3);
    assert.deepEqual(blocks[0].lines.map((l) => l.cy), [100, 125, 150]);
  });

  test('side-by-side columns do not merge', () => {
    const blocks = clusterBlocks([line(100, 100, 150), line(100, 125, 150), line(400, 100, 150), line(400, 125, 150)]);
    assert.equal(blocks.length, 2);
  });

  test('bounds of a tilted line; the start of a long line', () => {
    const b = lineBounds(line(0, 0, 100, 10, Math.PI / 2));
    assert.ok(Math.abs(b.top + 50) < 1e-9 && Math.abs(b.left + 5) < 1e-9);
    const s = lineStart(line(500, 50, 1000, 20));
    assert.equal(s.len, 200);
    assert.equal(s.cx, 100); // from the left end
  });
});

describe('crop suggestion', () => {
  const blocks = (texts) => ({
    width: 1000,
    height: 800,
    blocks: texts.map((lines, b) => {
      const ls = lines.map((text, i) => ({ text, bounds: { left: 100, right: 900, top: 100 + b * 300 + i * 30, bottom: 120 + b * 300 + i * 30 } }));
      return { left: 100, right: 900, top: ls[0].bounds.top, bottom: ls.at(-1).bounds.bottom, lines: ls };
    }),
  });

  test('frames the block from the "Ingrediente:" line down', () => {
    const r = pickIngredientBlock(blocks([['PASTĂ DE TOMATE', 'Kaufland 310 g', 'Ingrediente: concentrat', 'de tomate, apă']]));
    assert.equal(r.kind, 'ro');
    assert.ok(Math.abs(r.rect.y - (160 / 800 - 0.02)) < 1e-9, 'starts at the heading line');
    assert.ok(Math.abs(r.rect.y + r.rect.h - (210 / 800 + 0.02)) < 1e-9);
  });

  test('Romanian wins over English and "Conține:"; no heading → no suggestion', () => {
    const r = pickIngredientBlock(blocks([['Ingredients: sugar'], ['Ingrediente: zahăr']]));
    assert.equal(r.kind, 'ro');
    assert.ok(r.rect.y > 0.4);
    assert.equal(pickIngredientBlock(blocks([['Valori nutriționale'], ['A se păstra']])), null);
    assert.equal(pickIngredientBlock(null), null);
  });

  test('coverage of the true paragraph', () => {
    assert.equal(coverage([0, 0, 1, 1], [0.2, 0.2, 0.2, 0.2]), 1);
    assert.ok(Math.abs(coverage([0, 0, 0.3, 1], [0.2, 0.2, 0.2, 0.2]) - 0.5) < 1e-9);
    assert.equal(coverage({ x: 0.5, y: 0.5, w: 0.1, h: 0.1 }, [0, 0, 0.2, 0.2]), 0);
  });
});
