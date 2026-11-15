import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findBlock, scoreProse, scoreTable, valueTokens, strictText, rate } from '../bench/real/score.js';

test('findBlock: a block inside longer text costs only its own errors', () => {
  const r = findBlock([...'zahar, sare'], [...'ingrediente: zahar, sare. a se pastra']);
  assert.equal(r.edits, 0);
  assert.equal(findBlock([...'zahar, sare'], [...'xx zahqr, sare yy']).edits, 1);
  // Nothing of the block present: every character is an error.
  assert.equal(findBlock([...'abc'], [...'xyz']).edits, 3);
  assert.equal(findBlock([...'abc'], []).edits, 3);
});

test('strict keeps diacritics (cedilla = comma below); folded drops them', () => {
  assert.equal(strictText('ŢELINĂ  şi'), 'țelină și');
  const s = scoreProse('făină de grâu', 'faina de grau');
  assert.equal(s.folded.charEdits, 0);
  assert.equal(s.strict.charEdits, 3);
  assert.equal(s.folded.words, 3);
  assert.equal(s.strict.wordEdits, 2);
});

test('nutrition: labels with small reading errors count; values as a multiset', () => {
  const block = { labels: ['Grăsimi', 'din care zaharuri'], values: ['18,9 g', '0 g', '0 g', '2360/566'] };
  const s = scoreTable(block, 'Grasimi 18.9g din care zaharurl 0 g 2360 / 566');
  assert.equal(s.labelsFound, 2);
  assert.equal(s.valuesFound, 3); // only one "0 g" was read
  assert.deepEqual(s.missingValues, ['0 g']);
  assert.deepEqual(valueTokens('<0,1 g 1456 kJ 20%'), ['<0,1g', '1456kj', '20%']);
});

test('rate', () => {
  assert.equal(rate(1, 8), 12.5);
  assert.equal(rate(0, 0), null);
});
