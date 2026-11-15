import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickRotation, READ_UNSURE } from '../src/lib/orientation.js';
import { recWidth, REC_STRETCH, cyrillicShare } from '../src/lib/paddleCore.js';

const reading = (text, conf = 0.9) => ({ text, conf, probs: [...text].map(() => conf) });

test('orientation: when both ways read about equally, the photo stays as taken', () => {
  const m = { base: 0, lines: 4, vote: { flip: false, confidence: 0.51 }, texts: { up: [reading('75ge0', 0.75)], down: [reading('2620', 0.2)] } };
  const r = pickRotation(m);
  assert.ok(READ_UNSURE > 0);
  if (r.method === 'unsure') assert.equal(r.turns, 0);
  // A clear reading still decides.
  const clear = { base: 0, lines: 4, vote: null, texts: { up: [reading('xq zv kp', 0.3)], down: [reading('zahar, sare, faina de grau', 0.95)] } };
  assert.equal(pickRotation(clear).turns, 2);
});

test('line stretch: lines are drawn 2× wider for the recogniser (condensed label fonts)', () => {
  assert.equal(REC_STRETCH, 2);
  const box = { len: 480, thick: 48 };
  assert.equal(recWidth(box, 48, 1), 480);
  assert.equal(recWidth(box), 960);
  assert.equal(recWidth({ len: 50000, thick: 10 }), 4000); // capped
});

test('cyrillicShare', () => {
  assert.equal(cyrillicShare('Съставки: захар'), 1);
  assert.equal(cyrillicShare('zahăr, sare'), 0);
  assert.equal(cyrillicShare('E330 ...'), 0);
  assert.ok(cyrillicShare('сол, E330, salt') < 0.5);
});

test('reading order: a paragraph next to a table is read whole, then the table row by row', async () => {
  const { joinLines } = await import('../src/lib/paddleCore.js');
  const line = (cx, cy, len, text) => ({ cx, cy, angle: 0, len, thick: 20, text, conf: 0.9 });
  const items = [
    // ingredients paragraph, left (lines 400 px long)
    line(200, 100, 400, 'Ingrediente: zahăr, lapte praf'), line(200, 125, 400, 'integral 23%, unt de cacao,'), line(200, 150, 400, 'masă de cacao, emulgator.'),
    // nutrition table, right, rows at the same heights
    line(520, 100, 120, 'Grăsimi'), line(640, 100, 60, '35,0'),
    line(520, 125, 120, 'Glucide'), line(640, 125, 60, '53,5'),
    line(520, 150, 120, 'Proteine'), line(640, 150, 60, '8,7'),
  ];
  assert.equal(joinLines(items).text, 'Ingrediente: zahăr, lapte praf\nintegral 23%, unt de cacao,\nmasă de cacao, emulgator.\nGrăsimi 35,0\nGlucide 53,5\nProteine 8,7');
  // Without a table beside it, a paragraph is read row by row as before (pieces of a row joined).
  const alone = [line(200, 100, 400, 'huiles végétales (olive,'), line(470, 100, 80, 'tournesol),'), line(200, 125, 400, 'basilic frais 30%, noix'), line(200, 150, 400, 'de cajou, fromage')];
  assert.equal(joinLines(alone).text, 'huiles végétales (olive, tournesol),\nbasilic frais 30%, noix\nde cajou, fromage');
});

test('reading order: loose rows and cut-off pieces next to a paragraph do not break joining', async () => {
  const { joinLines } = await import('../src/lib/paddleCore.js');
  const line = (cx, cy, len, text) => ({ cx, cy, angle: 0, len, thick: 20, text, conf: 0.9 });
  const items = [
    line(200, 100, 400, 'Ingrediente: zahăr, lapte praf'), line(200, 125, 400, 'integral 23%, unt de cacao,'), line(200, 150, 400, 'masă de cacao, emulgator:'),
    line(200, 300, 100, 'Grăsimi'), line(320, 300, 60, '35,0'), // loose rows below
    line(200, 330, 100, 'Sare'), line(320, 330, 60, '0,3'),
    line(440, 150, 60, 'lecitină.'), // piece of the paragraph's last line, cut off by the detector
  ];
  assert.equal(joinLines(items).text, 'Ingrediente: zahăr, lapte praf\nintegral 23%, unt de cacao,\nmasă de cacao, emulgator: lecitină.\nGrăsimi 35,0\nSare 0,3');
});
