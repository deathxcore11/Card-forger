// The seeded stage generator: determinism, variety, fairness (reachability, enemy coverage, rings), purity and speed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { generateStage as generateStageAny, analyze } from '../src/gen/generate.js';
const generateStage = (s, i, sp) => generateStageAny(s, i, Object.assign({ old: true }, sp));       // these tests guard the OLD generator (the last-resort fallback); the designed one has its own tests in stagemap.test.js and gen2.test.js
import { STAGES } from '../src/data/stages.js';
import { sealCodeFrom, sealCodeParse, stageSeed, rngFor } from '../src/gen/seed.js';
import { Game } from '../src/sim/game.js';
import { heightAt } from '../src/sim/terrain.js';

const SEEDS = Array.from({ length: 40 }, (_, i) => 1000 + i * 37);

test('src/gen is pure: no platform maths, no clocks, no randomness', () => {
  const banned = /\bMath\.(random|sin|cos|tan|atan|atan2|pow|exp|log|log2|log10|sqrt|hypot|cbrt)\b|\bDate\b|\bperformance\b|\bsetTimeout\b|\blocalStorage\b|\bwindow\b|\bdocument\b/;
  const walk = d => readdirSync(new URL('../src/gen/' + d, import.meta.url), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(d + e.name + '/') : [d + e.name]);
  for (const f of walk('')) {
    if (f === 'v2/reach.js') continue;       // the movement table is built once at load from IEEE square roots only (correctly rounded everywhere); it is checked against fixed rows in gen2.test.js
    const src = readFileSync(new URL('../src/gen/' + f, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''");
    assert.ok(!banned.test(src), f + ' uses ' + (src.match(banned) || [])[0]);
  }
});

test('Seal Code: 8 characters, round trips, and one seed gives one map', () => {
  const c = sealCodeFrom(123456789, 7); assert.equal(c.length, 8); assert.match(c, /^[0-9A-HJKMNP-TV-Z]{8}$/); assert.deepEqual(sealCodeParse(c), { lo: 123456789, hi: 7 });
  const a = generateStage(77, 0), b = generateStage(77, 0); assert.equal(a.hash, b.hash); assert.equal(a.sealCode, b.sealCode); assert.equal(JSON.stringify(a.encounters), JSON.stringify(b.encounters));
  assert.notEqual(generateStage(77, 1).hash, a.hash, 'each stage has its own map');
  assert.notEqual(rngFor(5, 'terrain').next32(), rngFor(5, 'encounters').next32(), 'steps use their own streams');
});

test('variety: a different seed gives a different map almost every time', () => {
  const hashes = new Set(SEEDS.map(s => generateStage(s, 0).hash)); assert.ok(hashes.size >= SEEDS.length - 1, hashes.size + ' distinct of ' + SEEDS.length);
  const kitSets = new Set(SEEDS.map(s => (generateStage(s, 0).report.kits || ['fallback']).join(','))); assert.ok(kitSets.size >= 20, 'kit mixes ' + kitSets.size);
});

test('every generated map is fair: spawn on ground, gate, rings and every encounter reachable, swarm coverage, no fallback', () => {
  let fallbacks = 0;
  for (const stage of [0, 1, 2]) for (const seed of SEEDS.slice(0, 20)) {
    const m = generateStage(seed, stage, STAGES[stage].gen); if (m.fallback) { fallbacks++; continue; }
    const A = analyze(m), at = (x, z) => A.idx(A.ci(x), A.ci(z));
    assert.equal(A.grid[at(m.spawn.x, m.spawn.z)], 0, 'spawn on flat ground');
    assert.ok(A.ed[at(m.gate.x, m.gate.z)] >= 0, 'the swarm can reach the gate (seed ' + seed + ')'); assert.ok(A.pd[at(m.gate.x, m.gate.z)] >= 0);
    assert.ok(m.bossRings.length >= 5 && m.bossRings.length <= 7, 'boss rings ' + m.bossRings.length);
    for (const r of m.bossRings) { assert.ok(A.ed[at(r.x, r.z)] >= 0 && A.pd[at(r.x, r.z)] >= 0, 'ring reachable'); }
    for (const e of m.encounters) assert.ok(A.pd[at(e.x, e.z)] >= 0, e.type + ' at ' + e.x + ',' + e.z + ' is reachable with run and jump only (seed ' + seed + ' stage ' + stage + ')');
    const need = STAGES[stage].gen.counts, got = t => m.encounters.filter(e => e.type === t).length;
    assert.ok(got('cchest') >= need.cchest - 2 && got('broker') === 1 && got('altar') === 1 && got('stone') >= 1 && got('shrine') >= 2, 'encounter counts');
    const nearSpawn = m.encounters.filter(e => e.type === 'cchest' && (e.x - m.spawn.x) ** 2 + (e.z - m.spawn.z) ** 2 < 3600).length; assert.ok(nearSpawn <= 2, 'at most 2 Card Chests within 60 m of spawn');
    assert.ok(m.report.metrics.groundCover.value >= 0.9 && m.report.metrics.spawnSpace.value >= 0.4);
    assert.equal(m.encounters.filter(e => e.type === 'stone' && A.ed[at(e.x, e.z)] >= 0 && A.ed[at(e.x, e.z)] <= 90).length <= 1, true, 'opening region');
  }
  assert.ok(fallbacks <= 3, 'fallback rate ' + fallbacks + ' of 60');
});

test('generation is fast: median under 150 ms on this machine', () => {
  const ms = SEEDS.slice(0, 15).map(s => { const t = Date.now(); generateStage(s, 0); return Date.now() - t; }).sort((a, b) => a - b); assert.ok(ms[7] < 150, 'median ' + ms[7] + ' ms');
});

test('the sim plays on a generated map: the stage machine loads it, the duelist starts on the plaza, the gate is where the map says', () => {
  const g = new Game(9, { mode: 'run', offers: false }); assert.ok(g.map.key !== 'classic'); assert.equal(g.p.x, g.map.spawn.x); assert.equal(heightAt(g.p.x, g.p.z), 0);
  assert.ok(g.sealCode && g.sealCode.length === 8); const h0 = g.map.hash;
  const c = new Game(9, { mode: 'classic', offers: false }); assert.equal(c.map.key, 'classic', 'classic keeps the fixed map'); assert.equal(heightAt(0, -57), 4, 'terrain reloaded for the classic map');
  g.tick({ mx: 0, mz: 0, yaw: 0, buttons: 0, menu: 0 }); assert.equal(g.map.hash, h0); assert.ok(heightAt(g.map.gate.x, g.map.gate.z) >= 0);
});



