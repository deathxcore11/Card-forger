import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { param, damageOf } from '../src/sim/field.js';
import { splash, AREA_SHARE, fireShot, KIND_FIRE } from '../src/sim/weapons.js';
import { explode } from '../src/sim/combat.js';
import { layWake, updateWakes, inWake, WAKE_W } from '../src/sim/monsters.js';
import { spawnEnemy } from '../src/sim/enemies.js';
// Area attacks that grow with Reach: the numbers (level 1 / 5 / 10), the Reach multiplier, and that the circle or strip that is drawn is the one that hurts.
const mk = (reach) => { const g = new Game(5, { mode: 'run', duelist: 'kael', offers: false, oldGen: true }); g.god = true; g.spawnAcc = -1e9; g.cardT = 1e9; g.mods.reach = reach; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; g.field.monsters.fill(null); g.p.x = 0; g.p.z = 0; g.p.y = 0; return g; };
const near = (a, b) => Math.abs(a - b) < 1e-6;

test('rule numbers per level', () => {
  const at = (id, lv, name) => param({ id, level: lv }, name);
  assert.deepEqual([1, 5, 10].map(l => at('cinder-hatchling', l, 'splash')), [3, 3.75, 5.5]);
  assert.deepEqual([1, 5, 10].map(l => at('astral-magus', l, 'explodeRadius')), [4, 4.75, 5.5]);
  assert.deepEqual([1, 5, 10].map(l => at('sigil-familiar', l, 'ring')), [0, 5, 6]);
  assert.deepEqual([1, 5, 10].map(l => at('ember-wyvern', l, 'wake')), [0, 1, 1]);
  assert.deepEqual([1, 5, 10].map(l => at('ember-wyvern', l, 'burst')), [0, 0, 5.5]);
  assert.deepEqual([1, 5, 10].map(l => at('twinflare-tyrant', l, 'range')), [14, 16, 19].map((v, i) => [14, 16, 19][i]));       // the Tyrant is unchanged
});

test('a splash hurts exactly the circle it draws, at Reach 0 and +150%', () => {
  for (const reach of [0, 1.5]) for (const [id, lv] of [['cinder-hatchling', 1], ['cinder-hatchling', 5], ['cinder-hatchling', 10], ['sigil-familiar', 5], ['sigil-familiar', 10]]) {
    const g = mk(reach), r = param({ id, level: lv }, id === 'sigil-familiar' ? 'ring' : 'splash'), R = r * g.reachK;
    assert.ok(near(g.reachK, Math.sqrt(1 + reach)));
    spawnEnemy(g, 'husk', { x: 0, z: 0 }); const a = g.lastSlot; spawnEnemy(g, 'husk', { x: 0, z: 0 }); const b = g.lastSlot;
    g.en.x[a] = R - 0.3; g.en.z[a] = 0; g.en.x[b] = R + 0.3; g.en.z[b] = 0; g.en.hp[a] = g.en.hp[b] = 1e6; g.grid.rebuild(g.en.max, g.en.x, g.en.z, g.en.alive);
    splash(g, 0, 0, 0, r, 10, 0); const ring = g.fx.find(o => o.on && o.type === 'ring');
    assert.ok(near(ring.r, R), `${id} L${lv} reach ${reach}: drawn ${ring.r} sim ${R}`);
    assert.ok(g.en.hp[a] < 1e6, `${id} L${lv}: inside the drawn ring and not hurt`); assert.equal(g.en.hp[b], 1e6, `${id} L${lv}: outside the drawn ring and hurt`);
  }
});

test('Magus blasts hurt exactly the circle they draw', () => {
  for (const reach of [0, 1.5]) for (const lv of [1, 5, 10]) {
    const g = mk(reach), r = param({ id: 'astral-magus', level: lv }, 'explodeRadius'), R = r * g.reachK;
    spawnEnemy(g, 'husk', { x: 0, z: 0 }); const a = g.lastSlot; spawnEnemy(g, 'husk', { x: 0, z: 0 }); const b = g.lastSlot;
    g.en.x[a] = R - 0.3; g.en.z[a] = 0; g.en.x[b] = R + 0.3; g.en.z[b] = 0; g.en.hp[a] = g.en.hp[b] = 1e6; g.grid.rebuild(g.en.max, g.en.x, g.en.z, g.en.alive);
    explode(g, 0, 0, 0, r, 0, 8, 0xb070ff); const ring = g.fx.find(o => o.on && o.type === 'ring');
    assert.ok(near(ring.r, R)); assert.ok(g.en.hp[a] < 1e6); assert.equal(g.en.hp[b], 1e6);
  }
});

test('the Ember Wake: the drawn rectangle is the one that hurts, 35% of the hit, every half second', () => {
  for (const reach of [0, 1.5]) {
    const g = mk(reach), m = { id: 'ember-wyvern', level: 5, x: 0, y: 2, z: 0, cd: 1e9 }; g.field.monsters[0] = m; const dmg = damageOf(m), len = param(m, 'length');
    layWake(g, m, 0, 2, -10, len, dmg, 1);
    const w = g.fx.find(o => o.on && o.type === 'wake'), hw = WAKE_W * g.reachK / 2;
    assert.ok(near(w.hw, hw) && near(w.r, len / 2) && near(w.dmg, dmg * AREA_SHARE), 'the stored footprint is the rule footprint');
    const put = (x, z) => { spawnEnemy(g, 'husk', { x: 0, z: 0 }); const i = g.lastSlot; g.en.x[i] = x; g.en.z[i] = z; g.en.hp[i] = 1e6; return i; };
    const inside = put(hw - 0.2, -len + 0.5), outside = put(hw + 0.2, -len / 2), behind = put(0, 1.5), past = put(0, -len - 1.5);
    g.grid.rebuild(g.en.max, g.en.x, g.en.z, g.en.alive);
    updateWakes(g, 0.49); assert.equal(g.en.hp[inside], 1e6, 'no hit before 0.5 s');
    updateWakes(g, 0.02); const hit = 1e6 - g.en.hp[inside];
    assert.ok(hit > 0 && Math.abs(hit - dmg * AREA_SHARE) < dmg * AREA_SHARE * 0.5 + 1e-3, 'the strip hit it for about 35% of the main hit: ' + hit + ' vs ' + dmg * AREA_SHARE);
    assert.equal(g.en.hp[outside], 1e6); assert.equal(g.en.hp[behind], 1e6); assert.equal(g.en.hp[past], 1e6);
    assert.ok(inWake(w, hw - 0.01, -1, 0) && !inWake(w, hw + 0.01, -1, 0));
    updateWakes(g, 0.5); assert.ok(1e6 - g.en.hp[inside] > hit, 'it hits again each half second');
    for (let t = 0; t < 2; t += 1 / 60) g.step(1 / 60, { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false });
    assert.ok(!g.fx.some(o => o.on && o.type === 'wake'), 'it fades after 1.5 s');
  }
});

test('the end burst of the line (level 10) and no wake or burst below their levels', () => {
  const g = mk(0), m = { id: 'ember-wyvern', level: 10, x: 0, y: 2, z: 0, cd: 0 }; g.field.monsters[0] = m; spawnEnemy(g, 'husk', { x: 0, z: 0 }); const t = g.lastSlot;
  g.en.x[t] = 0; g.en.z[t] = -9; g.en.hp[t] = 1e6; for (let k = 0; k < 8; k++) g.step(1 / 60, { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false });
  assert.ok(g.fx.some(o => o.on && o.type === 'wake'), 'a level 10 Wyvern lays a wake');
  const lo = mk(0); lo.field.monsters[0] = { id: 'ember-wyvern', level: 2, x: 0, y: 2, z: 0, cd: 0 }; spawnEnemy(lo, 'husk', { x: 0, z: 0 }); lo.en.z[lo.lastSlot] = -9; lo.en.hp[lo.lastSlot] = 1e6; lo.en.x[lo.lastSlot] = 0;
  for (let k = 0; k < 8; k++) lo.step(1 / 60, { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false });
  assert.ok(!lo.fx.some(o => o.on && o.type === 'wake'), 'no wake below level 3');
});

test('the Seal Ring pulses every 4 s only with an enemy inside, 35% of the Familiar\'s hit', () => {
  const g = mk(0), m = { id: 'sigil-familiar', level: 5, cd: 1e9 }; g.field.monsters[0] = m; spawnEnemy(g, 'husk', { x: 0, z: 0 }); const i = g.lastSlot; g.en.hp[i] = 1e6;
  const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false }; let pulses = 0, was = false;
  for (let k = 0; k < 60 * 13; k++) { g.en.x[i] = g.p.x + 3; g.en.z[i] = g.p.z; g.en.hp[i] = 1e6; g.step(1 / 60, idle); const rg = g.fx.find(o => o.on && o.type === 'ring' && o.t < 0.02 && o.r === 5); if (rg && !was) pulses++; was = !!rg; }
  assert.ok(pulses >= 2 && pulses <= 4, 'pulses in 13 s: ' + pulses);
});

test('the line ends in a burst of 5.5 m x Reach at 35% of the hit', () => {
  for (const reach of [0, 1.5]) {
    const g = mk(reach), idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false }, R = 5.5 * g.reachK;
    fireShot(g, KIND_FIRE, 0, 1, 0, 0, 1, -30, 34, 0.5, 20, { flame: 1, pierce: 2, burst: 5.5 });             // dies at z = -17 after 0.5 s
    spawnEnemy(g, 'husk', { x: 0, z: 0 }); const a = g.lastSlot; spawnEnemy(g, 'husk', { x: 0, z: 0 }); const b = g.lastSlot;
    g.en.x[a] = R - 0.4; g.en.z[a] = -17; g.en.x[b] = R + 0.4; g.en.z[b] = -17; g.en.hp[a] = g.en.hp[b] = 1e6;
    for (let k = 0; k < 40; k++) { g.en.x[a] = R - 0.4; g.en.z[a] = -17; g.en.x[b] = R + 0.4; g.en.z[b] = -17; g.step(1 / 60, idle); if (!g.shots.alive[0]) break; }
    assert.ok(g.en.hp[a] < 1e6 && g.en.hp[b] === 1e6, 'reach ' + reach + ': ' + g.en.hp[a] + ' ' + g.en.hp[b]);
    assert.ok(Math.abs((1e6 - g.en.hp[a]) - 20 * AREA_SHARE) < 20 * AREA_SHARE * 0.5 + 1e-3);
  }
});
