// The 64-bit state hash (two FNV-style 32-bit lanes) over the deterministic state. Used by the golden traces and by replay verification.
const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
export class H {
  constructor() { this.a = 0x811C9DC5 | 0; this.b = 0x9747B28C | 0; }
  u(x) { this.a = Math.imul(this.a ^ x, 16777619); this.b = Math.imul(this.b ^ (x + 0x9E3779B9 | 0), 0x85EBCA6B); this.b ^= this.b >>> 13; }
  n(v) { f64[0] = v; this.u(u32[0]); this.u(u32[1]); }
}
export function stateHash(g, h = new H()) {
  const p = g.p;
  h.u(g.tickN); h.n(g.t); h.n(p.x); h.n(p.y); h.n(p.z); h.n(p.hp); h.u(g.kills); h.u(g.coins | 0); h.n(g.xp); h.u(g.level); h.u(g.over ? 1 : 0); h.u(g.offer ? 1 : 0);
  const e = g.en; let c = 0, sx = 0, sz = 0, sh = 0;
  for (let i = 0; i < e.max; i++) if (e.alive[i]) { c++; sx += e.x[i]; sz += e.z[i]; sh += e.hp[i]; }
  h.u(c); h.n(sx); h.n(sz); h.n(sh);
  const m = g.pick; c = 0; sx = 0; sz = 0;
  for (let i = 0; i < m.max; i++) if (m.alive[i]) { c++; sx += m.x[i]; sz += m.z[i]; }
  h.u(c); h.n(sx); h.n(sz);
  for (const s of g.sp) { h.n(s.x); h.n(s.z); h.n(s.hp); h.u(s.alive ? 1 : 0); }
  for (const f of g.field.monsters) h.u(f ? f.level + 1 : 0);
  h.u(g.fusions); h.u(g.chests.length);
  const st = g.streams; h.u(st.spawn.s); h.u(st.loot.s); h.u(st.combat.s); h.u(st.cosmetic.s);
  return h;
}
export const hashHex = g => { const h = stateHash(g); return (h.a >>> 0).toString(16).padStart(8, '0') + (h.b >>> 0).toString(16).padStart(8, '0'); };
