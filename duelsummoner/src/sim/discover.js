// Discovery in the big desert: a banner names each region the first time you walk into it, and reaching a far landmark (a tall mesa, a spire, a giant card) for the first time pays at once:
// a burst of XP, a handful of coins and a rare pickup at your feet, and its name. Landmarks are seen from kilometres away, so this is the reason to walk to the thing on the horizon.
import { dropPickup } from './combat.js';
import { rollRare } from './powerups.js';
export const DISCOVER = { landmarkR: 40, xp: 18, xpPerLevel: 2, coins: 25, every: 30 };
export function discoverTick(g) {
  const m = g.map; if (!m || !m.big || (g.tickN % DISCOVER.every) !== 0) return; const p = g.p;
  const rid = m.regionId(p.x, p.z); if (g.regionNow !== rid) { const first = g.regionNow !== undefined; g.regionNow = rid; const seen = g.regionsSeen || (g.regionsSeen = new Set()); if (!seen.has(rid)) { seen.add(rid); if (first) g.event('bannerdrop', m.regionLabel(p.x, p.z)); } }
  const LC = 1100, lx0 = Math.floor(p.x / LC), lz0 = Math.floor(p.z / LC), found = g.landmarksFound || (g.landmarksFound = new Set());
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const lx = lx0 + i, lz = lz0 + j, b = m.landmark(lx, lz); if (!b) continue; const key = lx * 4096 + lz; if (found.has(key)) continue;
    const R = Math.max(b.rx, b.rz) + DISCOVER.landmarkR; if ((b.cx - p.x) * (b.cx - p.x) + (b.cz - p.z) * (b.cz - p.z) > R * R) continue;
    found.add(key); g.addXp(DISCOVER.xp + DISCOVER.xpPerLevel * g.level); g.coins += DISCOVER.coins; const k = rollRare(g); if (k) dropPickup(g, k, p.x, p.y, p.z + 1.2);
    g.event('bannerdrop', 'You reached ' + m.landmarkLabel(b, lx, lz)); g.emit('landmark', p.x, p.z, 0);
  }
}
