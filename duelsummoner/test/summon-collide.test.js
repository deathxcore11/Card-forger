import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false };
test('summons are never inside a trunk or boulder: stood against 6 colliders for 5 s each, every summon stays outside', () => {
  const g = new Game(3, { mode: 'run', duelist: 'kael', offers: false }); g.god = true; g.spawnAcc = -1e9; g.cardT = 1e9;
  g.field.monsters[0] = { id: 'ember-wyvern', level: 1, cd: 99 }; g.field.monsters[1] = { id: 'rune-apprentice', level: 1, cd: 99 }; g.field.monsters[2] = { id: 'cinder-hatchling', level: 1, cd: 99 };
  const list = g.colliders.list.filter(c => c.top > 1.5).slice(0, 6); assert.ok(list.length >= 3, 'colliders found');
  for (const c of list) {
    g.p.x = c.x + c.r + 0.8; g.p.z = c.z; g.p.y = 0; let worst = 1e9;
    for (let t = 0; t < 5; t += 1 / 60) { g.p.vx = g.p.vz = 0; g.step(1 / 60, idle); for (const m of g.field.monsters) if (m && m.init) { const d = Math.hypot(m.x - c.x, m.z - c.z) - c.r; if (d < worst) worst = d; } }
    assert.ok(worst > 0.45, 'a summon came within ' + worst.toFixed(2) + ' m of the surface of a collider (radius ' + c.r.toFixed(1) + ')');
  }
});
