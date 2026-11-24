import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openMap, ARCHETYPES, EDGE_R, groundAt, blockProf, footY, duneH, viewH, MAX_DROP } from '../src/gen/open/terrain.js';
import { Game } from '../src/sim/game.js';
import { scatterStage } from '../src/gen/scatter.js';
import { loadMap, heightAt, camGround, moveXZ } from '../src/sim/terrain.js';
import { buildColliders } from '../src/sim/colliders.js';
import { newBot, botRecord } from '../tools/bot.mjs';
import { MAP } from '../src/data/map.js';

const SIM = 840, HALF = 420;
// slopes over the inner 570 m (the mountain foot is outside it)
const slopes = m => { const H = m.heights, out = []; for (let j = 135; j < SIM - 135; j++) for (let i = 135; i < SIM - 135; i++) { const sx = (H[j * SIM + i + 1] - H[j * SIM + i - 1]) / 2, sz = (H[(j + 1) * SIM + i] - H[(j - 1) * SIM + i]) / 2; out.push(Math.atan(Math.sqrt(sx * sx + sz * sz)) * 57.2958); } return out.sort((a, b) => a - b); };
const maps = [];
const get = (a, s) => { const t0 = Date.now(), m = openMap(s * 7919, 0, a); const ms = Date.now() - t0; maps.push(ms); return m; };

test('open desert: 840 m of heightfield (about 720 m of playable ground), generated in well under 1.5 s', () => {
  for (const a of ARCHETYPES) for (const seed of [1, 2, 3]) {
    const m = get(a, seed); assert.ok(m, a + ' ' + seed); assert.equal(m.arch, a); assert.equal(m.half, HALF); assert.equal(m.heights.length, SIM * SIM);
    assert.ok(m.report.openFrac >= 0.55, a + ' open ground ' + m.report.openFrac); assert.ok(m.report.walkFrac >= 0.97, a + ' reachable ' + m.report.walkFrac); assert.ok(m.report.flatShare <= 0.04, a + ' flat patches ' + m.report.flatShare);
    const sl = slopes(m), q = p => sl[Math.floor(p * sl.length)];
    assert.ok(q(0.5) >= 5 && q(0.5) <= 15, a + ' median slope ' + q(0.5)); assert.ok(q(0.9) <= 30, a + ' p90 slope ' + q(0.9)); assert.ok(sl.filter(v => v < 15).length / sl.length >= 0.55, a + ' under 15 degrees');
    // blocks: 4 to 6 mesas, 2 to 4 tall walls, 16 to 22 ruin blocks
    const mesas = m.blocks.filter(b => b.tone > 0 && b.rz >= 6 && b.h >= 6.9 && b.h <= 10.1), walls = m.blocks.filter(b => b.h >= 9.9 && b.rz < 6 && b.tone > 0), ruins = m.blocks.filter(b => b.tone === 0);
    assert.ok(mesas.length >= 4 && mesas.length <= 6, a + ' mesas ' + mesas.length); assert.ok(walls.length >= 2 && walls.length <= 4, a + ' walls ' + walls.length); assert.ok(ruins.length >= 16 && ruins.length <= 22, a + ' ruin blocks ' + ruins.length);
    assert.ok(m.dune.big.length >= 2 && m.dune.big.length <= 3 && m.dune.big.every(d => d.H >= 14 && d.H <= 18), a + ' big dunes');
    // spawn and gate 350 m or more apart; 4 to 6 monuments; 25 points of interest plus the free chest and the shop
    assert.ok(Math.hypot(m.spawn.x - m.gate.x, m.spawn.z - m.gate.z) >= 350, 'spawn and gate are far apart'); assert.ok(m.dress.heads.length >= 4 && m.dress.heads.length <= 6, 'monuments');
    const by = t => m.encounters.filter(e => e.type === t).length; assert.ok(by('cchest') >= 12 && by('shrine') >= 4 && by('altar') >= 2 && by('stone') >= 4 && by('broker') === 1 && m.encounters.length >= 26, a + ' points of interest ' + m.encounters.length);
    assert.ok(m.encounters.some(e => e.free), 'a free chest near the start'); assert.ok(m.bossRings.length >= 4);
    // the start: relief within 30 m, gate and a landmark inside 40 degrees of the opening heading, a skyline that rises and falls
    { const fx = -Math.sin(m.startYaw), fz = -Math.cos(m.startYaw), cosd = (x, z) => ((x - m.spawn.x) * fx + (z - m.spawn.z) * fz) / Math.hypot(x - m.spawn.x, z - m.spawn.z); assert.ok(cosd(m.gate.x, m.gate.z) >= 0.766, a + ' gate in the opening view');
      const lms = m.blocks.filter(b => b.tone > 0).map(b => [b.cx, b.cz]).concat(m.dress.heads.map(h => [h.x, h.z])); assert.ok(lms.some(l => { const d = Math.hypot(l[0] - m.spawn.x, l[1] - m.spawn.z); return d >= 35 && d <= 130 && cosd(l[0], l[1]) >= 0.766; }), a + ' a landmark in the opening view');
      let lo = 1e9, hi = -1e9; for (const r of [30, 18]) for (let t = 0; t < 12; t++) { const h = groundAt(m, m.spawn.x + Math.cos(t * 0.5236) * r, m.spawn.z + Math.sin(t * 0.5236) * r); lo = Math.min(lo, h); hi = Math.max(hi, h); } assert.ok(hi - lo >= 3, a + ' relief at the start ' + (hi - lo));
      const y0 = groundAt(m, m.spawn.x, m.spawn.z) + 4; let tl = 9, th = -9; for (let k = -8; k <= 8; k++) { const ang = m.startYaw + k * 0.098; let e = -9; for (let d = 6; d <= 400; d += 4) { const x = m.spawn.x - Math.sin(ang) * d, z = m.spawn.z - Math.cos(ang) * d; if (Math.abs(x) > 410 || Math.abs(z) > 410) break; e = Math.max(e, (groundAt(m, x, z) - y0) / d); } tl = Math.min(tl, e); th = Math.max(th, e); } assert.ok(th - tl >= 0.07, a + ' skyline varies ' + (th - tl)); }
    // rewards beside blocks or monuments, loose clusters (14 m or more apart), open stretches; the shop beside a ruin block with its stall
    const rw = m.encounters.filter(e => !e.free && e.type !== 'broker'); let beside = 0;
    for (const e of rw) { for (const b of m.blocks) assert.ok(blockProf(b, e.x, e.z) === 0, 'a reward on a block'); if (m.blocks.some(b => Math.hypot(b.cx - e.x, b.cz - e.z) < Math.max(b.rx, b.rz) * 1.1 + 19) || m.dress.heads.some(h => Math.hypot(h.x - e.x, h.z - e.z) < 24)) beside++; }
    assert.ok(beside >= Math.floor(rw.length * 0.7), a + ' beside blocks or monuments ' + beside + ' of ' + rw.length);
    { const nn = rw.map(e => Math.min(...rw.filter(f => f !== e).map(f => Math.hypot(e.x - f.x, e.z - f.z)))); assert.ok(Math.min(...nn) >= 14, a + ' nothing stacks ' + Math.min(...nn)); assert.ok(nn.filter(d => d <= 40).length >= rw.length * 0.5, a + ' clustered'); }
    const bk = m.encounters.find(e => e.type === 'broker'); assert.ok(m.blocks.some(b => b.tone === 0 && Math.hypot(b.cx - bk.x, b.cz - bk.z) < Math.max(b.rx, b.rz) * 1.05 + 10), a + ' shop beside a ruin block'); assert.equal(m.dress.stalls.length, 1);
    // dressing: dense cactus groups, tall pale dead trees, long fat beams, pots; coverage so a piece is always near on foot
    assert.ok(m.dress.cacti.length >= 500 && m.dress.dead.length >= 80 && m.dress.logs.length >= 300 && m.dress.pots.length >= 80, a + ' dressing');
    { const C = m.dress.cacti; let grouped = 0; for (const c of C) if (C.filter(o => o !== c && Math.hypot(o[0] - c[0], o[2] - c[2]) < 6).length >= 3) grouped++; assert.ok(grouped >= C.length * 0.4, a + ' grouped cacti ' + grouped + ' of ' + C.length); for (const d of m.dress.dead) assert.ok(4.6 * d[3] >= 5.7 && 5.5 * d[3] <= 9.1, 'dead tree height 6 to 9 m');
      const pcs = [...C, ...m.dress.dead, ...m.dress.pots].map(q => [q[0], q[2]]).concat(m.dress.logs.map(q => [(q[0] + q[3]) / 2, (q[2] + q[5]) / 2]), m.dress.heads.map(h => [h.x, h.z]), m.blocks.map(b => [b.cx, b.cz])); let n25 = 0, n60 = 0, N = 0; for (let i = 0; i < 500; i++) { const x = (((i * 7919) % 2999) / 2999 - 0.5) * 520, z = (((i * 104729) % 3001) / 3001 - 0.5) * 520; N++; let c25 = 0, c60 = 0; for (const q of pcs) { const d = Math.hypot(q[0] - x, q[1] - z); if (d < 25) c25++; if (d < 60) c60++; } if (c25 >= 1) n25++; if (c60 >= 3) n60++; } assert.ok(n25 / N >= 0.95 && n60 / N >= 0.95, a + ' coverage ' + n25 / N + ' ' + n60 / N); }
    assert.ok(m.solid.length < 1500, 'solid pieces ' + m.solid.length);
    // beams 6 to 9 m
    for (const l of m.dress.logs) { const len = Math.hypot(l[3] - l[0], l[5] - l[2]); assert.ok(len >= 5.99 && len <= 9.01, a + ' beam length ' + len); }
    // every block sits on the ground along its whole outline: for each of the 56 wall segments (as the view draws them) the wall bottom is a flat line, and the ground at both ends, in the middle and a quarter along must be at least 0.3 m above it (a wall cannot hang), and the wall must not be buried deeper than 8 m
    const pads = [m.gate, m.spawn, ...(m.sleepers || []), ...(m.encounters || []), ...((m.dress && m.dress.heads) || [])].filter(Boolean), padNear = (x, z) => pads.some(q => Math.hypot(q.x - x, q.z - z) < 34);       // a flattened pad (a shrine, a chest, the gate, a head) blends the sand over up to 34 m
    for (const b of m.blocks) {
      const avg = (b.rx + b.rz) / 2, q = 1 - 0.15 * b.cw / avg; let worst = 1e9, deep = 0;
      const pt = k => { const t = k / 56 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), ux = q * Math.sign(c) * Math.cbrt(Math.abs(c)), uz = q * Math.sign(s) * Math.cbrt(Math.abs(s)); return [b.cx + ux * b.rx * b.cr - uz * b.rz * b.sr, b.cz + ux * b.rx * b.sr + uz * b.rz * b.cr]; };
      const view = (x, z) => viewH(m, x, z);
      for (let k = 0; k < 56; k++) { const a0 = pt(k), a1 = pt(k + 1), bottom = Math.min(footY(m, a0[0], a0[1]), footY(m, a1[0], a1[1]));
        for (const t of [0, 0.25, 0.5, 0.75, 1]) { const g = view(a0[0] + (a1[0] - a0[0]) * t, a0[1] + (a1[1] - a0[1]) * t); worst = Math.min(worst, g - bottom); deep = Math.max(deep, g - bottom); }
        assert.ok(b.T + 0.04 - bottom >= 3.2, a + ' every wall piece is at least 3.2 m tall, so the windows, slits and roof details (drawn from the roof down) always have wall under them: ' + (b.T - bottom));
        for (const t of [0, 0.5, 1]) { const x = a0[0] + (a1[0] - a0[0]) * t, z = a0[1] + (a1[1] - a0[1]) * t, nx = x - b.cx, nz = z - b.cz, nl = Math.hypot(nx, nz) || 1; for (const d of [0.5, 1.5, 3]) { const px = x + nx / nl * d, pz = z + nz / nl * d; if (padNear(px, pz)) continue; assert.ok(viewH(m, px, pz) >= duneH(m.dune, px, pz) - 0.5, a + ' the drawn ground beside a block is never more than 0.5 m under the dune (no scooped hollow), unless a flattened pad of a shrine, the gate or a head is there on purpose'); } } }
      // the footprint is never steeper than MAX_DROP
      { let lo = 1e9, hi = -1e9; for (let k = 0; k < 20; k++) { const tt = k / 20 * Math.PI * 2; for (const f of [1, 0.55, 0]) { const ux = Math.cos(tt) * b.rx * f, uz = Math.sin(tt) * b.rz * f, h = duneH(m.dune, b.cx + ux * b.cr - uz * b.sr, b.cz + ux * b.sr + uz * b.cr); lo = Math.min(lo, h); hi = Math.max(hi, h); } } assert.ok(hi - lo <= MAX_DROP + 0.01, a + ' a block footprint spans ' + (hi - lo) + ' m of ground'); }
      assert.ok(worst >= 0.3, a + ' a block hangs: its wall stops only ' + worst + ' m below the ground');
      assert.ok(duneH(m.dune, b.cx, b.cz) - footY(m, b.cx, b.cz) >= 0.3 && groundAt(m, b.cx, b.cz) >= duneH(m.dune, b.cx, b.cz) - 0.01, a + ' block centre');
    }
  }
  const sorted = maps.slice().sort((a, b) => a - b), p95 = sorted[Math.floor(sorted.length * 0.95)]; assert.ok(p95 < 1500, 'generation p95 ' + p95 + ' ms (max ' + sorted[sorted.length - 1] + ')');
});

test('open desert: a continuous mountain range all round, 35 to 70 m high, too steep to climb, blocked at the foot with no creep', () => {
  for (const [a, s] of [['a', 1], ['c', 2], ['e', 3]]) {
    const m = get(a, s); loadMap(m); assert.equal(MAP.half, HALF); let minPeak = 1e9, maxPeak = 0;
    for (let k = 0; k < 120; k++) {                                              // 120 rays from the centre: the range is there in every direction
      const ang = k * Math.PI * 2 / 120, dx = Math.cos(ang), dz = Math.sin(ang), n4 = Math.pow(dx ** 4 + dz ** 4, 0.25); let hi = 0, ring = 0;       // the range is a rounded square: walk out in its own measure
      for (let r4 = 200; r4 < 414; r4 += 1) { const d = r4 / n4, h = groundAt(m, dx * d, dz * d); if (h > hi) hi = h; if (r4 >= 392 && h > ring) ring = h; } minPeak = Math.min(minPeak, ring); maxPeak = Math.max(maxPeak, hi); assert.ok(ring >= 33, a + ' the range is complete in ray ' + k + ': ' + ring);
    }
    assert.ok(minPeak >= 33 && maxPeak <= 82, a + ' peaks ' + minPeak + ' to ' + maxPeak);
    // walk at the range from 24 directions: the duelist is stopped low on the face (never above 24 m), at one spot, and stays there
    for (let k = 0; k < 24; k++) {
      const ang = k * Math.PI * 2 / 24, dx = Math.cos(ang), dz = Math.sin(ang), o = { x: dx * 200, y: heightAt(dx * 200, dz * 200), z: dz * 200 };
      if (heightAt(o.x, o.z) > 25) continue;
      for (let t = 0; t < 700; t++) { moveXZ(o, dx * 0.5, dz * 0.5, 0.6, 0.55); o.y = Math.max(0, heightAt(o.x, o.z)); }
      const x0 = o.x, z0 = o.z, y0 = o.y; for (let t = 0; t < 60; t++) { moveXZ(o, dx * 0.5, dz * 0.5, 0.6, 0.55); o.y = Math.max(0, heightAt(o.x, o.z)); }
      assert.ok(y0 < 24, a + ' climbed to ' + y0 + ' in direction ' + k); if (k % 6 === 0) assert.ok(Math.abs(o.x - x0) < 0.01 && Math.abs(o.z - z0) < 0.01, 'no creep at the foot');       // head on: stopped dead; at an angle the duelist slides along the face, as at any wall
    }
  }
});

test('open desert: the same seed gives the same ground, different seeds differ in dunes, rocks and where things stand, and it only loads behind the option', () => {
  const a = openMap(12345, 0, 'e'), b = openMap(12345, 0, 'e'), c = openMap(54321, 0, 'e');
  assert.deepEqual(Array.from(a.heights), Array.from(b.heights)); assert.notDeepEqual(Array.from(a.heights), Array.from(c.heights)); assert.deepEqual(a.dress, b.dress); assert.notDeepEqual(a.dress.cacti, c.dress.cacti); assert.notDeepEqual(a.spawn, c.spawn);
  const tones = new Set(); for (let s = 1; s <= 8; s++) for (const bl of openMap(s * 101, 0, 'a').blocks) tones.add(bl.tone); assert.ok(tones.has(1) && tones.has(2), 'both rock styles appear across seeds');
  const g = new Game(5, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', arch: 'b' }); assert.equal(g.map.open, true); assert.equal(g.map.arch, 'b'); assert.equal(MAP.half, HALF); assert.equal(g.grid.half, HALF);
  const n = new Game(5, { mode: 'run', duelist: 'kael', offers: false }); assert.ok(!n.map.open); assert.equal(MAP.half, 200); assert.equal(n.grid.half, 200);
});

test('open desert: no trees or boulders of the other stages, solid pieces only where they should be, the camera never reads wall past the heightfield', () => {
  const m = openMap(777, 0, 'a'); loadMap(m); const S = scatterStage(m, 0, true); assert.equal([].concat(...S.trees).length, 0); assert.equal([].concat(...S.rocks).length, 0);
  assert.equal(m.kits.length, 0); assert.equal((m.props || []).length, 0);
  const col = buildColliders(m, 0); assert.equal(col.list.length, m.solid.length);
  for (const [x, z] of [[0, 430], [500, 0], [-450, 460], [700, 700]]) { const h = camGround(x, z); assert.ok(h < 90 && h > -15, 'camera ground ' + h); }
  assert.ok(EDGE_R > 300);
});

test('open desert: enemies keep to the ground in a bot run far from the start, and packs keep arriving', () => {
  const g = new Game(9, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', arch: 'a', difficulty: 'easy' }), bot = newBot({ focus: true }); g.god = true;
  const far = { x: g.map.gate.x * 0.5, z: g.map.gate.z * 0.5 }; g.p.x = far.x; g.p.z = far.z; g.p.y = heightAt(far.x, far.z); let seen = 0;
  for (let i = 0; i < 60 * 120 && !g.over; i++) {
    g.tick(botRecord(g, bot));
    if (i % 30 === 0) { let alive = 0; for (let e = 0; e < g.en.max; e++) if (g.en.alive[e]) { alive++; assert.ok(heightAt(g.en.x[e], g.en.z[e]) < 50, 'an enemy on a mountain'); } seen = Math.max(seen, alive); }
  }
  assert.ok(g.spawned >= 40 && g.kills >= 25, 'packs keep arriving round the duelist far from the start: spawned ' + g.spawned + ', killed ' + g.kills + ', most alive at once ' + seen);
});
