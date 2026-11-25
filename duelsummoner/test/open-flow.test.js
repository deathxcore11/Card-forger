import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { heightAt } from '../src/sim/terrain.js';
import { damageSpecial } from '../src/sim/specials.js';

const STEP = 1 / 60, IDLE = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false, hold: false };
const mk = () => { const g = new Game(11, { mode: 'run', duelist: 'kael', offers: false, terrain: 'small', arch: 'a', difficulty: 'easy' }); g.god = true; g.events = []; const ev = g.event.bind(g); g.event = (t, d) => { g.events.push([t, d]); return ev(t, d); }; return g; };
const run = (g, secs, cmd = IDLE) => { for (let i = 0; i < secs * 60 && !g.over; i++) { Object.assign(g._cmd, cmd); g._tick(STEP, g._cmd); } };
const at = (g, x, z) => { g.p.x = x; g.p.z = z; g.p.y = heightAt(x, z); g.p.vx = g.p.vz = g.p.vy = 0; };
const banners = g => g.events.filter(e => e[0] === 'banner').map(e => e[1]);

test('open flow: the gate wakes by choice at 0:30 (hold use 1.5 s in its ring), the stage boss comes only then, with the name card', () => {
  const g = mk(); assert.equal(g.openFlow, true); run(g, 30);
  assert.ok(g.sc >= 29 && g.sc <= 31); assert.equal(g.gate.state, 'closed'); assert.ok(!g.sp.some(s => s.role === 'gate'), 'no stage boss before the gate is woken');
  at(g, g.map.gate.x + 1, g.map.gate.z); run(g, 1.0, Object.assign({}, IDLE, { use: true })); assert.equal(g.gate.state, 'closed', 'not yet: 1.0 s is under the hold');
  run(g, 0.8, Object.assign({}, IDLE, { use: true })); assert.equal(g.gate.state, 'fight'); const boss = g.sp.find(s => s.role === 'gate'); assert.ok(boss && boss.alive, 'the stage boss stands');
  assert.ok(Math.hypot(boss.x - g.map.gate.x, boss.z - g.map.gate.z) < 15, 'beside the gate'); assert.ok(g.events.some(e => e[0] === 'bosscard' && e[1] === g.stageSpec.gate.name), 'the large name card for the stage boss');
  assert.ok(!g.events.some(e => e[0] === 'bosscard' && e[1] !== g.stageSpec.gate.name), 'no other name cards');
});

test('open flow: no timed arrivals; the elite and the two mini bosses stand asleep at their own spots, far from the start and from each other', () => {
  const g = mk(); run(g, 8 * 60);
  assert.ok(!g.horde.on || g.horde.why === 'clock', 'only the clock can start the horde'); const sleepers = g.sp.filter(s => s.role && s.role !== 'gate');
  assert.equal(sleepers.filter(s => s.alive).length >= 3, true); for (const s of sleepers) assert.ok(s.asleep, s.name + ' still asleep after 8 minutes'); assert.ok(!g.sp.some(s => s.role === 'gate'));
  assert.ok(!banners(g).some(t => /approaches|in 5 seconds|hunt you/.test(t)), 'no arrival banners: ' + banners(g).filter(t => /approaches|in 5 seconds|hunt you/.test(t)));
  const m = g.map.sleepers, d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z); assert.equal(m.length, 3);
  for (const s of m) { assert.ok(d(s, g.map.spawn) >= 100 && d(s, g.map.gate) >= 100, s.role + ' far from the start and the gate'); }
  assert.ok(d(m[0], m[1]) >= 70 && d(m[1], m[2]) >= 70 && d(m[0], m[2]) >= 70, 'far from each other');
});

test('open flow: a sleeper wakes within 18 m or when hit, and its health is set from the stage clock at that moment', () => {
  const g = mk(); run(g, 5); const [a, b] = [g.sp.find(s => s.role === 'elite'), g.sp.find(s => s.role === 'bossA')];
  at(g, a.x + 19, a.z); run(g, 0.5); assert.ok(a.asleep, '19 m: still asleep'); at(g, a.x + 17, a.z); run(g, 0.2); assert.ok(!a.asleep, '17 m: awake'); assert.ok(banners(g).some(t => /wakes/.test(t)));
  assert.ok(b.asleep); at(g, b.x + 60, b.z); g.sc = 300; run(g, 0.1); const before = b.hpBase; damageSpecial(g, b, 1, g.p.x, g.p.z, { area: true }); assert.ok(!b.asleep, 'a hit wakes it'); assert.ok(Math.abs(b.maxHp - before * g.hpMul) / b.maxHp < 0.05, 'health from the clock at the moment it woke');
});

test('open flow: the stage boss falls, the end-stage horde rises from all sides and is stronger, the gateway opens and stays open', () => {
  const g = mk(); run(g, 20); at(g, g.map.gate.x + 1, g.map.gate.z); run(g, 2, Object.assign({}, IDLE, { use: true })); const boss = g.sp.find(s => s.role === 'gate'); assert.ok(boss);
  const mulBefore = g.hpMul; damageSpecial(g, boss, 1e9, g.p.x, g.p.z, { area: true }); run(g, 0.2); assert.equal(g.gate.state, 'done'); assert.ok(g.circle, 'the gateway is open'); assert.ok(g.horde.on && g.horde.why === 'boss');
  const sp0 = g.spawned; run(g, 30); assert.ok(g.circle && g.circle.t > 1e6, 'the gateway stays open'); assert.ok(g.hpMul > mulBefore * 1.4, 'clearly stronger: ' + g.hpMul + ' vs ' + mulBefore); assert.ok(g.spawned - sp0 >= 40, 'the horde keeps coming: ' + (g.spawned - sp0));
  // it keeps rising
  const hm1 = g.hpMul, rate1 = g.spawned; run(g, 120); assert.ok(g.hpMul > hm1, 'rising'); assert.ok(g.spawned - rate1 >= 100, 'endless');
  // and the gateway can be taken at any time
  at(g, g.circle.x, g.circle.z); run(g, 0.3); assert.ok(g.desc, 'stepping through starts the descent');
});

test('open flow: if the clock runs out before the gate is woken, the horde starts anyway and keeps rising until the boss is beaten', () => {
  const g = mk(); run(g, g.stageSpec.clock - 5); assert.ok(!g.horde.on); run(g, 12); assert.ok(g.horde.on && g.horde.why === 'clock', 'the clock-out horde'); assert.equal(g.gate.state, 'closed'); assert.ok(!g.sp.some(s => s.role === 'gate'), 'no forced boss, no toll bell');
  const hm = g.hpMul; run(g, 90); assert.ok(g.hpMul > hm, 'still rising'); assert.ok(g.shades.length === 0, 'no toll shades'); at(g, g.map.gate.x + 1, g.map.gate.z); run(g, 2, Object.assign({}, IDLE, { use: true })); assert.equal(g.gate.state, 'fight', 'the gate can still be woken during the horde');
});

test('old flow is untouched: the timed elite is announced, the toll bell rings at the clock', () => {
  const g = new Game(11, { mode: 'run', duelist: 'kael', offers: false, difficulty: 'easy' }); g.god = true; assert.ok(!g.openFlow); for (let i = 0; i < 110 * 60; i++) g._tick(STEP, IDLE); assert.ok(g.evState[0] >= 1, 'the Grave Herald is announced on the clock');
});
