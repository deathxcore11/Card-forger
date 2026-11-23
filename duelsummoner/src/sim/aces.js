// Ace monsters. A swarm enemy that is marked an Ace is bigger and tougher; when one falls it pays more and may drop a Trophy Chest. Every roll uses the run's loot stream,
// so the same seed and the same inputs always give the same Trophy Chests and replays still verify.
import { ACES } from '../data/stages.js';
import { dropPickup, PICK_XP, PICK_COIN } from './combat.js';

export const aliveAces = g => { const e = g.en; let n = 0; for (let i = 0; i < e.max; i++) if (e.alive[i] && e.ace[i]) n++; return n; };
export function trophyChance(g) { const T = ACES.trophy; return Math.max(T.min, T.first - T.decay * (g.trophies || 0)); }
export function aceFell(g, x, y, z) {
  g.acesDown = (g.acesDown || 0) + 1; dropPickup(g, PICK_XP, x, y, z, ACES.xp); for (let k = 0; k < ACES.coins; k++) dropPickup(g, PICK_COIN, x + 0.7 * (k - 1), y, z + 0.4);
  if (g.rl() < trophyChance(g)) {
    let r = g.rl(), rarity = ACES.rarity[0][0]; for (const [name, p] of ACES.rarity) { if (r < p) { rarity = name; break; } r -= p; }
    g.world.cchests.push({ x, y, z, open: false, rarity, free: true, trophy: true }); g.trophies = (g.trophies || 0) + 1;
    g.event('banner', 'An Ace falls: a Trophy Chest drops.'); g.emit('trophy', x, y, z);
  }
}
