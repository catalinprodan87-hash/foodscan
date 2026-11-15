import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  componentsFromProbMap, linesFromProbMap, verticalShare, orientationBase, topLines, rotateBox180,
  clsWidth, clsVote, lineSegments, CLS_WIDTH,
} from '../src/lib/paddleCore.js';
import { lexiconScore, readingScore, pickRotation, CLS_SURE } from '../src/lib/orientation.js';

/** Probability map with filled rectangles [x, y, w, h]. */
function probMap(w, h, rects) {
  const p = new Float32Array(w * h);
  for (const [x0, y0, rw, rh] of rects) {
    for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) p[y * w + x] = 0.9;
  }
  return p;
}

describe('steep text (photo taken sideways)', () => {
  test('vertical lines are kept as components but not as readable lines', () => {
    const prob = probMap(200, 300, [[40, 20, 10, 200], [80, 20, 10, 220], [120, 30, 10, 180]]);
    const comps = componentsFromProbMap(prob, 200, 300);
    assert.equal(comps.length, 3);
    assert.ok(comps.every((c) => c.vertical));
    assert.equal(linesFromProbMap(prob, 200, 300).length, 0, 'today’s readable lines: none');
    assert.equal(verticalShare(comps), 1);
    assert.equal(orientationBase(comps), 1);
  });

  test('horizontal lines → base 0; mixed mostly horizontal stays 0', () => {
    const flat = componentsFromProbMap(probMap(300, 200, [[20, 40, 220, 10], [20, 80, 200, 10]]), 300, 200);
    assert.equal(orientationBase(flat), 0);
    const mixed = componentsFromProbMap(probMap(300, 300, [[20, 40, 240, 12], [20, 80, 240, 12], [20, 120, 240, 12], [280, 20, 10, 80]]), 300, 300);
    assert.equal(orientationBase(mixed), 0);
  });

  test('single letters (not line-shaped) do not count; no text → null / 0', () => {
    const dots = componentsFromProbMap(probMap(100, 100, [[10, 10, 8, 9], [40, 40, 9, 8]]), 100, 100);
    assert.equal(verticalShare(dots), null);
    assert.equal(orientationBase(dots), 0);
    assert.equal(orientationBase([]), 0);
  });
});

describe('direction classifier helpers', () => {
  test('topLines keeps long confident lines, biggest first', () => {
    const box = (len, thick, score) => ({ cx: 0, cy: 0, angle: 0, len, thick, score });
    const top = topLines([box(100, 10, 0.9), box(20, 15, 0.9), box(300, 12, 0.8), box(200, 10, 0.3)], 8);
    assert.deepEqual(top.map((b) => b.len), [300, 100]);
  });

  test('a box in the image turned 180°', () => {
    assert.deepEqual(rotateBox180({ cx: 30, cy: 40, angle: 0.1, len: 50, thick: 8 }, 200, 100), { cx: 170, cy: 60, angle: 0.1, len: 50, thick: 8 });
  });

  test('classifier width keeps the line shape, at most 192', () => {
    assert.equal(clsWidth({ len: 100, thick: 48 }), 100);
    assert.equal(clsWidth({ len: 1000, thick: 20 }), CLS_WIDTH);
  });

  test('weighted vote', () => {
    assert.equal(clsVote([]), null);
    const v = clsVote([{ p180: 0.95, weight: 300 }, { p180: 0.2, weight: 50 }]);
    assert.equal(v.flip, true);
    assert.ok(v.confidence > 0.8);
    assert.equal(clsVote([{ p180: 0.1, weight: 1 }]).flip, false);
  });
});

describe('pickRotation', () => {
  const lex = new Map([['zahar', 'zahăr'], ['sare', 'sare'], ['faina', 'făină'], ['apa', 'apă'], ['grau', 'grâu']]);

  test('lexicon score: upright words score, upside-down nonsense does not', () => {
    assert.equal(lexiconScore('Făină de grâu, zahăr, sare', lex), 1); // "de" is too short to count
    assert.equal(lexiconScore('Făină de grâu, zahăr, sare, xqzt', lex), 0.8);
    assert.equal(lexiconScore('ǝɹɐs \'ɹɐɥɐz \'nɐɹƃ ǝp', lex), 0);
    assert.equal(lexiconScore('', lex), 0);
  });

  test('a sure classifier decides alone; base 1 adds a quarter turn', () => {
    assert.deepEqual(pickRotation({ base: 0, lines: 5, vote: { flip: true, confidence: 0.97 } }, lex), { turns: 2, method: 'cls', confidence: 0.97 });
    assert.equal(pickRotation({ base: 0, lines: 5, vote: { flip: false, confidence: 0.9 } }, lex).turns, 0);
    assert.equal(pickRotation({ base: 1, lines: 5, vote: { flip: false, confidence: 0.9 } }, lex).turns, 1);
    assert.equal(pickRotation({ base: 1, lines: 5, vote: { flip: true, confidence: 0.9 } }, lex).turns, 3);
  });

  test('an unsure classifier: the reading that makes sense wins', () => {
    const texts = {
      up: [{ text: 'IIo! ,ɹ ,ʇ', conf: 0.4 }],
      down: [{ text: 'făină de grâu, zahăr, sare', conf: 0.95 }],
    };
    const r = pickRotation({ base: 0, lines: 3, vote: { flip: false, confidence: CLS_SURE - 0.1 }, texts }, lex);
    assert.equal(r.turns, 2);
    assert.equal(r.method, 'recogniser');
    assert.ok(readingScore(texts.down, lex) > readingScore(texts.up, lex));
  });

  test('no classifier and no texts: keep the base; no lines: leave the photo alone', () => {
    assert.deepEqual(pickRotation({ base: 1, lines: 2 }, lex), { turns: 1, method: 'weak', confidence: 0 });
    assert.deepEqual(pickRotation({ base: 0, lines: 0 }, lex), { turns: 0, method: 'none', confidence: 0 });
    assert.deepEqual(pickRotation(null, lex), { turns: 0, method: 'none', confidence: 0 });
  });
});

describe('line pieces for the classifier', () => {
  test('a short line stays whole; a long line gives up to 3 pieces of ≤ 4× its height, start to end', () => {
    const short = { cx: 50, cy: 10, angle: 0, len: 60, thick: 20 };
    assert.deepEqual(lineSegments(short), [short]);
    const long = { cx: 500, cy: 100, angle: 0, len: 1000, thick: 20 };
    const parts = lineSegments(long);
    assert.equal(parts.length, 3);
    assert.ok(parts.every((p) => p.len === 80));
    assert.deepEqual(parts.map((p) => Math.round(p.cx)), [40, 500, 960]);
    assert.ok(parts.every((p) => p.cy === 100));
  });

  test('pieces follow the line angle', () => {
    const tilted = { cx: 0, cy: 0, angle: Math.PI / 6, len: 400, thick: 20 };
    const [first, , last] = lineSegments(tilted);
    assert.ok(first.cy < 0 && last.cy > 0, 'the line goes down to the right');
    assert.ok(Math.abs((last.cy - first.cy) / (last.cx - first.cx) - Math.tan(Math.PI / 6)) < 1e-9);
  });
});

describe('retries for weak reads', () => {
  test('upside-down retry only without an orientation check; larger detector only for crops / small photos', async () => {
    const { retryPlan } = await import('../src/lib/readPhoto.js');
    assert.deepEqual(retryPlan({ width: 1100, height: 160 }), [{ turns: 2 }, { detMaxSide: 2560 }]);
    assert.deepEqual(retryPlan({ width: 1100, height: 160 }, { orientationChecked: true }), [{ detMaxSide: 2560 }]);
    assert.deepEqual(retryPlan({ width: 3000, height: 2250 }, { orientationChecked: true }), []);
    assert.deepEqual(retryPlan({ width: 3000, height: 2250 }), [{ turns: 2 }]);
  });

  test('a weak read is retried and the better one kept; a good read is not retried', async () => {
    const { readIngredients } = await import('../src/lib/readPhoto.js');
    const calls = [];
    const fake = (results) => async (image, opts) => { calls.push(opts.detMaxSide || 'normal'); return results.shift(); };
    const weak = { text: 'S0DIUM LAURETHSULATE', confidence: 70, lines: 1 };
    const better = { text: 'Ingrediente: zahăr, făină de grâu, sare, ulei de palmier', confidence: 90, lines: 2 };
    const r = await readIngredients({ width: 1000, height: 200 }, { recognize: fake([weak, better]), rotate: (c) => c, orientationChecked: true });
    assert.deepEqual(calls, ['normal', 2560]);
    assert.equal(r.tries, 2);
    assert.equal(r.retried, true);
    assert.match(r.text, /zahăr/);

    calls.length = 0;
    const good = await readIngredients({ width: 1000, height: 200 }, { recognize: fake([better]), rotate: (c) => c, orientationChecked: true });
    assert.deepEqual(calls, ['normal']);
    assert.equal(good.tries, 1);
    assert.equal(good.retried, false);
  });
});
