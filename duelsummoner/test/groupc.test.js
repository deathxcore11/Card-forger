import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
const mk = seed => { const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false }); g.god = true; return g; };
const boss = () => ({ alive: true, dead: false, role: 'gate', kind: 'pharaoh', size: 6, radius: 1, x: 0, y: 0, z: 0, hp: 1e6, maxHp: 1e6, face: 0 });

test('C1: bosses take the Drill, Affinity and Overtime brackets like the swarm does', () => {
  const g = mk(3), sp = boss(); g.sp.push(sp); g.curSrc = 0; g.srcClassOf[0] = 0;
  const hit = o => { sp.hp = 1e6; g.damageSpecial(sp, 100, 5, 5, { noCrit: true, ...o }); return 1e6 - sp.hp; };
  const base = hit({});
  g.mods.drill[0] = 10; const drilled = hit({}); assert.ok(drilled > base, 'Drill raises boss damage: ' + base + ' to ' + drilled);
  g.mods.aff[0] = 3; const aff = hit({ elem: 1 }); assert.ok(aff > drilled, 'Affinity raises it again: ' + aff);
  g.otStep = 4; const ot = hit({ elem: 1 }); assert.ok(ot > aff, 'Overtime raises it again: ' + ot);
});
