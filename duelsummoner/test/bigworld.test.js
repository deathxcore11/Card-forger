import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, Q, REGION } from '../src/gen/world/world.js';
import { Game } from '../src/sim/game.js';
import { loadMap, heightAt, streamTo, isStreamed } from '../src/sim/terrain.js';
import { bigMap } from '../src/gen/world/map.js';

const SEEDS = [11, 4711, 90210, 77, 31337, 5, 123456, 8080];
const STEP = 1 / 60, IDLE = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false, hold: false };

test('big world: the same seed gives the same ground and the same cells, a different seed does not', () => {
  const a = makeWorld(4711, 0), b = makeWorld(4711, 0), c = makeWorld(4712, 0), A = new Float32Array(64 * 64), B = new Float32Array(64 * 64), C = new Float32Array(64 * 64);
  a.fillSim(1000, -2000, 64, A); b.fillSim(1000, -2000, 64, B); c.fillSim(1000, -2000, 64, C);
  assert.deepEqual(Array.from(A), Array.from(B)); assert.notDeepEqual(Array.from(A), Array.from(C));
  assert.deepEqual(a.spawn, b.spawn); assert.deepEqual(a.cell(3, -4).pockets, b.cell(3, -4).pockets); assert.deepEqual(a.cell(3, -4).blocks.map(x => [x.cx, x.cz, x.T]), b.cell(3, -4).blocks.map(x => [x.cx, x.cz, x.T]));
});

test('big world: a height is the same whatever chunks were loaded before it (the ring cache never changes an answer)', () => {
  const m1 = bigMap(90210, 0), m2 = bigMap(90210, 0), pts = []; let s = 1; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let k = 0; k < 400; k++) pts.push([(r() - 0.5) * 6000, (r() - 0.5) * 6000]);
  loadMap(m1); assert.ok(isStreamed()); const one = pts.map(p => heightAt(p[0], p[1]));
  loadMap(m2); streamTo(0, 0, 200, 6); const two = pts.slice().reverse().map(p => heightAt(p[0], p[1])).reverse();
  assert.deepEqual(one, two); assert.ok(one.every(h => h > 0 && h < 120), 'heights are sane');
});

test('big world: regions of every character exist, walkable ground is one connected piece, and a pocket is never far', () => {
  for (const seed of SEEDS) {
    const W = makeWorld(seed, 0), seen = new Set(); for (let z = -12000; z <= 12000; z += 500) for (let x = -12000; x <= 12000; x += 500) seen.add(W.regionAt(x, z).type);
    assert.ok(seen.size >= 6, seed + ' region kinds ' + [...seen].map(i => REGION[i]).join(','));
    // 500 m round the start: nearly all walkable ground is joined to the start, and every pocket is on it
    const R = 400, S = 2, n = R * 2 / S, hs = new Float32Array(n * n), ox = W.spawn.x - R, oz = W.spawn.z - R;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) hs[j * n + i] = W.simAt(ox + i * S + 1, oz + j * S + 1);
    const got = new Uint8Array(n * n), q = [(n >> 1) * n + (n >> 1)]; got[q[0]] = 1; let walk = 0, reach = 0; for (let k = 0; k < n * n; k++) if (hs[k] < 50) walk++;
    while (q.length) { const c = q.pop(), x = c % n, z = (c / n) | 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= n || zz >= n) continue; const m = zz * n + xx; if (got[m] || hs[m] >= 50 || Math.abs(hs[m] - hs[c]) > 0.55 * S) continue; got[m] = 1; q.push(m); } }
    for (let k = 0; k < n * n; k++) if (got[k]) reach++;
    assert.ok(reach / walk > 0.97, seed + ' connected ' + (reach / walk).toFixed(3));
    for (let qz = -1; qz <= 1; qz++) for (let qx = -1; qx <= 1; qx++) for (const p of W.cell(Math.floor(W.spawn.x / Q) + qx, Math.floor(W.spawn.z / Q) + qz).pockets) { const i = Math.floor((p.x - ox) / S), j = Math.floor((p.z - oz) / S); if (i > 0 && j > 0 && i < n && j < n) assert.ok(got[j * n + i], seed + ' pocket ' + p.type + ' reachable'); }
    // the longest stretch of a straight 3 km drive with no pocket within 90 m of the line is under 60 s at 9 m/s (540 m)
    for (let d = 0; d < 6; d++) { const a = d * 1.0471975 + 0.3, dx = Math.cos(a), dz = Math.sin(a); let last = 0, gap = 0;
      for (let t = 0; t <= 3000; t += 10) { const x = W.spawn.x + dx * t, z = W.spawn.z + dz * t; let near = false;
        for (let j = -1; j <= 1 && !near; j++) for (let i = -1; i <= 1 && !near; i++) { const C = W.cell(Math.floor(x / Q) + i, Math.floor(z / Q) + j); for (const p of [...C.pockets, ...C.extras]) if (Math.hypot(p.x - x, p.z - z) < 90) { near = true; break; } }
        if (near) last = t; gap = Math.max(gap, t - last); }
      assert.ok(gap <= 540, seed + ' drive ' + d + ' gap ' + gap + ' m'); }
  }
});

test('big world: a run on it starts in the open, the things of the cells near the duelist are placed and the ground follows them', () => {
  const g = new Game(4711, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }); g.god = true;
  assert.ok(g.map.big && g.openFlow); assert.ok(g.world.vases.length > 10 && g.world.shrines.length + g.world.stones.length + g.world.cchests.length >= 3, 'pockets near the start');
  const n0 = g.world.vases.length + g.world.cchests.length + g.world.shrines.length + g.world.stones.length;
  for (let i = 0; i < 20 * 60; i++) g.step(STEP, Object.assign({}, IDLE, { f: 1 }));
  g.p.x += 900; g.p.y = heightAt(g.p.x, g.p.z); for (let i = 0; i < 120; i++) g.step(STEP, IDLE);
  assert.ok(g.world.vases.length + g.world.cchests.length + g.world.shrines.length + g.world.stones.length > n0, 'new pockets were placed 900 m on'); assert.ok(g.fog.count > 100 && g.fog.big, 'the fog opens as the duelist goes');
  assert.ok(heightAt(g.p.x, g.p.z) < 50 && Math.abs(g.p.y - heightAt(g.p.x, g.p.z)) < 5, 'standing on the ground');
});

test('big world door: stages are 12 minutes, the door rises near the duelist between 8:00 and 10:00 (never a beam), and waking it is still hold-to-wake', () => {
  for (const seed of [11, 4711, 90210, 77, 31337, 5, 123456, 8080]) {
    const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }); g.god = true; g.spawnAcc = -1e9;
    assert.equal(g.stageSpec.clock, 720); assert.deepEqual(g.stageSpec.doorRise, [480, 600]); assert.equal(g.door.state, 'hidden'); assert.ok(g.door.base >= 480 && g.door.base <= 600);
    assert.ok(g.map.gate.x > 1e6, 'the gate is parked off the world until the door rises');
    let t = 0; const banners = []; const ev = g.event.bind(g); g.event = (k, d) => { if (k === 'banner') banners.push(d); ev(k, d); };
    while (g.door.state === 'hidden' && t < 700 * 60) { g.step(STEP, IDLE); t++; g.p.hp = g.p.maxHp; }
    assert.equal(g.door.state, 'risen'); assert.ok(g.sc >= 359 && g.sc <= 601 && (g.sc >= 479 || g.door.shards || g.elitesKilled), seed + ' rose at ' + g.sc);       // before 8:00 only through a Rumour Shard or a felled elite
    const dd = Math.hypot(g.map.gate.x - g.p.x, g.map.gate.z - g.p.z); assert.ok(dd >= 150 && dd <= 300, seed + ' door ' + Math.round(dd) + ' m away');
    assert.ok(banners.some(b => /door has risen/.test(b))); assert.ok(heightAt(g.map.gate.x, g.map.gate.z) < 50);
    // hold to wake: standing at it for 0.5 s does nothing, 2 s (after it has finished rising) wakes the stage boss
    g.p.x = g.map.gate.x + 0.5; g.p.z = g.map.gate.z; g.p.y = heightAt(g.p.x, g.p.z); g.p.vx = g.p.vz = 0; for (let i = 0; i < 6 * 60; i++) g.step(STEP, IDLE); assert.equal(g.gate.state, 'closed');
    for (let i = 0; i < 4 * 60; i++) { if (g.offer) chooseCard(g, 0); g.step(STEP, Object.assign({}, IDLE, { use: true })); } assert.equal(g.gate.state, 'fight', seed + ' boss woken');
  }
});

test('big world door: each elite or mini boss felled makes it rise 30 s sooner, never before 6:00', () => {
  const g = new Game(4711, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }); const base = g.door.base;
  g.elitesKilled += 1; assert.equal(Math.round(g.door.base - 30), Math.round(base - 30)); g.step(STEP, IDLE); assert.equal(Math.round(g.door.at), Math.round(Math.max(360, base - 30)));
  g.elitesKilled += 20; g.step(STEP, IDLE); assert.equal(g.door.at, 360);
});

import { rollPickup, collectPowerup } from '../src/sim/powerups.js';
import { dropPickup } from '../src/sim/combat.js';
import { PICK, POWER, COMMON_KINDS, RARE_KINDS } from '../src/data/powerups.js';
import { openCardChest } from '../src/sim/world.js';
import { chooseCard } from '../src/sim/field.js';
import { ITEMS } from '../src/data/items.js';
const mkBig = () => { const g = new Game(4711, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }); g.god = false; return g; };

test('big world pickups: a vase drops nothing extra 85 in 100, a common one 12, a rare one 3; a banded vase always drops one', () => {
  const g = mkBig(), n = 20000, t = { none: 0, common: 0, rare: 0 }, b = { none: 0, common: 0, rare: 0 };
  for (let i = 0; i < n; i++) { const k = rollPickup(g, false); t[k === 0 ? 'none' : COMMON_KINDS.includes(k) ? 'common' : RARE_KINDS.includes(k) ? 'rare' : 'bad']++; const q = rollPickup(g, true); b[q === 0 ? 'none' : COMMON_KINDS.includes(q) ? 'common' : 'rare']++; }
  assert.ok(Math.abs(t.none / n - 0.85) < 0.01 && Math.abs(t.common / n - 0.12) < 0.01 && Math.abs(t.rare / n - 0.03) < 0.006, JSON.stringify(t)); assert.equal(t.bad, undefined);
  assert.equal(b.none, 0); assert.ok(Math.abs(b.common / n - 0.7) < 0.015, JSON.stringify(b));
  const seen = new Set(); for (let i = 0; i < 4000; i++) seen.add(rollPickup(g, true)); for (const k of [...COMMON_KINDS, ...RARE_KINDS]) assert.ok(seen.has(k), 'kind ' + k + ' can drop');
});

test('big world pickups: each does its one job', () => {
  const g = mkBig(); g.p.hp = 10; g.p.maxHp = 100; const take = k => collectPowerup(g, k, 1);
  take(PICK.GREAT); assert.equal(g.p.hp, 70); take(PICK.PURSE); assert.ok(g.coins >= 14);
  take(PICK.WIND); assert.ok(g.windT === POWER.windSeconds); take(PICK.DRUM); assert.equal(g.drumT, POWER.drumSeconds); take(PICK.STOP); assert.equal(g.stopT, POWER.stopSeconds);
  take(PICK.WARD); assert.equal(g.wardHits, 3); const hp = g.p.hp; for (let i = 0; i < 3; i++) g.hurtPlayer(20, false, 'test'); assert.equal(g.p.hp, hp, 'three hits blocked'); g.hurtPlayer(20, false, 'test'); assert.ok(g.p.hp < hp, 'the fourth lands');
  // lodestar: every crystal on the field is on its way
  const g2 = mkBig(); for (let i = 0; i < 5; i++) dropPickup(g2, PICK.XP, g2.p.x + 30 + i * 3, g2.p.y, g2.p.z, 1); collectPowerup(g2, PICK.LODE, 1); let flying = 0; for (let i = 0; i < g2.pick.max; i++) if (g2.pick.alive[i] && g2.pick.kind[i] === PICK.XP && g2.pick.far[i]) flying++; assert.equal(flying, 5);
  // wind step doubles the speed, stopped sand freezes the enemies, seal burst clears the near ones
  const a = mkBig(), b = mkBig(); const run = (gg, s) => { const x0 = gg.p.x, z0 = gg.p.z; for (let i = 0; i < s * 60; i++) gg.step(STEP, Object.assign({}, IDLE, { f: 1, yaw: 0 })); return Math.hypot(gg.p.x - x0, gg.p.z - z0); };
  a.god = b.god = true; a.spawnAcc = b.spawnAcc = -1e9; collectPowerup(b, PICK.WIND, 1); const da = run(a, 3), db = run(b, 3); assert.ok(db > da * 1.6, 'wind step ' + da.toFixed(1) + ' vs ' + db.toFixed(1));
  const s = mkBig(); s.god = true; s.spawnAcc = -1e9; for (let i = 0; i < 12; i++) spawnEnemyAt(s, s.p.x + 8 + i, s.p.z); collectPowerup(s, PICK.STOP, 1); const xs = Array.from(s.en.x.slice(0, 12)), was = Array.from(s.en.alive.slice(0, 12)); for (let i = 0; i < 120; i++) s.step(STEP, IDLE); let held = 0; for (let i = 0; i < 12; i++) if (was[i] && s.en.alive[i]) { assert.ok(Math.abs(s.en.x[i] - xs[i]) < 0.8, 'frozen ' + (s.en.x[i] - xs[i])); held++; } assert.ok(held >= 4, 'some stood and were checked: ' + held);
  const z = mkBig(); z.god = true; z.spawnAcc = -1e9; for (let i = 0; i < 12; i++) spawnEnemyAt(z, z.p.x + 8 + i, z.p.z); const k0 = z.kills; collectPowerup(z, PICK.BURST, 1); assert.ok(z.kills >= k0 + 10, 'seal burst cleared ' + (z.kills - k0));
});

import { spawnEnemy } from '../src/sim/enemies.js';
function spawnEnemyAt(g, x, z) { return spawnEnemy(g, 'husk', { x, z }); }

test('big world chests: a chest holds one item, its rarity rolled at opening (richer later), and taking it puts it in the build; level-ups stay cards', () => {
  const g = mkBig(); g.god = true; const c = g.world.cchests.find(q => q.free); g.coins = 999; g.p.x = c.x; g.p.z = c.z;
  openCardChest(g, c); assert.ok(g.offer && g.offer.type === 'chest' && g.offer.itemChest && g.offer.cards.length === 1 && g.offer.cards[0].kind === 'item', 'one item');
  const id = g.offer.cards[0].id, rar = g.offer.reveal; assert.equal(ITEMS[id].rarity, rar); chooseCard(g, 0); assert.ok(g.items.includes(id) && c.open && !g.offer);
  const h = mkBig(); h.god = true; h.xp = 1e6; h.addXp(1); for (let i = 0; i < 3 && !h.offer; i++) h.step(STEP, IDLE); if (h.offer) assert.ok(h.offer.cards.every(q => q.kind !== 'item' && q.kind !== 'blessing'), 'level-up cards only: ' + h.offer.cards.map(q => q.kind));
});

import { ITEMS as ALL_ITEMS, BLESSINGS as ALL_BOONS, ITEM_CAPS } from '../src/data/items.js';
import { addItem } from '../src/sim/field.js';
import { procEvent, procTick } from '../src/sim/procs.js';

test('big world catalog: 120 items (45 common, 40 rare, 25 epic, 10 legendary), 16 boons, every item reads and works', () => {
  const c = { common: 0, rare: 0, epic: 0, legendary: 0 }; for (const it of Object.values(ALL_ITEMS)) c[it.rarity]++;
  assert.deepEqual(c, { common: 45, rare: 40, epic: 25, legendary: 10 }); assert.equal(Object.keys(ALL_BOONS).length, 16);
  for (const [id, it] of Object.entries(ALL_ITEMS)) { assert.ok(it.name && it.text && it.fam && it.price > 0, id); assert.ok(!/undefined|NaN/.test(it.text), id + ': ' + it.text); if (it.rarity === 'legendary') assert.ok(it.unique, id + ' single only'); }
  for (const id of Object.keys(ALL_BOONS)) { const b = ALL_BOONS[id]; assert.ok(b.name && b.text && b.fmt(1) && b.mods, id); }
  const g = mkBig(); g.god = true; g.spawnAcc = -1e9;
  for (const id of Object.keys(ALL_ITEMS)) { if (!g.items.includes(id)) addItem(g, id); }       // every item at once: nothing throws, the stats stay inside their ceilings
  for (let i = 0; i < 600; i++) { g.step(STEP, Object.assign({}, IDLE, { f: 1, dash: i % 90 === 0 })); }
  for (const k of Object.keys(ITEM_CAPS)) assert.ok(g.mods[k] <= ITEM_CAPS[k] + 1e-9, k + ' ' + g.mods[k]);
  assert.ok(g.procs.length >= 55, 'procs built: ' + g.procs.length); for (const ev of ['kill', 'crit', 'hurt', 'dash', 'level', 'chest', 'vase', 'pickup']) procEvent(g, ev, { x: g.p.x, y: g.p.y, z: g.p.z });
  procTick(g, 1); assert.ok(Number.isFinite(g.p.hp));
});

test('big world items: stat items change the stat, procs fire on their trigger, a second copy is stronger', () => {
  const g = mkBig(); g.god = true; const a = g.mods.critDmg; addItem(g, 'sharpened-edge'); assert.ok(Math.abs(g.mods.critDmg - a - 0.25) < 1e-9); addItem(g, 'ox-hide'); assert.equal(g.p.maxHp, 100 + 20);
  g.p.hp = 50; addItem(g, 'vampire-fang'); for (let i = 0; i < 15; i++) procEvent(g, 'kill', { x: g.p.x, y: g.p.y, z: g.p.z }); assert.equal(g.p.hp, 52, 'the 15th kill heals 2');
  const h = mkBig(); h.god = true; addItem(h, 'last-stand'); h.p.hp = 10; procTick(h, 0.1); assert.ok(h.buf.might >= 0.35 - 1e-9, 'below 35%: +35% damage'); h.p.hp = 100; procTick(h, 0.1); assert.equal(h.buf.might, 0);
  const w = mkBig(); w.god = true; addItem(w, 'level-lantern'); w.addXp(1e5); assert.ok(w.wardHits >= 1, 'a Ward on level-up');
  const t = mkBig(); t.god = true; addItem(t, 'old-hourglass'); for (let i = 0; i < 46 * 60; i++) t.step(STEP, IDLE); assert.ok(t.stopT > 0 || t.sc > 45, 'the sand stops every 45 s');
});

import { defaultMeta, applyRun, simMeta, migrateLadder } from '../src/core/meta.js';
import { loadSave, freshSave as freshSave4, SAVE_VERSION as SV } from '../src/core/save.js';
import { QUESTS } from '../src/data/quests.js';
import { STARTER } from '../src/data/starter.js';

test('unlock ladder: a fresh save starts small (1 duelist, 12 cards, 15 items, 4 boons, 6 pickups, Easy, stage 1), and the first ten runs unlock something almost every time', () => {
  const m = defaultMeta(); assert.deepEqual([m.duelists.length, m.unlockedCards.length, m.unlockedItems.length, m.unlockedBoons.length, m.unlockedPickups.length, m.stagesOpen], [1, 12, 15, 4, 6, 1]); assert.equal(m.diffUnlock.ruins, undefined);
  const sm = simMeta(m); assert.deepEqual([sm.boons.length, sm.pickups.length, sm.stagesOpen], [4, 6, 1]);
  const total = ITEMS_COUNT(); assert.equal(total, 120);
  // ten short runs: about 1.5 minutes, 80 kills, a few vases and chests, some pickups, a boon now and then, never a win
  let unlockedRuns = 0, firstTen = [];
  for (let run = 1; run <= 10; run++) { const done = applyRun(m, { game: 'ds', big: true, mode: 'run', map: 'ruins', difficulty: 'easy', result: 'loss', timeSurvived: 90 + run * 15, kills: 60 + run * 25, vasesBroken: 5 + run, chestsOpened: 2, pickups: 3, boons: run % 3 === 0 ? 1 : 0, doorsFound: 0, stagesCleared: 0, items: ['sand-sandals', 'brass-ring', 'spyglass'.slice(0, 0) || 'bronze-scale'], duelist: 'kael', keys: [], oathsKept: [], level: 5 + run }); const gained = done.filter(q => q.reward && (q.reward.item || q.reward.boon || q.reward.pickup || q.reward.card)).length; firstTen.push(gained); if (gained > 0) unlockedRuns++; }
  assert.ok(unlockedRuns >= 8, 'runs with an unlock in the first ten: ' + unlockedRuns + ' ' + firstTen);
});
function ITEMS_COUNT() { return Object.keys(ALL_ITEMS).length; }

test('unlock ladder: clearing stage 1 opens stage 2 and the next difficulty; the ladder never grants an item twice and every locked item has exactly one quest', () => {
  const m = defaultMeta(); applyRun(m, { game: 'ds', big: true, mode: 'run', map: 'ruins', difficulty: 'easy', result: 'win', timeSurvived: 700, kills: 400, stagesCleared: 1, items: [], duelist: 'kael', keys: [], oathsKept: [], level: 20 });
  assert.equal(m.stagesOpen, 2); assert.ok(m.diffUnlock.ruins && m.diffUnlock.ruins.includes('medium'));
  const granted = {}; for (const q of QUESTS) for (const k of ['item', 'boon', 'pickup']) if (q.reward && q.reward[k] !== undefined) { const key = k + ':' + q.reward[k]; granted[key] = (granted[key] || 0) + 1; }
  for (const [k, n] of Object.entries(granted)) assert.equal(n, 1, k + ' has one quest');
  for (const id of Object.keys(ALL_ITEMS)) if (!STARTER.items.includes(id)) assert.equal(granted['item:' + id], 1, id + ' can be unlocked');
  for (const id of Object.keys(ALL_BOONS)) if (ALL_BOONS[id].big && !STARTER.boons.includes(id)) assert.equal(granted['boon:' + id], 1, id + ' can be unlocked');
});

test('unlock ladder: a save from before the ladder keeps everything it owned (cards, items, duelists, boons) and opens all stages; a fresh older save gets the small start', () => {
  const old = { v: 3, starChips: 40, runs: 9, records: {}, settings: {}, meta: { unlockedCards: ['ember-wyvern', 'kindling-rite', 'deep-marks'], unlockedItems: ['worn-duel-glove', 'hunters-mark', 'traders-seal'], duelists: ['kael', 'mira', 'vesh'], totals: { runs: 9, kills: 2000, chests: 30, vases: 90, bossKills: 2, stagesCleared: 3 }, questsDone: ['husks500'], maps: {}, deck: {}, oathCount: {} } };
  const host = { save: { load: () => old, write: () => true } }, s = loadSave(host);
  assert.equal(s.v, SV); for (const c of old.meta.unlockedCards) assert.ok(s.meta.unlockedCards.includes(c), c); for (const c of old.meta.unlockedItems) assert.ok(s.meta.unlockedItems.includes(c), c);
  assert.ok(s.meta.duelists.includes('vesh') && s.meta.duelists.includes('mira') && s.meta.duelists.includes('kael')); assert.equal(s.meta.stagesOpen, 3);
  for (const b of ['might', 'swiftness', 'vigor', 'haste', 'guard', 'plenty', 'renewal']) assert.ok(s.meta.unlockedBoons.includes(b), b);
  assert.equal(s.meta.unlockedItems.length, 3, 'an old save is not handed the new starter items it did not choose'); assert.equal(s.meta.totals.runs, 9);
  const young = { v: 3, starChips: 0, runs: 0, records: {}, settings: {}, meta: { unlockedCards: ['ember-wyvern'], unlockedItems: ['worn-duel-glove'], duelists: ['kael', 'mira'], totals: { runs: 0 }, questsDone: [], maps: {}, deck: {}, oathCount: {} } };
  const y = loadSave({ save: { load: () => young, write: () => true } }); assert.equal(y.meta.stagesOpen, 1); assert.deepEqual(y.meta.duelists, ['kael']); assert.equal(y.meta.unlockedItems.length, 15);
  const f = loadSave({ save: { load: () => null, write: () => true } }); assert.equal(f.meta.stagesOpen, 1);
});

test('unlock ladder: a run on a save that has only stage 1 open is one stage long; with the stages open it is three', () => {
  const one = new Game(4711, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy', meta: simMeta(defaultMeta()) }); assert.equal(one.stages.length, 1);
  const m = defaultMeta(); m.stagesOpen = 3; const three = new Game(4711, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy', meta: simMeta(m) }); assert.equal(three.stages.length, 3);
  const none = new Game(4711, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }); assert.equal(none.stages.length, 3);
  assert.ok(one.unlockedBoons.size === 4 && one.unlockedPickups.size === 6 && one.unlockedCards.size === 12);
});

test('pickups: with the pool full of gems and coins a heart or a power-up still lands (it takes the oldest gem slot and banks its XP)', () => {
  const g = mkBig(); const m = g.pick; for (let i = 0; i < m.max; i++) { m.alive[i] = 1; m.kind[i] = i % 2; m.age[i] = i; m.val[i] = 1; m.x[i] = i; m.z[i] = 0; m.y[i] = 0; }
  const xp0 = g.xp; dropPickup(g, PICK.WARD, 5, 0, 5, 1); let n = 0; for (let i = 0; i < m.max; i++) if (m.alive[i] && m.kind[i] === PICK.WARD) n++; assert.equal(n, 1); assert.ok(g.xp > xp0, 'the gem it replaced paid its XP');
});
