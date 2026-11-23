import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
const idle = { f: 0, r: 0, yaw: 0.7, jump: false, dash: false, slide: false, use: false };
test('summons keep to slots beside the duelist and stay out of shrine basins, stones and chests', () => {
  const g = new Game(3, { mode: 'run', duelist: 'kael', offers: false }); g.god = true; g.spawnAcc = -1e9; g.cardT = 1e9;
  g.field.monsters[0] = { id: 'ember-wyvern', level: 1, cd: 99 }; g.field.monsters[1] = { id: 'rune-apprentice', level: 1, cd: 99 }; g.field.monsters[2] = { id: 'cinder-hatchling', level: 1, cd: 99 };
  const sh = g.world.shrines[0]; g.p.x = sh.x + 0.5; g.p.z = sh.z; g.p.y = sh.y; let worst = 1e9;
  for (let t = 0; t < 4; t += 1 / 60) { g.p.vx = g.p.vz = 0; g.step(1 / 60, idle); for (const m of g.field.monsters) if (m && m.init) worst = Math.min(worst, Math.hypot(m.x - sh.x, m.z - sh.z)); }
  assert.ok(worst >= 2.4, 'a summon came within ' + worst.toFixed(2) + ' m of the basin centre');
  // slots: after settling, no summon is on the camera line over the duelist (within 1.2 m of the line along the view direction)
  g.p.x = 10; g.p.z = 10; g.p.y = 0; for (let t = 0; t < 3; t += 1 / 60) { g.p.vx = g.p.vz = 0; g.step(1 / 60, idle); }
  const fx = -Math.sin(0.7), fz = -Math.cos(0.7), rx = -fz, rz = fx;
  for (const m of g.field.monsters) if (m) { const side = (m.x - g.p.x) * rx + (m.z - g.p.z) * rz; assert.ok(Math.abs(side) > 1.5, 'a summon at ' + side.toFixed(2) + ' m from the camera line'); }
});
