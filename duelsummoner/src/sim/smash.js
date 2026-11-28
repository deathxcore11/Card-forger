// A world that answers back. Natural props (rocks, trees, bones) and camp pieces are solid until something hits them hard enough:
// the card ridden through at speed, a summon's blast, swipe or bolt. A smashed prop stops being solid, throws the enemies beside it, and drops a little XP (sometimes a coin).
// The view hears 'smash' (kind, x, z) and takes the prop off the map in a burst of its own blocks.
import { smashNear } from './colliders.js';
import { dropPickup, PICK_COIN, PICK_XP } from './combat.js';
import { knock } from './fusion.js';
export function smashProps(g, x, z, r) {
  if (!g.colliders || !g.colliders.big) return 0;
  return smashNear(g.colliders, x, z, r, c => {
    g.propsBroken = (g.propsBroken || 0) + 1; g.emit('smash', c.brk, c.x, c.z);
    dropPickup(g, PICK_XP, c.x, c.y, c.z, 1); if (g.rl() < (c.brk === 3 ? 0.6 : 0.25)) dropPickup(g, PICK_COIN, c.x + 0.6, c.y, c.z);
    const e = g.en; for (let i = 0; i < e.max; i++) { if (!e.alive[i]) continue; const dx = e.x[i] - c.x, dz = e.z[i] - c.z; if (dx * dx + dz * dz < 9) knock(g, i, dx, dz, 7); }       // the pieces fly: enemies beside it are thrown back
  });
}
