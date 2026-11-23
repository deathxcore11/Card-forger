import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { heightAt } from '../src/sim/terrain.js';
import { chestPrice, breakVasesNear, nearestProp, useProp } from '../src/sim/world.js';
import { addItem, addBlessing, buildOffer } from '../src/sim/field.js';
import { ENCOUNTERS as E } from '../src/data/encounters.js';
import { ITEMS } from '../src/data/items.js';

const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false };
const quiet = g => { g.spawnAcc = -1e9; g.golemT = 1e9; g.flags.warden = g.flags.idols = true; g.boss.state = 'dead'; g.field.monsters.fill(null); g.cardT = 1e9; return g; };
const run = (g, s, cmd = idle) => { for (let t = 0; t < s && !g.over && !g.offer; t += 1 / 60) g.step(1 / 60, cmd); };
const at = (g, o) => { g.p.x = o.x; g.p.z = o.z; g.p.y = o.y; g.p.vx = g.p.vz = 0; g.p.grounded = true; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('placement over many seeds: every spot is standable, flat, in its region, spaced out and has an escape', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const g = new Game(seed), W = g.world, all = [...W.stones, W.broker, ...W.shrines, ...W.cchests];
    assert.equal(W.stones.length, 2); assert.ok(W.broker); assert.equal(W.shrines.length, E.shrines.count); assert.equal(W.cchests.length, 8);
    for (const s of all) {
      assert.ok(s.y < 50 && Math.abs(heightAt(s.x, s.z) - s.y) < 1e-6, 'standable');
      let open = 0; for (let k = 0; k < 8; k++) { const h = heightAt(s.x + Math.cos(k * Math.PI / 4) * 4, s.z + Math.sin(k * Math.PI / 4) * 4); if (h < 50 && Math.abs(h - s.y) < 0.7) open++; }
      assert.ok(open >= 3, `seed ${seed}: spot has ${open} ways off`);
    }
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(dist(all[i], all[j]) >= E.minSpacing - 1e-6, `seed ${seed}: spots too close`);
    for (const s of W.shrines) assert.equal(s.y, 0, 'shrines are floor only');
    assert.equal(W.broker.y, 4, 'the broker stands on the upper stands');
    for (const s of W.stones) assert.equal(s.y, 0);
    assert.ok(dist(W.stones[0], W.stones[1]) >= E.witnessStones.minApart, 'the two free-item stones are far apart');
    assert.deepEqual([0, 4, 5.8].map(h => W.cchests.filter(c => Math.abs(c.y - h) < 0.01).length), [3, 3, 2], 'chests spread over all three heights');
    assert.ok(W.vases.length >= 25 && W.vases.length <= 70, `vases ${W.vases.length}`);
  }
});

test('different seeds give different layouts, the same seed gives the same one', () => {
  const a = new Game(3).world, b = new Game(3).world, c = new Game(4).world;
  assert.deepEqual(a.shrines.map(s => [s.x, s.z]), b.shrines.map(s => [s.x, s.z]));
  assert.notDeepEqual(a.shrines.map(s => [s.x, s.z]), c.shrines.map(s => [s.x, s.z]));
});

test('vases break from a card shot or a dash, and drop coins, XP and sometimes a heart', () => {
  const g = quiet(new Game(2)); g.god = true; const v = g.world.vases[0]; at(g, { x: v.x - 6, z: v.z, y: v.y });
  const before = g.pick.alive.reduce((a, b) => a + b, 0);
  breakVasesNear(g, v.x, v.z, 0.9); assert.equal(v.alive, false); assert.ok(g.pick.alive.reduce((a, b) => a + b, 0) > before);
  const w = g.world.vases.find(x => x.alive); at(g, { x: w.x - 3, z: w.z, y: w.y });
  g.step(1 / 60, { ...idle, dash: true, yaw: Math.atan2(-(w.x - g.p.x), -(w.z - g.p.z)) }); run(g, 0.3, { ...idle, yaw: Math.atan2(-(w.x - g.p.x), -(w.z - g.p.z)) });
  assert.equal(w.alive, false, 'a dash through breaks it');
  const banded = { x: 0, y: 0, z: 0, alive: true, banded: true, hp: 1 }; g.world.vases.push(banded); const hearts0 = g.pick.kind.filter((k, i) => g.pick.alive[i] && k === 2).length;
  breakVasesNear(g, 0, 0, 0.5); assert.ok(g.pick.kind.filter((k, i) => g.pick.alive[i] && k === 2).length > hearts0, 'a banded vase always drops a heart');
});

test('Witness Stones: one free item from three, once per stone', () => {
  const g = quiet(new Game(5)); const s = g.world.stones[0]; at(g, s);
  const hit = nearestProp(g); assert.equal(hit.type, 'stone'); useProp(g, hit);
  assert.equal(g.offer.type, 'item'); assert.equal(g.offer.cards.length, 3); assert.ok(g.offer.cards.every(c => c.kind === 'item'));
  const id = g.offer.cards[0].id; assert.ok(g.choose(0)); assert.ok(g.items.includes(id)); assert.equal(s.used, true);
  assert.notEqual(nearestProp(g) && nearestProp(g).obj, s, 'a used stone cannot be used again');
});

test('Relic Broker: fixed stock for the run, items cost coins, browse and come back', () => {
  const g = quiet(new Game(6)); const b = g.world.broker; at(g, b); const stock0 = b.stock.map(s => s.id + s.price).join();
  useProp(g, nearestProp(g)); assert.equal(g.offer.type, 'shop'); assert.equal(g.offer.cards.length, 3);
  assert.equal(g.choose(0), false, 'no coins, no sale'); g.coins = 500;
  const price = g.offer.cards[0].price, id = g.offer.cards[0].id; assert.ok(g.choose(0)); assert.equal(g.coins, 500 - price); assert.ok(g.items.includes(id));
  assert.equal(g.choose(0), false, 'sold'); assert.ok(g.offer, 'the shop stays open'); g.leave();
  useProp(g, nearestProp(g)); assert.equal(b.stock.map(s => s.id + s.price).join(), stock0, 'stock and prices are fixed for the run'); assert.equal(g.offer.cards[0].sold, true);
});

test('Shrine of Tribute: hold 5 s inside the ring; leaving pauses, then decays; reward is a stat blessing', () => {
  const g = quiet(new Game(7)); g.god = true; const s = g.world.shrines[0]; at(g, s);
  run(g, 3); assert.ok(s.charge > 2.9 && s.charge < 3.2);
  at(g, { x: s.x + 20, z: s.z, y: s.y }); run(g, 1); assert.ok(s.charge > 2.9, 'a brief exit only pauses');
  run(g, 3); assert.ok(s.charge < 3, 'a long exit decays');
  const c0 = s.charge; at(g, s); run(g, 6); assert.equal(s.done, true); assert.equal(g.offer.type, 'blessing'); assert.equal(g.offer.cards.length, 3);
  const maxBefore = g.p.maxHp, dmg0 = g.mods.dmgMult; g.offer.cards.forEach((c, i) => { if (c.id === 'vigor') { g.choose(i); } }); if (g.offer) g.choose(0);
  assert.ok(g.blessings.length === 1);
  assert.ok(c0 < 3);
});

test('Card Chests: price rises with each chest, rarity is shown, you must be able to pay', () => {
  const g = quiet(new Game(8)); const cs = g.world.cchests; const prices = [];
  for (let k = 0; k < 4; k++) {
    const c = cs[k]; at(g, c); const p = chestPrice(g); prices.push(p); g.coins = 0; useProp(g, nearestProp(g)); assert.equal(g.offer, null, 'cannot open without coins');
    g.coins = 1000; useProp(g, nearestProp(g)); assert.ok(g.offer && g.offer.type === 'chest'); assert.equal(g.coins, 1000 - p); g.choose(0);
  }
  assert.deepEqual(prices, [30, 92, 164, 246]); assert.equal(g.world.opened, 4);              // additive: 30, 92, 164, 246
});

test('items change the run: armour, free chests, discount, regen, coins, luck, dash cooldown, air jump', () => {
  const g = quiet(new Game(9)); g.god = false;
  addItem(g, 'bronze-scale'); g.p.hp = 100; g.hurtPlayer(8); assert.equal(Math.round(g.p.hp), 93, '+1 armour');
  g.hurtPlayer(1); assert.equal(Math.round(g.p.hp), 92, 'never below 1 damage');
  addItem(g, 'jar-of-avarice'); g.world.opened = 4; assert.equal(chestPrice(g), 0, 'every 5th chest is free');
  addItem(g, 'traders-seal'); g.world.opened = 1; assert.equal(chestPrice(g), Math.round(92 * 0.75));
  addItem(g, 'clay-heart'); assert.equal(g.p.maxHp, 115); addItem(g, 'bandaged-hand'); g.p.hp = 50; run(g, 5); assert.ok(g.p.hp >= 50.9, 'regen');
  addItem(g, 'travelling-cloak'); g.step(1 / 60, { ...idle, dash: true }); assert.ok(Math.abs(g.p.dashCd - 1.1 * 0.85) < 0.03);
  addItem(g, 'scarab-charm'); const c0 = g.coins; for (let i = 0; i < 20; i++) { g.pick.alive[i] = 1; g.pick.kind[i] = 1; g.pick.x[i] = g.p.x; g.pick.z[i] = g.p.z; g.pick.y[i] = g.p.y; g.pick.val[i] = 1; } run(g, 0.3);
  assert.ok(g.coins - c0 >= 22, 'coins +15%');
  const boots = quiet(new Game(9)); addItem(boots, 'dueling-boots'); boots.step(1 / 60, { ...idle, jump: true }); run(boots, 0.25); boots.step(1 / 60, idle); const y1 = boots.p.y;
  boots.step(1 / 60, { ...idle, jump: true }); run(boots, 0.3, { ...idle, jump: true }); assert.ok(boots.p.y > y1, 'the air jump lifts you again');
});

test('Paper Talisman blocks one hit every 20 s; Hunter\'s Mark hits elites harder', () => {
  const g = quiet(new Game(9)); addItem(g, 'paper-talisman'); g.p.hp = 100;
  assert.equal(g.hurtPlayer(10), false); assert.equal(g.p.hp, 100); assert.equal(g.hurtPlayer(10), true, 'second hit lands'); assert.ok(g.p.hp < 100);
  assert.ok(ITEMS['hunters-mark'].mods.bossDmg === 0.25);
});

test('blessings stack and heal', () => {
  const g = quiet(new Game(9)); g.p.hp = 60; addBlessing(g, 'vigor'); assert.equal(g.p.maxHp, 120); assert.equal(g.p.hp, 80); addBlessing(g, 'might'); assert.ok(Math.abs(g.mods.dmgMult - 0.1) < 1e-9);
});

test('Altar of Tribute: one landmark, two labelled actions; Tribute frees the zone and the next card starts +2 levels', () => {
  const g = quiet(new Game(11)); g.field.monsters[0] = { id: 'ember-wyvern', level: 6, cd: 0 }; g.field.monsters[1] = { id: 'rune-apprentice', level: 2, cd: 0 };
  const a = g.world.altar; assert.ok(a); at(g, a); const hit = nearestProp(g); assert.equal(hit.type, 'altar'); useProp(g, hit);
  assert.equal(g.offer.type, 'altar'); const kinds = new Set(g.offer.cards.map(c => c.kind)); assert.ok(kinds.has('tribute') && kinds.has('banish'));
  const i = g.offer.cards.findIndex(c => c.kind === 'tribute' && c.id === 'ember-wyvern'); assert.ok(g.choose(i));
  assert.equal(g.field.monsters[0], null, 'the zone is freed'); assert.equal(a.used, true, 'one use');
  g.field.monsters[2] = { id: 'sigil-familiar', level: 1, cd: 0 };                         // fill another zone so the freed one is the only empty one
  g.field.monsters[3] = { id: 'cinder-hatchling', level: 1, cd: 0 };
  g.level = 5; const c = { id: 'rune-apprentice', kind: 'monster', isNew: true, to: 1, rarity: 'common' };
  g.field.monsters[1] = null; g.field.bonusM[1] = 0; g.field.monsters[1] = { id: 'rune-apprentice', level: 2, cd: 0 };
  g.offer = { type: 'level', cards: [{ id: 'ember-wyvern', kind: 'monster', isNew: true, to: 1, rarity: 'common' }], leave: false }; g.pendingLevels = 1; g.choose(0);
  assert.equal(g.field.monsters[0].id, 'ember-wyvern'); assert.equal(g.field.monsters[0].level, 3, 'starts +2 levels higher');
});

test('Altar Banish removes an unowned card from all future offers', () => {
  const g = quiet(new Game(12)); const a = g.world.altar; at(g, a); useProp(g, nearestProp(g));
  const i = g.offer.cards.findIndex(c => c.kind === 'banish'); const id = g.offer.cards[i].id; g.choose(i); assert.ok(g.field.banished.has(id));
  for (let k = 0; k < 30; k++) { g.level = 6; assert.ok(!buildOffer(g).some(c => c.id === id)); }
});

