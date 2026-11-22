// The Buried Kingdom: one map, about 400 m across. Axes: x east, z south (north is -z).
// Primitives are rasterised for collision (src/sim/terrain.js) and meshed for drawing (src/view/mapMesh.js),
// so what you see is what you stand on. Solid-column model: no overhangs.
//   box   {x0,z0,x1,z1,h,y0?,rot?}        flat-topped block, optional yaw (deg) about its centre
//   ramp  {axis,a0,a1,b0,b1,h0,h1}        height rises linearly from h0 at a0 to h1 at a1 along axis
//   ring  {cx,cz,r0,r1,a0,a1,h,y0?}       annular sector, angles in degrees (0 = +x, 90 = +z)
//   cyl   {x,z,r,h,y0?}                   round pillar
// deco:true means visual only (no collision). c is the colour.
import { sin, cos } from '../sim/dmath.js';
export const MAP ={ half: 200, boundaryR: 195, wallTop: 22 };

const P = [];
const box = (x0, z0, x1, z1, h, c, o) => P.push(Object.assign({ t: 'box', x0, z0, x1, z1, h, c }, o));
const ramp = (axis, a0, a1, b0, b1, h0, h1, c, o) => P.push(Object.assign({ t: 'ramp', axis, a0, a1, b0, b1, h0, h1, c }, o));
const ring = (r0, r1, a0, a1, h, c, o) => P.push(Object.assign({ t: 'ring', cx: 0, cz: 0, r0, r1, a0, a1, h, c }, o));
const cyl = (x, z, r, h, c, o) => P.push(Object.assign({ t: 'cyl', x, z, r, h, c }, o));
const polar = (r, deg) => [r * cos(deg * 3.141592653589793 / 180), r * sin(deg * 3.141592653589793 / 180)];

// ---------------- Sunken Colosseum (centre, round, start) ----------------
export const COLOSSEUM = { floorR: 32, standsR: 52, outerR: 60, standsH: 4, roofH: 5.8,
  gaps: [[100, 125], [150, 162.5], [205, 225], [310, 335]], rampU0: 20, rampU1: 32, rampHalfW: 4 };
{
  const K = COLOSSEUM, SAND = 0xc9a46a, DARK = 0xa98150, ROOF = 0xd8b87c;
  // broken stands: inner band is missing in four wedges
  let a = 0;
  const gaps = K.gaps.slice().sort((p, q) => p[0] - q[0]);
  gaps.forEach(g => { if (g[0] > a) ring(K.floorR, K.standsR, a, g[0], K.standsH, SAND); a = g[1]; });
  if (a < 360) ring(K.floorR, K.standsR, a, 360, K.standsH, SAND);
  ring(K.standsR, K.outerR, 0, 360, K.standsH, DARK);
  // rooftops of the outer halls: eight roofs, jumped onto from the stands (rise 1.8 m)
  for (let k = 0; k < 8; k++) ring(K.standsR, K.outerR, 22.5 + 45 * k - 15, 22.5 + 45 * k + 15, K.roofH, ROOF, { y0: K.standsH });
  // four ramps up from the arena floor, four down the outside
  const u0 = K.rampU0, u1 = K.rampU1, w = K.rampHalfW;
  ramp('x', u0, u1, -w, w, 0, 4, 0xb98c56); ramp('x', -u0, -u1, -w, w, 0, 4, 0xb98c56);
  ramp('z', u0, u1, -w, w, 0, 4, 0xb98c56); ramp('z', -u0, -u1, -w, w, 0, 4, 0xb98c56);
  ramp('x', 72, 60, -w, w, 0, 4, 0xb98c56); ramp('x', -72, -60, -w, w, 0, 4, 0xb98c56);
  ramp('z', 72, 60, -w, w, 0, 4, 0xb98c56); ramp('z', -72, -60, -w, w, 0, 4, 0xb98c56);
  // broken pillars on the arena floor and rubble on the stands: [radius, degrees, pillar radius, top height]
  [[14, 20, 1.3, 6], [13, 95, 1.3, 3.2], [15, 170, 1.3, 6.5], [12, 250, 1.3, 2.6], [21, 55, 1.3, 5],
   [22, 140, 1.3, 1.6], [22, 215, 1.3, 6], [21, 305, 1.3, 3.6], [8, 130, 1.0, 1.3], [8, 310, 1.0, 1.3]]
    .forEach(q => { const p = polar(q[0], q[1]); cyl(p[0], p[1], q[2], q[3], q[3] > 2.5 ? 0xd9b27a : 0xb98c56); });
  [[44, 30], [45, 70], [44, 112], [46, 195], [44, 250], [45, 290], [44, 350]]
    .forEach(q => { const p = polar(q[0], q[1]); cyl(p[0], p[1], 1.4, 5.3, 0xb98c56); });
  // The Royal Gate on the north side: two tall pylons and a lintel (lintel is visual only, so the way stays open)
  box(-15, -63, -8, -53, 24, 0xe0b765, { y0: 4 }); box(8, -63, 15, -53, 24, 0xe0b765, { y0: 4 });
  box(-15, -63, 15, -53, 27, 0xf0cf86, { y0: 20, deco: true });
  box(-6, -63, -4, -62, 11, 0xd8a84a, { y0: 4, deco: true }); box(4, -63, 6, -62, 11, 0xd8a84a, { y0: 4, deco: true });
}

// ---------------- Market of Tablets (north): tight streets, flat roofs to jump across ----------------
export const MARKET = { x0: -60, x1: 60, z0: -172, z1: -90 };
{
  const roofs = [2.4, 4.4, 6.2, 4.4], tints = [0xd9b27a, 0xc79a60, 0xe0c28c, 0xb98c56];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
    const x = -58 + i * 20, z = -170 + j * 20, h = roofs[(i + j) % 4];
    box(x, z, x + 14, z + 14, h, tints[(i * 3 + j) % 4]);
    box(x + 1, z + 1, x + 13, z + 13, h + 0.15, 0x8f6a40, { y0: h, deco: true });
  }
}

// ---------------- Hall of Sealed Cards (east): long two-floor temple with stone cards on the walls ----------------
export const TEMPLE = { x0: 88, x1: 158, z0: -62, z1: 48 };
{
  const STONE = 0xa89578;
  box(105, -45, 155, 45, 5, STONE);                    // ground floor roof deck (first floor)
  box(135, -45, 155, 45, 10, 0xb9a687);                // upper floor
  ramp('x', 90, 105, -8, 8, 0, 5, 0xb98c56);            // west gate ramp
  ramp('z', -62, -45, 120, 132, 0, 5, 0xb98c56);        // north side ramp
  ramp('x', 117, 135, -6, 6, 5, 10, 0xb98c56);          // inner ramp to the upper floor
  for (let k = 0; k < 7; k++) {                         // giant stone cards standing against the west wall
    const z = -36 + k * 12;
    box(103.2, z, 105, z + 8, 9, 0x6f6a8a, { y0: 0, deco: true });
    box(103.0, z + 1, 105, z + 7, 8, 0xd8b24a, { y0: 1, deco: true });
  }
}

// ---------------- Dragon's Spine (south): a ridge of huge fossil bones as ramps and bridges ----------------
export const SPINE = { x0: -100, x1: 95, z0: 108, z1: 168 };
{
  const BONE = 0xe6dcc0, heights = [6, 6.5, 7, 7.5, 7, 6.5, 6];   // gentle steps so ground enemies can walk the ridge
  heights.forEach((h, k) => box(-70 + k * 20, 134, -50 + k * 20, 144, h, BONE));
  [[-60, 6], [-20, 7], [20, 7], [60, 6]].forEach(q => ramp('z', 112, 134, q[0] - 4, q[0] + 4, 0, q[1], 0xd9cfb0));   // north rib ramps
  [[-20, 7], [60, 6]].forEach(q => ramp('z', 166, 144, q[0] - 4, q[0] + 4, 0, q[1], 0xd9cfb0));            // south rib ramps
  box(70, 130, 92, 148, 7.8, 0xf2e9cf);                  // skull platform
  box(-90, 136, -70, 142, 4.4, BONE);                    // tail bridge
  for (let k = 0; k < 7; k++) cyl(-60 + k * 20, 139, 3.2, heights[k] + 1.6, 0xf2e9cf, { y0: heights[k], deco: true });
}

// ---------------- Pharaoh's Stair (west): stepped pyramid, 12 tiers of 2.4 m = 28.8 m ----------------
export const PYRAMID = { cx: -130, cz: 0, tiers: 12, tierH: 2.4, half0: 45, shrink: 3, x0: -176, x1: -84, z0: -46, z1: 76 };
{
  for (let i = 0; i < PYRAMID.tiers; i++) {
    const half = PYRAMID.half0 - PYRAMID.shrink * i;
    box(PYRAMID.cx - half, PYRAMID.cz - half, PYRAMID.cx + half, PYRAMID.cz + half, PYRAMID.tierH * (i + 1), i % 2 ? 0xb89a62 : 0xc4a56e);
  }
  ramp('z', 75, 33, -136, -124, 0, 12, 0xd2b27a);       // south ramp reaches tier four; above that you jump
}

// ---------------- landmark props: giant face-down stone cards half buried in the sand ----------------
export const CARD_PROPS = [[100, -110, 20], [-100, -100, -15], [-150, -110, 40], [130, -120, 5], [150, 90, -30],
  [60, 85, 25], [-60, 90, -20], [-30, 95, 10], [175, 0, 90], [45, -78, 30], [-60, -80, -35], [-70, 70, 15]];
CARD_PROPS.forEach(q => {
  box(q[0] - 4.5, q[1] - 6.5, q[0] + 4.5, q[1] + 6.5, 1.7, 0x9c8a6e, { rot: q[2] });
  box(q[0] - 3.7, q[1] - 5.7, q[0] + 3.7, q[1] + 5.7, 1.78, 0xd8b24a, { rot: q[2], y0: 1.7, deco: true });
  box(q[0] - 3.2, q[1] - 5.2, q[0] + 3.2, q[1] + 5.2, 1.84, 0x6f5a80, { rot: q[2], y0: 1.78, deco: true });
  box(q[0] - 1.2, q[1] - 1.2, q[0] + 1.2, q[1] + 1.2, 1.92, 0xe8c56a, { rot: q[2] + 45, y0: 1.84, deco: true });
});

export const PRIMS = P;

// Districts for the minimap and for later encounter placement.
export const DISTRICTS = [
  { id: 'colosseum', name: 'Sunken Colosseum', short: 'COLOSSEUM', shape: 'circle', cx: 0, cz: 0, r: 72, color: '#e0b765' },
  { id: 'market', name: 'Market of Tablets', short: 'MARKET', shape: 'rect', x0: -60, z0: -172, x1: 60, z1: -90, color: '#d98a4a' },
  { id: 'temple', name: 'Hall of Sealed Cards', short: 'HALL', shape: 'rect', x0: 88, z0: -62, x1: 158, z1: 48, color: '#8b86c8' },
  { id: 'spine', name: "Dragon's Spine", short: 'SPINE', shape: 'rect', x0: -100, z0: 108, x1: 95, z1: 168, color: '#e8e0c4' },
  { id: 'pyramid', name: "Pharaoh's Stair", short: 'STAIR', shape: 'rect', x0: -176, z0: -46, x1: -84, z1: 76, color: '#c9a050' }
];




