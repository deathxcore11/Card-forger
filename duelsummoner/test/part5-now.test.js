// Fix list part 5, NOW items. One test group per item, added as each one lands.
import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js'; import { onPlayerHurt } from '../src/sim/monsters.js'; import { TRAPS } from '../src/data/cards.js';
const mk = seed => { const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false }); g.god = true; g.spawnAcc = -1e9; return g; };

test('2: a hurt-triggered trap and the Thornbound Locket give the attack source back, so the rest of its hits keep Pack Drill', () => {
  const g = mk(41), id = Object.keys(TRAPS).find(k => TRAPS[k].trigger === 'hurt'); assert.ok(id, 'a hurt trap exists');
  g.field.spells[0] = { id, level: 1, cd: 0 }; const src = g.srcIndex('some-monster'); g.curSrc = src; onPlayerHurt(g, false);
  assert.equal(g.curSrc, src, 'the trap fired and put the source back');
  g.field.spells[0] = null; g.mods.locket = 1; g.mods.armour = 5; g.curSrc = src; onPlayerHurt(g, false);
  assert.equal(g.curSrc, src, 'the locket nova put the source back');
});

import { spawnEnemy } from '../src/sim/enemies.js'; import { killEnemy } from '../src/sim/combat.js'; import { CAP } from '../src/sim/caps.js'; import { K } from '../src/data/tuning.js';
const rebuild = g => g.grid.rebuild(g.en.max, g.en.x, g.en.z, g.en.alive);
function husk(g, x, z, hp) { assert.ok(spawnEnemy(g, 'husk', { x, z }), 'spawned at ' + x.toFixed(1) + ',' + z.toFixed(1)); const s = g.lastSlot; g.en.hp[s] = hp; return s; }
function spread(g, n, gap) { const out = []; for (let k = 0; out.length < n && k < 4000; k++) { const a = k * 2.399963, d = 14 + Math.sqrt(k) * gap * 0.9, x = g.p.x + Math.cos(a) * d, z = g.p.z + Math.sin(a) * d; if (out.every(o => (o.x - x) ** 2 + (o.z - z) ** 2 > gap * gap) && spawnEnemy(g, 'husk', { x, z })) { const s = g.lastSlot; g.en.hp[s] = 5000; out.push({ s, x, z }); } } assert.equal(out.length, n, 'found room for ' + n); return out.map(o => o.s); }

test('3: ten direct kills in a tick are ten mark blasts, forty are thirty-two, and victims of a blast do not blast', () => {
  for (const [n, want] of [[10, 10], [40, 32]]) {
    const g = mk(51); g.mods.markExplode = { radius: 3, dmg: 5 }; const slots = spread(g, n, 9);
    for (const s of slots) g.en.mark[s] = 5; rebuild(g); for (const s of slots) killEnemy(g, s);
    assert.equal(g.caps.taken[CAP.MARK_EXPLODE], want, n + ' marked kills in one tick');
  }
  const g = mk(52); g.mods.markExplode = { radius: 3, dmg: 5000 }; const a = spread(g, 1, 9)[0], bx = g.en.x[a], bz = g.en.z[a], b = husk(g, bx + 1, bz, 1), c = husk(g, bx + 2, bz, 1);
  g.en.mark[a] = g.en.mark[b] = g.en.mark[c] = 5; rebuild(g); killEnemy(g, a);
  assert.equal(g.en.alive[b], 0, 'the blast felled its neighbour'); assert.equal(g.caps.taken[CAP.MARK_EXPLODE], 1, 'the neighbour did not blast in turn');
});

test('4: the Graveyard Bell tolls the same whoever lands the kill, and reads its numbers from tuning', () => {
  const lost = src => {
    const g = mk(61); g.mods.bell = 5; const every = Math.max(10, Math.floor(K.bellEvery / g.mods.bell)); g.kills = every - 1;
    const victim = spread(g, 1, 9)[0], by = husk(g, g.en.x[victim] + 1, g.en.z[victim], 5000); rebuild(g); g.curSrc = g.srcIndex(src); killEnemy(g, by);
    assert.equal(g.curSrc, g.srcIndex(src), 'the killer keeps its source after the toll'); return 5000 - g.en.hp[victim];
  };
  const a = lost('card-throw'), b = lost('some-monster'); assert.ok(a > 0, 'the bell hurt a bystander'); assert.equal(a, b, 'same toll whoever kills');
});

import { recompute } from '../src/sim/field.js'; import { SPELLS } from '../src/data/cards.js';
test('5: Kindling Rite burn scales with level, and the card says so', () => {
  const g = mk(71); g.field.spells[0] = { id: 'kindling-rite', level: 5, cd: 0 }; recompute(g);
  assert.ok(Math.abs(g.mods.burnDps - 7.0) < 1e-9, 'level 5 gives 7.0 damage a second: ' + g.mods.burnDps); assert.ok(Math.abs(g.mods.burnDur - 7.0) < 1e-9);
  assert.match(SPELLS['kindling-rite'].text, /For each level/, 'the card text is per level');
});

import { updateEnemies } from '../src/sim/enemies.js';
test('6: burn is logged once a tick under its own source and equals the life the burning enemies lost', () => {
  const g = mk(81), slots = spread(g, 3, 9); rebuild(g); for (const s of slots) { g.en.burn[s] = 5; g.en.burnDps[s] = 3; g.en.hp[s] = 100; }
  g.curSrc = g.srcIndex('some-monster'); for (let k = 0; k < 30; k++) updateEnemies(g, 1 / 60);
  const lostHp = slots.reduce((a, s) => a + (100 - g.en.hp[s]), 0), logged = (g.dealtLog.burn || []).reduce((a, v) => a + (v || 0), 0);
  assert.ok(lostHp > 0 && Math.abs(lostHp - logged) < 0.001, 'life lost ' + lostHp + ' = logged ' + logged); assert.equal(g.curSrc, g.srcIndex('some-monster'), 'the source is put back');
});

const eventsOf = (g, fn) => { g.drainEvents(() => {}); const out = []; fn(); g.drainEvents((t, a, b, c) => { if (t !== 'banner') out.push([t, a, b, c]); }); return out; };
test('7: a dodged or blocked hit does not say hurt; a hit that lands says hurt after the life is lost', () => {
  const g = mk(91); g.god = false; g.p.dashT = 0.2; let ev = eventsOf(g, () => g.hurtPlayer(10, false, 'x')); assert.deepEqual(ev.map(e => e[0]), ['dodge'], 'a dash dodges'); assert.equal(g.p.hp, g.p.maxHp);
  g.p.dashT = 0; g.mods.talisman = 1; g.talismanCd = 0; ev = eventsOf(g, () => g.hurtPlayer(10, false, 'x')); assert.deepEqual(ev.map(e => e[0]), ['ward'], 'the Talisman wards'); assert.equal(g.p.hp, g.p.maxHp);
  g.mods.talisman = 0; g.drainEvents(() => {}); g.hurtPlayer(10, false, 'x'); assert.ok(g.p.hp < g.p.maxHp, 'the hit landed'); assert.equal(g.evType[(g.evHead - 1) & 255], 'hurt', 'and then it says hurt');
  g.god = true; ev = eventsOf(g, () => g.hurtPlayer(10, false, 'x')); assert.deepEqual(ev.map(e => e[0]), ['hurt'], 'god still records the hurt');
  g.god = false; g.p.hp = 50; ev = eventsOf(g, () => g.hurtPlayer(5, false, 'self', 1)); assert.equal(ev.find(e => e[0] === 'hurt')[3], 1, 'self damage says so in c');
});

test('8: armour is Guard points through the hyperbola, so ten Bronze Scales never floor an 8 hit, and nothing passes the 85% cap', () => {
  const hit = (armour, dmg) => { const g = mk(95); g.god = false; g.p.hp = 100; g.mods.armour = armour; g.hurtPlayer(dmg, false, 'swarm'); return 100 - g.p.hp; };
  assert.ok(Math.abs(hit(1, 8) - 8 * (1 - 4 / 24)) < 1e-9, 'one scale takes a sixth off'); assert.ok(hit(10, 8) > 1.5 && hit(10, 8) < 3, 'ten scales: ' + hit(10, 8) + ', well above the old 1 LP floor');
  assert.ok(Math.abs(hit(10, 8) - 8 / 3) < 1e-9); assert.ok(hit(10000, 8) >= 8 * 0.15 - 1e-9, 'never above 85% off: ' + hit(10000, 8));
  let last = 9; for (let a = 0; a <= 40; a += 5) { const h = hit(a, 8); assert.ok(h <= last + 1e-12, 'more armour never hurts more'); last = h; }
});

import { startBoss } from '../src/sim/specials.js'; import { heightAt } from '../src/sim/terrain.js';
const idleCmd = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false };
function miraNearBoss(seed, husks) {
  const g = new Game(seed, { mode: 'classic', duelist: 'mira', offers: false }); g.god = true; g.spawnAcc = -1e9; startBoss(g, true); const sp = g.sp.find(s => s.kind === 'pharaoh'); assert.ok(sp, 'a boss');
  g.p.x = sp.x - 8; g.p.z = sp.z; g.p.y = heightAt(g.p.x, g.p.z); g.p.px = g.p.x; g.p.pz = g.p.z; g.p.py = g.p.y;
  for (let k = 0; k < husks; k++) { const a = k * 0.63; spawnEnemy(g, 'husk', { x: g.p.x + Math.cos(a) * 5, z: g.p.z + Math.sin(a) * 5 }); g.en.hp[g.lastSlot] = 50000; }
  g.grid.rebuild(g.en.max, g.en.x, g.en.z, g.en.alive); return { g, sp };
}
test('9: Mira\'s pair hurts and marks a lone boss, and a boss is marked first even with ten swarm enemies around', () => {
  for (const husks of [0, 10]) {
    const { g, sp } = miraNearBoss(101, husks); const hp0 = sp.hp; let marked = false;
    for (let t = 0; t < 360; t++) { g.p.x = sp.x - 8; g.p.z = sp.z; g.step(1 / 60, idleCmd); if (sp.mark > 0) marked = true; }
    assert.ok(hp0 - sp.hp > 0, 'Mira\'s monsters hurt the boss (' + husks + ' husks near): ' + (hp0 - sp.hp)); assert.ok(marked, 'the boss was marked (' + husks + ' husks near)');
  }
});

import { CFG } from '../src/data/config.js';
test('10: Collector\'s Eye level 5 reaches 13.75 m, and Magnet stops at the tuning cap', () => {
  const g = mk(111); g.field.spells[0] = { id: 'collectors-eye', level: 5, cd: 0 }; recompute(g);
  assert.ok(Math.abs(g.mods.pickup - 1.75) < 1e-9, 'pickup ' + g.mods.pickup); assert.ok(Math.abs(CFG.xp.magnet * (1 + g.mods.pickup) - 13.75) < 1e-9, 'range ' + CFG.xp.magnet * (1 + g.mods.pickup));
  for (let i = 0; i < 12; i++) g.items.push('lodestone'); recompute(g); assert.equal(g.mods.pickup, K.magCap, 'clamped at the cap'); assert.ok(g.mods.raw.pickup > K.magCap, 'the raw sum is kept for the panel');
});

