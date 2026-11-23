import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { spawnEnemy } from '../src/sim/enemies.js';
import { damageEnemy } from '../src/sim/combat.js';

// The sim-to-view queue must never lose an event while the view drains once a frame, even when hundreds of enemies die in one tick (Overtime).
test('event queue: 300 kills in one tick lose nothing (300 hit events, 300 kill events, pickups) and the oldest event is still there', () => {
  const g = new Game(11, { mode: 'run', duelist: 'kael', offers: false }); g.god = true; g.drainEvents(() => {}); g.event('banner', 'first'); const slots = [];
  for (let k = 0; k < g.en.max; k++) { spawnEnemy(g, 'husk', { x: g.p.x + (k % 20) * 2, z: g.p.z - 20 - Math.floor(k / 20) * 2 }); slots.push(g.lastSlot); }
  assert.ok(new Set(slots).size >= 290, 'spawned ' + new Set(slots).size);
  for (const i of new Set(slots)) damageEnemy(g, i, 1e9, { elem: 1 });
  const counts = {}; let first = null; g.drainEvents((t, a, b, c, d) => { counts[t] = (counts[t] || 0) + 1; if (first === null) first = [t, d]; });
  assert.equal(g.evDropped, 0, 'nothing dropped'); assert.equal(counts.hit, new Set(slots).size); assert.equal(counts.kill, new Set(slots).size); assert.deepEqual(first, ['banner', 'first']);
});

test('event queue: a harness that never drains is bounded (the oldest are dropped past 65,536 and counted)', () => {
  const g = new Game(3, { mode: 'run', duelist: 'kael', offers: false }); g.drainEvents(() => {}); for (let i = 0; i < 70000; i++) g.emit('sound', i, 0, 0);
  assert.equal(g.evCap, 65536); assert.ok(g.evDropped >= 70000 - 65536); assert.equal(g.evHead - g.evTail, 65536);
  const seen = []; g.drainEvents((t, a) => { if (seen.length < 1) seen.push(a); }); assert.equal(seen[0], g.evDropped, 'the oldest kept event is the first after the dropped ones');
});


test('event queue: the ring grows past its start size without losing or reordering anything', () => {
  const g = new Game(5, { mode: 'run', duelist: 'kael', offers: false }); g.drainEvents(() => {}); for (let i = 0; i < 5000; i++) g.emit('sound', i, 0, 0);
  assert.ok(g.evCap >= 8192 && g.evDropped === 0); let k = 0, ok = true; g.drainEvents((t, a) => { if (a !== k++) ok = false; }); assert.ok(ok && k === 5000);
});

