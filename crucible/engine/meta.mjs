// What a player keeps between runs of Lost Memories: Memories (a currency every run pays,
// win or lose), the Codex of melds found, unlocked Forgers, Heat levels and relics bought
// in the Memory Vault. Pure functions over a plain profile object. Unlocks add variety,
// never a stronger start.
import { RELICS } from './relics.mjs';
import { FORGERS } from './forgers.mjs';

export const MAX_HEAT = 5;
// Relics a new profile cannot be offered until bought in the Vault.
export const VAULT = [
  { id: 'tomb_bell', price: 20 }, { id: 'glass_idol', price: 20 }, { id: 'tinder_vow', price: 20 },
  { id: 'spare_wire', price: 20 }, { id: 'deep_pockets', price: 25 }, { id: 'second_wind', price: 25 },
  { id: 'living_furnace', price: 40 }, { id: 'unseen_hand', price: 40 }, { id: 'signature', price: 40 },
];
// Forgers are earned by feats, not bought.
export const FORGER_FEATS = {
  tarn: { text: 'Yours from the start.', test: () => true },
  scrapper: { text: 'Finish one run, win or lose.', test: p => p.runs >= 1 },
  veil: { text: 'Beat a floor guardian.', test: p => p.bossWins >= 1 },
  storm: { text: 'Reach the third floor.', test: p => p.bestFloor >= 2 },
};

export function newProfile() {
  return { v: 1, memories: 0, earned: 0, runs: 0, clears: 0, duelWins: 0, bossWins: 0, bestFloor: 0, heatCleared: -1, forgers: ['tarn'], bought: [], codex: [], seen: [] };
}
export const lockedRelics = p => VAULT.map(v => v.id).filter(id => !p.bought.includes(id));
export const maxHeat = p => Math.min(MAX_HEAT, p.heatCleared + 1);

// What a finished run pays. Does not change the profile.
export function scoreRun(p, run) {
  const S = run.stats, lines = [];
  const add = (label, n) => { if (n > 0) lines.push([label, n]); };
  add('Duels won', S.wins);
  add('Guardians beaten', S.bossWins * 10);
  add('S ranks', (S.ranks.S || 0) * 3);
  const known = new Set(p.codex);
  const fresh = run.codex.filter(k => !known.has(k));
  add('New melds in the Codex', Math.min(20, fresh.length));
  const floor = run.result && run.result.won ? 3 : run.floor;
  add('Deeper than ever before', Math.max(0, floor - p.bestFloor) * 8);
  if (run.result && run.result.won) add('The pyramid cleared', 30);
  const base = lines.reduce((n, l) => n + l[1], 0);
  const heat = Math.round(base * 0.2 * (run.heat || 0));
  add('Heat ' + (run.heat || 0), heat);
  return { lines, total: base + heat, fresh, floor };
}

// Banks a finished run into the profile and returns what it paid and what it unlocked.
export function applyRun(p, run) {
  if (run.phase !== 'over') throw new Error('the run is not over');
  const r = scoreRun(p, run);
  p.memories += r.total; p.earned += r.total; p.runs++;
  p.duelWins += run.stats.wins; p.bossWins += run.stats.bossWins; p.bestFloor = Math.max(p.bestFloor, r.floor);
  for (const k of r.fresh) p.codex.push(k);
  const unlocks = [];
  if (run.result.won) { p.clears++; const h = run.heat || 0; if (h > p.heatCleared) { p.heatCleared = h; if (h < MAX_HEAT) unlocks.push({ kind: 'heat', id: h + 1, name: 'Heat ' + (h + 1), text: 'A harder descent that pays more Memories.' }); } }
  for (const id of Object.keys(FORGER_FEATS)) if (!p.forgers.includes(id) && FORGER_FEATS[id].test(p)) { p.forgers.push(id); unlocks.push({ kind: 'forger', id, name: FORGERS[id].name, text: FORGERS[id].tag + '. ' + FORGERS[id].powerText }); }
  return { ...r, unlocks };
}

export function buy(p, id) {
  const item = VAULT.find(v => v.id === id);
  if (!item) throw new Error('not in the Vault');
  if (p.bought.includes(id)) throw new Error('already yours');
  if (p.memories < item.price) throw new Error('not enough Memories');
  p.memories -= item.price; p.bought.push(id);
  return { id, name: RELICS[id].name };
}
