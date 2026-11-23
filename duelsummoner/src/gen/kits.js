// The kit library: hand-designed building blocks the generator arranges. Each kit is written in local coordinates around its centre.
//   plan(rng)  decides this kit's size and shape (so the layout can reserve its footprint before anything is built)
//   build(k, plan, rng)  emits primitives through the Kit transform and returns slots (places the encounter pass may use)
// Slot tags: reward_port (a roof, pillar top or hop-chain end), floor, high_perch, pocket_end. y is the standing height.
// Heights follow the movement rules (design/generator-spec.md section 4): hop ledges 1.4 m, walls and tiers 3 m, ramps 1:2 or gentler.
import { sin, cos } from '../sim/dmath.js';
import { COLOSSEUM } from '../data/map.js';
import { isqrt } from './imath.js';

const SAND = 0xc9a46a, DARK = 0xa98150, ROOF = 0xd8b87c, RAMPC = 0xb98c56, STONE = 0xa89578, BONE = 0xe6dcc0, GOLD = 0xe0b765, LSTONE = 0x4a4250;         // LSTONE: grey-violet landmark stone
const polar = (r, deg) => [r * cos(deg * 3.141592653589793 / 180), r * sin(deg * 3.141592653589793 / 180)];
const hyp = (a, b) => isqrt(a * a + b * b);
// A built column: a stone shaft 4.5 to 7 m tall with a bone capital (the capital is for show and not solid). A toppled one leaves a stump (1.2-1.5 m or 3 m and up) and three lying drums
// 1.3 m high; the shaft tops stay out of the 1.8-2.6 m band, so nothing here is a jump you could half-make.
function column(k, x, z, r, rng, toppled) {
  if (!toppled) { const h = 4.5 + rng.int(26) / 10; k.cyl(x, z, r, h, STONE); k.cyl(x, z, r + 0.15, h + 0.5, BONE, { y0: h, deco: true }); return; }
  k.cyl(x, z, r, rng.int(2) ? 1.2 + rng.int(4) / 10 : 3.0 + rng.int(8) / 10, STONE);
  const th = rng.int(360), dx = cos(th * 3.141592653589793 / 180), dz = sin(th * 3.141592653589793 / 180);
  for (let i = 0; i < 3; i++) { const d = r + 2.0 + i * 3.1, cx = x + dx * d, cz = z + dz * d; k.box(cx - 1.4, cz - 0.65, cx + 1.4, cz + 0.65, 1.3, STONE, { rot: th }); }
}
// A leaning card: a 3 x 4.5 x 0.4 m stone card tilted back 15 to 35 degrees (drawn by the view as a tilted slab) over a plain vertical slab for the collider, which rises straight from the ground.
function leanCard(k, x, z, rot, rng) {
  k.box(x - 1.5, z - 0.3, x + 1.5, z + 0.3, 4.2, LSTONE, { rot });
  const [px, pz] = k.pt(x, z); k.push({ t: 'tilt', x: px, z: pz, w: 3, th: 0.4, hgt: 4.5, yaw: -(rot + 90 * k.rot), tilt: 15 + rng.int(21), c: LSTONE, deco: true });
}
// seeded 25 to 40 percent of a ring or a scatter are toppled, and two neighbours are never both toppled
const toppleFlags = (n, rng) => { const f = []; for (let i = 0; i < n; i++) f.push(!(f[i - 1]) && !(i === n - 1 && f[0]) && rng.int(100) < 36); if (!f.some(Boolean)) f[1] = true; return f; };

export const KITS = {
  // ---- the gate arena: the Sunken Colosseum floor with broken stands, ramps out, and the Royal Gate on its north side ----
  colosseum: {
    role: 'gate', name: 'Sunken Colosseum', short: 'COLOSSEUM', color: '#e0b765',
    plan: () => ({ r: 72 }),
    build(k) {
      const C = COLOSSEUM, slots = [];
      let a = 0; const gaps = C.gaps.slice().sort((p, q) => p[0] - q[0]);
      gaps.forEach(g => { if (g[0] > a) k.ring(C.floorR, C.standsR, a, g[0], C.standsH, SAND); a = g[1]; });
      if (a < 360) k.ring(C.floorR, C.standsR, a, 360, C.standsH, SAND);
      k.ring(C.standsR, C.outerR, 0, 360, C.standsH, DARK);
      for (let i = 0; i < 8; i++) k.ring(C.standsR, C.outerR, 22.5 + 45 * i - 15, 22.5 + 45 * i + 15, C.roofH, ROOF, { y0: C.standsH });
      const w = C.rampHalfW;
      for (const [ax, s] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]]) { k.ramp(ax, s * C.rampU0, s * C.rampU1, -w, w, 0, 4, RAMPC); k.ramp(ax, s * 72, s * 60, -w, w, 0, 4, RAMPC); }
      [[14, 20, 1.3, 6], [13, 95, 1.3, 3.2], [15, 170, 1.3, 6.5], [12, 250, 1.3, 2.6], [21, 55, 1.3, 5], [22, 140, 1.3, 1.6], [22, 215, 1.3, 6], [21, 305, 1.3, 3.6], [8, 130, 1, 1.3], [8, 310, 1, 1.3]]
        .forEach(q => { const p = polar(q[0], q[1]); k.cyl(p[0], p[1], q[2], q[3], q[3] > 2.5 ? 0xd9b27a : RAMPC); });
      [[44, 30], [45, 70], [44, 112], [46, 195], [44, 250], [45, 290], [44, 350]].forEach(q => { const p = polar(q[0], q[1]); k.cyl(p[0], p[1], 1.4, 5.3, RAMPC); });
      k.box(-15, -63, -8, -53, 24, LSTONE, { y0: 4 }); k.box(8, -63, 15, -53, 24, LSTONE, { y0: 4 });
      k.box(-15.2, -63.2, -7.8, -52.8, 24, GOLD, { y0: 22, deco: true }); k.box(7.8, -63.2, 15.2, -52.8, 24, GOLD, { y0: 22, deco: true });       // a 2 m gold band at the top of each pylon                        // the gate pylons
      k.box(-15, -63, 15, -53, 27, 0xf0cf86, { y0: 20, deco: true }); k.box(-6, -63, -4, -62, 11, 0xd8a84a, { y0: 4, deco: true }); k.box(4, -63, 6, -62, 11, 0xd8a84a, { y0: 4, deco: true });
      for (const [r, d] of [[16, 150], [20, 300], [24, 60]]) { const p = polar(r, d); slots.push({ tag: 'floor', x: p[0], z: p[1], y: 0 }); }
      for (const d of [40, 130, 220, 330]) { const p = polar(39, d); slots.push({ tag: 'reward_port', x: p[0], z: p[1], y: 4 }); }
      for (const d of [65, 155, 245]) { const p = polar(56, d); slots.push({ tag: 'high_perch', x: p[0], z: p[1], y: 5.8 }); }
      return { slots, gate: { x: 0, z: -57 }, boss: { x: 0, z: -12 }, tollPull: { x: 0, z: -2 }, center: { x: 0, z: 0 } };
    }
  },
  // ---- the spawn plaza: an open flat disc with a ring of low pillars ----
  plaza: {
    role: 'spawn', name: 'Spawn Plaza', plan: () => ({ r: 34 }),
    build(k, p, rng) {
      const fl = toppleFlags(8, rng);
      for (let i = 0; i < 8; i++) { const q = polar(27 + (i % 2) * 2, i * 45 + 22); column(k, q[0], q[1], 0.9, rng, fl[i]); }
      return { slots: [] };
    }
  },
  // ---- districts (large): each hero kit carries a landmark and several rewards ----
  market: {
    role: 'district', name: 'Market of Tablets', short: 'MARKET', color: '#d98a4a',
    plan: rng => { const cols = 3 + rng.int(2), rows = 3; return { cols, rows, r: hyp(cols * 20, rows * 20) / 2 + 4 }; },
    build(k, p, rng) {
      const roofs = [2.4, 4.4, 6.2, 4.4], tints = [0xd9b27a, 0xc79a60, 0xe0c28c, 0xb98c56], slots = [], x0 = -p.cols * 10 + 3, z0 = -p.rows * 10 + 3;
      for (let i = 0; i < p.cols; i++) for (let j = 0; j < p.rows; j++) {
        const x = x0 + i * 20, z = z0 + j * 20, h = roofs[(i + j + rng.int(2)) % 4];
        k.box(x, z, x + 14, z + 14, h, tints[(i * 3 + j) % 4]); k.box(x + 1, z + 1, x + 13, z + 13, h + 0.15, 0x8f6a40, { y0: h, deco: true });
        if ((i + j) % 3 === 0) slots.push({ tag: 'reward_port', x: x + 7, z: z + 7, y: h });
      }
      // the hero landmark: twin standing cards 22 m and 18 m on a pedestal, in landmark stone with bone caps (view only above the pedestal)
      k.box(-9, -3, 9, 3, 1.5, LSTONE); k.box(-8, -0.4, 0, 0.4, 23.5, LSTONE, { y0: 1.5, deco: true, landmark: true }); k.box(1.5, -0.4, 8.5, 0.4, 19.5, LSTONE, { y0: 1.5, deco: true, landmark: true });
      k.box(-8, -0.5, 0, 0.5, 24, BONE, { y0: 23.5, deco: true, landmark: true }); k.box(1.5, -0.5, 8.5, 0.5, 20, BONE, { y0: 19.5, deco: true, landmark: true });
      return { slots };
    }
  },
  temple: {
    role: 'district', name: 'Hall of Sealed Cards', short: 'HALL', color: '#8b86c8',
    plan: () => ({ r: 62 }),
    build(k) {
      const ox = -123, oz = 7;                                  // the old hall was centred at (123, -7)
      k.box(105 + ox, -45 + oz, 155 + ox, 45 + oz, 5, STONE); k.box(135 + ox, -45 + oz, 155 + ox, 45 + oz, 10, 0xb9a687);
      k.ramp('x', 90 + ox, 105 + ox, -8 + oz, 8 + oz, 0, 5, RAMPC); k.ramp('z', -62 + oz, -45 + oz, 120 + ox, 132 + ox, 0, 5, RAMPC); k.ramp('x', 117 + ox, 135 + ox, -6 + oz, 6 + oz, 5, 10, RAMPC);
      for (let i = 0; i < 7; i++) { const z = -36 + i * 12 + oz; k.box(103.2 + ox, z, 105 + ox, z + 8, 9, 0x6f6a8a, { y0: 0, deco: true }); k.box(103 + ox, z + 1, 105 + ox, z + 7, 8, 0xd8b24a, { y0: 1, deco: true }); }
      const ob = (w, y0, y1, c) => k.box(145 + ox - w / 2, oz - w / 2, 145 + ox + w / 2, oz + w / 2, y1, c, { y0, deco: true, landmark: true });       // a stepped obelisk (4, 2.5 and 1.2 m wide) up to 26 m, bone cap
      ob(4, 10, 18, LSTONE); ob(2.5, 18, 23, LSTONE); ob(1.2, 23, 26, LSTONE); ob(1.5, 26, 27, BONE);
      return { slots: [{ tag: 'reward_port', x: 115 + ox, z: -20 + oz, y: 5 }, { tag: 'reward_port', x: 125 + ox, z: 25 + oz, y: 5 }, { tag: 'high_perch', x: 145 + ox, z: oz, y: 10 }, { tag: 'high_perch', x: 145 + ox, z: 30 + oz, y: 10 }] };
    }
  },
  spine: {
    role: 'district', name: "Dragon's Spine", short: 'SPINE', color: '#e8e0c4',
    plan: rng => { const n = 4 + rng.int(2); return { n, r: n * 10 + 12 }; },
    build(k, p, rng) {
      const hs = [6, 6.5, 7, 7.5, 7, 6.5, 6], slots = [], x0 = -p.n * 10;
      for (let i = 0; i < p.n; i++) { const h = hs[i]; k.box(x0 + i * 20, -5, x0 + i * 20 + 20, 5, h, BONE); if (i % 2) k.cyl(x0 + i * 20 + 10, 0, 3.2, h + 1.6, 0xf2e9cf, { y0: h, deco: true }); }
      [[0, 6], [2, 7], [p.n - 1, 6]].forEach(q => { const x = x0 + q[0] * 20 + 10; k.ramp('z', -28, -5, x - 4, x + 4, 0, q[1], 0xd9cfb0); });
      [[1, 7], [p.n - 2, 6.5]].forEach(q => { const x = x0 + q[0] * 20 + 10; k.ramp('z', 28, 5, x - 4, x + 4, 0, q[1], 0xd9cfb0); });
      k.box(x0 + p.n * 20 - 10, -9, x0 + p.n * 20 + 12, 9, 7.8, 0xf2e9cf);
      for (const zz of [-5.5, 5.5]) { const hx = x0 + p.n * 20 + 1; k.box(hx - 1.1, zz - 1.1, hx + 1.1, zz + 1.1, 18, LSTONE, { y0: 7.8, deco: true, landmark: true }); k.box(hx - 0.6, zz - 0.6, hx + 0.6, zz + 0.6, 24, LSTONE, { y0: 18, deco: true, landmark: true }); k.box(hx - 0.8, zz - 0.8, hx + 0.8, zz + 0.8, 25, BONE, { y0: 24, deco: true, landmark: true }); }       // a pair of 24 m horns on the skull
      slots.push({ tag: 'high_perch', x: x0 + p.n * 20 + 1, z: 0, y: 7.8 });
      slots.push({ tag: 'reward_port', x: x0 + 30, z: 0, y: hs[1] }, { tag: 'reward_port', x: x0 + 90, z: 0, y: hs[4] });
      return { slots };
    }
  },
  pyramid: {
    role: 'district', name: "King's Stair", short: 'STAIR', color: '#c9a050',
    plan: rng => { const tiers = 8 + rng.int(4), half0 = 30 + rng.int(8); return { tiers, half0, r: Math.floor(half0 * 1.45) + 4 }; },
    build(k, p) {
      const tierH = 2.4, shrink = 3, slots = [];
      for (let i = 0; i < p.tiers; i++) { const half = p.half0 - shrink * i; k.box(-half, -half, half, half, tierH * (i + 1), i % 2 ? 0xb89a62 : 0xc4a56e); }
      const half4 = p.half0 - shrink * 4; k.ramp('z', p.half0 + 30, half4, -6, 6, 0, tierH * 5, 0xd2b27a);
      k.box(-2.5, -2.5, 2.5, 2.5, tierH * p.tiers + 6, BONE, { y0: tierH * p.tiers, deco: true, landmark: true });       // a 6 m bone capstone, not gold
      slots.push({ tag: 'high_perch', x: 0, z: 0, y: tierH * p.tiers }, { tag: 'reward_port', x: 0, z: half4 + 2, y: tierH * 5 }, { tag: 'reward_port', x: half4 - 2, z: 0, y: tierH * 5 });
      return { slots };
    }
  },
  // ---- fillers: smaller kits that make the ground between districts worth crossing ----
  mesa: {
    role: 'filler', name: 'Mesa', plan: rng => { const half = 11 + rng.int(6); return { half, r: half + 9 }; },
    build(k, p) {
      k.box(-p.half, -p.half, p.half, p.half, 3, 0xcaa270);
      k.ramp('z', p.half + 6, p.half, -5, 5, 0, 3, RAMPC); k.ramp('z', -p.half - 6, -p.half, -5, 5, 0, 3, RAMPC);
      k.cyl(p.half - 4, p.half - 4, 1.2, 2.6, RAMPC, { y0: 3 });
      return { slots: [{ tag: 'high_perch', x: 0, z: 0, y: 3 }] };
    }
  },
  ruinfield: {
    role: 'filler', name: 'Broken Colonnade', plan: () => ({ r: 26 }),
    build(k, p, rng) {
      const fl = toppleFlags(9, rng);
      for (let i = 0; i < 9; i++) { const q = polar(6 + rng.int(18), rng.int(360)); column(k, q[0], q[1], 1.1 + rng.range(0, 0.5), rng, fl[i]); }
      k.box(-12, -2, -4, 1, 1.2, STONE); k.box(4, 6, 12, 9, 1.2, STONE); k.box(-3, -13, 1, -6, 1.4, STONE);       // hop-height walls
      return { slots: [{ tag: 'reward_port', x: 8, z: 7.5, y: 1.2 }] };
    }
  },
  graveyard: {
    role: 'filler', name: 'Card Graveyard', plan: () => ({ r: 30 }),
    build(k, p, rng) {
      const slots = []; const spots = [[0, 0], [14, 4], [-14, 5], [4, -15], [-6, 16], [17, -13]];
      spots.forEach((q, i) => { const rot = rng.int(180); if (i % 2) { leanCard(k, q[0], q[1], rot, rng); return; } k.box(q[0] - 4.5, q[1] - 6.5, q[0] + 4.5, q[1] + 6.5, 1.4, 0x9c8a6e, { rot }); k.box(q[0] - 3.7, q[1] - 5.7, q[0] + 3.7, q[1] + 5.7, 1.46, 0xd8b24a, { rot, y0: 1.4, deco: true }); if (i === 2) slots.push({ tag: 'reward_port', x: q[0], z: q[1], y: 1.4 }); });
      return { slots };
    }
  },
  hopyard: {
    role: 'filler', name: 'Hop Yard', plan: rng => { const n = 5 + rng.int(2); return { n, r: n * 4 + 10 }; },
    build(k, p, rng) {                                          // a chain of platforms: rises of 1.4 m, gaps of 3.2 to 3.8 m. Player-only: a parkour route.
      const hs = [1.4, 2.8, 1.4, 2.8, 4.2, 2.8, 4.2], slots = []; let x = -p.n * 4.6;
      for (let i = 0; i < p.n; i++) { const w = 6, gap = 3.2 + rng.int(4) * 0.2, z = (i % 2 ? 4 : -4); k.box(x, z - 3, x + w, z + 3, hs[i], i % 2 ? 0xd8b87c : 0xc9a46a); x += w + gap; if (i === p.n - 1) slots.push({ tag: 'reward_port', x: x - gap - 3, z, y: hs[i] }); }
      return { slots };
    }
  },
  canyon: {
    role: 'filler', name: 'Canyon', plan: () => ({ r: 34 }),
    build(k) {
      k.box(-30, -18, 30, -10, 6, 0xb8935c); k.box(-30, 10, 30, 18, 6, 0xb8935c);                  // two long walls with a corridor between them
      k.ramp('x', -42, -30, -18, -10, 0, 6, RAMPC); k.ramp('x', 42, 30, 10, 18, 0, 6, RAMPC);      // an enemy ramp up to each wall top
      return { slots: [{ tag: 'high_perch', x: 0, z: -14, y: 6 }, { tag: 'high_perch', x: 0, z: 14, y: 6 }] };
    }
  },
  terraces: {
    role: 'filler', name: 'Terraces', plan: rng => ({ r: 28 + rng.int(6) }),
    build(k, p) {
      const R = p.r - 8; k.box(-R, -R, R, R, 1.4, 0xcdb37c); k.box(-R + 8, -R + 8, R - 8, R - 8, 2.8, 0xc9a46a); k.box(-R + 16, -R + 16, R - 16, R - 16, 4.2, 0xc4a56e);
      k.ramp('x', R + 3, R, -4, 4, 0, 1.4, RAMPC);                           // ground to the first terrace: a 1.4 m hop with a ramp
      k.ramp('z', -(R - 2.8), -(R - 8), -4, 4, 1.4, 2.8, RAMPC);              // first terrace to the second, on the north side
      k.ramp('z', R - 10.8, R - 16, -4, 4, 2.8, 4.2, RAMPC);                  // second terrace to the top, on the south side
      return { slots: [{ tag: 'high_perch', x: 0, z: 0, y: 4.2 }, { tag: 'reward_port', x: R - 12, z: 0, y: 2.8 }] };
    }
  },
  dunes: {
    role: 'filler', name: 'Dunes', plan: () => ({ r: 30 }),
    build(k, p, rng) { for (let i = 0; i < 6; i++) { const q = polar(rng.int(20), rng.int(360)), w = 6 + rng.int(8); k.box(q[0] - w, q[1] - w / 2, q[0] + w, q[1] + w / 2, 0.5, 0xd2b27a, { rot: rng.int(180) }); } return { slots: [] }; }
  }
};
export const DISTRICT_POOL = ['market', 'temple', 'spine', 'pyramid'];
export const FILLER_POOL = ['mesa', 'ruinfield', 'graveyard', 'hopyard', 'hopyard', 'canyon', 'terraces', 'dunes', 'graveyard', 'mesa'];
