// Damage brackets 2 (source), 3 (affinity) and 8 (overtime): add within a bracket, multiply across brackets, each with a ceiling, and the run keeps a breakdown of where the damage came from.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { sourceBracket, affinityBracket, overtimeBracket, sourceClass, mightBracket } from '../src/sim/ledger.js';
import { damageEnemy } from '../src/sim/combat.js';
import { recompute } from '../src/sim/field.js';
import { ELEMENTS } from '../src/data/elements.js';

test('brackets: the Source and Affinity brackets have ceilings and Overtime is linear', () => {
  assert.equal(sourceBracket(0), 1); assert.ok(sourceBracket(1) > 1.4 && sourceBracket(1000) < 3.0001 && sourceBracket(1000) > 2.99, 'Source approaches x3');
  assert.equal(affinityBracket(0), 1); assert.equal(affinityBracket(0.5), 1.5); assert.equal(affinityBracket(99), 3, 'Affinity is a hard x3');
  assert.equal(overtimeBracket(0), 1); assert.ok(Math.abs(overtimeBracket(10) - 1.4) < 1e-9);
  assert.equal(sourceClass('ember-wyvern'), 0); assert.equal(sourceClass('card-throw'), 1); assert.equal(sourceClass('thornbound-locket'), 4); assert.equal(sourceClass('nothing'), -1);
});

function target(g, hp = 20000) { const e = g.en; e.alive[0] = 1; e.kind[0] = 0; e.hp[0] = hp; e.x[0] = 5; e.z[0] = 0; e.mark[0] = 0; return 0; }
const hit = (g, src, o) => { g.curSrc = g.srcIndex(src); const h0 = g.en.hp[0]; g.rc = () => 1; damageEnemy(g, 0, 10, { noCrit: true, ...o }); return h0 - g.en.hp[0]; };

test('brackets: Drill raises only the matching source, Affinity only the matching element, and they multiply', () => {
  const g = new Game(2, { mode: 'run', duelist: 'kael' }); g.god = true; target(g);
  const base = hit(g, 'ember-wyvern'), card = hit(g, 'card-throw'); assert.ok(Math.abs(base - 10) < 1e-3 && Math.abs(card - 10) < 1e-3, 'no brackets, ' + base);
  g.mods.drill[0] = 0.5; const withDrill = hit(g, 'ember-wyvern'), cardAfter = hit(g, 'card-throw'); assert.ok(Math.abs(withDrill - 10 * sourceBracket(0.5)) < 1e-3 && Math.abs(cardAfter - 10) < 1e-3, 'Drill monster only');
  g.mods.aff[0] = 0.4; const fireHit = hit(g, 'ember-wyvern', { elem: ELEMENTS.fire.bit }), iceHit = hit(g, 'ember-wyvern', { elem: ELEMENTS.ice.bit });
  assert.ok(Math.abs(fireHit - 10 * sourceBracket(0.5) * 1.4) < 1e-3, 'fire gets Affinity too: ' + fireHit); assert.ok(Math.abs(iceHit - withDrill) < 1e-3, 'ice does not');
  g.otStep = 5; const ot = hit(g, 'ember-wyvern'); assert.ok(Math.abs(ot - withDrill * 1.2) < 1e-3, 'Overtime resolve x1.2');
});

test('brackets: the breakdown says which bracket the damage came from', () => {
  const g = new Game(2, { mode: 'run', duelist: 'kael' }); g.god = true; target(g); g.mods.dmgMult = 0.5; g.mods.drill[0] = 3;
  for (let i = 0; i < 20; i++) hit(g, 'ember-wyvern'); const BD = g.bracketDmg; assert.ok(BD[1] > 0 && BD[2] > 0 && BD[3] === 0 && BD[5] === 0, JSON.stringify(Array.from(BD)));
  assert.ok(BD[2] > BD[1], 'the bigger bracket takes the bigger share');
});

test('brackets: the new spells feed them through the stat sheet (Pack Drill, Elemental Litany)', () => {
  const g = new Game(3, { mode: 'run', duelist: 'kael' }); g.god = true; g.field.spells[0] = { id: 'pack-drill', level: 2, cd: 0 }; g.field.spells[1] = { id: 'elemental-litany', level: 1, cd: 0 }; recompute(g);
  assert.ok(Math.abs(g.mods.drill[0] - 0.3) < 1e-9, 'drill ' + g.mods.drill[0]);
  const fire = g.field.monsters.filter(m => m && /ember|cinder/.test(m.id)).length; assert.ok(g.mods.aff[0] >= 0.12 * fire - 1e-9, 'fire affinity ' + g.mods.aff[0] + ' for ' + fire + ' fire monsters');
});
