import test from 'node:test';
import assert from 'node:assert/strict';
import { Signatures, SIG } from '../src/view/signature.js';

test('signature: fires on a spike of kills, not on a steady trickle', () => {
  const s = new Signatures(); let fired = 0;
  for (let t = 0; t < 3000; t += 12) { s.note('fire', t, 0, 0); if (s.check(t, true, false)) fired++; }       // 5 kills a second for 50 s: never 25 in 60 ticks
  assert.equal(fired, 0);
  const b = new Signatures(); for (let i = 0; i < 24; i++) b.note('fire', 100 + i, 1, 2); assert.equal(b.check(124, true, false), null);
  b.note('fire', 125, 1, 2); const r = b.check(125, true, false); assert.equal(r.el, 'fire'); assert.ok(Math.abs(r.x - 1) < 1e-9 && Math.abs(r.z - 2) < 1e-9);
});

test('signature: once per 1200 ticks per element, blocked by an open offer, needs tier 4', () => {
  const s = new Signatures(); for (let i = 0; i < 30; i++) s.note('lightning', 500 + i, 0, 0);
  assert.equal(s.check(530, false, false), null); assert.equal(s.check(530, true, true), null);
  assert.equal(s.check(530, true, false).el, 'lightning');
  for (let i = 0; i < 30; i++) s.note('lightning', 700 + i, 0, 0); assert.equal(s.check(730, true, false), null);         // inside the cooldown
  for (let i = 0; i < 30; i++) s.note('lightning', 1800 + i, 0, 0); assert.equal(s.check(1830, true, false).el, 'lightning');
});

test('signature: K rises with the recent average rate (2.0 x), so a sustained flood needs a bigger spike', () => {
  const s = new Signatures(); for (let t = 0; t < 600; t += 3) s.note('fire', t, 0, 0);       // 20 kills a second for 10 s: average 20, K = 40
  assert.equal(s.check(599, true, false), null);       // 20 kills in the last 60 ticks, K is 40
  for (let i = 0; i < 40; i++) s.note('fire', 600 + i, 0, 0); assert.ok(s.check(640, true, false));
  assert.equal(SIG.cooldown, 1200);
});

