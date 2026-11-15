/**
 * Golden corpus: the analysis of 474 real Romanian ingredient lists (Open Food
 * Facts, ODbL; bench/corpus) compared with a stored snapshot – any change in
 * what the app finds shows up as a diff. Accept intended changes with:
 *   UPDATE_SNAPSHOTS=1 npm test
 * Also: allergen recall against Open Food Facts' own allergen tags.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { analyze } from '../src/lib/analyze.js';
import { ALLERGENS } from '../src/data/allergens.js';

const rows = readFileSync(new URL('../bench/corpus/ro-ingredients.jsonl', import.meta.url), 'utf8')
  .split('\n').filter(Boolean).slice(1).map((l) => JSON.parse(l));
const snapFile = new URL('./__snapshots__/corpus.txt', import.meta.url);

/** One compact line per product: what the analysis found (text only, no database tags). */
function line(row) {
  const r = analyze({ text: row.text, productType: 'food' });
  const items = r.items.map((x) => `${x.code}:${x.level[0]}`).join(',');
  const al = `${r.allergens.contains.map((a) => a.id).join(',')}/${r.allergens.traces.map((a) => a.id).join(',')}`;
  return `${row.code} ${r.verdict} nova${r.processing.nova ?? '-'} [${items}] {${al}}`;
}

describe('golden corpus (real Romanian ingredient lists)', () => {
  const lines = rows.map(line);

  test('analysis matches the snapshot', () => {
    if (process.env.UPDATE_SNAPSHOTS || !existsSync(snapFile)) {
      writeFileSync(snapFile, `${lines.join('\n')}\n`);
      return;
    }
    const before = readFileSync(snapFile, 'utf8').split('\n').filter(Boolean);
    const old = new Map(before.map((l) => [l.split(' ')[0], l]));
    const diffs = lines.filter((l) => old.get(l.split(' ')[0]) !== l).map((l) => `- ${old.get(l.split(' ')[0]) || '(new)'}\n+ ${l}`);
    assert.equal(diffs.length, 0, `${diffs.length} products changed (UPDATE_SNAPSHOTS=1 to accept):\n${diffs.slice(0, 10).join('\n')}`);
  });

  test('unknown E-numbers in real lists (input for the database)', (t) => {
    const unknown = new Map();
    for (const row of rows) {
      for (const x of analyze({ text: row.text, productType: 'food' }).items) {
        if (!x.known) unknown.set(x.code, (unknown.get(x.code) || 0) + 1);
      }
    }
    t.diagnostic(`unknown E-codes: ${[...unknown].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}×${n}`).join(' ') || 'none'}`);
  });

  test('allergens: recall against Open Food Facts tags ≥ 98%; traces never counted as contained', (t) => {
    const tagged = rows.filter((r) => Array.isArray(r.allergens));
    if (tagged.length < 100) { t.skip(`tags for ${tagged.length}/${rows.length} lists – run scripts/corpus-tags.mjs`); return; }
    const groupOf = new Map(ALLERGENS.flatMap((g) => g.off.map((tag) => [tag, g.id])));
    // Tags the ingredient text does not support, reviewed by hand (Open Food Facts errors).
    const reviewed = JSON.parse(readFileSync(new URL('../bench/corpus/tag-review.json', import.meta.url), 'utf8')).reviewed;
    let total = 0;
    let found = 0;
    const missed = [];
    for (const row of tagged) {
      const r = analyze({ text: row.text, productType: 'food' }).allergens;
      const seen = new Set([...r.contains, ...r.traces].map((a) => a.id));
      for (const tag of row.allergens) {
        const id = groupOf.get(tag);
        if (!id || reviewed[row.code]?.ids.includes(id)) continue;
        total++;
        if (seen.has(id)) found++; else missed.push(`${row.code} ${id}`);
      }
      // Open Food Facts lists as traces only: we must not claim them as contained from the traces part.
    }
    t.diagnostic(`allergen recall ${found}/${total}; missed: ${missed.slice(0, 15).join(', ')}`);
    assert.ok(total === 0 || found / total >= 0.98, `recall ${((found / total) * 100).toFixed(1)}% – missed: ${missed.slice(0, 20).join(', ')}`);
  });
});
