import test from 'node:test';
import assert from 'node:assert/strict';
import { generateStage } from '../src/gen/generate.js';
import { loadMap, heightAt } from '../src/sim/terrain.js';

// The designed (v2) generator as the game sees it: a heightfield map with a spawn, a gate, boss rings and encounters on walkable ground, the same map for the same seed.
const SEEDS = [1, 2, 3, 777, 4242];
test('v2 stage maps: playable on every stage for five seeds (spawn, gate, rings and every encounter stand on ground, no fallback)', () => {
  for (const seed of SEEDS) for (const stage of [0, 1, 2]) {
    const m = generateStage(seed, stage); assert.ok(m.v2, 'seed ' + seed + ' stage ' + stage + ' is a designed map'); assert.ok(!m.fallback);
    loadMap(m); const tag = ' (seed ' + seed + ' stage ' + stage + ')';
    assert.equal(m.heights.length, 400 * 400); assert.ok(heightAt(m.spawn.x, m.spawn.z) > -0.05 && heightAt(m.spawn.x, m.spawn.z) < 50, 'spawn on ground' + tag);
    assert.ok(heightAt(m.gate.x, m.gate.z) < 50, 'gate on ground' + tag);
    assert.ok(m.bossRings.length >= 5 && m.bossRings.length <= 7, 'rings ' + m.bossRings.length + tag);
    for (const r of m.bossRings) assert.ok(heightAt(r.x, r.z) < 50, 'ring on ground' + tag);
    for (const e of m.encounters) assert.ok(heightAt(e.x, e.z) < 50, e.type + ' on ground' + tag);
    const n = t => m.encounters.filter(e => e.type === t).length; assert.ok(n('cchest') >= 5 && n('stone') >= 1 && n('shrine') >= 2 && n('broker') >= 1, 'the economy kinds are placed' + tag);
  }
});

test('v2 stage maps: the same seed gives the same map, a different seed a different one, and each stage its own', () => {
  const a = generateStage(4242, 0), b = generateStage(4242, 0); assert.equal(a.key, b.key); assert.deepEqual(a.spawn, b.spawn); assert.equal(JSON.stringify(a.encounters), JSON.stringify(b.encounters));
  assert.notEqual(generateStage(4243, 0).key, a.key); assert.notEqual(generateStage(4242, 1).key, a.key);
});

test('v2 stage maps: the world is walled all round, and the heights are metres (cliffs, tiers and pits exist on a real map)', () => {
  const m = generateStage(1, 0); let mx = -1e9, mn = 1e9, walls = 0; for (const h of m.heights) { if (h >= 50) { walls++; continue; } if (h > mx) mx = h; if (h < mn) mn = h; }
  assert.ok(walls > 20000 && mx > 8 && mx < 40 && mn > -10, 'walls ' + walls + ' tallest ' + mx + ' lowest ' + mn);
  loadMap(m); assert.equal(heightAt(-199.5, -199.5), 99);
});
