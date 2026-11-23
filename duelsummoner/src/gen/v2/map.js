// StageMap container, cell flags and small shared helpers.
export const NONE = -32768;
export const F = {
  WALK: 1, RIM: 2, CLIFF: 4, RAMP: 8, GULLY: 16, PONLY: 32, DECK: 64, LANE: 128,
  ARENA: 256, SPAWNB: 512, SAFE: 1024, PIT: 2048, SOLID: 4096, CHUNK: 8192, SLIDE: 16384, ENTRY: 32768,
};
export const FLAG_NAMES = Object.keys(F);

export function createMap(N) {
  const n = N * N;
  return {
    N,
    h0: new Int16Array(n),
    h1: new Int16Array(n).fill(NONE),
    flags: new Uint16Array(n),
    reg: new Uint8Array(n).fill(255),
    mask1: new Uint8Array(n),       // 0 outside, 1 rim, 2 playable
    nodetail: new Uint8Array(n),
    ramps: [], hopstairs: [], gullies: [], chunks: [], slots: [], jumps: [], landmarks: [], dynamic: [], instances: [],
  };
}

export const idx = (m, x, z) => z * m.N + x;
export const inb = (m, x, z) => x >= 0 && z >= 0 && x < m.N && z < m.N;
export const isWalk = (m, i) => (m.flags[i] & F.WALK) !== 0;
export const cm = (cell) => cell * 100 + 50;          // cell index -> centre in cm
export const cellOf = (cmv) => Math.floor(cmv / 100); // cm -> cell index

// Recompute WALK from the structural flags.
export function refreshWalk(m) {
  const { flags, mask1 } = m;
  for (let i = 0; i < flags.length; i++) {
    const ok = mask1[i] === 2 && !(flags[i] & (F.SOLID | F.PIT));
    flags[i] = ok ? flags[i] | F.WALK : flags[i] & ~F.WALK;
  }
}

export function snapshot(m) {
  return { h0: m.h0.slice(), h1: m.h1.slice(), flags: m.flags.slice(), chunks: m.chunks.length, slots: m.slots.length, jumps: m.jumps.length,
    ramps: m.ramps.length, hopstairs: m.hopstairs.length, extra: JSON.stringify(m.extraStairs || []), slotList: m.slots.slice(), jumpList: m.jumps.slice(), removed: m.chunks.map((c) => !!c.removed) };
}
export function restore(m, s) {
  m.h0.set(s.h0); m.h1.set(s.h1); m.flags.set(s.flags);
  m.chunks.length = s.chunks; m.slots = s.slotList; m.jumps = s.jumpList; m.chunks.forEach((c, k) => { c.removed = s.removed[k]; }); m.ramps.length = s.ramps; m.hopstairs.length = s.hopstairs;
  m.extraStairs = JSON.parse(s.extra);
}

// Heightfield line of sight between two cells with eye heights (cm). Integer DDA.
export function los(m, x0, z0, e0, x1, z1, e1) {
  const N = m.N, h = m.h0; const dx = x1 - x0, dz = z1 - z0; const steps = Math.max(Math.abs(dx), Math.abs(dz));
  for (let k = 1; k < steps; k++) {
    const x = x0 + Math.round((dx * k) / steps), z = z0 + Math.round((dz * k) / steps);
    if (x < 0 || z < 0 || x >= N || z >= N) return false;
    const line = e0 + Math.trunc(((e1 - e0) * k) / steps);
    if (h[z * N + x] > line) return false;
  }
  return true;
}

