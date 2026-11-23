import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openMap, ARCHETYPES, LINE, groundAt, blockProf } from '../src/gen/open/terrain.js';
import { Game } from '../src/sim/game.js';
import { scatterStage } from '../src/gen/scatter.js';
import { loadMap, heightAt, camGround, moveXZ } from '../src/sim/terrain.js';
import { buildColliders } from '../src/sim/colliders.js';
import { newBot, botRecord } from '../tools/bot.mjs';

const HALF = 200, SIM = 400;
const slopes = m => { const H = m.heights, out = []; for (let j = 40; j < 360; j++) for (let i = 40; i < 360; i++) { const sx = (H[j * SIM + i + 1] - H[j * SIM + i - 1]) / 2, sz = (H[(j + 1) * SIM + i] - H[(j - 1) * SIM + i]) / 2; out.push(Math.atan(Math.sqrt(sx * sx + sz * sz)) * 57.2958); } return out.sort((a, b) => a - b); };

test('open desert: every dune style makes a rolling sand sheet that is mostly open, fully reachable, never flat for 25 m, with 2 to 4 mesas and the rewards the game needs', () => {
  for (const a of ARCHETYPES) for (const seed of [1, 2, 3]) {
    const m = openMap(seed * 7919, 0, a); assert.ok(m, a + ' ' + seed); assert.equal(m.arch, a);
    assert.ok(m.report.openFrac >= 0.55, a + ' open ground ' + m.report.openFrac); assert.ok(m.report.walkFrac >= 0.97, a + ' reachable ' + m.report.walkFrac);
    assert.ok(m.report.flatShare <= 0.04, a + ' flat patches ' + m.report.flatShare);
    const sl = slopes(m), q = p => sl[Math.floor(p * sl.length)];
    assert.ok(q(0.5) >= 5 && q(0.5) <= 15, a + ' median slope ' + q(0.5)); assert.ok(q(0.9) <= 30, a + ' p90 slope ' + q(0.9)); assert.ok(sl.filter(v => v < 15).length / sl.length >= 0.55, a + ' under 15 degrees');
    const mesas = m.blocks.filter(b => b.tone > 0 && b.rz >= 6 && b.h >= 6.9 && b.h <= 10.1), walls = m.blocks.filter(b => b.h >= 9.9 && b.rz < 6 && b.tone > 0), ruins = m.blocks.filter(b => b.tone === 0); for (const r of ruins) assert.ok(r.h >= 5.9 && r.h <= 9.1, 'ruin block height ' + r.h);
    assert.ok(mesas.length >= 2 && mesas.length <= 4, a + ' mesas ' + mesas.length); assert.ok(m.dune.big.length >= 2 && m.dune.big.length <= 3 && m.dune.big.every(d => d.H >= 14 && d.H <= 18), a + ' big dunes');
    // the start: the ground within 30 m spans 3 m, the gate and a landmark are within 40 degrees of the opening heading, and the skyline rises and falls
    { const fx = -Math.sin(m.startYaw), fz = -Math.cos(m.startYaw), cosd = (x, z) => ((x - m.spawn.x) * fx + (z - m.spawn.z) * fz) / Math.hypot(x - m.spawn.x, z - m.spawn.z); assert.ok(cosd(m.gate.x, m.gate.z) >= 0.766, a + ' gate in the opening view'); const lms = m.blocks.filter(b => b.tone > 0).map(b => [b.cx, b.cz]).concat(m.dress.heads.map(h => [h.x, h.z])); assert.ok(lms.some(l => { const d = Math.hypot(l[0] - m.spawn.x, l[1] - m.spawn.z); return d >= 35 && d <= 130 && cosd(l[0], l[1]) >= 0.766; }), a + ' a landmark in the opening view');
      let lo = 1e9, hi = -1e9; for (const r of [30, 18]) for (let t = 0; t < 12; t++) { const h = groundAt(m, m.spawn.x + Math.cos(t * 0.5236) * r, m.spawn.z + Math.sin(t * 0.5236) * r); lo = Math.min(lo, h); hi = Math.max(hi, h); } assert.ok(hi - lo >= 3, a + ' relief at the start ' + (hi - lo));
      const y0 = groundAt(m, m.spawn.x, m.spawn.z) + 4; let tl = 9, th = -9; for (let k = -8; k <= 8; k++) { const ang = m.startYaw + k * 0.098; let e = -9; for (let d = 6; d <= 400; d += 4) e = Math.max(e, (groundAt(m, m.spawn.x - Math.sin(ang) * d, m.spawn.z - Math.cos(ang) * d) - y0) / d); tl = Math.min(tl, e); th = Math.max(th, e); } assert.ok(th - tl >= 0.07, a + ' skyline varies ' + (th - tl)); } assert.ok(walls.length >= 1 && walls.length <= 2, a + ' tall walls ' + walls.length); assert.ok(ruins.length >= 6, a + ' ruin blocks ' + ruins.length);
    assert.ok(Math.hypot(m.spawn.x - m.gate.x, m.spawn.z - m.gate.z) >= 180, 'spawn and gate are far apart');
    const by = t => m.encounters.filter(e => e.type === t).length; assert.ok(by('cchest') >= 4 && by('shrine') >= 1 && by('altar') >= 1 && by('stone') >= 1 && by('broker') === 1, a + ' rewards');
    assert.ok(m.encounters.some(e => e.free), 'a free chest near the start'); assert.ok(m.bossRings.length >= 1);
    // rewards stand on open sand beside a block (never on a block), far apart
    const rw = m.encounters.filter(e => !e.free && e.type !== 'broker'); let beside = 0;
    for (const e of rw) { for (const b of m.blocks) assert.ok(blockProf(b, e.x, e.z) === 0, 'a reward on a block'); if (m.blocks.some(b => Math.hypot(b.cx - e.x, b.cz - e.z) < Math.max(b.rx, b.rz) * 1.25 + 8)) beside++; }
    assert.ok(beside >= Math.floor(rw.length * 0.4), a + ' beside blocks ' + beside + ' of ' + rw.length);
    for (let i = 0; i < rw.length; i++) for (let j = i + 1; j < rw.length; j++) assert.ok(Math.hypot(rw[i].x - rw[j].x, rw[i].z - rw[j].z) >= 50, 'rewards far apart');
    // the line: the cells beyond it are wall for the sim, the square inside is sand
    for (let k = 0; k < SIM; k++) assert.equal(m.heights[k], 99, 'outside the square is wall');
    assert.ok(m.heights[(HALF) * SIM + HALF + 177] < 50 && m.heights[(HALF) * SIM + HALF + 179] >= 99, 'wall begins at the line');
    // dressing: 2 to 3 monuments, plenty of cacti, dead trees, logs and pots; far dressing beyond the line
    assert.ok(m.dress.heads.length >= 2 && m.dress.heads.length <= 3, 'monuments'); assert.ok(m.dress.cacti.length >= 50 && m.dress.dead.length >= 20 && m.dress.logs.length >= 80 && m.dress.pots.length >= 20, a + ' dressing');
    assert.ok(m.far.rocks.length >= 30 && m.far.dead.length >= 30 && m.far.ruins.length >= 10, 'far dressing'); for (const r of m.far.rocks) assert.ok(Math.abs(r[0]) > 190 || Math.abs(r[2]) > 190, 'far rock past the line');
    // at least 60 percent of the ground is open for packs: nothing solid or steep there
    const sol = m.solid.length; assert.ok(sol < 200, 'few solid pieces ' + sol);
  }
});
test('open desert: the same seed gives the same ground, different seeds differ in dunes, rocks and where things stand, and it only loads behind the option', () => {
  const a = openMap(12345, 0, 'e'), b = openMap(12345, 0, 'e'), c = openMap(54321, 0, 'e');
  assert.deepEqual(Array.from(a.heights), Array.from(b.heights)); assert.notDeepEqual(Array.from(a.heights), Array.from(c.heights)); assert.deepEqual(a.dress, b.dress); assert.notDeepEqual(a.dress.cacti, c.dress.cacti); assert.notDeepEqual(a.spawn, c.spawn);
  const tones = new Set(); for (let s = 1; s <= 12; s++) for (const bl of openMap(s * 101, 0, 'a').blocks) tones.add(bl.tone); assert.ok(tones.has(1) && tones.has(2), 'both rock styles appear across seeds');
  const g = new Game(5, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', arch: 'b' }); assert.equal(g.map.open, true); assert.equal(g.map.arch, 'b');
  const n = new Game(5, { mode: 'run', duelist: 'kael', offers: false }); assert.ok(!n.map.open);
});
test('open desert: no trees or boulders of the other stages, the dressing is solid only where it should be, and the camera reads real sand past the line', () => {
  const m = openMap(777, 0, 'a'); loadMap(m); const S = scatterStage(m, 0, true); assert.equal([].concat(...S.trees).length, 0); assert.equal([].concat(...S.rocks).length, 0);
  assert.equal(m.kits.length, 0); assert.equal((m.props || []).length, 0);
  const col = buildColliders(m, 0); assert.equal(col.list.length, m.solid.length);
  assert.ok(heightAt(0, LINE + 3) >= 99 && heightAt(LINE + 3, 0) >= 99, 'the sim sees wall past the line');
  for (const [x, z] of [[0, LINE + 5], [LINE + 40, 0], [-LINE - 120, LINE + 60], [LINE + 200, LINE + 200]]) { const h = camGround(x, z); assert.ok(h < 30 && h > -15, 'camera ground ' + h); }
  assert.ok(Math.abs(groundAt(m, 176.9, 10) - groundAt(m, 177.1, 10)) < 0.5, 'no step at the seam');
});
test('open desert: the duelist stops softly at the line (no bounce), and no enemy or pickup is ever past it', () => {
  const m = openMap(4242, 0, 'c'); loadMap(m); const o = { x: 100, y: heightAt(100, 0), z: 0 };
  for (let k = 0; k < 400; k++) { moveXZ(o, 0.5, 0, 0.6, 1.2); } assert.ok(o.x <= LINE && o.x > LINE - 1.2, 'stopped at the line ' + o.x);
  const x0 = o.x; for (let k = 0; k < 50; k++) moveXZ(o, 0.5, 0, 0.6, 1.2); assert.equal(o.x, x0, 'no creep or bounce');
  const g = new Game(9, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', arch: 'a', difficulty: 'easy' }), bot = newBot({ focus: true }); g.god = true;
  g.p.x = 170; g.p.z = 170; g.p.y = heightAt(170, 170);
  for (let i = 0; i < 60 * 90 && !g.over; i++) {
    g.tick(botRecord(g, bot));
    if (i % 30 === 0) { for (let e = 0; e < g.en.max; e++) if (g.en.alive[e]) assert.ok(Math.abs(g.en.x[e]) <= LINE + 0.01 && Math.abs(g.en.z[e]) <= LINE + 0.01, 'an enemy past the line at tick ' + i); for (let k = 0; k < g.pick.max; k++) if (g.pick.alive[k]) assert.ok(Math.abs(g.pick.x[k]) <= LINE + 0.01 && Math.abs(g.pick.z[k]) <= LINE + 0.01, 'a pickup past the line'); assert.ok(Math.abs(g.p.x) <= LINE && Math.abs(g.p.z) <= LINE, 'the duelist past the line'); }
  }
});
