// The coded new-design items (src/data/items3.js, src/sim/items3.js): each rule checked by numbers in the sim.
import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js'; import { addItem, gainLevel } from '../src/sim/field.js';
import { ITEMS } from '../src/data/items.js'; import { ITEMS3 } from '../src/data/items3.js';
import { spawnEnemy } from '../src/sim/enemies.js'; import { damageEnemy, killEnemy } from '../src/sim/combat.js';
import { v2Rate, v2Event, v2Tick, v2Attacked } from '../src/sim/items3.js'; import { chestPrice } from '../src/sim/world.js';
import { MARKS } from '../src/data/cards.js';
const mk = () => { const g = new Game(4711, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }); g.god = true; g.spawnAcc = -1e9; return g; };
const foe = (g, dx, hp) => { spawnEnemy(g, 'husk', { x: g.p.x + dx, z: g.p.z + 1 }); const i = g.lastSlot; g.en.hp[i] = hp || 4000; return i; };
const hit = (g, i, src) => { g.curSrc = g.srcIndex(src || 'ember-wyvern'); const h0 = g.en.hp[i]; damageEnemy(g, i, 10, { noCrit: true }); g.curSrc = 0; return h0 - g.en.hp[i]; };
const mon = g => g.field.monsters.find(Boolean);

test('items v2: 40 coded, each has a name, a line and a price, is single-only, and is open in a game with a save', () => {
  assert.equal(Object.keys(ITEMS3).length, 40);
  for (const [id, it] of Object.entries(ITEMS3)) { assert.ok(ITEMS[id].v2 && it.name && it.text && it.price > 0 && it.unique, id); assert.ok(!/\bLP\b|undefined/.test(it.text), id + ': ' + it.text); }
  const g = new Game(1, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', meta: { mods: {}, cards: [], items: ['sand-sandals'], deck: {} } });
  if (g.unlockedItems) for (const id of Object.keys(ITEMS3)) assert.ok(g.unlockedItems.has(id), id);
});
test('items v2: every one at once, ten seconds of play, nothing throws', () => {
  const g = mk(); for (const id of Object.keys(ITEMS3)) assert.ok(addItem(g, id), id);
  for (let k = 0; k < 8; k++) foe(g, 2 + k, 40);
  for (let i = 0; i < 600; i++) g.step(1 / 60, { f: 1, r: 0, yaw: 0, jump: i % 50 === 0, dash: i % 90 === 0, slide: false, use: false, hold: false });
  for (const ev of ['hurt', 'dash', 'chest', 'heart', 'bought']) v2Event(g, ev); v2Event(g, 'coin', 120); v2Event(g, 'trick', 'air'); v2Event(g, 'trick', 'land'); v2Event(g, 'vase', { x: g.p.x, y: g.p.y, z: g.p.z });
  assert.ok(Number.isFinite(g.p.hp) && g.p.hp > 0);
});
test('items v2 damage: Glass Deck doubles and halves max health, Deep Purse, Tithe Bowl, Heart of the Horde, Kindling Pouch, Blood Ink', () => {
  let g = mk(); let i = foe(g, 3); const base = hit(g, i); const hp0 = g.p.maxHp;
  addItem(g, 'glass-deck'); assert.ok(Math.abs(hit(g, i) - base * 2) < 2e-3); assert.equal(g.p.maxHp, Math.ceil(hp0 / 2));
  g = mk(); i = foe(g, 3); addItem(g, 'deep-purse'); g.coins = 260; assert.ok(Math.abs(hit(g, i) - base * 1.10) < 2e-3);
  g = mk(); i = foe(g, 3); g.world.opened = 3; const p0 = chestPrice(g); addItem(g, 'tithe-bowl'); assert.equal(chestPrice(g), Math.max(1, Math.round(p0 * 0.8))); v2Event(g, 'bought'); v2Event(g, 'bought'); assert.ok(Math.abs(hit(g, i) - base * 1.04) < 2e-3);
  g = mk(); i = foe(g, 3); addItem(g, 'heart-of-the-horde'); g.kills = 300; assert.ok(Math.abs(hit(g, i) - base * 1.03 / 1.015) < 2e-3);
  g = mk(); i = foe(g, 3); addItem(g, 'kindling-pouch'); g.en.burn[i] = 2; assert.ok(Math.abs(hit(g, i) - base * 1.15) < 2e-3);
  g = mk(); i = foe(g, 3); addItem(g, 'blood-ink'); assert.ok(Math.abs(hit(g, i) - base * 1.3) < 2e-3); const h = g.p.hp; v2Attacked(g, mon(g)); assert.equal(g.p.hp, h - 1); g.p.hp = g.p.maxHp * 0.1; assert.ok(Math.abs(hit(g, i) - base) < 2e-3); v2Attacked(g, mon(g)); assert.equal(g.p.hp, g.p.maxHp * 0.1);
});
test('items v2 rate: Opening Bell, Heart Crumb, Glass Leash, Rally Flag, Rider\'s Covenant', () => {
  let g = mk(); const m = () => mon(g);
  addItem(g, 'opening-bell'); g.sc = 5; m().x = g.p.x + 8; m().z = g.p.z; assert.equal(v2Rate(g, m()), 0.25); g.sc = 30; assert.equal(v2Rate(g, m()), 0);
  g = mk(); addItem(g, 'heart-crumb'); g.sc = 99; assert.equal(v2Rate(g, m()), 0); v2Event(g, 'heart'); assert.equal(v2Rate(g, m()), 0.15); v2Tick(g, 5); assert.equal(v2Rate(g, m()), 0);
  g = mk(); addItem(g, 'glass-leash'); g.sc = 99; m().x = g.p.x + 3; m().z = g.p.z; assert.equal(v2Rate(g, m()), 0.25); m().x = g.p.x + 15; assert.equal(v2Rate(g, m()), -0.1); m().x = g.p.x + 9; assert.equal(v2Rate(g, m()), 0);
  g = mk(); addItem(g, 'rally-flag'); g.sc = 99; m().x = g.p.x + 2; m().z = g.p.z; g.p.vx = g.p.vz = 0; v2Tick(g, 1); assert.equal(v2Rate(g, m()), 0); v2Tick(g, 1.1); assert.ok(Math.abs(v2Rate(g, m()) - 0.1) < 1e-9); g.p.vx = 5; v2Tick(g, 0.1); assert.equal(v2Rate(g, m()), 0);
  g = mk(); addItem(g, 'riders-covenant'); g.sc = 99; g.rflow = { step: 1 }; assert.ok(Math.abs(v2Rate(g, m()) + 0.15) < 1e-9); g.rflow.step = 5; assert.ok(Math.abs(v2Rate(g, m()) - 0.6) < 1e-9);
});
test('items v2 marks: Bounty Tag pays 2, Marking Chalk lasts longer and jumps, Echo Bell repeats the hit, Marksman\'s Wax crits once a mark, Vase Dust marks', () => {
  let g = mk(); addItem(g, 'bounty-tag'); let i = foe(g, 3, 5); g.en.mark[i] = 3; const c = g.coins; killEnemy(g, i); assert.equal(g.coins, c + 2);
  g = mk(); addItem(g, 'marking-chalk'); assert.equal(g.mods.markDur, 2); i = foe(g, 3, 5); const j = foe(g, 5); g.en.mark[i] = 3; killEnemy(g, i); assert.equal(g.en.mark[j], MARKS.duration + 2);
  g = mk(); addItem(g, 'echo-bell'); i = foe(g, 3, 5); const k = foe(g, 6); g.en.mark[i] = 3; g.en.mark[k] = 3; const h0 = g.en.hp[k]; hit(g, i); assert.ok(!g.en.alive[i]); assert.ok(g.en.hp[k] < h0, 'the killing hit repeats on the other marked enemy');
  g = mk(); i = foe(g, 3); g.en.mark[i] = 5; g.curSrc = g.srcIndex('ember-wyvern'); let h = g.en.hp[i]; damageEnemy(g, i, 10, { noCrit: true }); const plain = h - g.en.hp[i]; addItem(g, 'marksmans-wax'); g.curSrc = g.srcIndex('ember-wyvern'); g.rc = () => 0.999;
  h = g.en.hp[i]; damageEnemy(g, i, 10); const first = h - g.en.hp[i]; h = g.en.hp[i]; damageEnemy(g, i, 10); const second = h - g.en.hp[i]; assert.ok(first > plain * 1.2, 'the first hit on the mark crits'); assert.ok(Math.abs(second - plain) < 2e-3, 'the second does not');
  g = mk(); addItem(g, 'vase-dust'); i = foe(g, 4); v2Event(g, 'vase', { x: g.p.x, y: g.p.y, z: g.p.z }); assert.ok(g.en.mark[i] > 0);
});
test('items v2 triggers: Chest Bell, Thorn Bracer, Landing Pad, Slam Bell, Static Sock, Flint Chip, Frost Pebble, Lucky Tooth, Shell Fragment, Heart Locket', () => {
  let g = mk(); const m = () => mon(g);
  addItem(g, 'chest-bell'); m().cd = 3; v2Event(g, 'chest'); assert.equal(m().cd, 0);
  g = mk(); addItem(g, 'thorn-bracer'); m().cd = 3; v2Event(g, 'hurt'); assert.equal(m().cd, 0);
  g = mk(); addItem(g, 'landing-pad'); m().cd = 3; v2Event(g, 'trick', 'land'); assert.equal(m().cd, 0);
  g = mk(); addItem(g, 'slam-bell'); m().cd = 3; v2Event(g, 'trick', 'air'); assert.equal(m().cd, 0); v2Tick(g, 0.4); assert.equal(m().cd, 1, 'a second of pause after the volley'); m().cd = 3; v2Event(g, 'trick', 'air'); assert.equal(m().cd, 3, '12 s to recharge');
  g = mk(); addItem(g, 'static-sock'); let i = foe(g, 3), j = foe(g, 5); g.step(1 / 60, { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false, hold: false }); mon(g).cd = 99; v2Event(g, 'dash'); let h = g.en.hp[j]; hit(g, i); assert.ok(g.en.hp[j] < h, 'the next creature hit chains once'); h = g.en.hp[j]; hit(g, i); assert.equal(g.en.hp[j], h);
  g = mk(); addItem(g, 'flint-chip'); i = foe(g, 3); for (let k = 0; k < 7; k++) v2Attacked(g, m()); hit(g, i); assert.equal(g.en.burn[i], 0); v2Attacked(g, m()); hit(g, i); assert.equal(g.en.burn[i], 2);
  g = mk(); addItem(g, 'frost-pebble'); i = foe(g, 3); hit(g, i); assert.equal(g.en.slow[i], 1); g.en.slow[i] = 0; hit(g, i); assert.equal(g.en.slow[i], 0, 'only the first hit');
  g = mk(); addItem(g, 'lucky-tooth'); i = foe(g, 3); g.rc = () => 0.999; g.curSrc = g.srcIndex('ember-wyvern'); h = g.en.hp[i]; damageEnemy(g, i, 10); const plain = h - g.en.hp[i]; v2Event(g, 'coin', 50); h = g.en.hp[i]; damageEnemy(g, i, 10); assert.ok(h - g.en.hp[i] > plain * 1.2);
  g = mk(); addItem(g, 'shell-fragment'); i = foe(g, 2); const d0 = Math.hypot(g.en.x[i] - g.p.x, g.en.z[i] - g.p.z); v2Event(g, 'hurt'); assert.ok(Math.abs(Math.hypot(g.en.x[i] - g.p.x, g.en.z[i] - g.p.z) - d0 - 2) < 1e-4);
  g = mk(); addItem(g, 'heart-locket'); g.p.hp = g.p.maxHp; assert.equal(v2Event(g, 'heart'), true); assert.equal(g.wardHits, 1); g.p.hp = 10; assert.equal(v2Event(g, 'heart'), false);
});
test('items v2 growth: Tier Ribbon heals 10 at a new tier, Growth Ring and Trainer\'s Treat give half levels, Hollow Egg, Elite Bounty, Conductor Rod, Kindling Crown, Sealed Hourglass', () => {
  let g = mk(); g.god = false; addItem(g, 'tier-ribbon'); g.p.hp = 50; const m = mon(g); m.level = 4; gainLevel(g, m, 1); assert.equal(m.level, 5); assert.equal(g.p.hp, 60); gainLevel(g, m, 1); assert.equal(g.p.hp, 60);
  g = mk(); addItem(g, 'growth-ring'); const a = mon(g); const slot = g.field.monsters.findIndex(x => !x); g.field.monsters[slot] = { id: 'cinder-hatchling', level: 2, cd: 0.1, ang: 0, x: g.p.x, y: g.p.y, z: g.p.z, px: 0, py: 0, pz: 0 }; const b = g.field.monsters[slot]; a.level = 4; gainLevel(g, a, 1); assert.equal(b.frac, 0.5); a.level = 9; gainLevel(g, a, 1); assert.equal(b.level, 3);
  g = mk(); addItem(g, 'hollow-egg'); const L = g.pendingLevels; g.addXp(g.xpNeed); assert.equal(g.pendingLevels, L, 'the next level-up is skipped'); g.addXp(g.xpNeed); assert.equal(g.pendingLevels, L + 1);
  g = mk(); addItem(g, 'elite-bounty'); const n0 = g.world.cchests.filter(c => c.trophy).length; g.rl = () => 0.999; for (let k = 0; k < 3; k++) { const i = foe(g, 3 + k, 5); g.en.ace[i] = 1; killEnemy(g, i); } assert.ok(g.world.cchests.filter(c => c.trophy).length >= n0 + 1);
  g = mk(); addItem(g, 'kindling-crown'); let i = foe(g, 3); g.en.ace[i] = 1; damageEnemy(g, i, 1, { flame: 1, noCrit: true }); const d1 = g.en.burnDps[i]; damageEnemy(g, i, 1, { flame: 1, noCrit: true }); assert.ok(Math.abs(g.en.burnDps[i] - d1 * 2) < 2e-3, 'burn piles up on an Ace'); const j = foe(g, 8); damageEnemy(g, j, 1, { flame: 1, noCrit: true }); assert.ok(Math.abs(g.en.burn[j] - 1.5) < 2e-3);
  g = mk(); const s0 = g.sc; g.step(1 / 60, { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false, hold: false }); const d = g.sc - s0; addItem(g, 'sealed-hourglass'); const s1 = g.sc; g.step(1 / 60, { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false, hold: false }); if (d > 0) assert.ok(Math.abs((g.sc - s1) - d * 0.8) < 1e-9);
});
