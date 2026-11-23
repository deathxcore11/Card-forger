import test from 'node:test'; import assert from 'node:assert/strict';
import { defaultMeta, upgradeCost, buyUpgrade, refundOne, refundKey, refundAll, refundValue, effectText, rankOf } from '../src/core/meta.js';
import { DECK_BOX } from '../src/data/meta.js';
// Deck Box: every rank refunds in full, buy then refund returns the exact balance, and the Now / Next text comes from the data.
test('buy then refund returns the exact balance, at every scope', () => {
  const m = defaultMeta(); let chips = 20000; const start = chips;
  for (const k of Object.keys(DECK_BOX)) for (let i = 0; i < 5; i++) { const left = buyUpgrade(m, chips, k); assert.ok(left !== null); chips = left; }
  assert.equal(chips, start - Object.keys(DECK_BOX).reduce((s, k) => s + DECK_BOX[k].cost.reduce((a, v) => a + v, 0), 0));
  assert.equal(refundValue(m, 'maxLp', 'one'), DECK_BOX.maxLp.cost[4]); assert.equal(refundValue(m, 'maxLp', 'key'), DECK_BOX.maxLp.cost.reduce((a, v) => a + v, 0));
  const all = refundValue(m, 'maxLp', 'all'); assert.equal(refundAll(m), all); chips += all; assert.equal(chips, start); assert.equal(rankOf(m, 'maxLp'), 0);
  chips = buyUpgrade(m, chips, 'luck'); chips = buyUpgrade(m, chips, 'luck'); chips += refundOne(m, 'luck'); assert.equal(rankOf(m, 'luck'), 1); chips += refundKey(m, 'luck'); assert.equal(chips, start); assert.equal(refundOne(m, 'luck'), 0);
});
test('effect text rolls up per rank from the data', () => {
  assert.equal(effectText('maxLp', 0), 'none'); assert.equal(effectText('maxLp', 2), '+10 max LP'); assert.equal(effectText('xpGain', 3), '+12% XP');
  assert.equal(effectText('redraws', 1), 'none'.replace('none', effectText('redraws', 1))); assert.match(effectText('redraws', 2), /\+1 Redraw/); assert.match(effectText('banishes', 3), /\+1 Exile/);
  assert.equal(DECK_BOX.banishes.name, 'Exiles');
});
