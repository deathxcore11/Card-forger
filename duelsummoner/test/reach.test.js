// Reach (spectacle spec 1.3): it scales AREA on area kinds only. Radius and length grow by the square root of the area factor, x1.58 at the +150% cap; shots keep their hit radius; the arc never changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { splash } from '../src/sim/weapons.js';
import { K } from '../src/data/tuning.js';

const mk = reach => { const g = new Game(3, { mode: 'run', duelist: 'kael', offers: false }); g.mods.reach = reach; return g; };
test('reach factor: 1.0 at +0%, 1.58 at the +150% cap, capped there', () => {
  assert.equal(mk(0).reachK, 1); assert.ok(Math.abs(mk(1.5).reachK - Math.sqrt(2.5)) < 1e-12); assert.ok(Math.abs(mk(1.5).reachK - 1.5811) < 1e-3); assert.equal(mk(9).reachK, Math.sqrt(1 + K.reachCap));
});
test('a splash (Cinder Hatchling 4.7 m) draws and hits at 7.43 m with Reach at the cap, 4.7 m with none', () => {
  for (const [reach, want] of [[0, 4.7], [1.5, 7.43]]) {
    const g = mk(reach); g.fx.forEach(o => { o.on = false; }); splash(g, g.p.x, g.p.y, g.p.z, 4.7, 1, 0);
    const rec = g.fx.find(o => o.on && o.type === 'ring'); assert.ok(rec, 'a ring record'); assert.ok(Math.abs(rec.r - want) / want < 0.05, 'ring ' + rec.r + ' want ' + want);
  }
});
