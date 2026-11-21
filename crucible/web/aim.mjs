// Which monsters a card played on its own may be aimed at, for the page's target picking.
// Returns { side, zones } (side 0 is the player's own row, 1 the rival's) or null when the card takes no target.
// The engine falls back to the strongest monster when no target is sent (castSpell and the Equip branch of doPlay).
import { roleOf } from '../engine/cards.mjs';
const RIVAL = ['destroy', 'bounce', 'weaken', 'position'];
export function aimFor(db, duel, id) {
  const role = roleOf(db, id), tag = db.tagOf.get(id);
  const side = role === 'equip' ? 0 : role === 'spell' && tag && tag.fx === 'pump' ? 0 : role === 'spell' && tag && RIVAL.includes(tag.fx) ? 1 : -1;
  if (side < 0) return null;
  const zones = []; duel.mon[side].forEach((m, z) => { if (m) zones.push(z); });
  return zones.length ? { side, zones } : null;
}
