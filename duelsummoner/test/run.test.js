import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { spawnEnemy, KIND_ID } from '../src/sim/enemies.js';
import { spawnWarden, spawnIdols, startBoss } from '../src/sim/specials.js';
import { fusionsReady, openChest, buildOffer, openLevelOffer } from '../src/sim/field.js';
import { heightAt } from '../src/sim/terrain.js';
import * as await_world from '../src/sim/world.js';
import { RUN } from '../src/data/waves.js';
import { MONSTERS, FUSIONS, formOf, LEVELS } from '../src/data/cards.js';

const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false };
const run = (g, s, cmd = idle) => { for (let t = 0; t < s && !g.over && !g.offer; t += 1 / 60) g.step(1 / 60, cmd); };
const quiet = g => { g.spawnAcc = -1e9; g.golemT = 1e9; g.flags.warden = g.flags.idols = true; g.boss.state = 'dead'; g.field.monsters.fill(null); g.cardT = 1e9; return g; };
const only = (g, kind, x, z, y = 0) => { assert.ok(spawnEnemy(g, kind, { x, z })); const i = g.en.alive.findIndex(a => a === 1); g.en.x[i] = g.en.px[i] = x; g.en.z[i] = g.en.pz[i] = z; g.en.y[i] = y; return i; };

test('Tomb Scarabs fly: a scarab reaches a duelist on a roof that walkers cannot', () => {
  const g = quiet(new Game(3)); g.god = true;
  const rx = 56 * Math.cos(0.39), rz = 56 * Math.sin(0.39);
  g.p.x = rx; g.p.z = rz; g.p.y = heightAt(rx, rz);
  const i = only(g, 'scarab', rx + 20, rz);
  run(g, 8);
  assert.ok(Math.hypot(g.en.x[i] - rx, g.en.z[i] - rz) < 3 && g.en.y[i] > 4, `scarab at y=${g.en.y[i]}`);
});

test('scarabs join the wave table from 0:45', () => {
  const g = quiet(new Game(5)); g.god = true; g.spawnAcc = 0; g.boss.state = 'idle'; let n = 0;
  g.t = 100; g.spawned = 0; g.en.alive.fill(0);
  run(g, 60); for (let i = 0; i < g.en.max; i++) if (g.en.alive[i] && g.en.kind[i] === KIND_ID.scarab) n++;
  assert.ok(n >= 1, 'at least one scarab by 1:40 to 2:40');
});

test('Glass Seer shows a 0.8 s line, then fires a bolt along it that hurts', () => {
  const g = quiet(new Game(2)); const i = only(g, 'seer', 12, 0); g.en.stT[i] = 0;
  g.step(1 / 60, idle); run(g, 0.1);
  assert.ok(g.tele.some(t => t.on && t.type === 0 && Math.abs(t.dur - 0.8) < 1e-9), 'telegraph line up');
  const hp0 = g.p.hp; run(g, 1.6);
  assert.ok(g.p.hp < hp0, 'the bolt landed (we did not sidestep)');
});

test('Ram Golem marks a lane for 1 s then rushes for 25', () => {
  const g = quiet(new Game(2)); const i = only(g, 'golem', 10, 0); g.en.stT[i] = 0; run(g, 0.2);
  assert.ok(g.tele.some(t => t.on && t.type === 0 && t.dur === 1.0), 'lane marked');
  const hp0 = g.p.hp; run(g, 2); assert.ok(hp0 - g.p.hp >= 24.9, 'rush hit for about 25');
});

test('Sand Bloat blast circle is shown, then bursts for 20 in 3 m, hitting enemies too', () => {
  const g = quiet(new Game(2)); only(g, 'bloat', 1.8, 0); spawnEnemy(g, 'husk', { x: 3.5, z: 1 }); const hp0 = g.p.hp;
  run(g, 0.2); assert.ok(g.tele.some(t => t.on && t.type === 1 && t.r === 3), 'circle shown');
  run(g, 1); assert.ok(hp0 - g.p.hp >= 19.9, 'player took the blast'); assert.equal(g.enemyCount(), 0, 'the husk in the blast died too');
});

test('Sealed Warden: shield blocks the front, back hits count, a chest drops on death', () => {
  const g = quiet(new Game(2)); g.god = true; spawnWarden(g); const w = g.sp[0]; w.x = w.px = 8; w.z = w.pz = 0; w.face = Math.PI / 2;   // faces +x
  const hp0 = w.hp;
  g.damageSpecial(w, 10, 20, 0, { noCrit: true }); assert.equal(w.hp, hp0, 'frontal hit blocked');
  g.damageSpecial(w, 10, -5, 0, { noCrit: true }); assert.equal(w.hp, hp0 - 10, 'rear hit lands');
  g.damageSpecial(w, 1e6, -5, 0, { noCrit: true }); assert.equal(w.alive, false); assert.equal(g.chests.length, 1);
});

test('Twin Jackal Idols: kill both inside 10 s or the first rises again', () => {
  const g = quiet(new Game(2)); g.god = true; spawnIdols(g); const [a, b] = g.sp;
  g.damageSpecial(a, 1e6, 0, 0, { noCrit: true, area: true }); assert.ok(a.dead && a.reviveT > 9.9);
  run(g, 10.5); assert.ok(!a.dead && a.hp > 0, 'revived after 10 s');
  g.damageSpecial(a, 1e6, 0, 0, { noCrit: true, area: true }); g.damageSpecial(b, 1e6, 0, 0, { noCrit: true, area: true });
  assert.ok(!a.alive && !b.alive && g.chests.length === 1, 'both down in time: stays dead, one chest');
});

test('Hollow Pharaoh: one shared state, three phases at 66% and 33%, victory on defeat, overtime goes on', () => {
  const g = new Game(4); g.god = true; g.spawnAcc = -1e9; g.field.monsters.fill(null); g.cardT = 1e9; g.flags.warden = g.flags.idols = true;
  assert.ok(startBoss(g, true)); assert.equal(startBoss(g, false), false, 'a second Pharaoh can never spawn');
  const ph = g.sp.find(s => s.kind === 'pharaoh');
  run(g, 0.2); assert.equal(g.boss.phase, 1);
  ph.hp = ph.maxHp * 0.6; run(g, 0.2); assert.equal(g.boss.phase, 2);
  ph.hp = ph.maxHp * 0.3; run(g, 0.2); assert.equal(g.boss.phase, 3);
  g.damageSpecial(ph, 1e9, 0, 0, { noCrit: true, area: true });
  assert.equal(g.boss.state, 'dead'); assert.equal(g.bossKilled, true); assert.equal(g.over, false, 'the run continues into Overtime');
});

test('the boss wakes by itself at 8:00; the Royal Gate allows entry only from 6:00', () => {
  const g = new Game(9); g.god = true; g.spawnAcc = -1e9; g.field.monsters.fill(null); g.cardT = 1e9; g.flags.warden = g.flags.idols = true;
  g.p.x = RUN.gate.x; g.p.z = RUN.gate.z; g.p.y = heightAt(g.p.x, g.p.z);
  g.t = 300; g.step(1 / 60, { ...idle, use: true }); assert.equal(g.boss.state, 'idle', 'too early');
  g.t = 365; g.step(1 / 60, { ...idle, use: true }); assert.equal(g.boss.state, 'active'); assert.equal(g.boss.early, true);
  const h = new Game(9); h.god = true; h.spawnAcc = -1e9; h.field.monsters.fill(null); h.cardT = 1e9; h.flags.warden = h.flags.idols = true; h.t = 479.9;
  run(h, 0.3); assert.equal(h.boss.state, 'active'); assert.equal(h.boss.early, false);
});

test('Overtime: hunters scale every 30 s with no cap on the scaling', () => {
  const g = new Game(8); g.god = true; g.spawnAcc = -1e9; g.field.monsters.fill(null); g.cardT = 1e9; g.flags.warden = g.flags.idols = true; g.boss.state = 'dead';
  g.t = 480; run(g, 2); const hp0 = Math.max(...Array.from(g.en.hp).filter((h, i) => g.en.alive[i] && g.en.kind[i] === KIND_ID.hunter));
  g.en.alive.fill(0); g.t = 480 + 30 * 10; g.otAcc = 0; run(g, 2); const hp10 = Math.max(...Array.from(g.en.hp).filter((h, i) => g.en.alive[i] && g.en.kind[i] === KIND_ID.hunter));
  assert.ok(hp10 > hp0 * 5, `hunter hp ${hp0} then ${hp10}`); assert.ok(g.dmgMul > 2, 'damage scales too');
  assert.equal(Math.round(g.overtimeSeconds()), 302);
});

test('level-up offers: 3 cards, forced partner by level 3, Redraw, Banish, Pass', () => {
  const g = new Game(6); g.level = 3; openLevelOffer(g); assert.equal(g.offer.cards.length, 3);
  assert.ok(g.offer.cards.some(c => c.id === 'cinder-hatchling' && c.isNew), 'the duelist partner is forced in by level 3');
  const before = g.offer.cards.map(c => c.id).join(); assert.ok(g.redraw()); assert.equal(g.field.redraws, 1);
  const victim = g.offer.cards[0].id; assert.ok(g.banish(0)); assert.ok(g.field.banished.has(victim)); assert.equal(g.field.banishes, 0);
  assert.ok(!g.offer.cards.some(c => c.id === victim));
  const coins = g.coins; g.pendingLevels = 1; assert.ok(g.pass()); assert.equal(g.coins, coins + 10); assert.equal(g.offer, null);
});

test('locked in: with all four Monster Zones full, offers only upgrade those four', () => {
  const g = new Game(6); g.field.monsters = ['ember-wyvern', 'cinder-hatchling', 'rune-apprentice', 'sigil-familiar'].map(id => ({ id, level: 2, cd: 0 }));
  for (let k = 0; k < 20; k++) for (const c of buildOffer(g)) if (c.kind === 'monster') assert.equal(c.isNew, false);
});

test('forms: young at 1, grown at 5, full at 10', () => {
  assert.deepEqual([1, 4, 5, 9, 10].map(l => formOf('ember-wyvern', l)), [0, 0, 1, 1, 2]);
  assert.equal(MONSTERS['ember-wyvern'].forms.length, 3); assert.equal(FUSIONS['twinflare-tyrant'].forms.length, 3);
  assert.equal(LEVELS.monsterMax, 10);
});

test('Fusion: needs both partners at level 10, comes from a sealed chest, starts at level 1 and frees a zone', () => {
  const g = new Game(6); g.field.monsters[1] = { id: 'cinder-hatchling', level: 9, cd: 0 }; g.field.monsters[0].level = 10;
  assert.deepEqual(fusionsReady(g), [], 'one partner at 9 is not enough');
  g.field.monsters[1].level = 10; assert.deepEqual(fusionsReady(g), ['twinflare-tyrant']);
  const chest = { x: 0, y: 0, z: 0, open: false }; g.chests.push(chest); openChest(g, chest);
  assert.equal(g.offer.type, 'fusion'); assert.ok(g.choose(0));
  const m = g.field.monsters.filter(Boolean); assert.equal(m.length, 1); assert.equal(m[0].id, 'twinflare-tyrant'); assert.equal(m[0].level, 1);
  assert.equal(g.field.monsters.filter(x => !x).length, 3, 'one zone used, three free'); assert.equal(g.fusions, 1); assert.equal(chest.open, true);
});

test('Spells and Traps level 1 to 5 and never fuse', () => {
  const g = new Game(6);
  for (let k = 0; k < 30; k++) for (const c of buildOffer(g)) if (c.kind === 'spell' || c.kind === 'trap') assert.ok(c.to <= 5);
});

test('interpolation: previous-tick positions are kept for the view', () => {
  const g = quiet(new Game(2)); const i = only(g, 'husk', 20, 0);
  g.step(1 / 60, idle); const x1 = g.en.x[i]; g.step(1 / 60, idle);
  assert.ok(Math.abs(g.en.px[i] - x1) < 1e-4, 'prev equals last tick'); assert.ok(g.en.x[i] !== x1);
  const a = g.fixed(1 / 144, idle); assert.ok(a >= 0 && a <= 1);
});


test('deterministic from a seed: no Math.random in the sim, same inputs give the same run', () => {
  const orig = Math.random; Math.random = () => { throw new Error('Math.random used in the sim'); };
  try {
    const play = () => {
      const g = new Game(77, { offers: false }); const cmd = { ...idle, f: 1, yaw: 0.3, dash: false }; let h = 0;
      for (let i = 0; i < 60 * 40; i++) { g.step(1 / 60, { ...cmd, dash: i % 200 === 0 }); h = (h * 31 + Math.round(g.p.x * 100) + g.kills * 7 + g.enemyCount() * 13) | 0; }
      return [h, g.kills, g.level, Math.round(g.p.hp)];
    };
    assert.deepEqual(play(), play());
  } finally { Math.random = orig; }
});

test('a generator can place objects through the API on an empty world', () => {
  const g = new Game(3, { world: 'none' }); assert.equal(g.world.vases.length, 0);
  const { placeObject, nearestProp } = await_world;
  placeObject(g, 'stone', { x: 5, y: 0, z: 5 }); placeObject(g, 'cchest', { x: -5, y: 0, z: 5, rarity: 'rare' }); placeObject(g, 'shrine', { x: 0, y: 0, z: -9 }); placeObject(g, 'broker', { x: 9, y: 0, z: 0 }); placeObject(g, 'vase', { x: 2, y: 0, z: 2, banded: true });
  assert.equal(g.world.stones.length, 1); assert.equal(g.world.broker.stock.length, 3); assert.equal(g.world.cchests[0].rarity, 'rare');
  g.p.x = 5; g.p.z = 5; assert.equal(nearestProp(g).type, 'stone');
});

