// The streamed world's per-tick upkeep: load the 64 m terrain chunks round the duelist (nearest first, one a tick), make the solid props of the near cells, and hand the sim the things each 256 m cell holds
// (a pocket to do, vases, a boss ring) the first time the duelist comes within about 420 m of it. Nothing here changes the answer to a question: heights and props are the same whether or not they were loaded early.
import { heightAt, streamTo } from './terrain.js';
import { placeObject } from './world.js';
import { E_VASE_HP } from './streamcfg.js';

const Q = 256, REACH = 420;
// kinds the sim has only one of: a second one of those becomes a stone, so a pocket is never empty
export function streamWorld(g, max) {
  const m = g.map; if (!m || !m.big || !g.world) return;
  const p = g.p; streamTo(p.x, p.z, max === undefined ? 1 : max, 6);
  if (g.colliders && g.colliders.ensure) g.colliders.ensure(p.x - 120, p.z - 120, p.x + 120, p.z + 120);
  const qx = Math.floor(p.x / Q), qz = Math.floor(p.z / Q); if (g._sq === qx * 100000 + qz && !g._sqForce) return; g._sq = qx * 100000 + qz; g._sqForce = false;
  if (!g.streamed) g.streamed = new Set();
  const r = Math.ceil(REACH / Q);
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    const cx = qx + i, cz = qz + j, key = (cx + 128) * 512 + (cz + 128); if (g.streamed.has(key)) continue;
    const C = m.cell(cx, cz), x0 = cx * Q, z0 = cz * Q; if (Math.max(0, Math.abs(p.x - x0 - Q / 2) - Q / 2) ** 2 + Math.max(0, Math.abs(p.z - z0 - Q / 2) - Q / 2) ** 2 > REACH * REACH) continue;
    g.streamed.add(key); placeCell(g, m, C);
  }
}
const put = (g, m, type, x, z, extra) => { const y = heightAt(x, z); if (y >= 50) return null; return placeObject(g, type, Object.assign({ x, y, z }, extra)); };
function placeCell(g, m, C) {
  const W = g.world;
  for (const b of C.blocks) if (!m.blocks.includes(b)) m.blocks.push(b);
  if (C.ring) { const y = heightAt(C.ring.x, C.ring.z); m.bossRings.push({ x: C.ring.x, z: C.ring.z, r: 14, y }); }
  for (const pk of C.pockets) {
    let kind = pk.type;
    if (kind === 'altar' && W.altar) kind = 'stone'; if (kind === 'broker' && (W.broker || (g.oaths && g.oaths.pauper))) kind = 'shrine';
    if (kind === 'vases') vases(g, pk); else put(g, m, kind, pk.x, pk.z, kind === 'cchest' ? { free: ((Math.floor(pk.x * 7 + pk.z * 13) % 10) + 10) % 10 < 7 } : kind === 'shrine' && pk.type !== 'shrine' ? { form: 'stand' } : undefined);       // a shrine standing in for a broker has no course: stand in it       // seven chests in ten are free, the rest cost coins
    m.encounters.push({ type: kind, x: pk.x, z: pk.z });
  }
  for (const e of C.extras) vases(g, e);
}
function vases(g, v) {
  for (const [dx, dz, banded] of v.vases) { const x = v.x + dx, z = v.z + dz, y = heightAt(x, z); if (y >= 50) continue; g.world.vases.push({ x, y, z, alive: true, banded: !!banded, hp: E_VASE_HP }); }
}
