// The Sunken Court: a hand-authored sample of the designed Stage 1 (a walkable proof, behind ?sample=1). Nothing here is random: every wall, stair and door is placed by number.
// Plan (360 m across, x east, z south, the Court at the origin, all measures in metres):
//   The Court: a square floor 90 m across at height 3, an obelisk 14 m tall in the exact middle, a gold boss ring round it, nothing else on the floor. Its wall is 3 m thick and 6 m high.
//   Spawn Terrace (south) and Gate Steps (north): raised 4 m (height 7). A 20 m wide straight stair (8 steps of 0.5 m) joins each to the Court, with a low parapet along the terrace edge,
//   a gateway frame (two posts and a lintel) over the stair mouth, paired braziers on the stair walls, two statues 10 m tall flanking Gate Steps, the free chest at the top of the spawn stair, the gate at the far end.
//   Ring road: a square road 12 m wide, 128 to 140 m from the centre, reached from each terrace through a 14 m gateway and a second stair. The six outer rooms (Market Street, The Grove, The Quarry, Sunken Yard and two more)
//   are not built yet: their openings are shut with a plain wall and a framed door.
// The same 400 x 400 heightfield serves the sim (collision) and the view (the mesh). drawH is the height the view draws where a prop (a statue, a post, the obelisk) stands on cells that block the duelist: the prop is drawn by hand there.
const SIM = 400, HALF = 200, WALL = 99;
const F = { RAMP: 8, ARENA: 256, SPAWNB: 512, SOLID: 4096 };
export const SAMPLE_KEY = 'sample-sunken-court-1';
const r2 = v => Math.round(v * 100) / 100;

export function sampleMap() {
  const H = new Float32Array(SIM * SIM).fill(WALL), D = new Float32Array(SIM * SIM).fill(WALL), Fl = new Uint16Array(SIM * SIM), R = new Uint8Array(SIM * SIM).fill(255), props = [];
  // a block of cells: x0 to x1 and z0 to z1 in metres (west and north edges inclusive), standing height h
  const paint = (x0, x1, z0, z1, h, fl, reg) => { for (let v = z0; v < z1; v++) for (let u = x0; u < x1; u++) { const k = (v + HALF) * SIM + u + HALF; H[k] = h; D[k] = h; Fl[k] = fl || 0; if (reg !== undefined) R[k] = reg; } };
  // a prop's footprint: the duelist cannot enter (top), the view draws the floor and the prop itself
  const solid = (x0, x1, z0, z1, top, floor) => { for (let v = z0; v < z1; v++) for (let u = x0; u < x1; u++) { const k = (v + HALF) * SIM + u + HALF; H[k] = top; D[k] = floor; Fl[k] |= F.SOLID; } };
  const flag = (x0, x1, z0, z1, bit) => { for (let v = z0; v < z1; v++) for (let u = x0; u < x1; u++) Fl[(v + HALF) * SIM + u + HALF] |= bit; };

  // ring road, its two walls, the voids between, the Court and its wall
  paint(-143, 143, -143, 143, 9, F.SOLID, 3);
  paint(-140, 140, -140, 140, 3, 0, 3);
  paint(-128, 128, -128, 128, 9, F.SOLID, 3);
  paint(-125, 125, -125, 125, 11, F.SOLID, 255);                   // the six outer rooms are not built: one closed mass, 8 m above the Court
  paint(-48, 48, -48, 48, 9, F.SOLID, 0);
  paint(-45, 45, -45, 45, 3, 0, 0);

  // the two halves: s = +1 the Spawn Terrace (south), s = -1 Gate Steps (north)
  for (const s of [1, -1]) {
    const Z = (a, b) => (s > 0 ? [a, b] : [-b, -a]), P = (x0, x1, a, b, h, fl, reg) => { const q = Z(a, b); paint(x0, x1, q[0], q[1], h, fl, reg); };
    const S = (x0, x1, a, b, top, floor) => { const q = Z(a, b); solid(x0, x1, q[0], q[1], top, floor); };
    const plat = s > 0 ? 1 : 2;
    P(-43, 43, 63, 111, 13, F.SOLID, plat);                          // the platform's wall, 6 m above its floor
    P(-40, 40, 66, 108, 7, 0, plat);                                 // its floor, 4 m above the Court
    P(-43, 43, 63, 66, 8.2, F.SOLID, plat);                          // the low parapet along the edge facing the Court (1.2 m above the floor)
    // the stair between the Court and the platform: 20 m wide, 8 steps of 0.5 m, 2 m each; the mouth cuts the Court wall
    P(-10, 10, 45, 48, 3, 0, 4);
    for (let k = 1; k <= 8; k++) P(-10, 10, 48 + 2 * (k - 1), 48 + 2 * k, 3 + 0.5 * k, F.RAMP, 4);
    P(-10, 10, 64, 66, 7, 0, 4);
    for (let k = 1; k <= 8; k++) { const a = 48 + 2 * (k - 1), b = 48 + 2 * k, t = 3 + 0.5 * k + 2.5; P(-13, -10, a, b, t, F.SOLID, 4); P(10, 13, a, b, t, F.SOLID, 4); }
    P(-13, -10, 64, 66, 9.5, F.SOLID, 4); P(10, 13, 64, 66, 9.5, F.SOLID, 4);
    // the back gateway, 14 m, and the second stair down to the ring road
    P(-7, 7, 108, 111, 7, 0, 5);
    for (let k = 1; k <= 8; k++) { const a = 111 + 2 * (k - 1), b = 111 + 2 * k, f = 7 - 0.5 * k; P(-7, 7, a, b, f, F.RAMP, 5); P(-10, -7, a, b, f + 2.5, F.SOLID, 5); P(7, 10, a, b, f + 2.5, F.SOLID, 5); }
    P(-7, 7, 127, 128, 3, 0, 5); P(-10, -7, 127, 128, 5.5, F.SOLID, 5); P(7, 10, 127, 128, 5.5, F.SOLID, 5);
    props.push({ t: 'frame', x: 0, z: s * 46.5, y: 9, along: 'x', w: 20, ph: 3.5, pw: 2.6, pd: 3.4 });          // over the stair mouth, on the Court wall
    props.push({ t: 'frame', x: 0, z: s * 109.5, y: 13, along: 'x', w: 14, ph: 3.5, pw: 2.6, pd: 3.4 });        // over the back gateway
    props.push({ t: 'frame', x: 0, z: s * 126.5, y: 9, along: 'x', w: 14, ph: 3.5, pw: 2.6, pd: 3.4 });         // over the ring road end of the second stair
    for (const k of [2, 5, 8]) { const z = s * (48 + 2 * (k - 1) + 1); for (const x of [-11.5, 11.5]) props.push({ t: 'brazier', x, z, y: 3 + 0.5 * k + 2.5 }); }       // braziers in pairs up the stair walls
  }
  // the gate: two pylons, a lintel and a sealed door at the far end of Gate Steps; the free chest and the broker stand on the Spawn Terrace
  solid(-10, -6, -102, -98, 19, 7); solid(6, 10, -102, -98, 19, 7); solid(-6, 6, -104, -103, 15, 7);
  flag(-20, 20, -106, -86, F.ARENA); flag(-6, 6, 88, 96, F.SPAWNB);
  props.push({ t: 'gate', x: 0, z: -100, y: 7 });
  // the Court: the obelisk (plinth in three steps, shaft 14 m tall), the boss ring, two statues 10 m tall at the mouth of Gate Steps
  solid(-5, 5, -5, 5, 3.5, 3); solid(-4, 4, -4, 4, 4, 3); solid(-3, 3, -3, 3, 4.5, 3); solid(-2, 2, -2, 2, 17, 3);
  props.push({ t: 'obelisk', x: 0, z: 0, y: 3 }, { t: 'ring', x: 0, z: 0, y: 3, r0: 18.6, r1: 20.2 }, { t: 'ring', x: 0, z: 0, y: 3, r0: 27.6, r1: 28.2 });
  for (const x of [-17, 17]) { solid(x - 2, x + 2, -42, -38, 13, 3); props.push({ t: 'statue', x, z: -40, y: 3, face: 1 }); }
  // the six shut gateways on the Court wall and on the ring road's inner wall: a framed door, the wall stays
  const shut = (x, z, along, nx, nz, floor) => {            // (x, z) is the centre of the opening on the wall face; (nx, nz) points out of the wall into the open space
    props.push({ t: 'door', x, z, y: floor, along, nx, nz, w: 14 });
    const ps = [-8, 8];
    for (const o of ps) { const px = along === 'x' ? x + o : x + (nx > 0 ? 0 : -1), pz = along === 'x' ? z + (nz > 0 ? 0 : -1) : z + o;
      if (along === 'x') solid(px - 1, px + 1, pz, pz + 1, floor + 9, floor); else solid(px, px + 1, pz - 1, pz + 1, floor + 9, floor); }
    props.push({ t: 'shutframe', x, z, y: floor, along, nx, nz, w: 14 });
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) shut(sx * 30, sz * 45, 'x', 0, -sz, 3);
  shut(-45, 0, 'z', 1, 0, 3); shut(45, 0, 'z', -1, 0, 3);
  // the same on the ring road side: the inner wall's outer face is at 128
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) shut(sx * 70, sz * 128, 'x', 0, sz, 3);
  shut(-128, 0, 'z', -1, 0, 3); shut(128, 0, 'z', 1, 0, 3);

  // rooms (floor tints), the spawn and the gate, what the HUD and the minimap need
  const roomOf = new Uint8Array(200 * 200).fill(255);
  for (let cz = 0; cz < 200; cz++) for (let cx = 0; cx < 200; cx++) roomOf[cz * 200 + cx] = R[(cz * 2 + 1) * SIM + cx * 2 + 1];
  const encounters = [
    { type: 'cchest', x: -11.5, z: 70.5, y: 7, free: true },        // the free chest at the top of the spawn stair
    { type: 'broker', x: 30.5, z: 92.5, y: 7 },
    { type: 'cchest', x: -30.5, z: -96.5, y: 7 },
    { type: 'shrine', x: 134.5, z: 0.5, y: 3 },
    { type: 'cchest', x: -134.5, z: 0.5, y: 3 }
  ];
  const districts = [
    { id: 0, name: 'Spawn Terrace', gate: false, cx: 0, cz: 88, r: 34, short: 'SPT', color: '#f3e3c2' },
    { id: 1, name: 'The Court', gate: false, cx: 0, cz: 0, r: 45, short: 'CRT', color: '#f3e3c2' },
    { id: 2, name: 'Gate Steps', gate: true, cx: 0, cz: -88, r: 34, short: 'GTS', color: '#f3e3c2' }
  ];
  const landmarks = [{ type: 'obelisk', x: 0, z: 0, base: 3, top: 17, mega: true, hero: true }];
  const main = [[0, 96], [0, 64], [0, 0], [0, -64], [0, -96]];
  return {
    key: SAMPLE_KEY, hash: 'sample01', sealCode: 'SUNKEN-COURT', stage: 0, attempt: 0, fallback: false, half: HALF, v2: true, sample: true, n: 360, off: 20,
    prims: [], heights: H, drawH: D, cellFlags: Fl, palette: undefined, stageName: 'The Sunken Court',
    districts, spawn: { x: 0.5, z: 94.5 }, gate: { x: 0.5, z: -97.5, radius: 5.5 }, arena: { center: { x: 0.5, z: -92.5 }, boss: { x: 0.5, z: -92.5 }, tollPull: { x: 0.5, z: -90.5 } },
    bossRings: [{ x: 0.5, z: 0.5, r: 14, y: 3 }], encounters, landmarks, kits: [], props, rooms: [], roomOf, gateways: [],
    roomTint: [0xe9d9a8, 0xd8a868, 0xb9a3a8, 0xc6b08a, 0xe9d9a8, 0xc6b08a], roomTintK: 0.34,
    _road: { main: main.map(p => [r2(p[0]), r2(p[1])]), trails: [], width: 4.5, trailWidth: 3 }, _pools: [],
    report: { genVersion: 'sample', v2: true, attempt: 0, fallback: false }
  };
}
