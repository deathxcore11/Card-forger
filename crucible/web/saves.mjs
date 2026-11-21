// What counts as a stored run or profile the page can use. Pure functions, so the rule tests can run them on every
// state a real run passes through and on saves damaged on purpose.
// A stored value that fails here is set aside under "<key>.unreadable" by the page: it is never played and never banked.
// These checks ask only for what the page and the banking code read. Fields a later build adds are let through.

const num = Number.isFinite;
const obj = x => !!x && typeof x === 'object' && !Array.isArray(x);

export const PHASES = ['kit', 'charm', 'chamber', 'duel', 'reward', 'anvil', 'bazaar', 'over'];
export const DOOR_TYPES = ['duel', 'cursed', 'champion', 'guardian', 'boss', 'anvil', 'bazaar', 'sanctum', 'omen', 'treasure', 'mystery', 'secret', 'onward'];

export const okProfile = s => obj(s) && num(s.memories) && Array.isArray(s.codex) && Array.isArray(s.forgers) && Array.isArray(s.bought);

// Returns '' for a run that can be used, otherwise a few words on what is wrong with it (for the tests and the log).
export function runFault(db, s) {
  if (!obj(s)) return 'not a run';
  if (!PHASES.includes(s.phase)) return 'unknown phase';
  for (const k of ['floor', 'chamber', 'sparks', 'embers', 'level']) if (!num(s[k])) return k + ' is not a number';
  if (s.floor < 0 || s.floor >= db.config.floors) return 'no such floor';
  const cards = a => Array.isArray(a) && a.every(c => obj(c) && db.byId.has(c.id));
  if (!cards(s.deck)) return 'the deck holds something that is not a card';
  if (!cards(s.trunk)) return 'the trunk holds something that is not a card';
  for (const k of ['charms', 'gifts', 'codex']) if (!Array.isArray(s[k])) return k + ' is not a list';
  const S = s.stats;
  if (!obj(S) || !num(S.wins) || !num(S.bossWins) || !num(S.duels) || !obj(S.ranks)) return 'the tallies are missing';
  switch (s.phase) {
    case 'kit': if (!Array.isArray(s.offer) || !s.offer.length) return 'no kits to choose from'; break;
    case 'charm': case 'reward': case 'anvil': case 'bazaar': if (!obj(s.offer)) return 'nothing on offer'; break;
    case 'chamber':
      if (!Array.isArray(s.doors) || !s.doors.length) return 'no doors';
      if (!s.doors.every(d => obj(d) && DOOR_TYPES.includes(d.type))) return 'a door to no known room';
      break;
    case 'duel': {
      const d = s.duel;
      if (!obj(d) || !obj(s.rival)) return 'no duel';
      for (const k of ['lp', 'hand', 'mon', 'deck']) if (!Array.isArray(d[k]) || d[k].length !== 2) return 'the duel has no ' + k;
      if (!d.lp.every(num) || !d.hand.every(Array.isArray) || !d.mon.every(Array.isArray) || !d.deck.every(Array.isArray)) return 'the duel is incomplete';
      if (!d.hand.every(h => h.every(c => obj(c) && db.byId.has(c.id)))) return 'the hand holds something that is not a card';
      break;
    }
    case 'over':
      if (!obj(s.result) || typeof s.result.won !== 'boolean') return 'no result';
      if (!s.result.won && typeof s.result.reason !== 'string') return 'no reason for the loss';
      break;
  }
  return '';
}
export const okRun = (db, s) => runFault(db, s) === '';
