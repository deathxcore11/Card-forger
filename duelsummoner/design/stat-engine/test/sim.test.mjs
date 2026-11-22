import test from 'node:test';
import assert from 'node:assert/strict';
import { K } from '../src/tuning.js';
import { BUILDS, MINUTES, assertCell } from '../sim/builds.mjs';
import { runMinute, plan, levelsAvailable } from '../src/loadout.js';
import { MONSTERS } from '../src/content.js';

test('every build at minutes 2-30: finite, capped, self-damage never kills, budget respected', () => {
  const fails = [];
  for (const b of BUILDS) for (const t of MINUTES) assertCell(runMinute(b, t, { warmSec: 10, measureSec: 20 }), m => fails.push(m));
  assert.deepEqual(fails, []);
});

test('the sim is deterministic for a seed', () => {
  const b = BUILDS.find(x => x.id === 'broken');
  const a = runMinute(b, 12, { warmSec: 5, measureSec: 10 }), c = runMinute(b, 12, { warmSec: 5, measureSec: 10 });
  assert.equal(a.dpm, c.dpm); assert.equal(a.procsPerSec, c.procsPerSec); assert.equal(a.avgHp, c.avgHp);
});

test('level budget: 60 before Overtime, then Draw + XP per minute', () => {
  assert.equal(levelsAvailable(8), K.levelsPreOt);
  assert.equal(levelsAvailable(4), 30);
  assert.equal(levelsAvailable(18), 60 + 10 * (K.otDrawPerMin + K.otXpLevelsPerMin));
});

test('planner: zones 4+4, levels in range, Fusion arrives L1 with 50% Tuning, God Fusion arrives L10', () => {
  for (const b of BUILDS.filter(x => !x.synthetic)) for (const t of [4, 8, 12, 20, 30]) {
    const lo = plan(b, t);
    assert.ok(lo.mons.length <= 4 && lo.st.length <= 4, `${b.id}@${t} zones`);
    for (const m of lo.mons) assert.ok(m.lvl >= 1 && m.lvl <= 10);
    for (const s of lo.st) assert.ok(s.lvl >= 1 && s.lvl <= 5);
    assert.ok(lo.spent <= lo.avail);
  }
  const god = BUILDS.find(x => x.id === 'god');
  const lo8 = plan(god, 8);
  const sc = lo8.mons.find(m => m.id === 'stormcrown-drake');
  assert.ok(sc && sc.lvl === 10 && MONSTERS[sc.id].tier === 2, 'God Fusion on the field at 8:00, level 10');
  assert.equal(lo8.spent, 60, 'a God Fusion by 8:00 costs the whole pre-Overtime budget');
  const lo4 = plan(god, 4.5);
  const am = lo4.mons.find(m => m.id === 'astral-magus');
  assert.ok(am && am.lvl === 1, 'Fusion arrives at level 1');
});

test('Unmarked Card banks only wasted picks, and only once the plan is exhausted', () => {
  const god = BUILDS.find(x => x.id === 'god');
  assert.equal(plan(god, 20).hidden, 0);
  const lo = plan(god, 30);
  assert.ok(lo.hidden > 0 && lo.hidden === lo.leftover);
});

test('rules: Spells/Traps never fuse, monsters cap at L10 with forms at 1/5/10, Spells/Traps cap at L5', () => {
  const b = { id: 'rule', duelist: 'none', goals: ['st:toll-of-ash:5', 'fuse:toll-of-ash'] };
  assert.throws(() => plan(b, 8), /never fuse/);
  assert.throws(() => plan({ id: 'r2', duelist: 'none', goals: ['st:toll-of-ash:6'] }, 8), /> 5/);
  assert.throws(() => plan({ id: 'r3', duelist: 'none', goals: ['mon:ember-wyvern:11'] }, 8), /> 10/);
  assert.deepEqual(K.formAt, [1, 5, 10]);
  assert.equal(K.zonesMon, 4); assert.equal(K.zonesST, 4); assert.equal(K.monsterMax, 10); assert.equal(K.stMax, 5);
  assert.deepEqual(K.tierArrive, [1, 1, 10, 10]);
  for (const d of Object.values(MONSTERS)) if (d.from) for (const p of d.from) assert.equal(MONSTERS[p].tier, d.tier - 1, `${d.name} must fuse two tier-${d.tier - 1} parents`);
});
