// Golden traces: every scene's recorded tape must replay to the same per-tick state hash, event log and snapshots.
// A failure names the first tick that differs. If the change was meant, regenerate with `node tools/trace.mjs --regen` and say so in the commit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENES } from '../tools/scenes.mjs';
import { check, loadGolden } from '../tools/trace.mjs';

for (const s of SCENES) test('golden trace: ' + s.name, () => { assert.equal(check(s, loadGolden(s.name)), null); });

// The goldens must bite: flip one sim constant in memory and the replay has to report a mismatch, early.
import { KINDS } from '../src/data/enemies.js';
test('golden trace detects a changed enemy speed at an early tick', () => {
  const s = SCENES.find(x => x.name === 'early-run'), gold = loadGolden(s.name), was = KINDS.husk.speed;
  try {
    assert.equal(check(s, gold), null, 'sanity: matches before the change');
    KINDS.husk.speed = was * 1.05;
    const d = check(s, gold); assert.ok(d, 'a changed constant must be reported');
    const m = /^tick (\d+)/.exec(d); assert.ok(m && +m[1] < 1500, 'reported at an early tick: ' + d.slice(0, 60));
  } finally { KINDS.husk.speed = was; }
});
