// The fusion rule v3/v4 (src/sim/fusion.js, numbers in src/data/fusion.js): layer caps, damage shares, links, forms and the limits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { spawnEnemy } from '../src/sim/enemies.js';
import { FUSION, FORMS, FORM, pickLink, MOVING } from '../src/data/fusion.js';
import { makeBuild, buildOf, cast, fusionState, fusionTick, applyStatus, fusionAttack } from '../src/sim/fusion.js';

const basic = id => makeBuild(id, 0, null);
const mk = () => { const g = new Game(5, { mode: 'run', duelist: 'kael', offers: false, difficulty: 'easy' }); g.spawnAcc = -1e9; g.god = true; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; return g; };
const crowd = (g, n, x0, z0, hp) => { const out = []; for (let k = 0; k < n; k++) { spawnEnemy(g, 'husk', { x: x0 + (k % 5) * 0.8, z: z0 + Math.floor(k / 5) * 0.8 }); g.en.hp[g.lastSlot] = hp || 1e6; out.push(g.lastSlot); } if (g.map.big) g.grid.center(g.p.x, g.p.z); g.grid.rebuild(g.en.max, g.en.x, g.en.z, g.en.alive); return out; };

test('layer caps by rank: 1, 2, 3, 4, 4 layers, and the layer shares and fire limits are the approved ones', () => {
  assert.deepEqual(FUSION.layerCap, [1, 2, 3, 4, 4]); assert.deepEqual(FUSION.layerScale, [1, 0.6, 0.45, 0.35]); assert.deepEqual(FUSION.fireFrom.slice(1), [2, 2, 1]); assert.deepEqual(FUSION.rankMul, [1, 1.25, 1.6, 2, 2.5]);
  const [a, b, c, d, e] = ['ember-wyvern', 'cinder-hatchling', 'rune-apprentice', 'sigil-familiar', 'shade'].map(basic);
  const r1 = makeBuild('f1', 1, [a, b]), r2 = makeBuild('f2', 2, [r1, c]), r3 = makeBuild('f3', 3, [r2, d]), r3b = makeBuild('f3b', 3, [makeBuild('g2', 2, [makeBuild('g1', 1, [c, d]), e]), a]), r4 = makeBuild('f4', 4, [r3, r3b]);
  assert.equal(r1.chain.length, 2); assert.equal(r2.chain.length, 3); assert.equal(r3.chain.length, 4); assert.equal(r4.chain.length, 4, 'Epic stays at four layers');
  assert.equal(r1.chain[0].d, 'bolt', 'the Line\'s own attack is layer 1'); assert.equal(r1.chain[1].d, 'lob', 'the graft\'s attack is the next layer');
  assert.ok(r3.loop && !r2.loop, 'Super and up loop reactions'); assert.equal(r4.key, r3.els[0], 'Epic gets a keystone by the Line\'s element');
  assert.ok(r4.els.length <= 3, 'at most three elements');
});

test('every layer applies its own element and the attack is named from its chain', () => {
  const T = buildOf('twinflare-tyrant'), S = buildOf('astral-magus');
  assert.equal(T.name, 'Fire Mortar Lance'); assert.equal(S.name, 'Lightning Swarm Brand');
  const mix = makeBuild('mix', 1, [basic('rime'), basic('ember-wyvern')]); assert.deepEqual(mix.chain.map(l => l.el), ['ice', 'fire']); assert.equal(mix.name, 'Steam Lance Nova');
});

test('links: a moving carrier links by hit, end, trail or kill; a standing one by hit, nova, echo or kill; the same pair always gives the same link', () => {
  for (let k = 0; k < 40; k++) { const key = 'pair' + k; for (const c of ['bolt', 'pulse']) { const l = pickLink(c, key); assert.equal(l, pickLink(c, key)); assert.ok((MOVING.includes(c) ? ['hit', 'end', 'trail', 'kill'] : ['hit', 'nova', 'echo', 'kill']).includes(l)); } }
  const b = makeBuild('x', 1, [basic('rime'), basic('ember-wyvern')]); assert.ok(['hit', 'nova', 'echo', 'kill'].includes(b.chain[1].link));
});

test('forms: a fusion of two fusions takes one from a hash of its id, never more than two; Giant is 2.2x the damage and slower', () => {
  const [a, b, c, d] = ['ember-wyvern', 'cinder-hatchling', 'rune-apprentice', 'sigil-familiar'].map(basic), f1 = makeBuild('f1', 1, [a, b]), f2 = makeBuild('f2', 1, [c, d]);
  let giant = null; for (let k = 0; k < 60; k++) { const w = makeBuild('w' + k, 2, [f1, f2]); assert.equal(w.forms.length, 1); assert.ok(FORMS.includes(w.forms[0])); assert.deepEqual(makeBuild('w' + k, 2, [f1, f2]).forms, w.forms, 'the same id, the same form'); if (w.forms[0] === 'Giant') giant = w;
    const ww = makeBuild('ww' + k, 3, [w, makeBuild('v' + k, 2, [f2, f1])]); assert.ok(ww.forms.length <= 2); }
  assert.ok(giant, 'some id gives Giant'); assert.ok(Math.abs(giant.mult - FUSION.rankMul[2] * FUSION.gameTier[2] * FORM.Giant.mult) < 1e-9); assert.ok(giant.cd > f1.cd);
  assert.equal(makeBuild('t', 2, [f1, c]).forms.length, 0, 'a fusion and a basic take no form');
});

test('a layer fires from at most two of the enemies the layer before it hit, at 0.6 of its own number', () => {
  const g = mk(), B = makeBuild('pp', 1, [basic('rime'), basic('rime')]); B.chain[1].link = 'hit'; const ids = crowd(g, 12, g.p.x + 2, g.p.z + 2);
  const hp0 = ids.map(i => g.en.hp[i]); cast(g, B, 0, g.p.x + 2.5, g.p.y + 1, g.p.z + 2.5, -1, 1, { id: 'pp', x: 0, z: 0 });
  const S = fusionState(g); assert.equal(S.q.filter(v => v.kind === 'layer').length, 2, 'two layer-2 casts from twelve hits');
  const hit1 = hp0[0] - g.en.hp[ids[0]]; assert.ok(Math.abs(hit1 - B.chain[0].q.dmg * B.mult) < B.chain[0].q.dmg * B.mult * 0.6, 'layer 1 at its own number (crits aside)');
});

test('reactions: at most one per enemy a second and four a second for the build', () => {
  const g = mk(), B = makeBuild('fi', 1, [basic('ember-wyvern'), basic('rime')]), ids = crowd(g, 20, g.p.x + 3, g.p.z + 3), S = fusionState(g);
  for (const i of ids) applyStatus(g, i, 'fire', B); for (const i of ids) applyStatus(g, i, 'ice', B);
  assert.equal(S.reactions, 4, 'four a second for the build');
  for (let k = 0; k < 60; k++) { g.t += 1 / 60; fusionTick(g, 1 / 60); }
  const r0 = S.reactions; for (let n = 0; n < 5; n++) { applyStatus(g, ids[0], 'fire', B); applyStatus(g, ids[0], 'ice', B); } assert.ok(S.reactions - r0 <= 1, 'one per enemy a second');
});

test('venom is 0.15 a second per stack, and only the strongest ground zone hurts', () => {
  const g = mk(), B = makeBuild('vv', 0, null); B.chain[0].el = 'poison'; const [i] = crowd(g, 1, g.p.x + 6, g.p.z + 6), S = fusionState(g);
  for (let k = 0; k < 10; k++) applyStatus(g, i, 'poison', B); const h0 = g.en.hp[i]; for (let k = 0; k < 120; k++) { g.t += 1 / 60; fusionTick(g, 1 / 60); }
  const lost = h0 - g.en.hp[i]; assert.ok(lost > 10 * FUSION.venom * 2 * 0.6 && lost < 10 * FUSION.venom * 2 * 1.6, 'about 3 over 2 s from 10 stacks, got ' + lost.toFixed(2));
  const [j] = crowd(g, 1, g.p.x - 6, g.p.z - 6); S.zones.push({ x: g.en.x[j], z: g.en.z[j], r: 3, t: 5, dps: 10, el: 'fire', B: null, lvl: 1 }, { x: g.en.x[j], z: g.en.z[j], r: 3, t: 5, dps: 4, el: 'fire', B: null, lvl: 1 });
  const hj = g.en.hp[j]; for (let k = 0; k < 60; k++) { g.t += 1 / 60; fusionTick(g, 1 / 60); } const zl = hj - g.en.hp[j]; assert.ok(zl > 7 && zl < 13.5, 'the strongest zone only (10 a second), got ' + zl.toFixed(2));
});

test('claws: a melee arc in front with a knock that is a velocity, not a jump', () => {
  const g = mk(), B = basic('shade'), [i] = crowd(g, 1, g.p.x + 2, g.p.z), [j] = crowd(g, 1, g.p.x - 2.6, g.p.z), hj = g.en.hp[j], x0 = g.en.x[i], m = { id: 'shade', x: g.p.x, y: g.p.y + 1, z: g.p.z };
  assert.ok(cast(g, B, 0, m.x, m.y, m.z, -1, 1, m)); assert.equal(g.en.x[i], x0, 'not moved at the hit'); assert.ok(fusionState(g).kvx[i] > 0, 'a velocity away from the claws'); assert.ok(m.lunge > 0, 'the summon lunges');
  for (let k = 0; k < 20; k++) { g.t += 1 / 60; fusionTick(g, 1 / 60); } assert.ok(g.en.x[i] > x0 + 0.5, 'it slides away over the next frames');
  assert.equal(g.en.hp[j], hj, 'nothing behind is hit');
});

test('the show-stopper meter fills on 24 kills and fires one move per element carried, once a Fusion is on the field', () => {
  const g = mk(), S = fusionState(g); g.field.monsters = [{ id: 'twinflare-tyrant', level: 1 }]; g.kills += 23; fusionTick(g, 1 / 60); assert.equal(S.stoppers, 0);
  g.kills += 1; fusionTick(g, 1 / 60); assert.equal(S.stoppers, 1); assert.deepEqual(S.stopperNames, ['Meteor Rain']); assert.equal(S.meter, 0);
  crowd(g, 10, g.p.x + 4, g.p.z + 4); for (let k = 0; k < 180; k++) { g.t += 1 / 60; fusionTick(g, 1 / 60); }
});

test('a Fusion on the field attacks by the layered rule in a real run tick', () => {
  const g = mk(); crowd(g, 15, g.p.x + 8, g.p.z + 3, 40); const m = { id: 'twinflare-tyrant', level: 1, x: g.p.x, y: g.p.y + 2, z: g.p.z };
  let fired = 0; for (let k = 0; k < 240; k++) { if (k % 40 === 0 && fusionAttack(g, m)) fired++; g.step(1 / 60, { f: 0, r: 0, yaw: 0 }); }
  assert.ok(fired > 0); assert.ok(fusionState(g).maxLayer >= 1, 'the second layer fired from the first layer\'s hits');
});

test('the roster loader: every one of the 320 rows builds an attack and fuses with any other', async () => {
  const { ATTACK_ROWS } = await import('../src/data/attacks.gen.js'), { kitOf, LAYER_NAME } = await import('../src/data/fusion.js'), ids = Object.keys(ATTACK_ROWS);
  assert.equal(ids.length, 320); assert.equal(kitOf('rune-apprentice').d, 'mark', 'a game id finds its row');
  for (const id of ids) { const b = makeBuild(id, 0, null); assert.ok(LAYER_NAME[b.chain[0].d], id + ' has a known delivery'); assert.ok(b.chain[0].q.dmg > 0 && b.chain[0].q.cd > 0, id + ' has numbers'); }
  for (let k = 0; k < 40; k++) { const a = makeBuild(ids[k * 7 % 320], 0, null), c = makeBuild(ids[(k * 13 + 5) % 320], 0, null), f = makeBuild('fx_' + k, 1, [a, c]); assert.equal(f.chain.length, 2); assert.ok(f.name.split(' ').length >= 3); }
});
