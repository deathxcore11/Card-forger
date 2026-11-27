// The run flow v2 (design/run-structure-v2.md): clock, then the stage boss hunts you, then a portal and Overtime; stage 3 is endless Overtime.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { jumpToStage, FLOW2 } from '../src/sim/stages.js';
const I = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false, hold: false };
const mk = () => { const g = new Game(21, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy', flow: 'v2' }); g.god = true; return g; };
const run = (g, s) => { for (let k = 0; k < s * 60; k++) g.step(1 / 60, I); };
const boss = g => g.sp.find(s => s.alive && s.role === 'gate');

test('flow v2: the clock ends, the stage boss hunts you from nearby; it falls, a portal opens 120 to 200 m away and Overtime starts', () => {
  const g = mk(); assert.ok(g.flow2); assert.equal(g.stageSpec.clock, 720, 'a 12 minute stage');
  g.sc = g.stageSpec.clock - 0.5; run(g, 1); const b = boss(g); assert.ok(b, 'the boss is out'); const d = Math.hypot(b.x - g.p.x, b.z - g.p.z); assert.ok(d > 20 && d < 60, 'it starts near the duelist, not at a far arena: ' + d.toFixed(1));
  assert.ok(!g.door || g.door.state !== 'risen', 'no door');
  const d0 = d; run(g, 2); assert.ok(Math.hypot(b.x - g.p.x, b.z - g.p.z) < d0, 'it comes after you');
  g.damageSpecial(b, 1e9, b.x, b.z, {}); run(g, 0.2);
  assert.ok(g.ot2 && !g.ot2.endless, 'Overtime starts at once'); assert.ok(g.circle && g.circle.portal, 'a portal'); const pd = Math.hypot(g.circle.x - b.x, g.circle.z - b.z); assert.ok(pd >= FLOW2.portalMin - 1 && pd <= FLOW2.portalMax + 1, 'portal ' + pd.toFixed(0) + ' m from the boss');
  const hp0 = g.hpMul; run(g, 31); assert.ok(g.hpMul > hp0 * 1.1, 'enemies get tougher in Overtime'); assert.ok(g.overtimeSeconds() > 30, 'Overtime counts for the score');
  assert.equal(g.shadeOn, false, 'no Toll Shades before two minutes'); run(g, 92); assert.ok(g.shadeOn, 'the Toll Shades come after two minutes');
  g.p.x = g.circle.x; g.p.z = g.circle.z; run(g, 8); assert.equal(g.stage, 1, 'walking into the portal goes down to stage 2'); assert.equal(g.ot2, null);
});

test('flow v2: stage 3 has no portal, it is endless Overtime', () => {
  const g = mk(); jumpToStage(g, 2); g.sc = g.stageSpec.clock - 0.5; run(g, 1); const b = boss(g); g.damageSpecial(b, 1e9, b.x, b.z, {}); run(g, 0.2);
  assert.ok(g.ot2 && g.ot2.endless); assert.ok(!g.circle, 'no portal'); assert.ok(g.won);
});
