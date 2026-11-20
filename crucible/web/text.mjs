// The words the player reads for what a card does in Lost Memories. Shared by the page (app.mjs) and by the
// tool that writes the game pack (tools/crucible/make-pack.mjs), so the two always say the same thing.
import { roleOf } from '../engine/cards.mjs';

export const FX_TEXT = { burn: n => n < 0 ? 'The attacker\'s ATK hits its owner. The attack stops.' : `Rival loses ${n} Life Points.`, heal: n => n < 0 ? 'Gain Life Points equal to the attacker\'s ATK.' : `Gain ${n} Life Points.`, destroy: () => 'Destroy one rival monster.', destroyAll: n => n === 1 ? 'Destroy every monster on both sides.' : 'Destroy every rival monster.', bounce: () => 'Return one rival monster to its hand.', pump: n => `One of your monsters gets +${n} ATK and DEF this duel.`, weaken: n => `One rival monster gets -${n} ATK and DEF this duel.`, draw: n => `Draw ${n}.`, flip: () => 'Turn every veiled rival monster face up.', freeze: n => n ? `Rival monsters cannot attack for ${n} of their turns.` : 'The attack stops and the rival cannot attack again this turn.', position: () => 'Turn one rival monster to its other position.', revive: () => 'Return your strongest monster from the graveyard to the table.' };
// A Trap answers one attack, so its wording names the attacker.
export const TRAP_TEXT = { burn: n => n < 0 ? 'The attacker\'s ATK hits its owner. The attack stops.' : `The rival loses ${n} Life Points. The attack goes on.`, heal: n => n < 0 ? 'Gain Life Points equal to the attacker\'s ATK.' : `Gain ${n} Life Points.`, destroy: () => 'Destroy the attacking monster.', destroyAll: () => 'Destroy every rival monster in attack position.', bounce: () => 'Return the attacking monster to its hand. The attack stops.', pump: n => `Your attacked monster gets +${n} ATK and DEF this duel.`, weaken: n => `The attacking monster gets -${n} ATK and DEF this duel.`, draw: n => `Draw ${n}.`, flip: () => 'Turn every veiled rival monster face up.', freeze: n => n ? `The attack stops. The rival cannot attack again this turn, or on ${n === 1 ? 'their next turn' : 'their next ' + n + ' turns'}.` : 'The attack stops and the rival cannot attack again this turn.', position: () => 'Turn the attacking monster to defense. The attack stops.', revive: () => 'Return your strongest monster from the graveyard to the table, in defense.' };

export const FX_SHORT = { burn: n => n < 0 ? 'Turns the attack back on its owner' : `Rival loses ${n} LP`, heal: n => n < 0 ? 'Gain LP equal to the attacker' : `Gain ${n} LP`, destroy: () => 'Destroy 1 rival monster', destroyAll: n => n === 1 ? 'Destroy all monsters' : 'Destroy all rival monsters', bounce: () => 'Return 1 rival monster to hand', pump: n => `Your monster +${n}`, weaken: n => `Rival monster -${n}`, draw: n => `Draw ${n}`, flip: () => 'Reveal veiled rivals', freeze: n => n ? `Rivals cannot attack, ${n} turns` : 'Stops the attack', position: () => 'Turn 1 rival monster', revive: () => 'Revive your strongest' };
export function shortText(db, id) {
  const role = roleOf(db, id);
  if (role === 'field') { const f = db.fieldOf.get(id); return '+500 ' + (f.attr ? f.attr : [...f.types].join(', ')); }
  if (role === 'equip') return 'Your monster +500';
  if (role === 'spell' || role === 'trap') { const t = db.tagOf.get(id); return (role === 'trap' ? 'On attack: ' : '') + FX_SHORT[t.fx](t.n); }
  return 'Meld fuel +300';
}
export function rulesText(db, id) {
  const role = roleOf(db, id);
  if (role === 'monster') return 'Fights with its printed ATK and DEF. Printed effects are not used in Lost Memories.';
  if (role === 'field') { const f = db.fieldOf.get(id); return 'Terrain: ' + (f.attr ? f.attr + ' monsters' : [...f.types].join(', ')) + ' get +500 ATK and DEF. Both sides.'; }
  if (role === 'equip') return 'Attach to one of your monsters: +500 ATK and DEF this duel.';
  if (role === 'spell') { const t = db.tagOf.get(id); return 'Spell: ' + FX_TEXT[t.fx](t.n); }
  if (role === 'trap') { const t = db.tagOf.get(id); return 'Trap, set face down. Springs when the rival attacks: ' + TRAP_TEXT[t.fx](t.n); }
  return 'Fuel: meld it into any monster for +300 ATK and DEF. It cannot be played alone.';
}
